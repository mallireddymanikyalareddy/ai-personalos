import copy
import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import bcrypt
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import db

COOKIE = "pos_session"
SESSION_TTL = timedelta(days=30)
HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,31}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_FAILS = 5
FAIL_WINDOW = timedelta(minutes=15)

DEFAULT_PREFERENCES = {
    "theme": "system",
    "weekStart": "monday",
    "timeFormat": "24h",
    "defaultPlanningView": "week",
    "planningPreference": "morning",
    "workingHours": {"enabled": True, "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "17:00"},
    "sleepSchedule": {"bedtime": "23:00", "wakeTime": "07:00"},
    "ai": {"tone": "balanced", "proactivity": "suggest", "model": "default"},
    "notifications": {
        "emailDigest": "daily",
        "dailyBriefing": True,
        "taskReminders": True,
        "aiInsights": True,
        "quietHours": {"enabled": True, "start": "22:00", "end": "07:00"},
    },
    "primaryLifeAreaIds": [],
}

LIFE_AREA_CATALOG = [
    {"name": "Work", "color": "#4f46e5", "icon": "briefcase", "description": "Career, projects, and professional growth"},
    {"name": "Health", "color": "#e11d48", "icon": "heart-pulse", "description": "Fitness, sleep, and wellbeing"},
    {"name": "Relationships", "color": "#d97706", "icon": "users", "description": "Family, friends, and community"},
    {"name": "Money", "color": "#059669", "icon": "wallet", "description": "Budgeting, saving, and investing"},
    {"name": "Learning", "color": "#7c3aed", "icon": "book-open", "description": "Skills, courses, and curiosity"},
    {"name": "Personal", "color": "#0891b2", "icon": "sparkles", "description": "Hobbies, home, and everything else"},
]

router = APIRouter(prefix="/api/v1")


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail: str, errors: list | None = None):
        self.status, self.code, self.detail, self.errors = status, code, detail, errors or []


def error_response(exc: ApiError) -> JSONResponse:
    return JSONResponse(
        {"title": exc.code, "status": exc.status, "code": exc.code, "detail": exc.detail, "errors": exc.errors},
        status_code=exc.status,
        media_type="application/problem+json",
    )


def invalid(field: str, issue: str, detail: str = "Request failed schema validation.") -> ApiError:
    return ApiError(400, "VALIDATION_FAILED", detail, [{"field": field, "issue": issue}])


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        elif value is not None:
            out[key] = value
    return out


def valid_tz(tz: str) -> bool:
    try:
        ZoneInfo(tz)
        return True
    except Exception:
        return False


def public_user(user: dict) -> dict:
    return {"id": user["id"], "handle": user["handle"], "displayName": user["display_name"], "email": user.get("email")}


def profile(user: dict) -> dict:
    return {
        **public_user(user),
        "emailVerified": user.get("email_verified_at") is not None,
        "timezone": user.get("timezone", "UTC"),
        "locale": user.get("locale", "en"),
        "avatarUrl": user.get("avatar_url"),
        "createdAt": iso(user["created_at"]),
        "onboardingCompleted": user.get("onboarding_completed_at") is not None,
        "preferences": deep_merge(DEFAULT_PREFERENCES, user.get("preferences") or {}),
    }


def platform_of(ua: str) -> tuple[str, str]:
    ua_l = ua.lower()
    plat = next((p for k, p in [("iphone", "ios"), ("ipad", "ios"), ("android", "android"), ("mac os", "macos"),
                                ("windows", "windows"), ("linux", "linux")] if k in ua_l), "web")
    browser = next((b for k, b in [("edg/", "Edge"), ("chrome", "Chrome"), ("firefox", "Firefox"), ("safari", "Safari")] if k in ua_l), "Browser")
    return plat, f"{browser} on {plat.capitalize() if plat != 'macos' else 'macOS'}"


def client_ip(request: Request) -> str | None:
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    fwd = request.headers.get("x-forwarded-for", "")
    parts = [p.strip() for p in fwd.split(",") if p.strip()]
    if parts:
        return parts[-3] if len(parts) >= 3 else parts[0]
    return request.client.host if request.client else None


