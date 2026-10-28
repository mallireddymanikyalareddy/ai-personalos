import asyncio
import logging
import uuid
from datetime import datetime, timedelta

import credits
import platform_settings
from auth import iso
from billing import now
from db import db
from entitlements import ACTIVE_STATUSES, utc

STATUSES = ("draft", "active", "ended")


class PromotionError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def promotion_status(promo: dict) -> str:
    status = promo.get("status", "draft")
    if status != "active":
        return status
    if promo.get("ends_at") and utc(promo["ends_at"]) < now():
        return "ended"
    return "active"


async def ensure_indexes() -> None:
    await db.promotions.create_index("id", unique=True)
    await db.promotions.create_index([("status", 1), ("starts_at", 1)])
    await db.promotion_grants.create_index("id", unique=True)
    await db.promotion_grants.create_index([("promotion_id", 1), ("user_id", 1)])
    await db.promotion_grants.create_index([("status", 1), ("expires_at", 1)])


def parse_eligibility(value: str) -> str:
    value = (value or "all").strip().lower()
    if value == "all" or value.startswith("plan:"):
        return value
    raise PromotionError(400, "VALIDATION_FAILED", "Eligibility must be 'all' or 'plan:<plan_id>'.")


async def _view(promo: dict) -> dict:
    return {k: (iso(v) if isinstance(v, datetime) else v) for k, v in promo.items() if k != "_id"} | {
        "status": promotion_status(promo),
        "granted": await db.promotion_grants.count_documents({"promotion_id": promo["id"]}),
        "activeGrants": await db.promotion_grants.count_documents({"promotion_id": promo["id"], "status": "active"}),
    }


async def list_promotions() -> list[dict]:
    rows = await db.promotions.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _view(p) for p in rows]


async def get_promotion(promo_id: str) -> dict:
    promo = await db.promotions.find_one({"id": promo_id}, {"_id": 0})
    if not promo:
        raise PromotionError(404, "NOT_FOUND", "Promotion not found.")
    return promo


async def create_promotion(name: str, credits_amount: int, eligibility: str, starts_at: datetime, ends_at: datetime,
                           per_user_limit: int, credit_expiry_days: int, actor: str) -> dict:
    if ends_at <= starts_at:
        raise PromotionError(400, "VALIDATION_FAILED", "The end must be after the start.")
    promo = {
        "id": f"promo_{uuid.uuid4().hex[:12]}", "name": name, "credits": credits_amount,
        "eligibility": parse_eligibility(eligibility), "starts_at": utc(starts_at), "ends_at": utc(ends_at),
        "per_user_limit": per_user_limit, "credit_expiry_days": credit_expiry_days, "status": "draft",
        "created_by": actor, "created_at": now(), "updated_at": now(),
    }
    await db.promotions.insert_one(dict(promo))
    return await _view(promo)


async def update_promotion(promo_id: str, *, name: str, credits_amount: int, eligibility: str,
                           starts_at: datetime, ends_at: datetime, per_user_limit: int,
                           credit_expiry_days: int) -> dict:
    promo = await get_promotion(promo_id)
    if promotion_status(promo) == "ended":
        raise PromotionError(409, "CONFLICT", "Ended promotions can't be edited.")
    if ends_at <= starts_at:
        raise PromotionError(400, "VALIDATION_FAILED", "The end must be after the start.")
    update = {"name": name, "credits": credits_amount, "eligibility": parse_eligibility(eligibility),
              "starts_at": utc(starts_at), "ends_at": utc(ends_at), "per_user_limit": per_user_limit,
              "credit_expiry_days": credit_expiry_days, "updated_at": now()}
    await db.promotions.update_one({"id": promo_id}, {"$set": update})
    return await _view(await get_promotion(promo_id))


async def set_status(promo_id: str, status: str) -> dict:
    if status not in ("active", "ended"):
        raise PromotionError(400, "VALIDATION_FAILED", "Unknown promotion status.")
    await get_promotion(promo_id)
    await db.promotions.update_one({"id": promo_id}, {"$set": {"status": status, "updated_at": now()}})
    return await _view(await get_promotion(promo_id))


async def eligible_user_ids(promo: dict) -> list[str]:
    eligibility = promo.get("eligibility", "all")
    if eligibility == "all":
        return [u["id"] async for u in db.users.find({}, {"id": 1})]
    plan_id = eligibility.split(":", 1)[1]
    subs = db.subscriptions.find({"plan_id": plan_id, "status": {"$in": list(ACTIVE_STATUSES)}}, {"user_id": 1})
    return [s["user_id"] async for s in subs]


