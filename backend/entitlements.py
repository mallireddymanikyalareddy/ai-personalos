import asyncio
import calendar
import logging
import uuid
from datetime import datetime, timedelta, timezone

from pymongo.errors import DuplicateKeyError

import credits
import platform_settings
from auth import iso
from billing import now
from db import db

BILLING_PERIODS = ("monthly", "annual")
STATUSES = ("trialing", "active", "past_due", "canceled", "expired")
ACTIVE_STATUSES = ("trialing", "active", "past_due")


class SubscriptionError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def add_months(value: datetime, months: int) -> datetime:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def period_end(start: datetime, billing_period: str) -> datetime:
    return add_months(start, 12 if billing_period == "annual" else 1)


def period_credits(version: dict, billing_period: str) -> int:
    return version["annual_monthly_credits"] if billing_period == "annual" else version["monthly_credits"]


async def ensure_indexes() -> None:
    await db.subscriptions.create_index("id", unique=True)
    await db.subscriptions.create_index("user_id")
    await db.subscriptions.create_index([("status", 1), ("current_period_end", 1)])
    await db.subscription_events.create_index("id", unique=True)
    await db.subscription_events.create_index([("subscription_id", 1), ("created_at", -1)])
    await db.entitlement_runs.create_index("id", unique=True)
    await db.entitlement_runs.create_index([("subscription_id", 1), ("period_start", 1), ("plan_version", 1)], unique=True)
    await db.entitlement_runs.create_index([("user_id", 1), ("created_at", -1)])


async def live_plan_version(plan_id: str) -> dict | None:
    return await db.plan_versions.find_one(
        {"plan_id": plan_id, "status": "published", "effective_at": {"$lte": now()}},
        {"_id": 0}, sort=[("effective_at", -1), ("version", -1)])


async def pinned_plan_version(sub: dict) -> dict | None:
    version = await db.plan_versions.find_one(
        {"plan_id": sub["plan_id"], "version": sub["plan_version"]}, {"_id": 0})
    return version or await live_plan_version(sub["plan_id"])


async def find_user(identifier: str) -> dict:
    ident = identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"id": identifier}, {"handle": ident}, {"email": ident}]}, {"_id": 0})
    if not user:
        raise SubscriptionError(404, "NOT_FOUND", "User not found.")
    return user


async def expire_included(user_id: str, key: str, actor: str) -> int:
    """Expire the exact unspent included-credit bucket (held credits are not included)."""
    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0})
    unused = max(0, min((acc or {}).get("included", 0), (acc or {}).get("available", 0)))
    if not unused:
        return 0
    done = await db.credit_accounts.find_one_and_update(
        {"user_id": user_id, "available": {"$gte": unused}, "included": {"$gte": unused}},
        {"$inc": {"available": -unused}, "$set": {"included": 0, "updated_at": now()}})
    if done:
        await credits.write_ledger(user_id, "included_expire", unused, -unused, 0,
                                   "Unused included credits expired", f"{key}:expire", actor, bucket="included")
        return unused
    return 0


async def _event(subscription_id: str, kind: str, actor: str, details: dict | None = None) -> None:
    await db.subscription_events.insert_one({
        "id": f"sev_{uuid.uuid4().hex[:16]}", "subscription_id": subscription_id, "type": kind,
        "actor": actor, "details": details or {}, "created_at": now(),
    })


