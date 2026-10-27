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


class CreditError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra):
        super().__init__(message)
        self.status, self.code, self.message, self.extra = status, code, message, extra


async def ensure_indexes() -> None:
    await db.credit_reservations.create_index("id", unique=True)
    await db.credit_reservations.create_index([("user_id", 1), ("request_id", 1)], unique=True)
    await db.credit_reservations.create_index([("status", 1), ("created_at", 1)])
    await db.ai_usage.create_index("id", unique=True)
    await db.ai_usage.create_index([("user_id", 1), ("created_at", -1)])


async def write_ledger(user_id: str, kind: str, credits: int, available_delta: int, reserved_delta: int, reason: str,
                       idempotency_key: str, actor: str = "system", **extra) -> None:
    await db.credit_ledger.insert_one({
        "id": f"ctx_{uuid.uuid4().hex[:16]}", "user_id": user_id, "type": kind, "credits": credits,
        "available_delta": available_delta, "reserved_delta": reserved_delta, "reason": reason,
        "idempotency_key": idempotency_key, "actor": actor, "created_at": now(), **extra,
    })


async def grant(user_id: str, credits: int, kind: str, reason: str, idempotency_key: str, actor: str = "system") -> bool:
    """Append a grant once per idempotency key; returns False if it was already applied."""
    try:
        await write_ledger(user_id, kind, credits, credits, 0, reason, idempotency_key, actor)
    except DuplicateKeyError:
        return False
    await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": {"available": credits}, "$set": {"updated_at": now()}})
    return True


async def grant_trial(user_id: str) -> bool:
    return await grant(user_id, TRIAL_GRANT_CREDITS, "trial_grant", "One-time trial credits", f"trial:{user_id}")


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


async def reserve(user_id: str, action: str, request_id: str) -> dict:
    price, pricing_version = await action_price(action)
    amount = price["max_credits"]
    if await db.credit_reservations.find_one({"user_id": user_id, "request_id": request_id}, {"_id": 1}):
        raise CreditError(409, "DUPLICATE_REQUEST", "This AI request was already submitted.")
    account = await db.credit_accounts.find_one_and_update(
        {"user_id": user_id, "available": {"$gte": amount}},
        {"$inc": {"available": -amount, "reserved": amount}, "$set": {"updated_at": now()}}, return_document=ReturnDocument.AFTER)
    if not account:
        current = await db.credit_accounts.find_one({"user_id": user_id}, {"available": 1}) or {}
        raise CreditError(402, "INSUFFICIENT_CREDITS", f"You need {amount} AI credit{'s' if amount != 1 else ''} for this, "
                          f"but have {current.get('available', 0)}.", required=amount, available=current.get("available", 0))
    res = {"id": f"rsv_{uuid.uuid4().hex[:16]}", "user_id": user_id, "request_id": request_id, "action": action,
           "label": price["label"], "pricing_version": pricing_version, "min_credits": price["min_credits"],
           "amount": amount, "max_output_tokens": price["max_output_tokens"], "status": "held", "created_at": now()}
    try:
        await db.credit_reservations.insert_one(dict(res))
    except DuplicateKeyError:
        await db.credit_accounts.update_one({"user_id": user_id}, {"$inc": {"available": amount, "reserved": -amount}})
        raise CreditError(409, "DUPLICATE_REQUEST", "This AI request was already submitted.")
    await write_ledger(user_id, "reserve", amount, -amount, amount, f"Held for {price['label']}", f"{res['id']}:reserve",
                       reservation_id=res["id"], action=action, pricing_version=pricing_version, request_id=request_id)
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
    refund = res["amount"] - charged
    await db.credit_accounts.update_one(
        {"user_id": res["user_id"]}, {"$inc": {"available": refund, "reserved": -res["amount"]}, "$set": {"updated_at": now()}})
    common = {"reservation_id": res["id"], "action": res["action"], "pricing_version": res["pricing_version"], "request_id": res["request_id"]}
    if charged:
        await write_ledger(res["user_id"], "charge", charged, 0, -charged, res["label"], f"{res['id']}:charge", **common)
    if refund:
        await write_ledger(res["user_id"], "release", refund, refund, -refund, reason, f"{res['id']}:release", **common)
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


async def record_usage(res: dict, status: str, charged: int, output_chars: int, ms: int, error: str | None = None) -> None:
    await db.ai_usage.insert_one({
        "id": f"req_{uuid.uuid4().hex[:16]}", "user_id": res["user_id"], "request_id": res["request_id"], "action": res["action"],
        "pricing_version": res["pricing_version"], "provider": "openai", "model": "gpt-6-luna", "reserved": res["amount"],
        "charged": charged, "output_chars": output_chars, "est_output_tokens": math.ceil(output_chars / 4), "ms": ms,
        "status": status, "error": error, "created_at": now(),
    })


async def balance(user_id: str) -> dict:
    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return {"available": acc.get("available", 0), "reserved": acc.get("reserved", 0)}


async def history(user_id: str, limit: int) -> list[dict]:
    from auth import iso

    rows = await db.credit_ledger.find({"user_id": user_id}, {"_id": 0, "idempotency_key": 0}).sort("created_at", -1).to_list(limit)
    return [r | {"created_at": iso(r["created_at"])} for r in rows]