async def grant_now(promo_id: str, actor: str, reason: str) -> dict:
    promo = await get_promotion(promo_id)
    settings = await platform_settings.get_settings()
    if not settings["flags"].get("promotions", True):
        raise PromotionError(409, "CONFLICT", "Promotional credits are disabled in platform settings.")
    if promotion_status(promo) != "active":
        raise PromotionError(409, "CONFLICT", "Activate this promotion before granting credits.")
    if utc(promo["starts_at"]) > now():
        raise PromotionError(409, "NOT_STARTED", "This promotion hasn't started yet.")
    expires = None
    if promo.get("credit_expiry_days"):
        expires = now() + timedelta(days=promo["credit_expiry_days"])
    granted = skipped = 0
    for user_id in await eligible_user_ids(promo):
        already = await db.promotion_grants.count_documents({"promotion_id": promo_id, "user_id": user_id})
        if already >= promo.get("per_user_limit", 1):
            skipped += 1
            continue
        key = f"promo:{promo_id}:{user_id}:{already + 1}"
        applied = await credits.grant(user_id, promo["credits"], "promotion_grant",
                                      f"{promo['name']} promotional credits", key, actor, bucket="promotional")
        if not applied:
            skipped += 1
            continue
        await db.promotion_grants.insert_one({
            "id": f"pg_{uuid.uuid4().hex[:12]}", "promotion_id": promo_id, "user_id": user_id,
            "credits": promo["credits"], "remaining": promo["credits"], "ledger_key": key,
            "status": "active", "granted_at": now(), "expires_at": expires, "granted_by": actor, "reason": reason,
        })
        granted += 1
    return {"granted": granted, "skipped": skipped, "creditsEach": promo["credits"]}


async def grants_for(promo_id: str, limit: int = 200) -> list[dict]:
    rows = await db.promotion_grants.find({"promotion_id": promo_id}, {"_id": 0}).sort("granted_at", -1).to_list(limit)
    ids = {r["user_id"] for r in rows}
    users = {u["id"]: u["handle"] async for u in db.users.find({"id": {"$in": list(ids)}}, {"_id": 0, "id": 1, "handle": 1})}
    return [r | {"handle": users.get(r["user_id"], "—"), "granted_at": iso(r["granted_at"]),
                 "expires_at": iso(r.get("expires_at"))} for r in rows]


async def backfill_remaining() -> dict:
    """One-time repair for grants created before per-grant remaining balances existed."""
    updated = 0
    async for grant in db.promotion_grants.find({"remaining": {"$exists": False}}):
        remaining = grant["credits"] if grant.get("status") == "active" else 0
        await db.promotion_grants.update_one({"id": grant["id"]}, {"$set": {"remaining": remaining}})
        updated += 1
    return {"grants": updated}


async def expire_due(limit: int = 1000) -> int:
    changed = 0
    async for grant in db.promotion_grants.find(
            {"status": "active", "expires_at": {"$ne": None, "$lte": now()}}).limit(limit):
        remaining = max(0, grant.get("remaining", 0))
        acc = await db.credit_accounts.find_one({"user_id": grant["user_id"]}, {"_id": 0})
        unused = min(remaining, max(0, (acc or {}).get("promotional", 0)), max(0, (acc or {}).get("available", 0)))
        if unused:
            done = await db.credit_accounts.find_one_and_update(
                {"user_id": grant["user_id"], "available": {"$gte": unused}, "promotional": {"$gte": unused}},
                {"$inc": {"available": -unused, "promotional": -unused}, "$set": {"updated_at": now()}})
            if done:
                await credits.write_ledger(grant["user_id"], "promotion_expire", unused, -unused, 0,
                                           "Promotional credits expired", f"{grant['ledger_key']}:expire", "system",
                                           bucket="promotional")
        await db.promotion_grants.update_one(
            {"id": grant["id"]}, {"$set": {"status": "expired", "remaining": 0, "expired_at": now()}})
        changed += 1
    async for promo in db.promotions.find({"status": "active", "ends_at": {"$lte": now()}}).limit(limit):
        await db.promotions.update_one({"id": promo["id"]}, {"$set": {"status": "ended", "updated_at": now()}})
        changed += 1
    return changed


async def sweep_loop():
    while True:
        try:
            await expire_due()
        except Exception:
            logging.exception("Promotion sweep error")
        await asyncio.sleep(300)
