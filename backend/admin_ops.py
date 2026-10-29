import csv
import io
import re
from datetime import timedelta

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

import approvals
import credits
import platform_settings
from mfa import require_step_up
import usage_insights
from admin import ROLES, admin_emails, require_role
from auth import ApiError, iso
from billing import now, record_audit
from db import db

router = APIRouter(prefix="/api/v1/admin")
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)]

CREDIT_ROLES = ("billing_admin", "support_admin")
EXPORT_ROLES = ("billing_admin", "support_admin")
USER_FIELDS = {"_id": 0, "id": 1, "handle": 1, "email": 1, "display_name": 1, "created_at": 1, "admin_role": 1,
               "admin_role_source": 1, "email_verified_at": 1, "suspended_at": 1, "suspension_reason": 1,
               "suspended_by": 1}


def csv_cell(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    text = "" if value is None else str(value)
    # Prevent spreadsheet formula injection from user-controlled text.
    return "'" + text if text.startswith(("=", "+", "-", "@")) else text


def csv_download(filename: str, headers: list[str], rows: list[list]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows([[csv_cell(value) for value in row] for row in rows])
    return StreamingResponse(
        iter([buffer.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


async def handles_for(ids: set[str]) -> dict[str, str]:
    return {u["id"]: u["handle"] async for u in db.users.find({"id": {"$in": list(ids)}}, {"_id": 0, "id": 1, "handle": 1})}


async def with_handles(rows: list[dict], *time_keys: str) -> list[dict]:
    names = await handles_for({r["user_id"] for r in rows if r.get("user_id")})
    return [r | {"handle": names.get(r.get("user_id"), "—")} | {k: iso(r[k]) for k in time_keys if r.get(k)} for r in rows]


def public_admin_user(u: dict, acc: dict | None, sub: dict | None = None) -> dict:
    return {"id": u["id"], "handle": u["handle"], "email": u.get("email"), "displayName": u.get("display_name"),
            "joined": iso(u.get("created_at")), "emailVerified": bool(u.get("email_verified_at")),
            "role": u.get("admin_role"), "roleSource": u.get("admin_role_source"),
            "suspended": bool(u.get("suspended_at")), "suspendedAt": iso(u.get("suspended_at")),
            "suspensionReason": u.get("suspension_reason"),
            "planId": (sub or {}).get("plan_id"), "plan": (sub or {}).get("plan_name"),
            "subscriptionStatus": (sub or {}).get("status"), "billing": (sub or {}).get("billing_period"),
            "available": (acc or {}).get("available", 0), "reserved": (acc or {}).get("reserved", 0),
            "included": (acc or {}).get("included", 0), "promotional": (acc or {}).get("promotional", 0),
            "purchased": (acc or {}).get("purchased", 0)}


async def active_subscriptions(user_ids: list[str]) -> dict[str, dict]:
    if not user_ids:
        return {}
    subs = await db.subscriptions.find(
        {"user_id": {"$in": user_ids}, "status": {"$in": ["active", "trialing", "past_due"]}},
        {"_id": 0}).to_list(5000)
    plan_ids = {s["plan_id"] for s in subs}
    names = {(v["plan_id"], v["version"]): v.get("name", v["plan_id"])
             async for v in db.plan_versions.find({"plan_id": {"$in": list(plan_ids)}}, {"_id": 0})}
    latest = await db.plan_versions.find(
        {"plan_id": {"$in": list(plan_ids)}, "status": "published", "effective_at": {"$lte": now()}},
        {"_id": 0}).sort([("plan_id", 1), ("version", -1)]).to_list(500)
    live: dict[str, str] = {}
    for v in latest:
        live.setdefault(v["plan_id"], v.get("name", v["plan_id"]))
    out = {}
    for sub in subs:
        out.setdefault(sub["user_id"], sub | {
            "plan_name": names.get((sub["plan_id"], sub.get("plan_version", 1))) or live.get(sub["plan_id"])})
    return out


@router.get("/users")
async def list_users(q: str = "", status: str = "", plan: str = "", limit: int = 100,
                     _=Depends(require_role())):
    match = {}
    if q.strip():
        pattern = re.escape(q.strip().lower())
        match = {"$or": [{"handle": {"$regex": pattern, "$options": "i"}}, {"email": {"$regex": pattern, "$options": "i"}}]}
    if status == "suspended":
        match["suspended_at"] = {"$ne": None}
    elif status == "active":
        match["suspended_at"] = None
    subscriptions = await active_subscriptions(
        [u["id"] async for u in db.users.find(match, {"_id": 0, "id": 1})])
    if plan:
        allowed = {uid for uid, sub in subscriptions.items() if sub["plan_id"] == plan}
        match["id"] = {"$in": list(allowed)}
    users = await db.users.find(match, USER_FIELDS).sort("created_at", -1).to_list(max(1, min(limit, 200)))
    accounts = {a["user_id"]: a async for a in db.credit_accounts.find({"user_id": {"$in": [u["id"] for u in users]}}, {"_id": 0})}
    return {"users": [public_admin_user(u, accounts.get(u["id"]), subscriptions.get(u["id"])) for u in users],
            "total": await db.users.count_documents(match)}


async def find_user(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, USER_FIELDS)
    if not user:
        raise ApiError(404, "NOT_FOUND", "User not found.")
    return user


@router.get("/users/{user_id}")
async def user_detail(user_id: str, _=Depends(require_role())):
    user = await find_user(user_id)
    acc = await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0})
    ledger = await credits.history(user_id, 25)
    usage = await db.ai_usage.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0}, sort=[("created_at", -1)])
    sub_public = sub | {k: iso(sub[k]) for k in ("started_at", "current_period_start", "current_period_end",
                                                  "trial_ends_at", "canceled_at", "created_at")
                         if sub.get(k)} if sub else None
    events = []
    plan_name = None
    if sub:
        version = await db.plan_versions.find_one(
            {"plan_id": sub["plan_id"], "version": sub.get("plan_version", 1)}, {"_id": 0})
        plan_name = (version or {}).get("name", sub["plan_id"])
        events = await db.subscription_events.find({"subscription_id": sub["id"]}, {"_id": 0}).sort(
            "created_at", -1).to_list(20)
        events = [e | {"created_at": iso(e["created_at"])} for e in events]
    return {"user": public_admin_user(user, acc, sub | {"plan_name": plan_name} if sub else None),
            "ledger": ledger, "subscription": sub_public, "subscriptionEvents": events,
            "usage": [u | {"created_at": iso(u["created_at"])} for u in usage]}


class SuspendIn(BaseModel):
    reason: Reason


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, body: SuspendIn, auth=Depends(require_role("super_admin", "support_admin"))):
    admin = auth[0]
    if user_id == admin["id"]:
        raise ApiError(400, "VALIDATION_FAILED", "You can't suspend your own account.")
    user = await find_user(user_id)
    if user.get("admin_role_source") == "env" or user.get("email") in admin_emails():
        raise ApiError(400, "VALIDATION_FAILED", "This owner account can't be suspended.")
    reason = body.reason.strip()
    await db.users.update_one({"id": user_id}, {"$set": {
        "suspended_at": now(), "suspension_reason": reason, "suspended_by": admin["handle"]}})
    revoked = await db.sessions.update_many(
        {"user_id": user_id, "revoked_at": None}, {"$set": {"revoked_at": now()}})
    await record_audit(admin["handle"], "user.suspend", "user", user_id, reason, "success", admin["admin_role"],
                       {"sessionsRevoked": revoked.modified_count})
    return {"user": public_admin_user(await find_user(user_id),
                                      await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}))}


