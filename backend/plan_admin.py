from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints

from admin import require_role
from auth import ApiError, iso
from billing import now, record_audit
from db import db

admin_router = APIRouter(prefix="/api/v1/admin")
public_router = APIRouter(prefix="/api/v1")
OWNER = require_role("super_admin")
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)]
Credits = Annotated[int, Field(ge=0, le=100000)]
Paise = Annotated[int, Field(ge=0, le=100_000_000)]
PLAN_FIELDS = ("name", "monthly_price_paise", "annual_price_paise", "monthly_credits", "annual_monthly_credits",
               "annual_bonus_credits", "trial_days", "trial_credits")


def effective_filter() -> dict:
    return {"status": "published", "effective_at": {"$lte": now()}}


def utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def out(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return doc | {k: iso(doc[k]) for k in ("effective_at", "created_at", "published_at") if doc.get(k)}


async def plan_state(plan_id: str) -> dict:
    versions = await db.plan_versions.find({"plan_id": plan_id}, {"_id": 0}).sort("version", -1).to_list(100)
    t = now()
    live = [v for v in versions if v["status"] == "published" and utc(v["effective_at"]) <= t]
    current = max(live, key=lambda v: (utc(v["effective_at"]), v["version"]), default=None)
    scheduled = [v for v in versions if v["status"] == "published" and utc(v["effective_at"]) > t]
    draft = next((v for v in versions if v["status"] == "draft"), None)
    return {"current": out(current), "scheduled": [out(v) for v in scheduled], "draft": out(draft),
            "history": [out(v) for v in versions if v["status"] == "published"]}


@admin_router.get("/plans")
async def admin_plans(_=Depends(require_role())):
    plans = await db.plans.find({}, {"_id": 0}).sort("sort", 1).to_list(50)
    return {"plans": [{"plan_id": p["plan_id"], "available": p["available"], "name": p["name"]} | await plan_state(p["plan_id"])
                      for p in plans]}


class PlanDraftIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=60)]
    monthly_price_paise: Paise
    annual_price_paise: Paise
    monthly_credits: Credits
    annual_monthly_credits: Credits
    annual_bonus_credits: Credits
    trial_days: Annotated[int, Field(ge=0, le=90)]
    trial_credits: Credits
    reason: Reason


class PublishIn(BaseModel):
    effective_at: datetime | None = None
    reason: Reason


async def next_version(coll, match: dict) -> int:
    last = await coll.find_one(match, {"version": 1}, sort=[("version", -1)])
    return (last["version"] if last else 0) + 1


async def require_plan(plan_id: str) -> dict:
    plan = await db.plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise ApiError(404, "NOT_FOUND", "Plan not found.")
    return plan


def publish_time(body: PublishIn) -> datetime:
    if body.effective_at is None:
        return now()
    when = utc(body.effective_at)
    if when < now():
        raise ApiError(400, "VALIDATION_FAILED", "Choose a time in the future, or leave it empty to publish now.",
                       [{"field": "effective_at", "issue": "must not be in the past"}])
    return when


@admin_router.put("/plans/{plan_id}/draft")
async def save_plan_draft(plan_id: str, body: PlanDraftIn, auth=Depends(OWNER)):
    await require_plan(plan_id)
    fields = body.model_dump(exclude={"reason"})
    draft = await db.plan_versions.find_one({"plan_id": plan_id, "status": "draft"}, {"_id": 0, "version": 1})
    if draft:
        await db.plan_versions.update_one({"plan_id": plan_id, "version": draft["version"]}, {"$set": fields | {"updated_at": now()}})
        version = draft["version"]
    else:
        version = await next_version(db.plan_versions, {"plan_id": plan_id})
        await db.plan_versions.insert_one(fields | {"plan_id": plan_id, "version": version, "status": "draft",
                                                    "created_at": now(), "created_by": auth[0]["handle"]})
    await record_audit(auth[0]["handle"], "plan.draft_save", "plan", plan_id, body.reason, role="super_admin",
                       details={"version": version} | fields)
    return await plan_state(plan_id)


@admin_router.delete("/plans/{plan_id}/draft")
async def discard_plan_draft(plan_id: str, auth=Depends(OWNER)):
    gone = await db.plan_versions.find_one_and_delete({"plan_id": plan_id, "status": "draft"})
    if not gone:
        raise ApiError(404, "NOT_FOUND", "There is no draft to discard.")
    await record_audit(auth[0]["handle"], "plan.draft_discard", "plan", plan_id, "Draft discarded", role="super_admin",
                       details={"version": gone["version"]})
    return await plan_state(plan_id)


@admin_router.post("/plans/{plan_id}/publish")
async def publish_plan(plan_id: str, body: PublishIn, auth=Depends(OWNER)):
    await require_plan(plan_id)
    when = publish_time(body)
    done = await db.plan_versions.find_one_and_update(
        {"plan_id": plan_id, "status": "draft"},
        {"$set": {"status": "published", "effective_at": when, "published_at": now(), "published_by": auth[0]["handle"]}})
    if not done:
        raise ApiError(404, "NOT_FOUND", "There is no draft to publish.")
    await db.plans.update_one({"plan_id": plan_id}, {"$set": {"name": done["name"]}})
    await record_audit(auth[0]["handle"], "plan.publish", "plan", plan_id, body.reason, role="super_admin",
                       details={"version": done["version"], "effective_at": iso(when)})
    return await plan_state(plan_id)


