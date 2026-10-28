import asyncio
import logging
import math
import uuid
from datetime import timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from billing import now
from db import db

TRIAL_GRANT_CREDITS = 10
STALE_AFTER = timedelta(minutes=10)
# Spend order: expiring promotional credits first, then this period's included credits, then
# non-expiring purchased/bonus credits. Anything not represented in a bucket is legacy/unallocated.
BUCKETS = ("promotional", "included", "purchased")


def allocate(account: dict, amount: int) -> dict:
    """Split an amount across buckets in spend order; the remainder is unallocated."""
    take: dict[str, int] = {}
    left = max(0, amount)
    for bucket in BUCKETS:
        value = max(0, int((account or {}).get(bucket, 0)))
        used = min(left, value)
        take[bucket] = used
        left -= used
    take["unallocated"] = left
    return take


def refund_from_hold(hold: dict, charged: int) -> dict:
    """Consume `charged` from a hold in bucket order and return what is left per bucket."""
    left = max(0, charged)
    refund: dict[str, int] = {}
    for bucket in (*BUCKETS, "unallocated"):
        value = max(0, int((hold or {}).get(bucket, 0)))
        used = min(left, value)
        left -= used
        refund[bucket] = value - used
    return refund


class CreditError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra):
        super().__init__(message)
        self.status, self.code, self.message, self.extra = status, code, message, extra


async def ensure_indexes() -> None:
    await db.credit_reservations.create_index("id", unique=True)
    await db.credit_reservations.create_index([("user_id", 1), ("request_id", 1)], unique=True)
    await db.credit_reservations.create_index([("status", 1), ("created_at", 1)])
    await db.credit_accounts.create_index("available")
    await db.ai_usage.create_index("id", unique=True)
    await db.ai_usage.create_index([("user_id", 1), ("created_at", -1)])


async def write_ledger(user_id: str, kind: str, credits: int, available_delta: int, reserved_delta: int, reason: str,
                       idempotency_key: str, actor: str = "system", **extra) -> None:
    await db.credit_ledger.insert_one({
        "id": f"ctx_{uuid.uuid4().hex[:16]}", "user_id": user_id, "type": kind, "credits": credits,
        "available_delta": available_delta, "reserved_delta": reserved_delta, "reason": reason,
        "idempotency_key": idempotency_key, "actor": actor, "created_at": now(), **extra,
    })


async def grant(user_id: str, credits: int, kind: str, reason: str, idempotency_key: str, actor: str = "system",
                bucket: str = "purchased") -> bool:
    """Append a grant once per idempotency key; returns False if it was already applied."""
    if bucket not in BUCKETS:
        raise ValueError(f"unknown credit bucket: {bucket}")
    try:
        await write_ledger(user_id, kind, credits, credits, 0, reason, idempotency_key, actor, bucket=bucket)
    except DuplicateKeyError:
        return False
    await db.credit_accounts.update_one(
        {"user_id": user_id},
        {"$inc": {"available": credits, bucket: credits}, "$set": {"updated_at": now()},
         "$setOnInsert": {"reserved": 0, "included": 0, "promotional": 0, "purchased": 0, "created_at": now()}},
        upsert=True)
    return True


async def grant_trial(user_id: str) -> bool:
    return await grant(user_id, TRIAL_GRANT_CREDITS, "trial_grant", "One-time trial credits", f"trial:{user_id}",
                       bucket="purchased")


async def backfill_credit_buckets() -> dict:
    """One-time repair for accounts created before explicit buckets existed."""
    updated = 0
    async for acc in db.credit_accounts.find({}, {"_id": 0}):
        available = max(0, int(acc.get("available", 0)))
        included = min(max(0, int(acc.get("included", 0))), available)
        promotional = min(max(0, int(acc.get("promotional", 0))), available - included)
        purchased = max(0, available - included - promotional)
        await db.credit_accounts.update_one(
            {"user_id": acc["user_id"]},
            {"$set": {"included": included, "promotional": promotional, "purchased": purchased, "updated_at": now()}})
        updated += 1
    return {"accounts": updated}


async def backfill_trial_credits() -> dict:
    granted = 0
    async for acc in db.credit_accounts.find({}, {"user_id": 1}):
        granted += await grant_trial(acc["user_id"])
    return {"accounts_granted": granted, "credits_each": TRIAL_GRANT_CREDITS}


async def action_price(action: str) -> tuple[dict, int]:
    version = await db.ai_pricing_versions.find_one(
        {"status": "published", "effective_at": {"$lte": now()}}, {"_id": 0}, sort=[("effective_at", -1), ("version", -1)])
    match = next((a for a in (version or {}).get("actions", []) if a["action"] == action), None)
    if not match:
        raise CreditError(400, "UNKNOWN_ACTION", "That AI action isn't available.")
    return match, version["version"]