@router.post("/users/{user_id}/reinstate")
async def reinstate_user(user_id: str, body: SuspendIn, auth=Depends(require_role("super_admin", "support_admin"))):
    admin = auth[0]
    await find_user(user_id)
    reason = body.reason.strip()
    await db.users.update_one({"id": user_id}, {
        "$unset": {"suspended_at": "", "suspension_reason": "", "suspended_by": ""}})
    await record_audit(admin["handle"], "user.reinstate", "user", user_id, reason, "success", admin["admin_role"])
    return {"user": public_admin_user(await find_user(user_id),
                                      await db.credit_accounts.find_one({"user_id": user_id}, {"_id": 0}))}


class CreditAdjustIn(BaseModel):
    amount: int = Field(ge=-10000, le=10000)
    reason: Reason
    requestId: str = Field(min_length=8, max_length=64)


async def approval_threshold() -> int:
    settings = await platform_settings.get_settings()
    return int(settings.get("approvalThresholdCredits", 1000))


async def _apply_credit_adjust(admin: dict, user_id: str, amount: int, reason: str, key: str,
                               request_id: str | None = None) -> dict:
    action = "credit.grant" if amount > 0 else "credit.remove"
    try:
        applied = await credits.adjust(user_id, amount, reason, key, admin["handle"])
    except credits.CreditError as exc:
        await record_audit(admin["handle"], action, "user", user_id, reason, "failed", admin["admin_role"],
                           {"amount": amount, "requestId": request_id, "error": exc.code})
        raise ApiError(exc.status, exc.code, exc.message)
    if applied:
        await record_audit(admin["handle"], action, "user", user_id, reason, "success", admin["admin_role"],
                           {"amount": amount, "requestId": request_id})
    return {"applied": applied, "balance": await credits.balance(user_id)}


@router.post("/users/{user_id}/credits")
async def adjust_credits(user_id: str, body: CreditAdjustIn, auth=Depends(require_role(*CREDIT_ROLES))):
    admin = auth[0]
    if body.amount == 0:
        raise ApiError(400, "VALIDATION_FAILED", "Amount can't be zero.", [{"field": "amount", "issue": "must not be 0"}])
    user = await find_user(user_id)
    reason = body.reason.strip()
    threshold = await approval_threshold()
    if threshold and abs(body.amount) >= threshold:
        approval = await approvals.create("credit_adjust", user_id, user["handle"],
                                          {"amount": body.amount, "requestId": body.requestId}, reason, admin)
        await record_audit(admin["handle"], "approval.requested", "user", user_id, reason, "success",
                           admin["admin_role"], {"approvalId": approval["id"], "amount": body.amount})
        return JSONResponse(status_code=202, content={"approval_required": True, "approval": jsonable_encoder(approval)})
    return await _apply_credit_adjust(admin, user_id, body.amount, reason, f"admin:{body.requestId}", body.requestId)


class BulkCreditIn(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=200)
    amount: int = Field(ge=-10000, le=10000)
    reason: Reason
    requestId: str = Field(min_length=8, max_length=64)


