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


def consumed_from_hold(hold: dict, charged: int) -> dict:
    """Return how much of a settled charge came from each bucket."""
    leftover = refund_from_hold(hold, charged)
    return {bucket: max(0, int((hold or {}).get(bucket, 0)) - leftover[bucket])
            for bucket in (*BUCKETS, "unallocated")}


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
    match = {"provider": "openai", "model": None, "input_credits_per_1k": 0, "max_input_tokens": 0,
             "request_limit_per_day": 0} | match
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


async def reserve(user_id: str, action: str, request_id: str, input_chars: int = 0) -> dict:
    price, pricing_version = await action_price(action)
    limit = int(price.get("request_limit_per_day", 0))
    if limit:
        day_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
        used = await db.ai_usage.count_documents(
            {"user_id": user_id, "action": action, "created_at": {"$gte": day_start}})
        if used >= limit:
            raise CreditError(429, "ACTION_LIMIT_REACHED",
                              f"This action is limited to {limit} request{'s' if limit != 1 else ''} per day.")
    max_input = int(price.get("max_input_tokens", 0))
    if max_input and input_chars > max_input * 4:
        raise CreditError(400, "INPUT_TOO_LARGE",
                          f"This action accepts up to {max_input:,} input tokens. Shorten the input and try again.",
                          maxInputTokens=max_input)
    rate = int(price.get("input_credits_per_1k", 0))
    extra = math.ceil(max(0, input_chars) / 4 / 1000) * rate if rate else 0
    amount = price["max_credits"] + extra
    if await db.credit_reservations.find_one({"user_id": user_id, "request_id": request_id}, {"_id": 1}):
        raise CreditError(409, "DUPLICATE_REQUEST", "This AI request was already submitted.")
    hold, account = await _hold_buckets(user_id, amount)
    if not account:
        current = await db.credit_accounts.find_one({"user_id": user_id}, {"available": 1}) or {}
        raise CreditError(402, "INSUFFICIENT_CREDITS", f"You need {amount} AI credit{'s' if amount != 1 else ''} for this, "
                          f"but have {current.get('available', 0)}.", required=amount, available=current.get("available", 0))
    res = {"id": f"rsv_{uuid.uuid4().hex[:16]}", "user_id": user_id, "request_id": request_id, "action": action,
           "label": price["label"], "pricing_version": pricing_version, "min_credits": price["min_credits"] + extra,
           "amount": amount, "max_output_tokens": price["max_output_tokens"], "status": "held", "created_at": now(),
           "bucket_hold": hold, "included_since": account.get("included_since"),
           "model": price.get("model") or None, "input_credits": extra}
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


async def _finish(res: dict, status: str, charged: int, reason: str,
                  from_statuses: tuple[str, ...] = ("held",), extra: dict | None = None) -> bool:
    update = {"$set": {"status": status, "charged": charged, "finished_at": now(), **(extra or {})}}
    done = await db.credit_reservations.find_one_and_update(
        {"id": res["id"], "status": {"$in": list(from_statuses)}}, update)
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


async def mark_reconciliation(res: dict, reason: str) -> bool:
    """Keep credits reserved when the provider may have completed an unknown-outcome request."""
    done = await db.credit_reservations.find_one_and_update(
        {"id": res["id"], "status": "held"},
        {"$set": {"status": "reconciliation_required", "reconciliation_reason": reason,
                  "reconciliation_flagged_at": now()}})
    return bool(done)


async def resolve_reconciliation(res: dict, charge_credits: int | None, reason: str, actor: str) -> dict:
    """Admin decision for an ambiguous request: charge a final amount or return the whole hold."""
    current = await db.credit_reservations.find_one({"id": res["id"]}, {"_id": 0})
    if not current or current.get("status") != "reconciliation_required":
        raise CreditError(409, "CONFLICT", "This request is no longer waiting for reconciliation.")
    extra = {"reconciliation_decision": "charge" if charge_credits is not None else "refund",
             "reconciliation_resolved_at": now(), "reconciliation_resolved_by": actor}
    if charge_credits is None:
        done = await _finish(current, "released", 0, reason, from_statuses=("reconciliation_required",), extra=extra)
        if not done:
            raise CreditError(409, "CONFLICT", "This request was already resolved.")
        return {"status": "released", "charged": 0, "resolved": done, "balance": await balance(current["user_id"])}
    amount = max(0, min(int(charge_credits), int(current.get("amount", 0))))
    done = await _finish(current, "settled", amount, reason, from_statuses=("reconciliation_required",), extra=extra)
    if not done:
        raise CreditError(409, "CONFLICT", "This request was already resolved.")
    return {"status": "settled", "charged": amount, "resolved": done, "balance": await balance(current["user_id"])}