def origin_of(request: Request) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host", "")).split(",")[0].strip()
    return f"https://{host}"


async def issue_session(user: dict, request: Request, response: Response) -> dict:
    token = secrets.token_urlsafe(32)
    ua = request.headers.get("user-agent", "")[:300]
    plat, name = platform_of(ua)
    device_key = sha(f"{user['id']}:{ua}")
    device = await db.devices.find_one_and_update(
        {"user_id": user["id"], "key": device_key},
        {"$set": {"last_seen_at": now(), "name": name, "platform": plat, "revoked_at": None},
         "$setOnInsert": {"id": str(uuid.uuid4()), "user_id": user["id"], "key": device_key}},
        upsert=True, return_document=True, projection={"_id": 0},
    )
    expires = now() + SESSION_TTL
    await db.sessions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "token_hash": sha(token), "device_id": device["id"],
        "ip": client_ip(request), "user_agent": ua, "device_name": name, "platform": plat,
        "created_at": now(), "last_seen_at": now(), "expires_at": expires, "revoked_at": None,
    })
    secure = request.headers.get("x-forwarded-proto", "https") == "https"
    response.set_cookie(COOKIE, token, max_age=int(SESSION_TTL.total_seconds()), httponly=True, samesite="lax", secure=secure, path="/")
    return {"user": public_user(user), "token": token, "expiresAt": iso(expires)}


async def current_session(request: Request) -> tuple[dict, dict] | None:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get(COOKIE)
    if not token:
        return None
    session = await db.sessions.find_one({"token_hash": sha(token), "revoked_at": None}, {"_id": 0})
    if not session or session["expires_at"].replace(tzinfo=timezone.utc) < now():
        return None
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        return None
    await db.sessions.update_one({"id": session["id"]}, {"$set": {"last_seen_at": now()}})
    return user, session


async def require_auth(request: Request) -> tuple[dict, dict]:
    found = await current_session(request)
    if not found:
        raise ApiError(401, "AUTH_REQUIRED", "Authentication required.")
    return found


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def check_new_password(password: str, field: str = "password") -> None:
    if not isinstance(password, str) or not 10 <= len(password) <= 200:
        raise invalid(field, "must be between 10 and 200 characters")


class RegisterIn(BaseModel):
    handle: str
    displayName: str
    password: str
    email: str | None = None


@router.post("/auth/register", status_code=201)
async def register(body: RegisterIn, request: Request, response: Response):
    handle = body.handle.strip().lower()
    if not HANDLE_RE.match(handle):
        raise invalid("handle", "must be 3-32 letters, numbers, _ or -", "Registration failed schema validation.")
    if not 1 <= len(body.displayName.strip()) <= 64:
        raise invalid("displayName", "must be 1-64 characters", "Registration failed schema validation.")
    check_new_password(body.password)
    email = body.email.strip().lower() if body.email else None
    if email and not EMAIL_RE.match(email):
        raise invalid("email", "must be a valid email", "Registration failed schema validation.")
    if await db.users.find_one({"handle": handle}):
        raise ApiError(409, "CONFLICT_ALREADY_EXISTS", "That handle is already taken.", [{"field": "handle", "issue": "already taken"}])
    if email and await db.users.find_one({"email": email}):
        raise ApiError(409, "CONFLICT_ALREADY_EXISTS", "That email is already registered.", [{"field": "email", "issue": "already registered"}])
    user = {
        "id": str(uuid.uuid4()), "handle": handle, "email": email, "display_name": body.displayName.strip(),
        "password_hash": hash_password(body.password), "timezone": "UTC", "locale": "en", "avatar_url": None,
        "email_verified_at": None, "onboarding_completed_at": None, "preferences": {}, "life_areas": [],
        "created_at": now(), "updated_at": now(),
    }
    await db.users.insert_one(dict(user))
    return await issue_session(user, request, response)


class LoginIn(BaseModel):
    identifier: str
    password: str