async def _apply_bulk_credit(admin: dict, user_ids: list[str], amount: int, reason: str, key_prefix: str) -> dict:
    results = []
    applied = failed = 0
    for user_id in dict.fromkeys(user_ids):
        try:
            await find_user(user_id)
            result = await _apply_credit_adjust(admin, user_id, amount, reason, f"{key_prefix}:{user_id}")
            results.append({"userId": user_id, **result})
            applied += 1 if result["applied"] else 0
        except ApiError as exc:
            failed += 1
            results.append({"userId": user_id, "applied": False, "error": exc.detail, "code": exc.code})
    return {"results": results, "applied": applied, "failed": failed,
            "skipped": len(results) - applied - failed}


@router.post("/users/bulk-credits")
async def bulk_adjust_credits(body: BulkCreditIn, auth=Depends(require_role(*CREDIT_ROLES))):
    admin = auth[0]
    if body.amount == 0:
        raise ApiError(400, "VALIDATION_FAILED", "Amount can't be zero.", [{"field": "amount", "issue": "must not be 0"}])
    ids = list(dict.fromkeys(body.user_ids))
    reason = body.reason.strip()
    threshold = await approval_threshold()
    if threshold and abs(body.amount) * len(ids) >= threshold:
        approval = await approvals.create("bulk_credit_adjust", ids[0], f"{len(ids)} users",
                                          {"user_ids": ids, "amount": body.amount, "requestId": body.requestId},
                                          reason, admin)
        await record_audit(admin["handle"], "approval.requested", "user", ids[0], reason, "success",
                           admin["admin_role"], {"approvalId": approval["id"], "amount": body.amount,
                                                "users": len(ids)})
        return JSONResponse(status_code=202, content={"approval_required": True, "approval": jsonable_encoder(approval)})
    return await _apply_bulk_credit(admin, ids, body.amount, reason, f"bulk:{body.requestId}")


class RoleIn(BaseModel):
    role: str | None
    reason: Reason


async def _apply_role_change(admin: dict, user_id: str, role: str | None, reason: str) -> dict:
    if user_id == admin["id"]:
        raise ApiError(400, "VALIDATION_FAILED", "You can't change your own role.")
    user = await find_user(user_id)
    if user.get("admin_role_source") == "env" or user.get("email") in admin_emails():
        raise ApiError(400, "VALIDATION_FAILED", "This owner account's role is set by the server configuration.")
    update = ({"$unset": {"admin_role": "", "admin_role_source": ""}} if role is None
              else {"$set": {"admin_role": role, "admin_role_source": "manual"}})
    await db.users.update_one({"id": user_id}, update)
    await record_audit(admin["handle"], "user.role_change", "user", user_id, reason, "success", admin["admin_role"],
                       {"from": user.get("admin_role"), "to": role})
    return {"user": public_admin_user(await find_user(user_id), await db.credit_accounts.find_one({"user_id": user_id}))}


async def _apply_bulk_role(admin: dict, user_ids: list[str], role: str | None, reason: str) -> dict:
    results = []
    changed = skipped = 0
    for user_id in dict.fromkeys(user_ids):
        if user_id == admin["id"]:
            results.append({"userId": user_id, "changed": False, "error": "You can't change your own role."})
            skipped += 1
            continue
        try:
            user = await find_user(user_id)
            if user.get("admin_role_source") == "env" or user.get("email") in admin_emails():
                results.append({"userId": user_id, "changed": False, "error": "Owner role is server-configured."})
                skipped += 1
                continue
            update = ({"$unset": {"admin_role": "", "admin_role_source": ""}} if role is None
                      else {"$set": {"admin_role": role, "admin_role_source": "manual"}})
            await db.users.update_one({"id": user_id}, update)
            await record_audit(admin["handle"], "user.role_change", "user", user_id, reason, "success",
                               admin["admin_role"], {"from": user.get("admin_role"), "to": role})
            results.append({"userId": user_id, "changed": True, "role": role})
            changed += 1
        except ApiError as exc:
            results.append({"userId": user_id, "changed": False, "error": exc.detail})
            skipped += 1
    return {"results": results, "changed": changed, "skipped": skipped}