async def grant_period(sub: dict, period_start: datetime, actor: str = "system") -> dict | None:
    period_start = utc(period_start)
    key = f"sub:{sub['id']}:v{sub.get('plan_version', 1)}:{period_start.isoformat()}"
    try:
        await db.entitlement_runs.insert_one({
            "id": f"ent_{uuid.uuid4().hex[:16]}", "subscription_id": sub["id"], "user_id": sub["user_id"],
            "period_start": period_start, "period_end": utc(sub["current_period_end"]),
            "plan_id": sub["plan_id"], "plan_version": sub["plan_version"], "billing_period": sub["billing_period"],
            "kind": "monthly", "credits": 0, "status": "pending", "ledger_key": key, "actor": actor,
            "created_at": now(),
        })
    except DuplicateKeyError:
        return None
    version = await pinned_plan_version(sub)
    if not version:
        await db.entitlement_runs.update_one({"ledger_key": key}, {"$set": {"status": "failed", "error": "plan version missing"}})
        return None
    settings = await platform_settings.get_settings()
    annual_bonus = settings["flags"].get("annual_bonus_credits", True)
    amount = period_credits(version, sub["billing_period"])
    if sub["billing_period"] == "annual" and not annual_bonus:
        amount = version["monthly_credits"]
    await expire_included(sub["user_id"], key, actor)
    if amount > 0:
        await credits.grant(sub["user_id"], amount, "plan_grant", f"{version['name']} included credits", key, actor,
                            bucket="included")
        await db.credit_accounts.update_one(
            {"user_id": sub["user_id"]},
            {"$set": {"included_total": amount, "included_since": period_start, "updated_at": now()}})
    else:
        await db.credit_accounts.update_one(
            {"user_id": sub["user_id"]},
            {"$set": {"included": 0, "included_total": 0, "included_since": period_start, "updated_at": now()}})
    await db.entitlement_runs.update_one(
        {"ledger_key": key}, {"$set": {"status": "granted" if amount else "skipped", "credits": amount, "granted_at": now()}})
    await _event(sub["id"], "credits_granted", actor,
                 {"period_start": iso(period_start), "credits": amount, "billing_period": sub["billing_period"]})
    return await db.entitlement_runs.find_one({"ledger_key": key}, {"_id": 0})


async def _grant_trial(sub: dict, version: dict, actor: str) -> None:
    amount = version.get("trial_credits", 0)
    if amount > 0:
        await credits.grant(sub["user_id"], amount, "plan_trial", "Trial credits", f"sub:{sub['id']}:trial", actor,
                            bucket="purchased")
    await _event(sub["id"], "trial_started", actor, {"credits": amount, "trial_days": version.get("trial_days", 0)})


async def create_subscription(identifier: str, plan_id: str, billing_period: str, actor: str,
                              trial_days: int | None = None, status: str | None = None) -> dict:
    if billing_period not in BILLING_PERIODS:
        raise SubscriptionError(400, "VALIDATION_FAILED", "Choose monthly or annual billing.")
    if status is not None and status not in STATUSES:
        raise SubscriptionError(400, "VALIDATION_FAILED", "Unknown subscription status.")
    user = await find_user(identifier)
    version = await live_plan_version(plan_id)
    if not version:
        raise SubscriptionError(404, "NOT_FOUND", "That plan is not available.")
    existing = await db.subscriptions.find_one({"user_id": user["id"], "status": {"$in": list(ACTIVE_STATUSES)}})
    if existing:
        raise SubscriptionError(409, "CONFLICT", "This user already has an active subscription.")
    start = now()
    days = version.get("trial_days", 0) if trial_days is None else trial_days
    if status is None:
        status = "trialing" if days > 0 else "active"
    end = start + timedelta(days=days) if status == "trialing" else period_end(start, billing_period)
    sub = {
        "id": f"sub_{uuid.uuid4().hex[:12]}", "user_id": user["id"], "plan_id": plan_id,
        "plan_version": version["version"], "billing_period": billing_period, "status": status,
        "started_at": start, "current_period_start": start, "current_period_end": end,
        "trial_ends_at": end if status == "trialing" else None, "cancel_at_period_end": False,
        "canceled_at": None, "provider": "manual", "payment_status": "manual",
        "created_by": actor, "created_at": start, "updated_at": start,
    }
    await db.subscriptions.insert_one(dict(sub))
    await _event(sub["id"], "created", actor,
                 {"plan_id": plan_id, "plan_version": version["version"], "billing_period": billing_period, "status": status})
    if status == "trialing":
        await _grant_trial(sub, version, actor)
    elif status == "active":
        await grant_period(sub, start, actor)
    return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})