async def release_cancelled(res: dict) -> None:
    """Return a hold when safe; flag it for reconciliation when the provider may have replied."""
    current = await db.credit_reservations.find_one({"id": res["id"]}, {"_id": 0})
    if not current or current.get("status") != "held":
        return
    if current.get("provider_started_at"):
        reason = ("Client disconnected after the AI provider started — outcome unknown"
                  if not current.get("output_started_at") else "Client disconnected mid-response — outcome unknown")
        if await mark_reconciliation(current, reason):
            await record_usage(current, "reconciliation_required", 0, 0, 0, reason)
        return
    if await release(current, "Request was cancelled — credits returned"):
        await record_usage(current, "cancelled", 0, 0, 0)


async def release_stale() -> int:
    count = 0
    async for res in db.credit_reservations.find({"status": "held", "created_at": {"$lt": now() - STALE_AFTER}}, {"_id": 0}):
        # Only holds where the provider never started are safe to return blindly.
        if res.get("provider_started_at"):
            if await mark_reconciliation(res, "Request timed out — provider outcome unknown"):
                await record_usage(res, "reconciliation_required", 0, 0, 0, "Stale hold flagged for reconciliation")
        else:
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
        "id": f"req_{uuid.uuid4().hex[:16]}", "user_id": res["user_id"], "reservation_id": res.get("id"),
        "request_id": res["request_id"], "action": res["action"],
        "pricing_version": res["pricing_version"], "provider": "openai",
        "model": res.get("model", "gpt-6-luna"), "reserved": res["amount"],
        "charged": charged, "output_chars": output_chars, "est_output_tokens": math.ceil(output_chars / 4),
        "input_chars": input_chars, "est_input_tokens": math.ceil(input_chars / 4), "ms": ms,
        "status": status, "error": error, "created_at": now(),
    })


async def _restore_promotions(user_id: str, amount: int) -> None:
    """Put credited promotional spend back on the grants that supplied it (latest expiring first)."""
    if amount <= 0:
        return
    grants = await db.promotion_grants.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).sort([("expires_at", -1), ("granted_at", -1)]).to_list(500)
    for grant in grants:
        room = max(0, int(grant.get("credits", 0)) - int(grant.get("remaining", 0)))
        give = min(amount, room)
        if give:
            await db.promotion_grants.update_one({"id": grant["id"]}, {"$inc": {"remaining": give}})
            amount -= give
        if amount <= 0:
            break