async def _hold_buckets(user_id: str, amount: int) -> tuple[dict | None, dict | None]:
    """Atomically move `amount` from the user's buckets into the reserved balance."""
    for _ in range(5):
        acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0})
        if not acc or acc.get("available", 0) < amount:
            return None, None
        hold = allocate(acc, amount)
        inc: dict = {"available": -amount, "reserved": amount}
        match: dict = {"user_id": user_id, "available": {"$gte": amount}}
        for bucket in BUCKETS:
            if hold[bucket]:
                inc[bucket] = -hold[bucket]
                match[bucket] = {"$gte": hold[bucket]}
        updated = await db.credit_accounts.find_one_and_update(
            match, {"$inc": inc, "$set": {"updated_at": now()}}, return_document=ReturnDocument.AFTER)
        if updated:
            return hold, acc
    return None, None


async def _return_hold(user_id: str, hold: dict, amount: int) -> None:
    inc: dict = {"available": amount, "reserved": -amount}
    for bucket in BUCKETS:
        inc[bucket] = hold.get(bucket, 0)
    await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": inc, "$set": {"updated_at": now()}})


async def _consume_promotions(user_id: str, amount: int) -> None:
    """Reduce promotional grant remainders (earliest expiry first) after a charge settles."""
    if amount <= 0:
        return
    grants = db.promotion_grants.find(
        {"user_id": user_id, "status": "active", "remaining": {"$gt": 0}}, {"_id": 0}
    ).sort([("expires_at", 1), ("granted_at", 1)])
    async for grant in grants:
        used = min(amount, grant.get("remaining", 0))
        if used:
            await db.promotion_grants.update_one({"id": grant["id"]}, {"$inc": {"remaining": -used}})
            amount -= used
        if amount <= 0:
            break


async def reserve(user_id: str, action: str, request_id: str) -> dict:
    price, pricing_version = await action_price(action)
    amount = price["max_credits"]
    if await db.credit_reservations.find_one({"user_id": user_id, "request_id": request_id}, {"_id": 1}):
        raise CreditError(409, "DUPLICATE_REQUEST", "This AI request was already submitted.")
    hold, account = await _hold_buckets(user_id, amount)
    if not account:
        current = await db.credit_accounts.find_one({"user_id": user_id}, {"available": 1}) or {}
        raise CreditError(402, "INSUFFICIENT_CREDITS", f"You need {amount} AI credit{'s' if amount != 1 else ''} for this, "
                          f"but have {current.get('available', 0)}.", required=amount, available=current.get("available", 0))
    res = {"id": f"rsv_{uuid.uuid4().hex[:16]}", "user_id": user_id, "request_id": request_id, "action": action,
           "label": price["label"], "pricing_version": pricing_version, "min_credits": price["min_credits"],
           "amount": amount, "max_output_tokens": price["max_output_tokens"], "status": "held", "created_at": now(),
           "bucket_hold": hold, "included_since": account.get("included_since")}
    try:
        await db.credit_reservations.insert_one(dict(res))
    except DuplicateKeyError:
        await _return_hold(user_id, hold, amount)
        raise CreditError(409, "DUPLICATE_REQUEST", "This AI request was already submitted.")
    await write_ledger(user_id, "reserve", amount, -amount, amount, f"Held for {price['label']}", f"{res['id']}:reserve",
                       reservation_id=res["id"], action=action, pricing_version=pricing_version, request_id=request_id,
                       buckets=hold)
    return res


def charge_for(res: dict, output_tokens: int) -> int:
    low, high = res["min_credits"], res["amount"]
    if high <= low:
        return high
    share = min(1.0, output_tokens / max(1, res["max_output_tokens"]))
    return min(high, low + math.ceil((high - low) * share))


async def _finish(res: dict, status: str, charged: int, reason: str) -> bool:
    done = await db.credit_reservations.find_one_and_update(
        {"id": res["id"], "status": "held"}, {"$set": {"status": status, "charged": charged, "finished_at": now()}})
    if not done:
        return False
    hold = done.get("bucket_hold") or res.get("bucket_hold") or {"unallocated": res["amount"]}
    refund_parts = refund_from_hold(hold, charged)
    account = await db.credit_accounts.find_one({"user_id": res["user_id"]}, {"_id": 0}) or {}
    # A hold created before the last included-credit reset must not return expired included credits.
    held_since = done.get("included_since", res.get("included_since"))
    if refund_parts["included"] and held_since and account.get("included_since") != held_since:
        refund_parts["purchased"] += refund_parts["included"]
        refund_parts["included"] = 0
    refund = sum(refund_parts.values())
    inc: dict = {"available": refund, "reserved": -res["amount"]}
    for bucket in BUCKETS:
        inc[bucket] = refund_parts.get(bucket, 0)
    await db.credit_accounts.update_one(
        {"user_id": res["user_id"]}, {"$inc": inc, "$set": {"updated_at": now()}})
    await _consume_promotions(res["user_id"], hold.get("promotional", 0) - refund_parts.get("promotional", 0))
    common = {"reservation_id": res["id"], "action": res["action"], "pricing_version": res["pricing_version"],
              "request_id": res["request_id"], "bucket_hold": hold}
    if charged:
        await write_ledger(res["user_id"], "charge", charged, 0, -charged, res["label"], f"{res['id']}:charge", **common)
    if refund:
        await write_ledger(res["user_id"], "release", refund, refund, -refund, reason, f"{res['id']}:release",
                           **common, buckets=refund_parts)
    return True


