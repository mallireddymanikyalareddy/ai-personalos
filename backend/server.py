import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel, Field, StrictBool
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import digest  # noqa: E402
from admin import promote_configured_admins, router as admin_router  # noqa: E402
from auth import ApiError, error_response, iso, public_user, require_auth, router as auth_router  # noqa: E402
import alerts  # noqa: E402
import credits  # noqa: E402
import entitlements  # noqa: E402
import platform_settings  # noqa: E402
import promotions  # noqa: E402
from admin_ops import router as admin_ops_router  # noqa: E402
from billing_admin import public_router as billing_public_router, router as billing_admin_router  # noqa: E402
from plan_admin import admin_router as plan_admin_router, public_router as plans_router  # noqa: E402
from billing import run_once, setup_billing  # noqa: E402
from db import db, ensure_indexes  # noqa: E402

BILLING_CODES = ("insufficient_credits", "integration_disabled", "daily_limit_reached")


async def digest_item(user: dict) -> dict:
    state = await db.app_state.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"id": user["id"], "email": user.get("email"), "displayName": user["display_name"],
            "timezone": user.get("timezone", "UTC"), "envelope": state["envelope"] if state else None}


async def claim_digest_week(user: dict) -> str | None:
    if not user or not user.get("email"):
        return None
    local = digest.local_now(user.get("timezone") or "UTC")
    if local.weekday() != 0 or local.hour < 7:
        return None
    week = digest.iso_week(local)
    claimed = await db.digest_prefs.find_one_and_update(
        {"user_id": user["id"], "enabled": True, "last_sent_week": {"$ne": week}},
        {"$set": {"last_sent_week": week}},
    )
    return week if claimed else None


async def send_weekly_digest(user: dict, previous_week: str | None) -> bool:
    """Send one digest; returns False when sending should pause (billing/limits)."""
    try:
        await digest.send_digest(await digest_item(user))
    except digest.EmailUnavailable as exc:
        logging.warning("Weekly digest not sent: %s", exc)
        if str(exc) in BILLING_CODES:
            await db.digest_prefs.update_one({"user_id": user["id"]}, {"$set": {"last_sent_week": previous_week}})
            return False
    except Exception:
        logging.exception("Weekly digest failed for %s", user["id"])
    return True


async def run_digest_pass() -> None:
    async for pref in db.digest_prefs.find({"enabled": True}, {"_id": 0}):
        user = await db.users.find_one({"id": pref["user_id"]}, {"_id": 0})
        if not await claim_digest_week(user):
            continue
        if not await send_weekly_digest(user, pref.get("last_sent_week")):
            break


async def digest_loop():
    while True:
        try:
            await run_digest_pass()
        except Exception:
            logging.exception("Digest loop error")
        await asyncio.sleep(900)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not os.environ.get("APP_URL"):
        logging.warning("APP_URL is not set; emailed links will use the browser Origin/Referer or Host header.")
    await ensure_indexes()
    await promote_configured_admins()
    await setup_billing()
    await credits.ensure_indexes()
    await entitlements.ensure_indexes()
    await promotions.ensure_indexes()
    await platform_settings.ensure_indexes()
    await platform_settings.seed_settings()
    await alerts.ensure_indexes()
    await run_once("stage8_credit_buckets", credits.backfill_credit_buckets)
    await run_once("stage8_promotion_remaining", promotions.backfill_remaining)
    await run_once("stage4_trial_credits_10", credits.backfill_trial_credits)
    await entitlements.run_due()
    await promotions.expire_due()
    tasks = [asyncio.create_task(digest_loop()), asyncio.create_task(credits.sweep_loop()),
             asyncio.create_task(entitlements.sweep_loop()), asyncio.create_task(promotions.sweep_loop()),
             asyncio.create_task(alerts.loop())]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(admin_ops_router)
app.include_router(plan_admin_router)
app.include_router(plans_router)
app.include_router(billing_admin_router)
app.include_router(billing_public_router)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if int(request.headers.get("content-length") or 0) > 26 * 1024 * 1024:
        return error_response(ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large."))
    return await call_next(request)


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return error_response(exc)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(str(p) for p in e["loc"][1:]) or "(root)", "issue": e["msg"]} for e in exc.errors()]
    return error_response(ApiError(400, "VALIDATION_FAILED", "Request failed schema validation.", errors))


@app.get("/api/health")
async def health():
    await db.command("ping")
    return {"status": "ok"}