@router.put("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, auth=Depends(require_role("super_admin"))):
    admin = auth[0]
    if body.role is not None and body.role not in ROLES:
        raise ApiError(400, "VALIDATION_FAILED", "Unknown role.", [{"field": "role", "issue": "unknown role"}])
    user = await find_user(user_id)
    if user_id == admin["id"]:
        raise ApiError(400, "VALIDATION_FAILED", "You can't change your own role.")
    if user.get("admin_role_source") == "env" or user.get("email") in admin_emails():
        raise ApiError(400, "VALIDATION_FAILED", "This owner account's role is set by the server configuration.")
    reason = body.reason.strip()
    if await approval_threshold() > 0:
        approval = await approvals.create("role_change", user_id, user["handle"], {"role": body.role}, reason, admin)
        await record_audit(admin["handle"], "approval.requested", "user", user_id, reason, "success",
                           admin["admin_role"], {"approvalId": approval["id"], "role": body.role})
        return JSONResponse(status_code=202, content={"approval_required": True, "approval": jsonable_encoder(approval)})
    return await _apply_role_change(admin, user_id, body.role, reason)


class BulkRoleIn(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=200)
    role: str | None
    reason: Reason


@router.put("/users/bulk-role")
async def bulk_set_role(body: BulkRoleIn, auth=Depends(require_role("super_admin"))):
    admin = auth[0]
    if body.role is not None and body.role not in ROLES:
        raise ApiError(400, "VALIDATION_FAILED", "Unknown role.", [{"field": "role", "issue": "unknown role"}])
    ids = list(dict.fromkeys(body.user_ids))
    reason = body.reason.strip()
    if await approval_threshold() > 0:
        approval = await approvals.create("bulk_role_change", ids[0], f"{len(ids)} users",
                                          {"user_ids": ids, "role": body.role}, reason, admin)
        await record_audit(admin["handle"], "approval.requested", "user", ids[0], reason, "success",
                           admin["admin_role"], {"approvalId": approval["id"], "role": body.role,
                                                "users": len(ids)})
        return JSONResponse(status_code=202, content={"approval_required": True, "approval": jsonable_encoder(approval)})
    return await _apply_bulk_role(admin, ids, body.role, reason)


class DecisionIn(BaseModel):
    reason: Reason


def can_decide(admin: dict, action: str) -> bool:
    role = admin.get("admin_role")
    if action in ("credit_adjust", "bulk_credit_adjust", "credit_refund"):
        return role == "super_admin" or role in CREDIT_ROLES
    return role == "super_admin"


@router.get("/approvals")
async def list_approvals(status: str = "pending", limit: int = 200, _=Depends(require_role())):
    return {"approvals": await approvals.list_for(status, limit)}


@router.post("/approvals/{approval_id}/approve")
async def approve_request(approval_id: str, body: DecisionIn, auth=Depends(require_role())):
    admin = auth[0]
    approval = await approvals.get(approval_id)
    if not approval:
        raise ApiError(404, "NOT_FOUND", "Approval request not found.")
    if approval["status"] != "pending":
        raise ApiError(409, "CONFLICT", "This request has already been decided.")
    if approval["requested_by"] == admin["id"]:
        raise ApiError(400, "VALIDATION_FAILED", "You can't approve your own request.")
    if not can_decide(admin, approval["action"]):
        raise ApiError(403, "FORBIDDEN", "Your admin role can't approve this request.")
    require_step_up(admin, auth[1])
    claimed = await approvals.claim(approval_id)
    if not claimed:
        raise ApiError(409, "CONFLICT", "This request was just decided by another admin.")
    reason = body.reason.strip()
    try:
        if approval["action"] == "credit_adjust":
            result = await _apply_credit_adjust(admin, approval["target_user_id"], approval["payload"]["amount"],
                                                approval["reason"], f"approval:{approval_id}")
        elif approval["action"] == "bulk_credit_adjust":
            result = await _apply_bulk_credit(admin, approval["payload"]["user_ids"], approval["payload"]["amount"],
                                              approval["reason"], f"approval:{approval_id}")
        elif approval["action"] == "credit_refund":
            result = await _apply_refund(admin, approval["payload"]["reservationId"], None,
                                         approval["payload"].get("amount"), approval["reason"],
                                         f"approval:{approval_id}")
        elif approval["action"] == "role_change":
            result = await _apply_role_change(admin, approval["target_user_id"], approval["payload"]["role"],
                                              approval["reason"])
        elif approval["action"] == "bulk_role_change":
            result = await _apply_bulk_role(admin, approval["payload"]["user_ids"], approval["payload"]["role"],
                                            approval["reason"])
        else:
            raise ApiError(400, "VALIDATION_FAILED", "Unknown approval action.")
    except ApiError:
        await approvals.release(approval_id)
        raise
    await approvals.finish(approval_id, "approved", admin, reason)
    await record_audit(admin["handle"], "approval.approve", "approval", approval_id, reason, "success",
                       admin["admin_role"], {"action": approval["action"]})
    return {"approval": await approvals.get(approval_id), "result": result}


@router.post("/approvals/{approval_id}/reject")
async def reject_request(approval_id: str, body: DecisionIn, auth=Depends(require_role())):
    admin = auth[0]
    approval = await approvals.get(approval_id)
    if not approval:
        raise ApiError(404, "NOT_FOUND", "Approval request not found.")
    if approval["status"] != "pending":
        raise ApiError(409, "CONFLICT", "This request has already been decided.")
    if not can_decide(admin, approval["action"]):
        raise ApiError(403, "FORBIDDEN", "Your admin role can't reject this request.")
    require_step_up(admin, auth[1])
    claimed = await approvals.claim(approval_id)
    if not claimed:
        raise ApiError(409, "CONFLICT", "This request was just decided by another admin.")
    reason = body.reason.strip()
    await approvals.finish(approval_id, "rejected", admin, reason)
    await record_audit(admin["handle"], "approval.reject", "approval", approval_id, reason, "success",
                       admin["admin_role"], {"action": approval["action"]})
    return {"approval": await approvals.get(approval_id)}


@router.get("/credits/ledger")
async def ledger(type: str = "", limit: int = 100, _=Depends(require_role())):
    match = {"type": type} if type else {}
    rows = await db.credit_ledger.find(match, {"_id": 0, "idempotency_key": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))
    return {"entries": await with_handles(rows, "created_at")}


@router.get("/credits/reconciliations")
async def list_reconciliations(limit: int = 200, _=Depends(require_role())):
    stale_before = now() - credits.STALE_AFTER
    rows = await db.credit_reservations.find(
        {"status": {"$in": ["reconciliation_required", "held"]}}, {"_id": 0}
    ).sort("created_at", 1).to_list(max(1, min(limit, 500)))
    rows = [r for r in rows if r["status"] == "reconciliation_required" or r.get("created_at", now()) < stale_before]
    return {"items": await with_handles(rows, "created_at", "provider_started_at", "reconciliation_flagged_at")}


class ReconciliationIn(BaseModel):
    decision: str = Field(pattern="^(charge|refund)$")
    amount: int | None = Field(default=None, ge=0, le=10000)
    reason: Reason


@router.post("/credits/reconciliations/{reservation_id}/resolve")
async def resolve_reconciliation(reservation_id: str, body: ReconciliationIn,
                                 auth=Depends(require_role(*CREDIT_ROLES))):
    admin = auth[0]
    res = await db.credit_reservations.find_one({"id": reservation_id}, {"_id": 0})
    if not res:
        raise ApiError(404, "NOT_FOUND", "AI request not found.")
    reason = body.reason.strip()
    amount = body.amount if body.amount is not None else int(res.get("amount", 0))
    try:
        result = await credits.resolve_reconciliation(
            res, None if body.decision == "refund" else amount, reason, admin["handle"])
    except credits.CreditError as exc:
        raise ApiError(exc.status, exc.code, exc.message)
    status = "released" if body.decision == "refund" else "succeeded"
    changed = await db.ai_usage.update_one(
        {"reservation_id": reservation_id, "status": "reconciliation_required"},
        {"$set": {"status": status, "charged": result["charged"], "resolution": body.decision,
                  "resolution_reason": reason, "resolved_by": admin["handle"], "resolved_at": now()}})
    if not changed.matched_count:
        await credits.record_usage(res, status, result["charged"], 0, 0, None)
    await record_audit(admin["handle"], f"credit.reconcile_{body.decision}", "user", res["user_id"], reason, "success",
                       admin["admin_role"], {"reservationId": reservation_id, "charged": result["charged"],
                                             "amount": amount})
    return result


class RefundIn(BaseModel):
    reservationId: str | None = Field(default=None, max_length=64)
    requestId: str | None = Field(default=None, max_length=64)
    amount: int | None = Field(default=None, ge=1, le=10000)
    reason: Reason
    idempotencyKey: str = Field(min_length=8, max_length=64)


async def _apply_refund(admin: dict, reservation_id: str | None, request_id: str | None, amount: int | None,
                        reason: str, key: str) -> dict:
    query = {"id": reservation_id} if reservation_id else {"request_id": request_id}
    res = await db.credit_reservations.find_one(query, {"_id": 0})
    if not res:
        raise ApiError(404, "NOT_FOUND", "AI transaction not found.")
    try:
        result = await credits.refund_usage(res["user_id"], res["id"], None, amount, reason, key, admin["handle"])
    except credits.CreditError as exc:
        await record_audit(admin["handle"], "credit.refund", "user", res["user_id"], reason, "failed",
                           admin["admin_role"], {"reservationId": res["id"], "error": exc.code})
        raise ApiError(exc.status, exc.code, exc.message)
    await record_audit(admin["handle"], "credit.refund", "user", res["user_id"], reason, "success",
                       admin["admin_role"], {"reservationId": res["id"], "refunded": result["refunded"],
                                             "duplicate": result["duplicate"]})
    return result | {"userId": res["user_id"], "reservationId": res["id"]}


@router.post("/credits/refunds")
async def refund_usage(body: RefundIn, auth=Depends(require_role(*CREDIT_ROLES))):
    admin = auth[0]
    if not body.reservationId and not body.requestId:
        raise ApiError(400, "VALIDATION_FAILED", "Choose the AI transaction to refund.")
    res = await db.credit_reservations.find_one(
        {"id": body.reservationId} if body.reservationId else {"request_id": body.requestId}, {"_id": 0})
    if not res:
        raise ApiError(404, "NOT_FOUND", "AI transaction not found.")
    reason = body.reason.strip()
    amount = body.amount
    if amount is None:
        amount = max(0, int(res.get("charged", 0)) - int(res.get("refunded_credits", 0)))
    threshold = await approval_threshold()
    if threshold and amount >= threshold:
        user = await find_user(res["user_id"])
        approval = await approvals.create(
            "credit_refund", res["user_id"], user["handle"], {"reservationId": res["id"], "amount": body.amount},
            reason, admin)
        await record_audit(admin["handle"], "approval.requested", "user", res["user_id"], reason, "success",
                           admin["admin_role"], {"approvalId": approval["id"], "amount": amount,
                                                 "reservationId": res["id"]})
        return JSONResponse(status_code=202, content={"approval_required": True, "approval": jsonable_encoder(approval)})
    return await _apply_refund(admin, res["id"], None, body.amount, reason, f"refund:{body.idempotencyKey}")


async def sum_credits(match: dict) -> int:
    rows = await db.credit_ledger.aggregate([{"$match": match}, {"$group": {"_id": None, "n": {"$sum": "$credits"}}}]).to_list(1)
    return rows[0]["n"] if rows else 0


@router.get("/credits/summary")
async def credit_summary(_=Depends(require_role())):
    rows = await db.credit_accounts.aggregate([{"$group": {
        "_id": None, "accounts": {"$sum": 1}, "available": {"$sum": "$available"}, "reserved": {"$sum": "$reserved"},
        "included": {"$sum": "$included"}, "promotional": {"$sum": "$promotional"},
        "purchased": {"$sum": "$purchased"}}}]).to_list(1)
    totals = rows[0] if rows else {"accounts": 0, "available": 0, "reserved": 0, "included": 0,
                                   "promotional": 0, "purchased": 0}
    next_reset = await db.subscriptions.find_one(
        {"status": {"$in": ["active", "trialing", "past_due"]}}, {"_id": 0},
        sort=[("current_period_end", 1)])
    reconciliation_items = await db.reconciliation_items.find(
        {"status": "open"}, {"_id": 0}).sort("checked_at", -1).to_list(25)
    return {"accounts": totals["accounts"], "available": totals["available"], "reserved": totals["reserved"],
            "included": totals.get("included", 0), "promotional": totals.get("promotional", 0),
            "purchased": totals.get("purchased", 0),
            "ledgerEntries": await db.credit_ledger.count_documents({}),
            "consumed": await sum_credits({"type": "charge"}),
            "refunded": await sum_credits({"type": "refund"}),
            "granted": await sum_credits({"type": {"$in": ["trial_grant", "admin_grant", "plan_grant",
                                                           "plan_trial", "promotion_grant"]}}),
            "expired": await sum_credits({"type": {"$in": ["included_expire", "promotion_expire"]}}),
            "removed": await sum_credits({"type": "admin_debit"}),
            "nextResetAt": iso(next_reset["current_period_end"]) if next_reset else None,
            "stuckHolds": await db.credit_reservations.count_documents(
                {"status": "held", "created_at": {"$lt": now() - credits.STALE_AFTER}}),
            "reconciliationOpen": len(reconciliation_items),
            "reconciliationItems": await with_handles(reconciliation_items, "checked_at")}


async def usage_totals(since) -> dict:
    rows = await db.ai_usage.aggregate([{"$match": {"created_at": {"$gte": since}}}, {"$group": {
        "_id": "$status", "n": {"$sum": 1}, "charged": {"$sum": "$charged"}}}]).to_list(10)
    by = {r["_id"]: r for r in rows}
    return {"requests": sum(r["n"] for r in rows), "succeeded": by.get("succeeded", {}).get("n", 0),
            "failed": by.get("failed", {}).get("n", 0), "cancelled": by.get("cancelled", {}).get("n", 0),
            "creditsCharged": sum(r["charged"] for r in rows)}


async def usage_trend(days: int) -> list[dict]:
    since = (now() - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = await db.ai_usage.aggregate([{"$match": {"created_at": {"$gte": since}}}, {"$group": {
        "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
        "requests": {"$sum": 1}, "credits": {"$sum": "$charged"}}}]).to_list(days)
    by = {r["_id"]: r for r in rows}
    out = []
    for i in range(days):
        day = (since + timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"day": day[5:], "requests": by.get(day, {}).get("requests", 0), "credits": by.get(day, {}).get("credits", 0)})
    return out


def window(days: int) -> int:
    return days if days in (7, 30, 90) else 7


@router.get("/usage")
async def usage(days: int = 7, limit: int = 100, _=Depends(require_role())):
    days = window(days)
    rows = await db.ai_usage.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))
    settings = await platform_settings.get_settings()
    rows = [r | {"estimated_cost_paise": round(usage_insights.estimate_cost(r, settings))} for r in rows]
    return {"totals": await usage_totals(now() - timedelta(days=days)), "trend": await usage_trend(days),
            "requests": await with_handles(rows, "created_at")}


