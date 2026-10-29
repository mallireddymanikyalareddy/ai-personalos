import uuid
from datetime import datetime, timezone

from pymongo import UpdateOne

from db import db
from request_context import current_request_id

SEED_EFFECTIVE_AT = datetime(2026, 6, 1, tzinfo=timezone.utc)

PLAN_SEEDS = [
    {"plan_id": "basic", "name": "PersonalOS Basic", "monthly_price_paise": 19900, "annual_price_paise": 178800,
     "monthly_credits": 0, "annual_monthly_credits": 0, "annual_bonus_credits": 0, "trial_days": 30, "trial_credits": 0, "sort": 1},
    {"plan_id": "ai", "name": "PersonalOS AI", "monthly_price_paise": 29900, "annual_price_paise": 298800,
     "monthly_credits": 100, "annual_monthly_credits": 150, "annual_bonus_credits": 50, "trial_days": 30, "trial_credits": 25, "sort": 2},
    {"plan_id": "ai_pro", "name": "PersonalOS AI Pro", "monthly_price_paise": 39900, "annual_price_paise": 418800,
     "monthly_credits": 200, "annual_monthly_credits": 250, "annual_bonus_credits": 50, "trial_days": 30, "trial_credits": 50, "sort": 3},
]

M = "gpt-6-luna"
ACTION_SEEDS = [
    ("quick_question", "Quick AI question", 1, 1, 600),
    ("task_improve", "Create or improve task", 1, 1, 400),
    ("task_priorities", "Suggest task priorities", 1, 1, 600),
    ("task_breakdown", "Break down task", 2, 2, 800),
    ("daily_plan", "Generate daily plan", 2, 2, 900),
    ("habit_suggest", "Suggest a habit or routine", 2, 2, 600),
    ("note_summary", "Summarize note", 2, 2, 700),
    ("journal_summary", "Summarize journal entry", 2, 2, 700),
    ("goal_plan", "Goal action plan", 3, 3, 1200),
    ("weekly_review", "Weekly productivity review", 3, 3, 1200),
    ("document_analysis", "Document analysis", 3, 8, 2000),
    ("meeting_analysis", "Meeting analysis", 3, 6, 1800),
    ("complex_planning", "Complex multi-step planning", 5, 5, 2500),
]


def now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_billing_indexes() -> None:
    await db.plans.create_index("plan_id", unique=True)
    await db.plan_versions.create_index([("plan_id", 1), ("version", 1)], unique=True)
    await db.credit_accounts.create_index("user_id", unique=True)
    await db.credit_ledger.create_index("id", unique=True)
    await db.credit_ledger.create_index("idempotency_key", unique=True)
    await db.credit_ledger.create_index([("user_id", 1), ("created_at", -1)])
    await db.ai_pricing_versions.create_index("version", unique=True)
    await db.ai_pricing_versions.create_index([("status", 1), ("effective_at", -1)])
    await db.admin_audit.create_index("id", unique=True)
    await db.admin_audit.create_index("created_at")
    await db.admin_audit.create_index([("target_type", 1), ("target_id", 1)])
    await db.schema_migrations.create_index("key", unique=True)


async def record_audit(actor: str, action: str, target_type: str, target_id: str, reason: str, outcome: str = "success",
                       role: str | None = None, details: dict | None = None) -> None:
    await db.admin_audit.insert_one({
        "id": f"aud_{uuid.uuid4().hex[:16]}", "actor": actor, "role": role, "action": action, "target_type": target_type,
        "target_id": target_id, "reason": reason, "outcome": outcome, "details": details or {}, "created_at": now(),
        "request_id": current_request_id(),
    })


async def run_once(key: str, fn) -> bool:
    # Seeds are idempotent, so an interrupted run is safely retried on next start.
    if await db.schema_migrations.find_one({"key": key, "completed_at": {"$exists": True}}):
        return False
    details = await fn()
    done = await db.schema_migrations.update_one(
        {"key": key, "completed_at": {"$exists": False}}, {"$set": {"completed_at": now(), "details": details}}, upsert=True)
    if not done.upserted_id and not done.modified_count:
        return False
    await record_audit("system", f"migration.{key}", "migration", key, f"Database setup ({key})", details=details)
    return True


async def seed_plans() -> dict:
    for seed in PLAN_SEEDS:
        version = {k: v for k, v in seed.items() if k != "sort"} | {
            "version": 1, "status": "published", "effective_at": SEED_EFFECTIVE_AT, "created_at": now(), "created_by": "system"}
        await db.plan_versions.update_one({"plan_id": seed["plan_id"], "version": 1}, {"$setOnInsert": version}, upsert=True)
        await db.plans.update_one({"plan_id": seed["plan_id"]}, {"$setOnInsert": {
            "plan_id": seed["plan_id"], "name": seed["name"], "available": True,
            "sort": seed["sort"], "created_at": now()}}, upsert=True)
    return {"plans": [s["plan_id"] for s in PLAN_SEEDS]}


async def seed_pricing() -> dict:
    actions = [{"action": a, "label": label, "min_credits": lo, "max_credits": hi, "provider": "openai", "model": M,
                "max_output_tokens": out, "input_credits_per_1k": 0, "max_input_tokens": 0,
                "request_limit_per_day": 0} for a, label, lo, hi, out in ACTION_SEEDS]
    await db.ai_pricing_versions.update_one({"version": 1}, {"$setOnInsert": {
        "version": 1, "status": "published", "effective_at": SEED_EFFECTIVE_AT, "actions": actions,
        "created_at": now(), "created_by": "system", "published_at": now()}}, upsert=True)
    return {"pricing_version": 1, "actions": len(actions)}


def empty_account(user_id: str) -> dict:
    return {"user_id": user_id, "available": 0, "reserved": 0, "included": 0, "promotional": 0,
            "purchased": 0, "created_at": now(), "updated_at": now()}


async def ensure_credit_account(user_id: str) -> None:
    await db.credit_accounts.update_one({"user_id": user_id}, {"$setOnInsert": empty_account(user_id)}, upsert=True)


async def backfill_credit_accounts() -> dict:
    ops = [UpdateOne({"user_id": u["id"]}, {"$setOnInsert": empty_account(u["id"])}, upsert=True)
           async for u in db.users.find({}, {"id": 1})]
    created = (await db.credit_accounts.bulk_write(ops, ordered=False)).upserted_count if ops else 0
    return {"accounts_created": created}


async def setup_billing() -> None:
    await ensure_billing_indexes()
    await db.plan_versions.create_index("plan_id", name="one_draft_per_plan", unique=True,
                                        partialFilterExpression={"status": "draft"})
    await db.ai_pricing_versions.create_index("status", name="one_pricing_draft", unique=True,
                                              partialFilterExpression={"status": "draft"})
    await db.plans.update_many({"current_version": {"$exists": True}}, {"$unset": {"current_version": ""}})
    await run_once("stage3_seed_plans_v1", seed_plans)
    await run_once("stage3_seed_ai_pricing_v1", seed_pricing)
    await run_once("stage3_backfill_credit_accounts", backfill_credit_accounts)