async def settle(res: dict, output_tokens: int) -> int:
    charged = charge_for(res, output_tokens)
    if await _finish(res, "settled", charged, "Unused credits returned"):
        return charged
    done = await db.credit_reservations.find_one({"id": res["id"]}, {"charged": 1})
    return done.get("charged", 0)


async def release(res: dict, reason: str) -> bool:
    return await _finish(res, "released", 0, reason)


async def release_cancelled(res: dict) -> None:
    if await release(res, "Request was cancelled — credits returned"):
        await record_usage(res, "cancelled", 0, 0, 0)


async def release_stale() -> int:
    count = 0
    async for res in db.credit_reservations.find({"status": "held", "created_at": {"$lt": now() - STALE_AFTER}}, {"_id": 0}):
        count += await release(res, "Request did not finish — credits returned")
    return count


async def sweep_loop():
    while True:
        try:
            await release_stale()
        except Exception:
            logging.exception("Credit sweep error")
        await asyncio.sleep(300)


async def record_usage(res: dict, status: str, charged: int, output_chars: int, ms: int,
                       error: str | None = None, input_chars: int = 0) -> None:
    await db.ai_usage.insert_one({
        "id": f"req_{uuid.uuid4().hex[:16]}", "user_id": res["user_id"], "request_id": res["request_id"], "action": res["action"],
        "pricing_version": res["pricing_version"], "provider": "openai",
        "model": res.get("model", "gpt-6-luna"), "reserved": res["amount"],
        "charged": charged, "output_chars": output_chars, "est_output_tokens": math.ceil(output_chars / 4),
        "input_chars": input_chars, "est_input_tokens": math.ceil(input_chars / 4), "ms": ms,
        "status": status, "error": error, "created_at": now(),
    })


async def balance(user_id: str) -> dict:
    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return {"available": acc.get("available", 0), "reserved": acc.get("reserved", 0)}


async def balance_detail(user_id: str) -> dict:
    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return {"available": acc.get("available", 0), "reserved": acc.get("reserved", 0),
            "included": acc.get("included", 0), "promotional": acc.get("promotional", 0),
            "purchased": acc.get("purchased", 0)}


async def _usage_sum(user_id: str, since) -> int:
    rows = await db.ai_usage.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": since}, "charged": {"$gt": 0}}},
        {"$group": {"_id": None, "n": {"$sum": "$charged"}}},
    ]).to_list(1)
    return rows[0]["n"] if rows else 0


async def forecast(user_id: str) -> dict:
    from alert_rules import projected_days

    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    used7 = await _usage_sum(user_id, now() - timedelta(days=7))
    used14 = await _usage_sum(user_id, now() - timedelta(days=14))
    return {"daysLeft": projected_days(acc.get("available", 0), used14), "used7d": used7, "used14d": used14}


async def history(user_id: str, limit: int) -> list[dict]:
    from auth import iso

    rows = await db.credit_ledger.find({"user_id": user_id}, {"_id": 0, "idempotency_key": 0}).sort("created_at", -1).to_list(limit)
    return [r | {"created_at": iso(r["created_at"])} for r in rows]


async def adjust(user_id: str, delta: int, reason: str, key: str, actor: str) -> bool:
    """Admin add/remove; removals never take available below zero. Returns False on a replayed key."""
    if delta > 0:
        return await grant(user_id, delta, "admin_grant", reason, key, actor, bucket="purchased")
    if delta == 0:
        return False
    if await db.credit_ledger.find_one({"idempotency_key": key}, {"_id": 1}):
        return False
    take: dict = {}
    for _ in range(5):
        acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0})
        if not acc or acc.get("available", 0) < -delta:
            raise CreditError(400, "INSUFFICIENT_CREDITS", "The user doesn't have that many available credits to remove.")
        take = allocate(acc, -delta)
        inc: dict = {"available": delta}
        match: dict = {"user_id": user_id, "available": {"$gte": -delta}}
        for bucket in BUCKETS:
            if take[bucket]:
                inc[bucket] = -take[bucket]
                match[bucket] = {"$gte": take[bucket]}
        taken = await db.credit_accounts.find_one_and_update(
            match, {"$inc": inc, "$set": {"updated_at": now()}})
        if taken:
            break
    else:
        raise CreditError(400, "CONFLICT", "The balance changed while removing credits. Try again.")
    try:
        await write_ledger(user_id, "admin_debit", -delta, delta, 0, reason, key, actor, buckets=take)
    except DuplicateKeyError:
        undo: dict = {"available": -delta}
        for bucket in BUCKETS:
            undo[bucket] = take[bucket]
        await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": undo})
        return False
    return True