@router.get("/usage/insights")
async def usage_insights_endpoint(days: int = 30, _=Depends(require_role())):
    return await usage_insights.insights(window(days))


class SimulatedAction(BaseModel):
    action: str = Field(min_length=1, max_length=80)
    credits: int = Field(ge=0, le=1000)


class SimulateIn(BaseModel):
    days: int = 30
    actions: list[SimulatedAction] = Field(min_length=1, max_length=100)


@router.post("/usage/simulate")
async def simulate_usage(body: SimulateIn, _=Depends(require_role())):
    return await usage_insights.simulate(window(body.days), {a.action: a.credits for a in body.actions})


class UsageCostIn(BaseModel):
    cost_paise: int = Field(ge=0, le=100_000_000)
    reason: Reason


@router.post("/usage/{usage_id}/cost")
async def record_usage_cost(usage_id: str, body: UsageCostIn, auth=Depends(require_role(*CREDIT_ROLES))):
    admin = auth[0]
    row = await db.ai_usage.find_one({"id": usage_id}, {"_id": 0, "id": 1, "user_id": 1, "action": 1})
    if not row:
        raise ApiError(404, "NOT_FOUND", "AI usage record not found.")
    await db.ai_usage.update_one(
        {"id": usage_id},
        {"$set": {"provider_cost_paise": body.cost_paise, "provider_cost_source": "manual",
                  "provider_cost_recorded_at": now(), "provider_cost_recorded_by": admin["handle"],
                  "provider_cost_reason": body.reason.strip()}})
    await record_audit(admin["handle"], "usage.cost_record", "user", row["user_id"], body.reason.strip(),
                       role=admin["admin_role"],
                       details={"usageId": usage_id, "action": row.get("action"), "costPaise": body.cost_paise})
    return {"id": usage_id, "providerCostPaise": body.cost_paise, "source": "manual"}