class StateIn(BaseModel):
    envelope: dict
    baseVersion: int | None = None


@app.get("/api/v1/state")
async def get_state(auth=Depends(require_auth)):
    doc = await db.app_state.find_one({"user_id": auth[0]["id"]}, {"_id": 0})
    if not doc:
        return {"envelope": None, "version": 0}
    return {"envelope": doc["envelope"], "version": doc["version"], "updatedAt": iso(doc["updated_at"])}


MAX_STATE_BYTES = 25 * 1024 * 1024


@app.put("/api/v1/state")
async def put_state(body: StateIn, request: Request, auth=Depends(require_auth)):
    if int(request.headers.get("content-length") or 0) > MAX_STATE_BYTES:
        raise ApiError(413, "PAYLOAD_TOO_LARGE", "Your saved data is too large to sync.")
    env = body.envelope
    if not isinstance(env.get("state"), dict) or not isinstance(env.get("version"), (int, float)):
        raise ApiError(400, "VALIDATION_FAILED", "State payload failed schema validation.")
    user_id = auth[0]["id"]
    stamp = datetime.now(timezone.utc)
    update = {"$set": {"envelope": env, "updated_at": stamp}, "$inc": {"version": 1}}
    if body.baseVersion is None:
        doc = await db.app_state.find_one_and_update(
            {"user_id": user_id}, update, upsert=True, return_document=ReturnDocument.AFTER, projection={"_id": 0, "version": 1})
        return {"version": doc["version"], "updatedAt": iso(stamp)}
    match = {"user_id": user_id, "version": body.baseVersion} if body.baseVersion > 0 else {"user_id": user_id, "version": {"$exists": False}}
    try:
        doc = await db.app_state.find_one_and_update(
            match, update, upsert=body.baseVersion == 0, return_document=ReturnDocument.AFTER, projection={"_id": 0, "version": 1})
    except DuplicateKeyError:
        doc = None
    if not doc:
        current = await db.app_state.find_one({"user_id": user_id}, {"version": 1})
        return JSONResponse({"code": "CONFLICT_VERSION", "version": current["version"] if current else 0}, status_code=409)
    return {"version": doc["version"], "updatedAt": iso(stamp)}


class DigestIn(BaseModel):
    enabled: StrictBool


async def digest_pref(user: dict) -> dict:
    doc = await db.digest_prefs.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    return {"enabled": doc.get("enabled", False), "lastSentWeek": doc.get("last_sent_week"), "email": user.get("email")}


@app.get("/api/v1/digest")
async def get_digest(auth=Depends(require_auth)):
    return await digest_pref(auth[0])


@app.put("/api/v1/digest")
async def put_digest(body: DigestIn, auth=Depends(require_auth)):
    user = auth[0]
    if body.enabled and not user.get("email"):
        raise ApiError(400, "VALIDATION_FAILED", "Add an email address to your account first.")
    await db.digest_prefs.update_one({"user_id": user["id"]}, {"$set": {"enabled": body.enabled}}, upsert=True)
    return await digest_pref(user)


@app.post("/api/digest/send-now")
async def digest_send_now(request: Request):
    from auth import current_session

    found = await current_session(request)
    if not found:
        return JSONResponse({"detail": "Please sign in first"}, status_code=401)
    user = found[0]
    if not user.get("email"):
        return JSONResponse({"detail": "Add an email address to your account first"}, status_code=400)
    if not digest.allow_send_now(user["id"]):
        return JSONResponse({"detail": "You've sent a few previews already. Try again in an hour."}, status_code=429)
    try:
        await digest.send_digest(await digest_item(user))
    except digest.EmailUnavailable as exc:
        if str(exc) == "undeliverable_recipient":
            return JSONResponse({"detail": f"We couldn't deliver to {user['email']}. Check the address in your account"}, status_code=422)
        return JSONResponse({"detail": "Email is temporarily unavailable"}, status_code=503)
    except Exception:
        logging.exception("Preview digest failed")
        return JSONResponse({"detail": "Failed to send email"}, status_code=502)
    return {"status": "sent", "to": user["email"]}


SYSTEM_PROMPT = (
    "You are the AI assistant inside PersonalOS, a personal operating system for tasks, goals, habits, notes and planning. "
    "Answer concisely and practically, grounded in the user's data provided below. Use short markdown lists when helpful. "
    "Never claim you changed data; any changes are offered as proposals the user reviews separately.\n\nUSER DATA:\n"
)