async def refund_usage(user_id: str, reservation_id: str | None, request_id: str | None, amount: int | None,
                       reason: str, key: str, actor: str = "system") -> dict:
    """Refund a settled AI charge once per idempotency key, restoring the original buckets."""
    query = {"user_id": user_id}
    if reservation_id:
        query["id"] = reservation_id
    elif request_id:
        query["request_id"] = request_id
    else:
        raise CreditError(400, "VALIDATION_FAILED", "Choose the AI transaction to refund.")
    res = await db.credit_reservations.find_one(query, {"_id": 0})
    if not res:
        raise CreditError(404, "NOT_FOUND", "AI transaction not found.")
    if res.get("status") not in ("settled", "refunded"):
        raise CreditError(409, "CONFLICT", "Only settled AI transactions can be refunded.")
    charged = int(res.get("charged", 0))
    already = int(res.get("refunded_credits", 0))
    remaining = max(0, charged - already)
    if remaining <= 0:
        return {"refunded": 0, "alreadyRefunded": already, "duplicate": True,
                "balance": await balance(user_id), "status": res.get("status")}
    if await db.credit_ledger.find_one({"idempotency_key": key}, {"_id": 1}):
        return {"refunded": 0, "alreadyRefunded": already, "duplicate": True,
                "balance": await balance(user_id), "status": res.get("status")}
    want = remaining if amount is None else int(amount)
    if want <= 0:
        raise CreditError(400, "VALIDATION_FAILED", "Choose a positive refund amount.")
    want = min(want, remaining)

    # Claim the transaction so two different refund keys can't credit the same charge twice.
    claimed = await db.credit_reservations.find_one_and_update(
        {"id": res["id"], "status": {"$in": ["settled", "refunded"]},
         "refund_processing": {"$exists": False},
         "$or": [{"refunded_credits": already}, {"refunded_credits": {"$exists": False}}]},
        {"$set": {"refund_processing": key}})
    if not claimed:
        raise CreditError(409, "CONFLICT", "This refund is already being processed. Reload and check the balance.")

    hold = res.get("bucket_hold") or {"unallocated": res.get("amount", 0)}
    consumed = consumed_from_hold(hold, charged)
    refunded_buckets = dict(res.get("refunded_buckets") or {})
    take: dict[str, int] = {}
    left = want
    for bucket in (*BUCKETS, "unallocated"):
        room = max(0, consumed.get(bucket, 0) - int(refunded_buckets.get(bucket, 0)))
        use = min(left, room)
        take[bucket] = use
        left -= use
    if left:  # Defensive: never lose a refund if the hold metadata is incomplete.
        take["purchased"] = take.get("purchased", 0) + left
        left = 0

    account = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    # Expired included credits come back as non-expiring purchased credits.
    if take.get("included") and res.get("included_since") and account.get("included_since") != res.get("included_since"):
        take["purchased"] = take.get("purchased", 0) + take["included"]
        take["included"] = 0
    if take.get("unallocated"):
        take["purchased"] = take.get("purchased", 0) + take["unallocated"]
        take["unallocated"] = 0

    inc: dict = {"available": want}
    for bucket in BUCKETS:
        if take.get(bucket):
            inc[bucket] = take[bucket]
    await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": inc, "$set": {"updated_at": now()}})
    await _restore_promotions(user_id, take.get("promotional", 0))

    total_refunded = already + want
    full = total_refunded >= charged
    for bucket, value in take.items():
        if value:
            refunded_buckets[bucket] = int(refunded_buckets.get(bucket, 0)) + value
    await db.credit_reservations.update_one(
        {"id": res["id"]},
        {"$set": {"status": "refunded" if full else "settled",
                  "refund_status": "refunded" if full else "partially_refunded",
                  "refunded_credits": total_refunded, "refunded_buckets": refunded_buckets,
                  "refunded_at": now(), "refund_reason": reason},
         "$unset": {"refund_processing": ""}})
    await db.ai_usage.update_many(
        {"$or": [{"reservation_id": res["id"]},
                 {"user_id": user_id, "request_id": res.get("request_id")}]},
        {"$set": {"refunded_credits": total_refunded,
                  "refund_status": "refunded" if full else "partially_refunded",
                  "refunded_at": now()}})
    await write_ledger(
        user_id, "refund", want, want, 0, reason, key, actor, reservation_id=res["id"],
        action=res.get("action"), request_id=res.get("request_id"), pricing_version=res.get("pricing_version"),
        buckets=take, refund_of=res["id"], partial=not full)
    return {"refunded": want, "alreadyRefunded": total_refunded, "duplicate": False,
            "status": "refunded" if full else "partially_refunded", "balance": await balance(user_id)}


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


async def debit(user_id: str, amount: int, kind: str, reason: str, key: str, actor: str) -> bool:
    """Remove credits from buckets; returns False when the ledger key was already used."""
    if amount <= 0:
        return False
    if await db.credit_ledger.find_one({"idempotency_key": key}, {"_id": 1}):
        return False
    take: dict = {}
    for _ in range(5):
        acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0})
        if not acc or acc.get("available", 0) < amount:
            raise CreditError(400, "INSUFFICIENT_CREDITS", "The user doesn't have that many available credits.")
        take = allocate(acc, amount)
        inc: dict = {"available": -amount}
        match: dict = {"user_id": user_id, "available": {"$gte": amount}}
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
        await write_ledger(user_id, kind, amount, -amount, 0, reason, key, actor, buckets=take)
    except DuplicateKeyError:
        undo: dict = {"available": amount}
        for bucket in BUCKETS:
            undo[bucket] = take[bucket]
        await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": undo})
        return False
    return True


async def adjust(user_id: str, delta: int, reason: str, key: str, actor: str) -> bool:
    """Admin add/remove; removals never take available below zero. Returns False on a replayed key."""
    if delta > 0:
        return await grant(user_id, delta, "admin_grant", reason, key, actor, bucket="purchased")
    if delta == 0:
        return False
    return await debit(user_id, -delta, "admin_debit", reason, key, actor)


async def gift(sender_id: str, recipient_id: str, amount: int, reason: str, key: str, actor: str) -> dict:
    if sender_id == recipient_id:
        raise CreditError(400, "VALIDATION_FAILED", "You can't gift credits to yourself.")
    if amount <= 0:
        raise CreditError(400, "VALIDATION_FAILED", "Choose a positive credit amount.")
    if not await debit(sender_id, amount, "gift_sent", reason, f"{key}:sent", actor):
        raise CreditError(409, "DUPLICATE_REQUEST", "This gift was already submitted.")
    if not await grant(recipient_id, amount, "gift_received", reason, f"{key}:received", actor, bucket="purchased"):
        await grant(sender_id, amount, "gift_refund", "Gift could not be completed - credits returned",
                    f"{key}:refund", "system", bucket="purchased")
        raise CreditError(409, "CONFLICT", "Gift could not be completed. Credits returned.")
    return {"sender": await balance(sender_id)}
