import base64
import hashlib
import hmac
import secrets
import struct
from datetime import timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from auth import ApiError, consume_token, create_token, issue_session, now, require_auth, sha
from db import db

router = APIRouter(prefix="/api/v1/auth")
STEP_UP_MINUTES = 15


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def totp(secret: str, at: int | None = None) -> str:
    counter = int((at if at is not None else now().timestamp()) // 30)
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return str((struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000).zfill(6)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    code = (code or "").strip()
    if not code.isdigit() or len(code) != 6 or not secret:
        return False
    current = int(now().timestamp() // 30)
    return any(hmac.compare_digest(totp(secret, (current + offset) * 30), code)
               for offset in range(-window, window + 1))


def new_recovery_codes(count: int = 8) -> list[str]:
    return [secrets.token_hex(4).upper() for _ in range(count)]


async def verify_code(user: dict, code: str) -> bool:
    if verify_totp(user.get("mfa_secret", ""), code):
        return True
    hashed = sha((code or "").strip().upper())
    for entry in user.get("mfa_recovery_codes", []):
        if entry.get("hash") == hashed and not entry.get("used_at"):
            await db.users.update_one(
                {"id": user["id"], "mfa_recovery_codes.hash": hashed},
                {"$set": {"mfa_recovery_codes.$.used_at": now()}})
            return True
    return False


def require_step_up(user: dict, session: dict, minutes: int = STEP_UP_MINUTES) -> None:
    if not user.get("mfa_enabled"):
        return
    verified = session.get("mfa_verified_at")
    if not verified:
        raise ApiError(403, "MFA_REQUIRED", "Enter your authenticator code to continue.")
    value = verified if verified.tzinfo else verified.replace(tzinfo=now().tzinfo)
    if now() - value > timedelta(minutes=minutes):
        raise ApiError(403, "MFA_REQUIRED", "Enter your authenticator code to continue.")


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=32)


class VerifyIn(BaseModel):
    challenge: str = Field(min_length=8, max_length=256)
    code: str = Field(min_length=6, max_length=32)


class DisableIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=6, max_length=32)


@router.get("/mfa")
async def mfa_status(auth=Depends(require_auth)):
    user, _ = auth
    codes = [entry for entry in user.get("mfa_recovery_codes", []) if not entry.get("used_at")]
    return {"enabled": bool(user.get("mfa_enabled")), "recoveryCodesRemaining": len(codes)}


@router.post("/mfa/setup")
async def mfa_setup(auth=Depends(require_auth)):
    user, _ = auth
    if user.get("mfa_enabled"):
        raise ApiError(400, "CONFLICT", "Two-factor authentication is already enabled.")
    secret = new_secret()
    await db.users.update_one({"id": user["id"]}, {"$set": {"mfa_pending_secret": secret, "mfa_pending_at": now()}})
    label = quote(f"PersonalOS:{user['handle']}")
    uri = f"otpauth://totp/{label}?secret={secret}&issuer=PersonalOS&digits=6&period=30"
    return {"secret": secret, "otpauthUrl": uri}


@router.post("/mfa/enable")
async def mfa_enable(body: CodeIn, auth=Depends(require_auth)):
    user, _ = auth
    secret = user.get("mfa_pending_secret")
    if not secret:
        raise ApiError(400, "VALIDATION_FAILED", "Start two-factor setup first.")
    if not verify_totp(secret, body.code):
        raise ApiError(400, "INVALID_MFA_CODE", "That authenticator code isn't valid.")
    codes = new_recovery_codes()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"mfa_enabled": True, "mfa_secret": secret, "mfa_enabled_at": now(),
                  "mfa_recovery_codes": [{"hash": sha(code), "used_at": None} for code in codes]},
         "$unset": {"mfa_pending_secret": "", "mfa_pending_at": ""}})
    return {"enabled": True, "recoveryCodes": codes}


@router.post("/mfa/disable", status_code=204)
async def mfa_disable(body: DisableIn, auth=Depends(require_auth)):
    user, _ = auth
    from auth import check_password
    if not check_password(body.password, user.get("password_hash", "")):
        raise ApiError(401, "INVALID_CREDENTIALS", "That password isn't correct.")
    if not await verify_code(user, body.code):
        raise ApiError(400, "INVALID_MFA_CODE", "That authenticator or recovery code isn't valid.")
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"mfa_enabled": "", "mfa_secret": "", "mfa_enabled_at": "", "mfa_recovery_codes": "",
                    "mfa_pending_secret": "", "mfa_pending_at": ""}})
    return Response(status_code=204)


@router.post("/mfa/step-up")
async def mfa_step_up(body: CodeIn, auth=Depends(require_auth)):
    user, session = auth
    if not user.get("mfa_enabled"):
        return {"verified": True}
    if not await verify_code(user, body.code):
        raise ApiError(400, "INVALID_MFA_CODE", "That authenticator or recovery code isn't valid.")
    await db.sessions.update_one({"id": session["id"]}, {"$set": {"mfa_verified_at": now()}})
    return {"verified": True}


@router.post("/mfa/verify")
async def mfa_verify(body: VerifyIn, request: Request, response: Response):
    doc = await consume_token(body.challenge, "mfa")
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0})
    if not user or not user.get("mfa_enabled") or not await verify_code(user, body.code):
        raise ApiError(401, "INVALID_MFA_CODE", "That authenticator code isn't valid.")
    return await issue_session(user, request, response, mfa_verified=True)
