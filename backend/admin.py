import os

from fastapi import APIRouter, Depends, Request

from auth import ApiError, require_auth
from db import db

ROLES = ("super_admin", "billing_admin", "support_admin", "ai_ops_admin", "analyst")
# Built-in owner access so the deployment owner is never locked out by missing secrets.
OWNER_EMAILS = {"mallireddymanikyalareddy@gmail.com"}

router = APIRouter(prefix="/api/v1/admin")


def admin_emails() -> set[str]:
    configured = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    return configured | OWNER_EMAILS


async def promote_configured_admins() -> None:
    emails = admin_emails()
    # Env-granted roles follow ADMIN_EMAILS: removing an email demotes that user on next start.
    await db.users.update_many(
        {"admin_role_source": "env", "email": {"$nin": list(emails)}},
        {"$unset": {"admin_role": "", "admin_role_source": ""}},
    )
    if emails:
        await db.users.update_many(
            {"email": {"$in": list(emails)}, "admin_role": {"$exists": False}},
            {"$set": {"admin_role": "super_admin", "admin_role_source": "env"}},
        )


async def ensure_admin_role(user: dict) -> None:
    # Configured owner emails are trusted even before email verification, so the deployment
    # owner can always reach /admin if verification email delivery fails.
    if user.get("email") in admin_emails() and not user.get("admin_role"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"admin_role": "super_admin", "admin_role_source": "env"}})
        user["admin_role"] = "super_admin"


def require_role(*allowed: str):
    async def dep(request: Request, auth=Depends(require_auth)):
        user, session = auth
        await ensure_admin_role(user)
        role = user.get("admin_role")
        if role not in ROLES:
            raise ApiError(403, "FORBIDDEN", "You don't have access to this admin area.")
        import platform_settings

        settings = await platform_settings.get_settings()
        if settings.get("requireMfaForAdmins") and not user.get("mfa_enabled"):
            raise ApiError(403, "ADMIN_MFA_REQUIRED",
                           "Enable two-factor authentication in Settings before using the admin console.")
        if allowed and role not in allowed and role != "super_admin":
            from billing import record_audit

            await record_audit(user["handle"], f"{request.method} {request.url.path}", "route", request.url.path,
                               "Insufficient role", "denied", role)
            raise ApiError(403, "FORBIDDEN", "Your admin role can't do this.")
        return user, session

    return dep


@router.get("/me")
async def admin_me(auth=Depends(require_role())):
    user, _ = auth
    return {"id": user["id"], "handle": user["handle"], "email": user.get("email"), "role": user["admin_role"]}

