import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import digest  # noqa: E402
from auth import ApiError, error_response, iso, public_user, require_auth, router as auth_router  # noqa: E402
from db import db, ensure_indexes  # noqa: E402

BILLING_CODES = ("insufficient_credits", "integration_disabled", "daily_limit_reached")


async def digest_item(user: dict) -> dict:
    state = await db.app_state.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"id": user["id"], "email": user.get("email"), "displayName": user["display_name"],
            "timezone": user.get("timezone", "UTC"), "envelope": state["envelope"] if state else None}


async def digest_loop():
    while True:
        try:
            async for pref in db.digest_prefs.find({"enabled": True}, {"_id": 0}):
                user = await db.users.find_one({"id": pref["user_id"]}, {"_id": 0})
                if not user or not user.get("email"):
                    continue
                local = digest.local_now(user.get("timezone") or "UTC")
                week = digest.iso_week(local)
                if local.weekday() != 0 or local.hour < 7:
                    continue
                claimed = await db.digest_prefs.find_one_and_update(
                    {"user_id": user["id"], "enabled": True, "last_sent_week": {"$ne": week}},
                    {"$set": {"last_sent_week": week}},
                )
                if not claimed:
                    continue
                try:
                    await digest.send_digest(await digest_item(user))
                except digest.EmailUnavailable as exc:
                    logging.warning("Weekly digest not sent: %s", exc)
                    if str(exc) in BILLING_CODES:
                        await db.digest_prefs.update_one({"user_id": user["id"]}, {"$set": {"last_sent_week": pref.get("last_sent_week")}})
                        break
                except Exception:
                    logging.exception("Weekly digest failed for %s", user["id"])
        except Exception:
            logging.exception("Digest loop error")
        await asyncio.sleep(900)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    task = asyncio.create_task(digest_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)


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


@app.put("/api/v1/state")
async def put_state(body: StateIn, auth=Depends(require_auth)):
    env = body.envelope
    if not isinstance(env.get("state"), dict) or not isinstance(env.get("version"), (int, float)):
        raise ApiError(400, "VALIDATION_FAILED", "State payload failed schema validation.")
    user_id = auth[0]["id"]
    current = await db.app_state.find_one({"user_id": user_id}, {"version": 1})
    current_version = current["version"] if current else 0
    if body.baseVersion is not None and body.baseVersion < current_version:
        return JSONResponse({"code": "CONFLICT_VERSION", "version": current_version}, status_code=409)
    stamp = datetime.now(timezone.utc)
    doc = await db.app_state.find_one_and_update(
        {"user_id": user_id},
        {"$set": {"envelope": env, "updated_at": stamp}, "$inc": {"version": 1}},
        upsert=True, return_document=ReturnDocument.AFTER, projection={"_id": 0, "version": 1},
    )
    return {"version": doc["version"], "updatedAt": iso(stamp)}


class DigestIn(BaseModel):
    enabled: bool


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


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    context: str = Field(default="", max_length=20000)
    history: list[ChatTurn] = []


def friendly_ai_error(msg: str) -> str:
    if "credits" in msg or "quota" in msg:
        return "your OpenAI account has no credits left"
    if "RateLimit" in msg:
        return "OpenAI rate limit reached, try again shortly"
    if "AuthenticationError" in msg or "API key" in msg:
        return "the OpenAI API key was rejected"
    return "the AI service failed to respond"


@app.post("/api/ai/chat")
async def ai_chat(body: ChatRequest, request: Request):
    from auth import current_session

    if not await current_session(request):
        return JSONResponse({"detail": "Please sign in to use GPT 6 Luna"}, status_code=401)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return JSONResponse({"detail": "OpenAI API key is not configured"}, status_code=503)
    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=SYSTEM_PROMPT + body.context).with_model("openai", "gpt-6-luna")
    transcript = "\n".join(f"{t.role.upper()}: {t.text}" for t in body.history[-10:])
    text = f"Conversation so far:\n{transcript}\n\nUSER: {body.prompt}" if transcript else body.prompt

    async def events():
        try:
            async for ev in chat.stream_message(UserMessage(text=text)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:
            yield f"data: {json.dumps({'error': friendly_ai_error(str(exc))})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


__all__ = ["app", "public_user"]