@router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    ident = body.identifier.strip().lower()
    key = f"{client_ip(request)}:{ident}"
    window = {"$gte": now() - FAIL_WINDOW}
    pair_fails = await db.login_attempts.count_documents({"key": key, "at": window})
    ident_fails = await db.login_attempts.count_documents({"ident": ident, "at": window})
    if pair_fails >= MAX_FAILS or ident_fails >= MAX_FAILS * 4:
        raise ApiError(429, "RATE_LIMITED", "Too many failed sign-in attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"$or": [{"handle": ident}, {"email": ident}]}, {"_id": 0})
    if not user or not check_password(body.password, user["password_hash"]):
        await db.login_attempts.insert_one({"key": key, "ident": ident, "at": now()})
        raise ApiError(401, "INVALID_CREDENTIALS", "Incorrect handle/email or password.")
    await db.login_attempts.delete_many({"key": key})
    return await issue_session(user, request, response)


@router.post("/auth/logout", status_code=204)
async def logout(request: Request):
    found = await current_session(request)
    if found:
        await db.sessions.update_one({"id": found[1]["id"]}, {"$set": {"revoked_at": now()}})
    out = Response(status_code=204)
    out.delete_cookie(COOKIE, path="/")
    return out


@router.get("/auth/me")
async def me(request: Request):
    found = await current_session(request)
    if not found:
        raise ApiError(401, "AUTH_REQUIRED", "Authentication required.")
    user, session = found
    return {"user": public_user(user), "session": {"id": session["id"], "expiresAt": iso(session["expires_at"])}}


@router.get("/auth/oauth/providers")
async def oauth_providers():
    return {"items": [{"id": p, "label": label, "enabled": False} for p, label in
                      [("google", "Google"), ("microsoft", "Microsoft"), ("apple", "Apple")]]}


class PasswordChangeIn(BaseModel):
    currentPassword: str
    password: str


@router.post("/auth/password", status_code=204)
async def change_password(body: PasswordChangeIn, auth=Depends(require_auth)):
    user, session = auth
    if not check_password(body.currentPassword, user["password_hash"]):
        raise ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.", [{"field": "currentPassword", "issue": "incorrect"}])
    check_new_password(body.password)
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.password), "updated_at": now()}})
    await db.sessions.update_many({"user_id": user["id"], "id": {"$ne": session["id"]}}, {"$set": {"revoked_at": now()}})
    return Response(status_code=204)


async def create_token(user_id: str, kind: str, ttl: timedelta) -> str:
    token = secrets.token_urlsafe(32)
    await db.tokens.insert_one({"token_hash": sha(token), "user_id": user_id, "kind": kind, "expires_at": now() + ttl, "used_at": None})
    return token


async def consume_token(token: str, kind: str) -> dict:
    doc = await db.tokens.find_one_and_update(
        {"token_hash": sha(token or ""), "kind": kind, "used_at": None, "expires_at": {"$gt": now()}},
        {"$set": {"used_at": now()}},
    )
    if not doc:
        raise ApiError(400, "TOKEN_INVALID", "This link is invalid or has expired.")
    return doc


class IdentifierIn(BaseModel):
    identifier: str


@router.post("/auth/password-reset/request", status_code=202)
async def reset_request(body: IdentifierIn, request: Request):
    import digest

    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"handle": ident}, {"email": ident}]}, {"_id": 0})
    if user and user.get("email") and digest.allow_send_now(f"reset:{user['id']}"):
        token = await create_token(user["id"], "reset", timedelta(hours=1))
        await digest.send_account_link(user, "reset", f"{origin_of(request)}/reset-password?token={token}")
    return {"status": "accepted"}


class ResetConfirmIn(BaseModel):
    token: str
    password: str


@router.post("/auth/password-reset/confirm", status_code=204)
async def reset_confirm(body: ResetConfirmIn):
    check_new_password(body.password)
    doc = await consume_token(body.token, "reset")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password), "updated_at": now()}})
    await db.sessions.update_many({"user_id": doc["user_id"]}, {"$set": {"revoked_at": now()}})
    return Response(status_code=204)


@router.post("/auth/verify-email/request", status_code=202)
async def verify_request(request: Request, auth=Depends(require_auth)):
    import digest

    user, _ = auth
    if not user.get("email"):
        raise invalid("email", "add an email address first")
    if digest.allow_send_now(f"verify:{user['id']}"):
        token = await create_token(user["id"], "verify", timedelta(hours=24))
        await digest.send_account_link(user, "verify", f"{origin_of(request)}/verify-email?token={token}")
    return {"status": "accepted"}