def user_label(row: dict, names: dict[str, str]) -> str:
    if row.get("target_type") != "user":
        return row["target_id"]
    return f"@{names[row['target_id']]}" if row["target_id"] in names else "(deleted user)"


@router.get("/audit")
async def audit(limit: int = 100, _=Depends(require_role())):
    rows = await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))
    names = await handles_for({r["target_id"] for r in rows if r.get("target_type") == "user"})
    return {"entries": [r | {"created_at": iso(r["created_at"]),
                             "target_label": user_label(r, names)} for r in rows]}


@router.get("/exports/users.csv")
async def export_users(q: str = "", ids: str = "", limit: int = 5000, _=Depends(require_role(*EXPORT_ROLES))):
    match = {}
    if ids.strip():
        match["id"] = {"$in": [value for value in ids.split(",") if value][:500]}
    elif q.strip():
        pattern = re.escape(q.strip().lower())
        match = {"$or": [{"handle": {"$regex": pattern, "$options": "i"}}, {"email": {"$regex": pattern, "$options": "i"}}]}
    users = await db.users.find(match, USER_FIELDS).sort("created_at", -1).to_list(max(1, min(limit, 5000)))
    accounts = {a["user_id"]: a async for a in db.credit_accounts.find(
        {"user_id": {"$in": [u["id"] for u in users]}}, {"_id": 0})}
    subs = await active_subscriptions([u["id"] for u in users])
    rows = []
    for user in users:
        row = public_admin_user(user, accounts.get(user["id"]), subs.get(user["id"]))
        rows.append([row["id"], row["handle"], row["email"], row["displayName"], row["joined"], row["emailVerified"],
                     row["role"], row["suspended"], row["planId"], row["subscriptionStatus"],
                     row["available"], row["reserved"], row["included"], row["promotional"], row["purchased"]])
    return csv_download("users.csv", ["id", "handle", "email", "displayName", "joined", "emailVerified", "role",
                                      "suspended", "planId", "subscriptionStatus", "available", "reserved",
                                      "included", "promotional", "purchased"], rows)


