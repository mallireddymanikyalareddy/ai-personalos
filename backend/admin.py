import os

from fastapi import APIRouter, Depends

from auth import ApiError, require_auth
from db import db

ROLES = ("super_admin", "billing_admin", "support_admin", "ai_ops_admin", "analyst")

router = APIRouter(prefix="/api/v1/admin")


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


async def promote_configured_admins() -> None:
    emails = admin_emails()
    # Env-granted roles follow ADMIN_EMAILS: removing an email demotes that user on next start.
    await db.users.update_many(
        {"admin_role_source": "env", "email": {"$nin": list(emails)}},
        {"$unset": {"admin_role": "", "admin_role_source": ""}},
    )
    if emails:
        await db.users.update_many(
            {"email": {"$in": list(emails)}, "email_verified_at": {"$ne": None}, "admin_role": {"$exists": False}},
            {"$set": {"admin_role": "super_admin", "admin_role_source": "env"}},
        )


async def ensure_admin_role(user: dict) -> None:
    # Only a verified email can claim a configured admin role (prevents squatting an unverified address).
    if user.get("email") in admin_emails() and user.get("email_verified_at") and not user.get("admin_role"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"admin_role": "super_admin", "admin_role_source": "env"}})
        user["admin_role"] = "super_admin"


def require_role(*allowed: str):
    async def dep(auth=Depends(require_auth)):
        user, session = auth
        await ensure_admin_role(user)
        role = user.get("admin_role")
        if role not in ROLES or (allowed and role not in allowed and role != "super_admin"):
            raise ApiError(403, "FORBIDDEN", "You don't have access to this admin area.")
        return user, session

    return dep


@router.get("/me")
async def admin_me(auth=Depends(require_role())):
    user, _ = auth
    return {"id": user["id"], "handle": user["handle"], "email": user.get("email"), "role": user["admin_role"]}