class ChatTurn(BaseModel):
    role: str
    text: str


AI_ACTIONS = ("quick_question", "daily_plan", "journal_summary")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    context: str = Field(default="", max_length=20000)
    history: list[ChatTurn] = []
    action: str = "quick_question"
    requestId: str | None = Field(default=None, min_length=8, max_length=64)


def friendly_ai_error(msg: str) -> str:
    if "credits" in msg or "quota" in msg:
        return "your OpenAI account has no credits left"
    if "RateLimit" in msg:
        return "OpenAI rate limit reached, try again shortly"
    if "AuthenticationError" in msg or "API key" in msg:
        return "the OpenAI API key was rejected"
    return "the AI service failed to respond"


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/api/v1/credits")
async def my_credits(auth=Depends(require_auth)):
    return await credits.balance(auth[0]["id"])


@app.get("/api/v1/credits/history")
async def my_credit_history(limit: int = 50, auth=Depends(require_auth)):
    return {"entries": await credits.history(auth[0]["id"], max(1, min(limit, 200)))}


@app.get("/api/v1/credits/forecast")
async def my_credit_forecast(auth=Depends(require_auth)):
    return await credits.forecast(auth[0]["id"])


async def reserve_or_response(user_id: str, body: ChatRequest):
    try:
        return await credits.reserve(user_id, body.action, body.requestId or str(uuid.uuid4())), None
    except credits.CreditError as exc:
        return None, JSONResponse({"detail": exc.message, "code": exc.code, **exc.extra}, status_code=exc.status)


@app.post("/api/ai/chat")
async def ai_chat(body: ChatRequest, request: Request):
    from auth import current_session

    found = await current_session(request)
    if not found:
        return JSONResponse({"detail": "Please sign in to use GPT 6 Luna"}, status_code=401)
    if body.action not in AI_ACTIONS:
        return JSONResponse({"detail": "That AI action isn't available.", "code": "UNKNOWN_ACTION"}, status_code=400)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return JSONResponse({"detail": "OpenAI API key is not configured"}, status_code=503)
    settings = await platform_settings.get_settings()
    if not digest.allow_send_now(f"ai:{found[0]['id']}", limit=settings["maxRequestsPerMinute"], window=60):
        return JSONResponse({"detail": "Too many AI requests. Try again in a minute.", "code": "RATE_LIMITED"}, status_code=429)
    res, error = await reserve_or_response(found[0]["id"], body)
    if error:
        return error
    model = settings["defaultModel"] or "gpt-6-luna"
    context = body.context[: max(1000, settings["maxInputTokens"]) * 4]
    res["model"] = model
    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=SYSTEM_PROMPT + context).with_model("openai", model)
    transcript = "\n".join(f"{t.role.upper()}: {t.text}" for t in body.history[-10:])
    text = f"Conversation so far:\n{transcript}\n\nUSER: {body.prompt}" if transcript else body.prompt
    # BackgroundTask runs after the response, so a hold is released even if the client left before streaming began.
    return StreamingResponse(chat_events(chat, text, res), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                             background=BackgroundTask(credits.release_cancelled, res))


async def chat_events(chat, text: str, res: dict):
    started, output, settled = time.monotonic(), "", False
    elapsed = lambda: int((time.monotonic() - started) * 1000)  # noqa: E731
    try:
        try:
            async for ev in chat.stream_message(UserMessage(text=text)):
                if isinstance(ev, TextDelta):
                    output += ev.content
                    yield sse({"delta": ev.content})
                elif isinstance(ev, StreamDone):
                    break
            if not output:
                raise RuntimeError("empty response")
        except Exception as exc:
            await credits.release(res, "AI request failed — credits returned")
            await credits.record_usage(res, "failed", 0, len(output), elapsed(), str(exc)[:300])
            yield sse({"error": friendly_ai_error(str(exc)), "creditsReturned": True})
            return
        charged = await credits.settle(res, len(output) // 4)
        settled = True
        try:
            await credits.record_usage(res, "succeeded", charged, len(output), elapsed())
        except Exception:
            logging.exception("Usage record failed for %s", res["id"])
        yield sse({"credits": {"charged": charged, **await credits.balance(res["user_id"])}})
    finally:
        if not settled:
            await asyncio.shield(credits.release_cancelled(res))


__all__ = ["app", "public_user"]
