import uuid

from billing import now
from db import db
from pymongo import ReturnDocument


async def ensure_indexes() -> None:
    await db.admin_approvals.create_index("id", unique=True)
    await db.admin_approvals.create_index([("status", 1), ("created_at", -1)])


async def create(action: str, target_user_id: str, target_handle: str, payload: dict,
                 reason: str, admin: dict) -> dict:
    doc = {
        "id": f"apr_{uuid.uuid4().hex[:12]}", "action": action, "target_user_id": target_user_id,
        "target_handle": target_handle, "payload": payload, "reason": reason,
        "requested_by": admin["id"], "requested_by_handle": admin["handle"],
        "requested_role": admin.get("admin_role"), "status": "pending",
        "created_at": now(), "decided_by": None, "decided_by_handle": None,
        "decided_at": None, "decision_reason": None, "error": None,
    }
    await db.admin_approvals.insert_one(dict(doc))
    return doc


async def get(approval_id: str) -> dict | None:
    return await db.admin_approvals.find_one({"id": approval_id}, {"_id": 0})


async def list_for(status: str = "pending", limit: int = 100) -> list[dict]:
    query = {"status": status} if status else {}
    return await db.admin_approvals.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))


async def claim(approval_id: str) -> dict | None:
    return await db.admin_approvals.find_one_and_update(
        {"id": approval_id, "status": "pending"},
        {"$set": {"status": "processing", "claimed_at": now()}},
        return_document=ReturnDocument.AFTER)


async def finish(approval_id: str, status: str, admin: dict, reason: str, error: str | None = None) -> None:
    await db.admin_approvals.update_one(
        {"id": approval_id},
        {"$set": {"status": status, "decided_by": admin["id"], "decided_by_handle": admin["handle"],
                  "decided_at": now(), "decision_reason": reason, "error": error}})


async def release(approval_id: str) -> None:
    await db.admin_approvals.update_one(
        {"id": approval_id, "status": "processing"}, {"$set": {"status": "pending"}, "$unset": {"claimed_at": ""}})