@router.get("/exports/ledger.csv")
async def export_ledger(type: str = "", limit: int = 5000, _=Depends(require_role(*EXPORT_ROLES))):
    match = {"type": type} if type else {}
    entries = await db.credit_ledger.find(match, {"_id": 0, "idempotency_key": 0}).sort(
        "created_at", -1).to_list(max(1, min(limit, 5000)))
    entries = await with_handles(entries, "created_at")
    rows = [[e["id"], e["user_id"], e.get("handle", ""), e["type"], e["credits"], e["available_delta"],
             e["reserved_delta"], e["reason"], e["actor"], e["created_at"]] for e in entries]
    return csv_download("credit-ledger.csv", ["id", "userId", "handle", "type", "credits", "availableDelta",
                                              "reservedDelta", "reason", "actor", "createdAt"], rows)


@router.get("/exports/audit.csv")
async def export_audit(limit: int = 5000, _=Depends(require_role(*EXPORT_ROLES))):
    entries = await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 5000)))
    names = await handles_for({r["target_id"] for r in entries if r.get("target_type") == "user"})
    rows = [[e["id"], e["actor"], e.get("role", ""), e["action"], e["target_type"], e["target_id"],
             user_label(e, names), e["reason"], e["outcome"], e.get("request_id", ""), e["created_at"]] for e in entries]
    return csv_download("admin-audit.csv", ["id", "actor", "role", "action", "targetType", "targetId",
                                            "targetLabel", "reason", "outcome", "requestId", "createdAt"], rows)


async def ai_charged_since(since) -> int:
    rows = await db.ai_usage.aggregate([
        {"$match": {"created_at": {"$gte": since}, "charged": {"$gt": 0}}},
        {"$group": {"_id": None, "n": {"$sum": "$charged"}}},
    ]).to_list(1)
    return rows[0]["n"] if rows else 0


async def subscription_revenue() -> tuple[dict, list[dict]]:
    """Monthly-equivalent recurring revenue from paying subscribers, never trials."""
    subs = await db.subscriptions.find({"status": {"$in": ["active", "past_due"]}}, {"_id": 0}).to_list(5000)
    plan_ids = {s["plan_id"] for s in subs}
    versions = {(v["plan_id"], v["version"]): v
                async for v in db.plan_versions.find({"plan_id": {"$in": list(plan_ids)}}, {"_id": 0})}
    live = {}
    for plan_id in plan_ids:
        live[plan_id] = await db.plan_versions.find_one(
            {"plan_id": plan_id, "status": "published", "effective_at": {"$lte": now()}}, {"_id": 0},
            sort=[("effective_at", -1), ("version", -1)])
    distribution: dict[str, dict] = {}
    mrr = annual_contracts = 0
    for sub in subs:
        version = versions.get((sub["plan_id"], sub.get("plan_version", 1))) or live.get(sub["plan_id"]) or {}
        monthly = (round(version.get("annual_price_paise", 0) / 12)
                   if sub.get("billing_period") == "annual" else int(version.get("monthly_price_paise", 0)))
        item = distribution.setdefault(sub["plan_id"], {
            "planId": sub["plan_id"], "name": version.get("name", sub["plan_id"]),
            "subscribers": 0, "annual": 0, "monthly": 0, "mrrPaise": 0})
        item["subscribers"] += 1
        item["annual" if sub.get("billing_period") == "annual" else "monthly"] += 1
        item["mrrPaise"] += monthly
        mrr += monthly
        annual_contracts += int(version.get("annual_price_paise", 0)) if sub.get("billing_period") == "annual" else 0
    for item in distribution.values():
        item["arrPaise"] = item["mrrPaise"] * 12
    return ({"mrrPaise": mrr, "arrPaise": mrr * 12, "annualContractValuePaise": annual_contracts,
             "payingSubscribers": len(subs)}, sorted(distribution.values(), key=lambda x: x["mrrPaise"], reverse=True))


