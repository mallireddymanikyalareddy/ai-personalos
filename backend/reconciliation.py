import asyncio
import logging
import uuid

from billing import now
from db import db


async def ensure_indexes() -> None:
    await db.reconciliation_items.create_index("user_id", unique=True)
    await db.reconciliation_items.create_index([("status", 1), ("checked_at", -1)])


async def run(limit: int = 5000) -> dict:
    """Compare every account balance with the immutable ledger and track mismatches."""
    totals = {row["_id"]: row async for row in db.credit_ledger.aggregate([
        {"$group": {"_id": "$user_id", "available": {"$sum": "$available_delta"},
                    "reserved": {"$sum": "$reserved_delta"}}}
    ])}
    checked = opened = resolved = 0
    async for acc in db.credit_accounts.find({}, {"_id": 0}):
        uid = acc["user_id"]
        ledger = totals.get(uid) or {"available": 0, "reserved": 0}
        available, reserved = acc.get("available", 0), acc.get("reserved", 0)
        if available != ledger["available"] or reserved != ledger["reserved"]:
            await db.reconciliation_items.update_one(
                {"user_id": uid},
                {"$set": {"status": "open", "available": available, "reserved": reserved,
                          "ledger_available": ledger["available"], "ledger_reserved": ledger["reserved"],
                          "available_delta": available - ledger["available"],
                          "reserved_delta": reserved - ledger["reserved"], "checked_at": now()},
                 "$setOnInsert": {"id": f"rec_{uuid.uuid4().hex[:12]}", "created_at": now()}},
                upsert=True)
            opened += 1
        else:
            resolved += (await db.reconciliation_items.delete_one({"user_id": uid})).deleted_count
        checked += 1
        if checked >= limit:
            break
    return {"checked": checked, "opened": opened, "resolved": resolved,
            "open": await db.reconciliation_items.count_documents({"status": "open"})}


async def loop():
    while True:
        try:
            await run()
        except Exception:
            logging.exception("Credit reconciliation error")
        await asyncio.sleep(3600)