class TokenIn(BaseModel):
    token: str


@router.post("/auth/verify-email/confirm")
async def verify_confirm(body: TokenIn):
    doc = await consume_token(body.token, "verify")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"email_verified_at": now()}})
    return profile(await db.users.find_one({"id": doc["user_id"]}, {"_id": 0}))


@router.get("/auth/sessions")
async def list_sessions(auth=Depends(require_auth)):
    user, current = auth
    rows = await db.sessions.find({"user_id": user["id"], "revoked_at": None, "expires_at": {"$gt": now()}}, {"_id": 0}).to_list(200)
    return {"items": [{
        "id": s["id"], "ip": s.get("ip"), "userAgent": s.get("user_agent"), "deviceName": s.get("device_name", "Browser"),
        "platform": s.get("platform", "web"), "createdAt": iso(s["created_at"]), "lastSeenAt": iso(s["last_seen_at"]),
        "current": s["id"] == current["id"],
    } for s in rows]}


@router.delete("/auth/sessions/{session_id}", status_code=204)
async def revoke_session(session_id: str, auth=Depends(require_auth)):
    user, _ = auth
    res = await db.sessions.update_one({"id": session_id, "user_id": user["id"], "revoked_at": None}, {"$set": {"revoked_at": now()}})
    if res.matched_count == 0:
        raise ApiError(404, "NOT_FOUND", "Session not found.")
    return Response(status_code=204)


@router.post("/auth/sessions/revoke-others")
async def revoke_others(auth=Depends(require_auth)):
    user, current = auth
    res = await db.sessions.update_many({"user_id": user["id"], "id": {"$ne": current["id"]}, "revoked_at": None}, {"$set": {"revoked_at": now()}})
    return {"revoked": res.modified_count}


@router.get("/auth/devices")
async def list_devices(auth=Depends(require_auth)):
    user, _ = auth
    devices = await db.devices.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    items = []
    for d in devices:
        active = await db.sessions.count_documents({"device_id": d["id"], "revoked_at": None, "expires_at": {"$gt": now()}})
        items.append({"id": d["id"], "name": d["name"], "platform": d["platform"], "lastSeenAt": iso(d["last_seen_at"]),
                      "revokedAt": iso(d.get("revoked_at")), "activeSessions": active})
    return {"items": items}


@router.delete("/auth/devices/{device_id}", status_code=204)
async def revoke_device(device_id: str, auth=Depends(require_auth)):
    user, _ = auth
    res = await db.devices.update_one({"id": device_id, "user_id": user["id"]}, {"$set": {"revoked_at": now()}})
    if res.matched_count == 0:
        raise ApiError(404, "NOT_FOUND", "Device not found.")
    await db.sessions.update_many({"device_id": device_id}, {"$set": {"revoked_at": now()}})
    return Response(status_code=204)


@router.get("/users/me")
async def get_profile(auth=Depends(require_auth)):
    return profile(auth[0])


def validate_preferences(prefs: dict) -> None:
    if not isinstance(prefs, dict):
        raise invalid("preferences", "must be an object")
    for field, allowed in [("theme", {"system", "light", "dark"}), ("weekStart", {"monday", "sunday"}), ("timeFormat", {"12h", "24h"}),
                           ("defaultPlanningView", {"day", "week", "month", "quarter"})]:
        if field in prefs and prefs[field] not in allowed:
            raise invalid(f"preferences.{field}", f"must be one of {sorted(allowed)}")
    for group in ("workingHours", "sleepSchedule", "notifications", "ai"):
        if group in prefs and not isinstance(prefs[group], dict):
            raise invalid(f"preferences.{group}", "must be an object")
    for path in [("workingHours", "start"), ("workingHours", "end"), ("sleepSchedule", "bedtime"), ("sleepSchedule", "wakeTime")]:
        value = (prefs.get(path[0]) or {}).get(path[1])
        if value is not None and not TIME_RE.match(str(value)):
            raise invalid(f"preferences.{'.'.join(path)}", "must be HH:MM in 24h time")