async def renew(sub: dict, actor: str = "system") -> dict:
    start = utc(sub["current_period_end"])
    end = period_end(start, sub["billing_period"])
    while end <= now():
        start, end = end, period_end(end, sub["billing_period"])
    live = await live_plan_version(sub["plan_id"])
    update = {"status": "active", "current_period_start": start, "current_period_end": end,
              "cancel_at_period_end": False, "canceled_at": None, "updated_at": now()}
    if live:
        update["plan_version"] = live["version"]
    await db.subscriptions.update_one({"id": sub["id"]}, {"$set": update})
    fresh = await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})
    await _event(sub["id"], "renewed", actor,
                 {"period_start": iso(start), "period_end": iso(end), "plan_version": update.get("plan_version", sub["plan_version"])})
    await grant_period(fresh, start, actor)
    return fresh


async def end_trial(sub: dict, actor: str = "system") -> dict:
    await db.subscriptions.update_one(
        {"id": sub["id"]}, {"$set": {"status": "expired", "canceled_at": now(), "updated_at": now()}})
    await _event(sub["id"], "trial_ended", actor, {"period_end": iso(sub["current_period_end"])})
    return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})


async def expire(sub: dict, actor: str, reason: str) -> dict:
    await db.subscriptions.update_one(
        {"id": sub["id"]}, {"$set": {"status": "expired", "canceled_at": now(), "updated_at": now()}})
    await _event(sub["id"], "expired", actor, {"reason": reason})
    return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})


async def cancel(sub: dict, actor: str, reason: str, at_period_end: bool) -> dict:
    if sub["status"] == "expired":
        raise SubscriptionError(409, "CONFLICT", "This subscription has already ended.")
    if at_period_end:
        await db.subscriptions.update_one(
            {"id": sub["id"]}, {"$set": {"cancel_at_period_end": True, "updated_at": now()}})
        await _event(sub["id"], "cancel_scheduled", actor, {"reason": reason, "period_end": iso(sub["current_period_end"])})
        return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})
    await db.subscriptions.update_one(
        {"id": sub["id"]}, {"$set": {"status": "canceled", "cancel_at_period_end": False,
                                     "canceled_at": now(), "updated_at": now()}})
    await _event(sub["id"], "canceled", actor, {"reason": reason})
    return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})


async def resume(sub: dict, actor: str) -> dict:
    if sub["status"] == "expired":
        raise SubscriptionError(409, "CONFLICT", "This subscription has already ended.")
    await db.subscriptions.update_one(
        {"id": sub["id"]}, {"$set": {"status": "active", "cancel_at_period_end": False,
                                     "canceled_at": None, "updated_at": now()}})
    await _event(sub["id"], "resumed", actor, {})
    return await db.subscriptions.find_one({"id": sub["id"]}, {"_id": 0})


async def run_due(limit: int = 500) -> int:
    changed = 0
    query = {"status": {"$in": list(ACTIVE_STATUSES)}, "current_period_end": {"$lte": now()}}
    async for sub in db.subscriptions.find(query).limit(limit):
        if sub["status"] == "trialing":
            await end_trial(sub)
        elif sub.get("cancel_at_period_end"):
            await expire(sub, "system", "Canceled at period end")
        elif sub["status"] == "active":
            await renew(sub)
        else:
            continue
        changed += 1
    return changed


async def sweep_loop():
    while True:
        try:
            await run_due()
        except Exception:
            logging.exception("Entitlement sweep error")
        await asyncio.sleep(300)


def public_subscription(sub: dict, user: dict | None = None, version: dict | None = None) -> dict:
    return {
        "id": sub["id"], "userId": sub["user_id"], "handle": (user or {}).get("handle"),
        "email": (user or {}).get("email"), "planId": sub["plan_id"], "plan": (version or {}).get("name", sub["plan_id"]),
        "planVersion": sub["plan_version"], "billing": sub["billing_period"], "status": sub["status"],
        "payment": sub.get("payment_status", "manual"), "provider": sub.get("provider", "manual"),
        "start": iso(sub.get("started_at")), "periodStart": iso(sub.get("current_period_start")),
        "periodEnd": iso(sub.get("current_period_end")), "trialEnds": iso(sub.get("trial_ends_at")),
        "cancelAtPeriodEnd": bool(sub.get("cancel_at_period_end")), "canceledAt": iso(sub.get("canceled_at")),
        "createdAt": iso(sub.get("created_at")),
    }
