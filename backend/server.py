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
import approvals  # noqa: E402
import credits  # noqa: E402
import entitlements  # noqa: E402
import mfa  # noqa: E402
import platform_settings  # noqa: E402
import promotions  # noqa: E402
import reconciliation  # noqa: E402
import referrals  # noqa: E402
from admin_ops import router as admin_ops_router  # noqa: E402
from billing_admin import public_router as billing_public_router, router as billing_admin_router  # noqa: E402
from plan_admin import admin_router as plan_admin_router, public_router as plans_router  # noqa: E402
from billing import run_once, setup_billing, now  # noqa: E402
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
    await approvals.ensure_indexes()
    await reconciliation.ensure_indexes()
    await run_once("stage8_credit_buckets", credits.backfill_credit_buckets)
    await run_once("stage8_promotion_remaining", promotions.backfill_remaining)
    await run_once("stage9_referral_codes", referrals.backfill_codes)
    await run_once("stage4_trial_credits_10", credits.backfill_trial_credits)
    await entitlements.run_due()
    await promotions.expire_due()
    tasks = [asyncio.create_task(digest_loop()), asyncio.create_task(credits.sweep_loop()),
             asyncio.create_task(entitlements.sweep_loop()), asyncio.create_task(promotions.sweep_loop()),
             asyncio.create_task(alerts.loop()), asyncio.create_task(reconciliation.loop()),
             asyncio.create_task(promotions.auto_loop()), asyncio.create_task(approvals.sweep_loop())]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    from request_context import request_id as request_id_var

    rid = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:16]}"
    token = request_id_var.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers["X-Request-ID"] = rid
    return response


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(admin_ops_router)
app.include_router(plan_admin_router)
app.include_router(plans_router)
app.include_router(billing_admin_router)
app.include_router(billing_public_router)
app.include_router(mfa.router)


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
    context: str = Field(default="", max_length=200000)
    history: list[ChatTurn] = []
    action: str = "quick_question"
    requestId: str | None = Field(default=None, min_length=8, max_length=64)
    itemCount: int = Field(default=1, ge=1, le=500)


class EstimateIn(BaseModel):
    action: str = Field(min_length=1, max_length=80)
    inputChars: int = Field(default=0, ge=0, le=2_000_000)
    itemCount: int = Field(default=1, ge=1, le=500)


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
    return await entitlements.credit_overview(auth[0]["id"])


@app.get("/api/v1/credits/history")
async def my_credit_history(limit: int = 50, auth=Depends(require_auth)):
    return {"entries": await credits.history(auth[0]["id"], max(1, min(limit, 200)))}


@app.get("/api/v1/credits/forecast")
async def my_credit_forecast(auth=Depends(require_auth)):
    return await credits.forecast(auth[0]["id"])


@app.get("/api/v1/referrals")
async def my_referrals(auth=Depends(require_auth)):
    return await referrals.summary(auth[0])


class GiftIn(BaseModel):
    identifier: str = Field(min_length=1, max_length=120)
    amount: int = Field(ge=1, le=10000)
    note: str | None = Field(default=None, max_length=200)
    requestId: str = Field(min_length=8, max_length=64)


@app.post("/api/v1/credits/gift")
async def gift_credits(body: GiftIn, auth=Depends(require_auth)):
    sender = auth[0]
    ident = body.identifier.strip().lower()
    recipient = await db.users.find_one(
        {"$or": [{"id": body.identifier}, {"handle": ident}, {"email": ident}]}, {"_id": 0, "id": 1, "handle": 1})
    if not recipient:
        return JSONResponse({"detail": "That person isn't on PersonalOS.", "code": "NOT_FOUND"}, status_code=404)
    if recipient["id"] == sender["id"]:
        return JSONResponse({"detail": "You can't gift credits to yourself."}, status_code=400)
    settings = await platform_settings.get_settings()
    if body.amount > int(settings.get("giftMaxCredits", 1000)):
        return JSONResponse({"detail": f"You can gift up to {settings.get('giftMaxCredits', 1000)} credits at a time."},
                            status_code=400)
    reason = (body.note or "").strip() or f"Gift to @{recipient['handle']}"
    try:
        result = await credits.gift(sender["id"], recipient["id"], body.amount, reason,
                                    f"gift:{body.requestId}", sender["handle"])
    except credits.CreditError as exc:
        return JSONResponse({"detail": exc.message, "code": exc.code}, status_code=exc.status)
    return {**result, "amount": body.amount, "recipientHandle": recipient["handle"]}