def _display_name(value) -> dict:
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 64:
        raise invalid("displayName", "must be 1-64 characters")
    return {"display_name": value.strip()}


def _timezone(value) -> dict:
    if not valid_tz(str(value)):
        raise invalid("timezone", "must be a valid IANA timezone")
    return {"timezone": value}


def _locale(value) -> dict:
    return {"locale": str(value)[:35]}


def _valid_avatar(url) -> bool:
    if url is None:
        return True
    return isinstance(url, str) and len(url) <= 256_000 and url.startswith(("https://", "data:image/"))


def _avatar(value) -> dict:
    if not _valid_avatar(value):
        raise invalid("avatarUrl", "must be an https URL or a base64 data image")
    return {"avatar_url": value}


PROFILE_FIELDS = {"displayName": _display_name, "timezone": _timezone, "locale": _locale, "avatarUrl": _avatar}


def validate_profile_update(body, user: dict) -> dict:
    if not isinstance(body, dict) or all(v is None for v in body.values()):
        raise invalid("(root)", "at least one field is required")
    update: dict = {"updated_at": now()}
    for field, handler in PROFILE_FIELDS.items():
        if field in body:
            update.update(handler(body[field]))
    if "preferences" in body:
        validate_preferences(body["preferences"])
        update["preferences"] = deep_merge(user.get("preferences") or {}, body["preferences"])
    return update


async def apply_user_update(user_id: str, update: dict) -> dict:
    await db.users.update_one({"id": user_id}, {"$set": update})
    return profile(await db.users.find_one({"id": user_id}, {"_id": 0}))


@router.patch("/users/me")
async def patch_profile(request: Request, auth=Depends(require_auth)):
    user, _ = auth
    return await apply_user_update(user["id"], validate_profile_update(await request.json(), user))


@router.get("/users/me/onboarding")
async def get_onboarding(auth=Depends(require_auth)):
    user, _ = auth
    return {"completed": user.get("onboarding_completed_at") is not None, "profile": profile(user), "lifeAreaCatalog": LIFE_AREA_CATALOG}


def _onboarding_life_areas(names) -> list:
    if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
        raise invalid("lifeAreaNames", "must be a list of life area names", "Onboarding failed schema validation.")
    catalog = {a["name"] for a in LIFE_AREA_CATALOG}
    unknown = [n for n in names if n not in catalog]
    if unknown:
        raise ApiError(400, "VALIDATION_FAILED", "Onboarding failed schema validation.",
                       [{"field": "lifeAreaNames", "issue": f'unknown life area "{n}"'} for n in unknown])
    return names[:12]


def validate_onboarding(body, user: dict) -> dict:
    if not isinstance(body, dict):
        raise invalid("(root)", "must be an object")
    tz = str(body.get("timezone", ""))
    if not valid_tz(tz):
        raise invalid("timezone", "must be a valid IANA timezone", "Onboarding failed schema validation.")
    life_areas = _onboarding_life_areas(body.get("lifeAreaNames") or [])
    prefs = body.get("preferences") or {}
    validate_preferences(prefs)
    update = {"timezone": tz, "locale": str(body.get("locale") or "en")[:35], "life_areas": life_areas,
              "preferences": deep_merge(user.get("preferences") or {}, prefs), "onboarding_completed_at": now(), "updated_at": now()}
    if body.get("displayName"):
        update["display_name"] = str(body["displayName"]).strip()[:64]
    return update


@router.post("/users/me/onboarding")
async def post_onboarding(request: Request, auth=Depends(require_auth)):
    user, _ = auth
    return await apply_user_update(user["id"], validate_onboarding(await request.json(), user))


@router.get("/integrations/catalog")
async def integrations_catalog(auth=Depends(require_auth)):
    return {"items": []}


@router.get("/integrations/{provider_id}/status")
async def integration_status(provider_id: str, auth=Depends(require_auth)):
    return {"providerId": provider_id, "status": "preparing", "configured": False, "connectable": False}


@router.post("/integrations/{action}")
async def integration_action(action: str, auth=Depends(require_auth)):
    raise ApiError(409, "INTEGRATION_UNAVAILABLE", "This integration isn't available yet.")
