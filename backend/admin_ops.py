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
USER_FIELDS = {"_id": 0, "id": 1, "handle": 1, "email": 1, "display_name": 1, "created_at": 1, "admin_role": 1,
               "admin_role_source": 1, "email_verified_at": 1}


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


def public_admin_user(u: dict, acc: dict | None) -> dict:
    return {"id": u["id"], "handle": u["handle"], "email": u.get("email"), "displayName": u.get("display_name"),
            "joined": iso(u.get("created_at")), "emailVerified": bool(u.get("email_verified_at")),
            "role": u.get("admin_role"), "roleSource": u.get("admin_role_source"),
            "available": (acc or {}).get("available", 0), "reserved": (acc or {}).get("reserved", 0),
            "included": (acc or {}).get("included", 0), "promotional": (acc or {}).get("promotional", 0),
            "purchased": (acc or {}).get("purchased", 0)}


@router.get("/users")
async def list_users(q: str = "", limit: int = 100, _=Depends(require_role())):
    match = {}
    if q.strip():
        pattern = re.escape(q.strip().lower())
        match = {"$or": [{"handle": {"$regex": pattern, "$options": "i"}}, {"email": {"$regex": pattern, "$options": "i"}}]}
    users = await db.users.find(match, USER_FIELDS).sort("created_at", -1).to_list(max(1, min(limit, 200)))
    accounts = {a["user_id"]: a async for a in db.credit_accounts.find({"user_id": {"$in": [u["id"] for u in users]}}, {"_id": 0})}
    return {"users": [public_admin_user(u, accounts.get(u["id"])) for u in users], "total": await db.users.count_documents(match)}


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
    return {"user": public_admin_user(user, acc), "ledger": ledger,
            "subscription": sub | {k: iso(sub[k]) for k in ("started_at", "current_period_start", "current_period_end",
                                                            "trial_ends_at", "canceled_at", "created_at")
                                   if sub.get(k)} if sub else None,
            "usage": [u | {"created_at": iso(u["created_at"])} for u in usage]}


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
    if action in ("credit_adjust", "bulk_credit_adjust"):
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
    return {"accounts": totals["accounts"], "available": totals["available"], "reserved": totals["reserved"],
            "included": totals.get("included", 0), "promotional": totals.get("promotional", 0),
            "purchased": totals.get("purchased", 0),
            "ledgerEntries": await db.credit_ledger.count_documents({}),
            "consumed": await sum_credits({"type": "charge"}),
            "granted": await sum_credits({"type": {"$in": ["trial_grant", "admin_grant", "plan_grant",
                                                           "plan_trial", "promotion_grant"]}}),
            "expired": await sum_credits({"type": {"$in": ["included_expire", "promotion_expire"]}}),
            "removed": await sum_credits({"type": "admin_debit"})}


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
async def export_users(q: str = "", ids: str = "", limit: int = 5000, _=Depends(require_role())):
    match = {}
    if ids.strip():
        match["id"] = {"$in": [value for value in ids.split(",") if value][:500]}
    elif q.strip():
        pattern = re.escape(q.strip().lower())
        match = {"$or": [{"handle": {"$regex": pattern, "$options": "i"}}, {"email": {"$regex": pattern, "$options": "i"}}]}
    users = await db.users.find(match, USER_FIELDS).sort("created_at", -1).to_list(max(1, min(limit, 5000)))
    accounts = {a["user_id"]: a async for a in db.credit_accounts.find(
        {"user_id": {"$in": [u["id"] for u in users]}}, {"_id": 0})}
    rows = []
    for user in users:
        row = public_admin_user(user, accounts.get(user["id"]))
        rows.append([row["id"], row["handle"], row["email"], row["displayName"], row["joined"], row["emailVerified"],
                     row["role"], row["available"], row["reserved"], row["included"], row["promotional"], row["purchased"]])
    return csv_download("users.csv", ["id", "handle", "email", "displayName", "joined", "emailVerified", "role",
                                      "available", "reserved", "included", "promotional", "purchased"], rows)


@router.get("/exports/ledger.csv")
async def export_ledger(type: str = "", limit: int = 5000, _=Depends(require_role())):
    match = {"type": type} if type else {}
    entries = await db.credit_ledger.find(match, {"_id": 0, "idempotency_key": 0}).sort(
        "created_at", -1).to_list(max(1, min(limit, 5000)))
    entries = await with_handles(entries, "created_at")
    rows = [[e["id"], e["user_id"], e.get("handle", ""), e["type"], e["credits"], e["available_delta"],
             e["reserved_delta"], e["reason"], e["actor"], e["created_at"]] for e in entries]
    return csv_download("credit-ledger.csv", ["id", "userId", "handle", "type", "credits", "availableDelta",
                                              "reservedDelta", "reason", "actor", "createdAt"], rows)


@router.get("/exports/audit.csv")
async def export_audit(limit: int = 5000, _=Depends(require_role())):
    entries = await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 5000)))
    names = await handles_for({r["target_id"] for r in entries if r.get("target_type") == "user"})
    rows = [[e["id"], e["actor"], e.get("role", ""), e["action"], e["target_type"], e["target_id"],
             user_label(e, names), e["reason"], e["outcome"], e["created_at"]] for e in entries]
    return csv_download("admin-audit.csv", ["id", "actor", "role", "action", "targetType", "targetId",
                                            "targetLabel", "reason", "outcome", "createdAt"], rows)


async def ai_charged_since(since) -> int:
    rows = await db.ai_usage.aggregate([
        {"$match": {"created_at": {"$gte": since}, "charged": {"$gt": 0}}},
        {"$group": {"_id": None, "n": {"$sum": "$charged"}}},
    ]).to_list(1)
    return rows[0]["n"] if rows else 0


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
        "alerts": alerts,
        "credits": await credit_summary(),
        "recentAudit": (await audit(5))["entries"],
    }