@app.post("/api/v1/ai/estimate")
async def ai_estimate(body: EstimateIn, auth=Depends(require_auth)):
    """Quote one AI action before it runs. The server owns the price, limits and balance."""
    user = auth[0]
    try:
        quote = await credits.quote(user["id"], body.action, body.inputChars, body.itemCount)
    except credits.CreditError as exc:
        return JSONResponse({"detail": exc.message, "code": exc.code, **exc.extra}, status_code=exc.status)
    access = await entitlements.ai_access(user["id"])
    balance = await credits.balance(user["id"])
    settings = await platform_settings.get_settings()
    reasons = []
    if not access["allowed"]:
        reasons.append("PAYMENT_GRACE_EXPIRED")
    if quote["too_large"]:
        reasons.append("INPUT_TOO_LARGE")
    if quote["daily_limit"] and quote["daily_used"] >= quote["daily_limit"]:
        reasons.append("ACTION_LIMIT_REACHED")
    if balance["available"] < quote["min_credits"]:
        reasons.append("INSUFFICIENT_CREDITS")
    return {
        "action": quote["action"], "label": quote["label"],
        "minCredits": quote["min_credits"], "maxCredits": quote["max_credits"],
        "inputTokens": quote["input_tokens"], "maxInputTokens": quote["max_input_tokens"],
        "maxOutputTokens": quote["max_output_tokens"],
        "model": quote["model"] or settings["defaultModel"],
        "pricingVersion": quote["pricing_version"],
        "available": balance["available"], "reserved": balance["reserved"],
        "expectedRemaining": max(0, balance["available"] - quote["max_credits"]),
        "dailyLimit": quote["daily_limit"], "dailyUsed": quote["daily_used"],
        "itemCount": quote["item_count"], "batchSize": quote["batch_size"],
        "modelMultiplier": quote["model_multiplier"],
        "allowed": not reasons, "reasons": reasons,
        "graceEndsAt": access.get("graceEndsAt"),
    }


async def reserve_or_response(user_id: str, body: ChatRequest, input_chars: int = 0):
    try:
        return await credits.reserve(user_id, body.action, body.requestId or str(uuid.uuid4()), input_chars,
                                     body.itemCount), None
    except credits.CreditError as exc:
        return None, JSONResponse({"detail": exc.message, "code": exc.code, **exc.extra}, status_code=exc.status)


@app.post("/api/ai/chat")
async def ai_chat(body: ChatRequest, request: Request):
    from auth import current_session

    found = await current_session(request)
    if not found:
        return JSONResponse({"detail": "Please sign in to use GPT 6 Luna"}, status_code=401)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return JSONResponse({"detail": "OpenAI API key is not configured"}, status_code=503)
    settings = await platform_settings.get_settings()
    if not digest.allow_send_now(f"ai:{found[0]['id']}", limit=settings["maxRequestsPerMinute"], window=60):
        return JSONResponse({"detail": "Too many AI requests. Try again in a minute.", "code": "RATE_LIMITED"}, status_code=429)
    raw_context = body.context
    transcript = "\n".join(f"{t.role.upper()}: {t.text}" for t in body.history[-10:])
    text = f"Conversation so far:\n{transcript}\n\nUSER: {body.prompt}" if transcript else body.prompt
    res, error = await reserve_or_response(found[0]["id"], body, len(raw_context) + len(text))
    if error:
        return error
    limit_tokens = int(res.get("max_input_tokens") or settings["maxInputTokens"])
    context = raw_context[: max(1000, limit_tokens) * 4]
    model = res.get("model") or settings["defaultModel"] or "gpt-6-luna"
    res["model"] = model
    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=SYSTEM_PROMPT + context).with_model("openai", model)
    # BackgroundTask runs after the response, so a hold is released even if the client left before streaming began.
    return StreamingResponse(chat_events(chat, text, res), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                             background=BackgroundTask(credits.release_cancelled, res))


async def chat_events(chat, text: str, res: dict):
    started, output, settled = time.monotonic(), "", False
    elapsed = lambda: int((time.monotonic() - started) * 1000)  # noqa: E731
    await db.credit_reservations.update_one(
        {"id": res["id"], "status": "held"}, {"$set": {"provider_started_at": now()}})
    try:
        try:
            async for ev in chat.stream_message(UserMessage(text=text)):
                if isinstance(ev, TextDelta):
                    if not output:
                        await db.credit_reservations.update_one(
                            {"id": res["id"], "status": "held"}, {"$set": {"output_started_at": now()}})
                    output += ev.content
                    yield sse({"delta": ev.content})
                elif isinstance(ev, StreamDone):
                    break
            if not output:
                raise RuntimeError("empty response")
        except Exception as exc:
            # The provider reported a failure, so the hold can be returned safely.
            await credits.release(res, "AI request failed — credits returned")
            await credits.record_usage(res, "failed", 0, len(output), elapsed(), str(exc)[:300], len(text))
            yield sse({"error": friendly_ai_error(str(exc)), "creditsReturned": True})
            return
        charged = await credits.settle(res, len(output) // 4)
        settled = True
        try:
            await credits.record_usage(res, "succeeded", charged, len(output), elapsed(), input_chars=len(text))
        except Exception:
            logging.exception("Usage record failed for %s", res["id"])
        yield sse({"credits": {"charged": charged, **await credits.balance(res["user_id"])}})
    finally:
        if not settled:
            await asyncio.shield(credits.release_cancelled(res))


__all__ = ["app", "public_user"]