async def pricing_state() -> dict:
    versions = await db.ai_pricing_versions.find({}, {"_id": 0}).sort("version", -1).to_list(100)
    t = now()
    live = [v for v in versions if v["status"] == "published" and utc(v["effective_at"]) <= t]
    current = max(live, key=lambda v: (utc(v["effective_at"]), v["version"]), default=None)
    return {"current": out(current),
            "scheduled": [out(v) for v in versions if v["status"] == "published" and utc(v["effective_at"]) > t],
            "draft": out(next((v for v in versions if v["status"] == "draft"), None)),
            "history": [out(v) | {"actions": len(v["actions"])} for v in versions if v["status"] == "published"]}


@admin_router.get("/pricing")
async def admin_pricing(_=Depends(require_role())):
    return await pricing_state()


class ActionCostIn(BaseModel):
    action: str
    min_credits: Annotated[int, Field(ge=1, le=100)]
    max_credits: Annotated[int, Field(ge=1, le=100)]
    max_output_tokens: Annotated[int, Field(ge=50, le=16000)]


class PricingDraftIn(BaseModel):
    actions: list[ActionCostIn] = Field(min_length=1, max_length=100)
    reason: Reason


def merged_actions(base: list[dict], edits: list[ActionCostIn]) -> list[dict]:
    by_key = {a["action"]: a for a in base}
    if sorted(e.action for e in edits) != sorted(by_key):
        raise ApiError(400, "VALIDATION_FAILED", "Send a cost for every existing AI action, with no extras.")
    for e in edits:
        if e.min_credits > e.max_credits:
            raise ApiError(400, "VALIDATION_FAILED", f"{by_key[e.action]['label']}: the minimum can't be above the maximum.",
                           [{"field": e.action, "issue": "min_credits > max_credits"}])
    return [by_key[e.action] | e.model_dump() for e in edits]


@admin_router.put("/pricing/draft")
async def save_pricing_draft(body: PricingDraftIn, auth=Depends(OWNER)):
    state = await pricing_state()
    if not state["current"]:
        raise ApiError(409, "CONFLICT", "No published pricing to base a draft on.")
    actions = merged_actions(state["current"]["actions"], body.actions)
    if state["draft"]:
        version = state["draft"]["version"]
        await db.ai_pricing_versions.update_one({"version": version, "status": "draft"}, {"$set": {"actions": actions, "updated_at": now()}})
    else:
        version = await next_version(db.ai_pricing_versions, {})
        await db.ai_pricing_versions.insert_one({"version": version, "status": "draft", "actions": actions,
                                                 "created_at": now(), "created_by": auth[0]["handle"]})
    await record_audit(auth[0]["handle"], "pricing.draft_save", "pricing", f"v{version}", body.reason, role="super_admin",
                       details={"version": version})
    return await pricing_state()


@admin_router.delete("/pricing/draft")
async def discard_pricing_draft(auth=Depends(OWNER)):
    gone = await db.ai_pricing_versions.find_one_and_delete({"status": "draft"})
    if not gone:
        raise ApiError(404, "NOT_FOUND", "There is no draft to discard.")
    await record_audit(auth[0]["handle"], "pricing.draft_discard", "pricing", f"v{gone['version']}", "Draft discarded",
                       role="super_admin")
    return await pricing_state()


@admin_router.post("/pricing/publish")
async def publish_pricing(body: PublishIn, auth=Depends(OWNER)):
    when = publish_time(body)
    done = await db.ai_pricing_versions.find_one_and_update(
        {"status": "draft"}, {"$set": {"status": "published", "effective_at": when, "published_at": now(),
                                       "published_by": auth[0]["handle"]}})
    if not done:
        raise ApiError(404, "NOT_FOUND", "There is no draft to publish.")
    await record_audit(auth[0]["handle"], "pricing.publish", "pricing", f"v{done['version']}", body.reason, role="super_admin",
                       details={"version": done["version"], "effective_at": iso(when)})
    return await pricing_state()


@public_router.get("/plans")
async def public_plans():
    plans = await db.plans.find({"available": True}, {"_id": 0}).sort("sort", 1).to_list(50)
    rows = []
    for p in plans:
        current = (await plan_state(p["plan_id"]))["current"]
        if current:
            rows.append({"planId": p["plan_id"], "version": current["version"]} | {k: current[k] for k in PLAN_FIELDS})
    pricing = (await pricing_state())["current"]
    actions = [{"action": a["action"], "label": a["label"], "minCredits": a["min_credits"], "maxCredits": a["max_credits"]}
               for a in (pricing or {}).get("actions", [])]
    return {"plans": rows, "actions": actions, "pricingVersion": (pricing or {}).get("version")}