async def recent_subscription_events(limit: int = 10) -> list[dict]:
    events = await db.subscription_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 50)))
    sub_ids = {e["subscription_id"] for e in events}
    subs = {s["id"]: s async for s in db.subscriptions.find({"id": {"$in": list(sub_ids)}}, {"_id": 0})}
    user_ids = {s["user_id"] for s in subs.values()}
    names = await handles_for(user_ids)
    plan_ids = {s["plan_id"] for s in subs.values()}
    plans = {}
    for plan_id in plan_ids:
        plan = await db.plan_versions.find_one(
            {"plan_id": plan_id, "status": "published", "effective_at": {"$lte": now()}}, {"_id": 0},
            sort=[("effective_at", -1), ("version", -1)])
        plans[plan_id] = (plan or {}).get("name", plan_id)
    out = []
    for event in events:
        sub = subs.get(event["subscription_id"]) or {}
        out.append(event | {
            "created_at": iso(event["created_at"]),
            "handle": names.get(sub.get("user_id"), "—"),
            "plan": plans.get(sub.get("plan_id"), sub.get("plan_id", "—")),
            "billing": sub.get("billing_period"),
        })
    return out


@router.get("/overview")
async def overview(days: int = 7, _=Depends(require_role())):
    days = window(days)
    stale = now() - credits.STALE_AFTER
    settings = await platform_settings.get_settings()
    month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_credits = await ai_charged_since(month_start)
    pending_holds = await db.credit_reservations.count_documents({"status": "held"})
    stale_holds = await db.credit_reservations.count_documents({"status": "held", "created_at": {"$lt": stale}})
    subscriptions = {"active": await db.subscriptions.count_documents({"status": "active"}),
                     "trialing": await db.subscriptions.count_documents({"status": "trialing"}),
                     "pastDue": await db.subscriptions.count_documents({"status": "past_due"}),
                     "total": await db.subscriptions.count_documents({})}
    overdue_renewals = await db.subscriptions.count_documents(
        {"status": {"$in": ["active", "trialing"]}, "current_period_end": {"$lte": now()}})
    drift = await db.reconciliation_items.count_documents({"status": "open"})
    pending_approvals = await db.admin_approvals.count_documents({"status": "pending"})
    failed_24h = await db.ai_usage.count_documents(
        {"status": "failed", "created_at": {"$gte": now() - timedelta(hours=24)}})
    revenue, plan_distribution = await subscription_revenue()
    usage_report = await usage_insights.insights(days)
    cost_per_success = round(usage_report["totals"].get("costPaise", usage_report["totals"]["estimatedCostPaise"])
                             / max(1, usage_report["totals"].get("succeeded", 0)), 2)
    alerts = []
    if subscriptions["pastDue"]:
        alerts.append({"type": "past_due", "level": "warning", "count": subscriptions["pastDue"],
                       "title": "Past-due subscriptions",
                       "detail": f"{subscriptions['pastDue']} subscription(s) need a payment or status update.",
                       "href": "/admin/subscriptions"})
    if overdue_renewals:
        alerts.append({"type": "overdue_renewals", "level": "warning", "count": overdue_renewals,
                       "title": "Renewals due",
                       "detail": f"{overdue_renewals} subscription(s) are past their period end.",
                       "href": "/admin/subscriptions"})
    if stale_holds:
        alerts.append({"type": "stale_holds", "level": "warning", "count": stale_holds,
                       "title": "Stale credit holds",
                       "detail": f"{stale_holds} AI request(s) have held credits for over 10 minutes.",
                       "href": "/admin/credits"})
    if drift:
        alerts.append({"type": "ledger_drift", "level": "danger", "count": drift,
                       "title": "Ledger mismatch",
                       "detail": f"{drift} account(s) do not match the credit ledger.",
                       "href": "/admin/credits"})
    if pending_approvals:
        alerts.append({"type": "pending_approvals", "level": "warning", "count": pending_approvals,
                       "title": "Pending approvals",
                       "detail": f"{pending_approvals} credit or role change(s) are waiting for a second admin.",
                       "href": "/admin/approvals"})
    if failed_24h >= 3:
        alerts.append({"type": "provider_failures", "level": "warning", "count": failed_24h,
                       "title": "AI failures in the last 24h",
                       "detail": f"{failed_24h} AI request(s) failed. Check provider status and usage.",
                       "href": "/admin/usage"})
    return {
        "users": await db.users.count_documents({}),
        "newUsers": await db.users.count_documents({"created_at": {"$gte": now() - timedelta(days=days)}}),
        "admins": await db.users.count_documents({"admin_role": {"$in": list(ROLES)}}),
        "usage": await usage_totals(now() - timedelta(days=days)),
        "trend": await usage_trend(days),
        "pendingHolds": pending_holds,
        "staleHolds": stale_holds,
        "subscriptions": subscriptions,
        "promotions": {"active": await db.promotions.count_documents({"status": "active"}),
                       "grants": await db.promotion_grants.count_documents({})},
        "spend": {"month": month_start.strftime("%Y-%m"), "chargedCredits": month_credits,
                  "estimatedPaise": month_credits * int(settings.get("creditValuePaise", 0)),
                  "thresholdPaise": int(settings.get("monthlySpendAlertPaise", 0))},
        "revenue": revenue,
        "planDistribution": plan_distribution,
        "recentSubscriptionEvents": await recent_subscription_events(10),
        "costPerSuccessPaise": cost_per_success,
        "estimatedCostPaise": usage_report["totals"]["estimatedCostPaise"],
        "actualCostPaise": usage_report["totals"].get("actualCostPaise", 0),
        "actualCostRequests": usage_report["totals"].get("actualRequests", 0),
        "alerts": alerts,
        "credits": await credit_summary(),
        "recentAudit": (await audit(5))["entries"],
    }
