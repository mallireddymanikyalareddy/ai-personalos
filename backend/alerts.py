import asyncio
import logging
from datetime import timedelta, timezone

import digest
import platform_settings
from admin import admin_emails
from alert_rules import allows_alerts, projected_days
from billing import now
from db import db

LOW_COOLDOWN = timedelta(hours=24)
SUMMARY_COOLDOWN = timedelta(days=6)
WEEK_START_HOUR = 8


def _aware(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def ensure_indexes() -> None:
    await db.alert_state.create_index("key", unique=True)


async def _charged_since(user_id: str, since) -> int:
    rows = await db.ai_usage.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": since}, "charged": {"$gt": 0}}},
        {"$group": {"_id": None, "n": {"$sum": "$charged"}}},
    ]).to_list(1)
    return rows[0]["n"] if rows else 0


async def _user(user_id: str) -> dict | None:
    return await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "email": 1, "display_name": 1,
                                                          "timezone": 1, "preferences": 1})


async def _send(coro, label: str) -> bool:
    try:
        await coro
        return True
    except Exception as exc:
        logging.warning("Credit alert (%s) not sent: %s", label, exc)
        return False


async def low_credit_pass() -> int:
    if not digest.email_configured() or not digest.public_app_url():
        return 0
    settings = await platform_settings.get_settings()
    threshold = max(0, int(settings.get("lowCreditThreshold", 3)))
    sent = 0
    async for acc in db.credit_accounts.find({"available": {"$lte": threshold}}):
        user = await _user(acc["user_id"])
        if not user or not user.get("email") or not allows_alerts(user):
            continue
        last = acc.get("low_alert_at")
        if last and now() - _aware(last) < LOW_COOLDOWN:
            continue
        charged = await _charged_since(acc["user_id"], now() - timedelta(days=14))
        days = projected_days(acc.get("available", 0), charged)
        await db.credit_accounts.update_one({"user_id": acc["user_id"]}, {"$set": {"low_alert_at": now()}})
        if await _send(digest.send_low_credits(user, acc.get("available", 0), threshold, days), "low-credit"):
            sent += 1
    return sent


async def weekly_summary_pass() -> int:
    if not digest.email_configured() or not digest.public_app_url():
        return 0
    sent = 0
    async for acc in db.credit_accounts.find({}):
        user = await _user(acc["user_id"])
        if not user or not user.get("email") or not allows_alerts(user):
            continue
        local = digest.local_now(user.get("timezone") or "UTC")
        if local.weekday() != 0 or local.hour < WEEK_START_HOUR:
            continue
        last = acc.get("summary_at")
        if last and now() - _aware(last) < SUMMARY_COOLDOWN:
            continue
        used = await _charged_since(acc["user_id"], now() - timedelta(days=7))
        charged = await _charged_since(acc["user_id"], now() - timedelta(days=14))
        days = projected_days(acc.get("available", 0), charged)
        await db.credit_accounts.update_one({"user_id": acc["user_id"]}, {"$set": {"summary_at": now()}})
        if await _send(digest.send_weekly_credits(user, acc.get("available", 0), acc.get("reserved", 0), used, days),
                       "weekly-summary"):
            sent += 1
    return sent


async def admin_spend_pass() -> int:
    if not digest.email_configured() or not digest.public_app_url():
        return 0
    settings = await platform_settings.get_settings()
    threshold = int(settings.get("monthlySpendAlertPaise", 0))
    value = int(settings.get("creditValuePaise", 0))
    if threshold <= 0 or value <= 0:
        return 0
    month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    charged = await _charged_since_all(month_start)
    estimated = charged * value
    if estimated < threshold:
        return 0
    key = f"admin-spend:{month_start:%Y-%m}"
    if await db.alert_state.find_one({"key": key}, {"_id": 1}):
        return 0
    emails = admin_emails()
    admins = [u async for u in db.users.find({"email": {"$in": list(emails)}}, {"_id": 0, "email": 1, "display_name": 1})]
    if not admins:
        return 0
    sent = 0
    for admin in admins:
        if await _send(digest.send_admin_spend(admin, estimated, charged, threshold, month_start.strftime("%B %Y")),
                       "admin-spend"):
            sent += 1
    if sent:
        await db.alert_state.update_one(
            {"key": key}, {"$setOnInsert": {"key": key, "month": month_start.strftime("%Y-%m"),
                                            "estimated_paise": estimated, "charged_credits": charged,
                                            "created_at": now()}}, upsert=True)
    return sent


async def _charged_since_all(since) -> int:
    rows = await db.ai_usage.aggregate([
        {"$match": {"created_at": {"$gte": since}, "charged": {"$gt": 0}}},
        {"$group": {"_id": None, "n": {"$sum": "$charged"}}},
    ]).to_list(1)
    return rows[0]["n"] if rows else 0


async def pass_once() -> dict:
    return {"low": await low_credit_pass(), "weekly": await weekly_summary_pass(), "adminSpend": await admin_spend_pass()}


async def loop():
    while True:
        try:
            await pass_once()
        except Exception:
            logging.exception("Credit alert loop error")
        await asyncio.sleep(1800)
