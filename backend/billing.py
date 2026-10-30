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
    # Core
    ("quick_question", "Quick AI question", 1, 1, 600),
    ("task_improve", "Create or improve task", 1, 1, 400),
    ("task_priorities", "Suggest task priorities", 1, 1, 600),
    ("task_breakdown", "Break down task", 2, 2, 800),
    ("daily_plan", "Generate daily plan", 2, 2, 900),
    ("habit_suggest", "Suggest a habit or routine", 2, 2, 600),
    ("note_summary", "Summarize note", 2, 2, 700),
    ("journal_summary", "Summarize journal entry", 2, 2, 700),
    ("goal_plan", "Goal action plan", 3, 5, 1200),
    ("weekly_review", "Weekly productivity review", 3, 5, 1200),
    ("document_analysis", "Document analysis", 3, 8, 2000),
    ("meeting_analysis", "Meeting analysis", 3, 8, 2000),
    ("complex_planning", "Complex multi-step planning", 5, 10, 2500),
    ("seo_metadata", "Generate SEO title and description", 1, 1, 300),
    # Today
    ("today_briefing", "Morning briefing", 2, 2, 900),
    ("today_evening_reflection", "End-of-day reflection", 2, 2, 800),
    ("today_rescue_plan", "Replan the rest of today", 3, 3, 1200),
    ("today_focus_plan", "Pick the next focus blocks", 2, 2, 800),
    ("today_weekly_preview", "Preview the week ahead", 3, 3, 1200),
    # Tasks
    ("task_from_note", "Turn a note into tasks", 1, 1, 600),
    ("task_estimate", "Estimate task effort", 1, 1, 600),
    ("task_bulk_cleanup", "Clean up a batch of tasks", 3, 3, 1200),
    ("task_delegate_suggest", "Suggest task ownership", 2, 2, 800),
    # Calendar
    ("calendar_schedule_suggestion", "Suggest a calendar slot", 2, 2, 700),
    ("calendar_conflict_resolution", "Resolve calendar conflicts", 3, 3, 1000),
    ("calendar_meeting_prep", "Prepare an agenda and questions", 3, 3, 1200),
    ("calendar_reschedule_day", "Rebuild a disrupted day", 3, 3, 1200),
    # Planner
    ("weekly_plan", "Generate a weekly plan", 3, 3, 1200),
    ("plan_rebalance", "Rebalance an overloaded plan", 3, 3, 1200),
    ("plan_energy_optimize", "Match work to energy patterns", 3, 3, 1200),
    ("plan_buffer_suggest", "Add realistic buffers", 2, 2, 800),
    # Goals
    ("goal_milestone_breakdown", "Break a goal into milestones", 3, 3, 1200),
    ("goal_progress_review", "Review goal progress and risks", 3, 3, 1200),
    ("goal_risk_check", "Identify goal blockers", 3, 3, 1200),
    ("goal_okr_rewrite", "Rewrite a goal as OKRs", 2, 2, 900),
    # Habits
    ("habit_stack_suggest", "Suggest habit stacking", 2, 2, 800),
    ("habit_recovery_plan", "Recover after a broken streak", 2, 2, 800),
    ("habit_pattern_insight", "Find patterns in check-ins", 2, 2, 900),
    # Notes
    ("note_action_extract", "Extract action items", 2, 2, 800),
    ("note_rewrite", "Rewrite for clarity or tone", 2, 2, 900),
    ("note_tag_suggest", "Suggest tags and folder", 1, 1, 400),
    ("note_merge_dedupe", "Merge duplicate notes", 3, 3, 1200),
    ("note_flashcards", "Generate study cards", 3, 3, 1200),
    # Journal
    ("journal_reflection", "Guided reflection prompts", 2, 2, 900),
    ("journal_mood_insight", "Mood and theme trends", 3, 3, 1200),
    ("journal_pattern_review", "Weekly or monthly pattern review", 3, 3, 1200),
    ("journal_gratitude_prompt", "One short gratitude prompt", 1, 1, 400),
    # Projects / Work
    ("project_plan", "Turn a brief into phases and tasks", 5, 8, 2000),
    ("project_status_summary", "Summarize project status", 3, 3, 1200),
    ("project_risk_review", "Identify project risks", 4, 4, 1500),
    ("project_task_extract", "Extract tasks from project notes", 3, 3, 1200),
    ("project_retrospective", "Draft a retrospective", 3, 3, 1200),
    # Meetings
    ("meeting_summary", "Summarize a meeting", 3, 3, 1500),
    ("meeting_action_items", "Extract decisions and actions", 3, 3, 1500),
    ("meeting_prep_brief", "Prepare a meeting brief", 3, 3, 1200),
    ("meeting_followup_email", "Draft a follow-up email", 2, 2, 900),
    ("meeting_transcript_qa", "Ask questions over a transcript", 3, 8, 2000),
    # Digital Paper
    ("document_summary", "Summarize a document", 2, 6, 1500),
    ("document_extract_tables", "Extract tables and structured data", 3, 8, 2000),
    ("document_rewrite", "Rewrite or simplify a document", 3, 8, 2000),
    ("document_compare", "Compare two documents", 5, 10, 2500),
    ("document_translate", "Translate a document", 4, 10, 2500),
    ("document_qa", "Ask a document", 3, 8, 1500),
    ("document_style_match", "Match a house style", 4, 8, 2000),
    # Digital Notebook
    ("notebook_summary", "Summarize a notebook or page", 2, 2, 900),
    ("notebook_outline", "Build an outline", 2, 2, 900),
    ("notebook_flashcards", "Generate notebook cards", 3, 3, 1200),
    ("notebook_quiz", "Generate a quiz", 3, 3, 1200),
    ("notebook_link_suggest", "Suggest links between pages", 2, 2, 800),
    ("handwriting_cleanup", "Clean OCR or handwriting text", 2, 2, 800),
    # Insights
    ("insights_narrative", "Explain the charts in words", 3, 3, 1200),
    ("insights_anomaly_explain", "Explain an unusual week", 3, 3, 1200),
    ("insights_recommendations", "Suggest changes from trends", 4, 4, 1500),
    ("insights_forecast", "Forecast workload and credits", 3, 3, 1200),
    # Rewards
    ("reward_suggest", "Suggest a reward for progress", 2, 2, 600),
    ("reward_reflection", "Reflect on what worked", 2, 2, 800),
    ("celebration_message", "Write a short celebration note", 1, 1, 300),
    # Templates
    ("template_generate", "Generate a reusable template", 3, 3, 1200),
    ("template_fill", "Fill a template from context", 3, 3, 1200),
    ("template_improve", "Improve an existing template", 2, 2, 900),
    # Inbox / Capture
    ("capture_classify", "Classify a capture", 1, 1, 400),
    ("capture_route", "Route a capture to the right module", 1, 1, 400),
    ("inbox_triage", "Triage a batch of captures", 3, 3, 1200),
    ("inbox_summary", "Summarize the inbox", 2, 2, 900),
    # Life Memory
    ("memory_recall_answer", "Answer a life-memory question", 2, 4, 1000),
    ("memory_timeline_summary", "Summarize a period", 3, 3, 1200),
    ("memory_connection_suggest", "Connect related memories", 3, 3, 1200),
    ("memory_dedupe", "Find duplicate memories", 3, 3, 1200),
    # Work Mode
    ("workmode_focus_plan", "Plan a focus session", 2, 2, 800),
    ("workmode_standup", "Draft a standup update", 2, 2, 700),
    ("workmode_end_of_day", "Wrap up the workday", 2, 2, 800),
    ("workmode_task_triage", "Triage the work queue", 2, 2, 900),
    ("workmode_meeting_brief", "Brief before a work meeting", 3, 3, 1200),
    # Collaboration
    ("collab_summary", "Summarize a shared thread", 3, 3, 1200),
    ("collab_reply_draft", "Draft a reply", 2, 2, 800),
    ("collab_agenda", "Build a shared agenda", 3, 3, 1200),
]

# Per-action limits and pricing-model overrides. Anything not listed keeps the defaults below.
ACTION_LIMITS = {
    "document_analysis": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                          "request_limit_per_day": 20},
    "meeting_analysis": {"max_input_tokens": 40000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                         "request_limit_per_day": 10},
    "meeting_transcript_qa": {"max_input_tokens": 40000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                              "request_limit_per_day": 20},
    "meeting_summary": {"max_input_tokens": 40000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                        "request_limit_per_day": 20},
    "meeting_action_items": {"max_input_tokens": 40000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                             "request_limit_per_day": 20},
    "meeting_followup_email": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "meeting_prep_brief": {"max_input_tokens": 20000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_summary": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_extract_tables": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_rewrite": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_compare": {"max_input_tokens": 60000, "input_step_tokens": 2000, "input_credits_per_step": 1,
                         "request_limit_per_day": 10},
    "document_translate": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_qa": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "document_style_match": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "project_plan": {"max_input_tokens": 12000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "project_status_summary": {"max_input_tokens": 20000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "project_risk_review": {"max_input_tokens": 20000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "project_task_extract": {"max_input_tokens": 20000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "project_retrospective": {"max_input_tokens": 20000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "note_merge_dedupe": {"max_input_tokens": 20000, "batch_size": 25, "batch_credits": 3,
                          "batch_extra_credits": 1},
    "task_bulk_cleanup": {"max_input_tokens": 20000, "batch_size": 25, "batch_credits": 3,
                          "batch_extra_credits": 1},
    "inbox_triage": {"max_input_tokens": 20000, "batch_size": 25, "batch_credits": 3,
                     "batch_extra_credits": 1},
    "memory_dedupe": {"max_input_tokens": 20000, "batch_size": 25, "batch_credits": 3,
                      "batch_extra_credits": 1},
    "memory_timeline_summary": {"max_input_tokens": 30000, "input_step_tokens": 2000, "input_credits_per_step": 1},
    "complex_planning": {"max_input_tokens": 12000, "request_limit_per_day": 20},
    "seo_metadata": {"max_input_tokens": 4000, "max_output_tokens": 300, "request_limit_per_day": 20},
}


def seed_action(row: tuple) -> dict:
    action, label, lo, hi, out = row
    data = {
        "action": action, "label": label, "min_credits": lo, "max_credits": hi,
        "provider": "openai", "model": M, "max_output_tokens": out,
        "input_credits_per_1k": 0, "input_step_tokens": 1000, "input_credits_per_step": 0,
        "max_input_tokens": 0, "request_limit_per_day": 100, "model_multiplier": 1,
        "batch_size": 0, "batch_credits": 0, "batch_extra_credits": 0,
    }
    data.update(ACTION_LIMITS.get(action, {}))
    return data


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
    actions = [seed_action(a) for a in ACTION_SEEDS]
    await db.ai_pricing_versions.update_one({"version": 1}, {"$setOnInsert": {
        "version": 1, "status": "published", "effective_at": SEED_EFFECTIVE_AT, "actions": actions,
        "created_at": now(), "created_by": "system", "published_at": now()}}, upsert=True)
    return {"pricing_version": 1, "actions": len(actions)}


async def seed_gateway_actions() -> dict:
    """Add newly registered actions to the live pricing version without rewriting history."""
    current = await db.ai_pricing_versions.find_one(
        {"status": "published", "effective_at": {"$lte": now()}}, {"_id": 0},
        sort=[("effective_at", -1), ("version", -1)])
    if not current:
        return {"added": 0, "skipped": "no published pricing"}
    existing = {a["action"] for a in current.get("actions", [])}
    missing = [a for a in ACTION_SEEDS if a[0] not in existing]
    if not missing:
        return {"added": 0, "version": current["version"]}
    last = await db.ai_pricing_versions.find_one({}, {"version": 1}, sort=[("version", -1)])
    version = (last["version"] if last else 0) + 1
    actions = list(current.get("actions", [])) + [seed_action(a) for a in missing]
    await db.ai_pricing_versions.insert_one({
        "version": version, "status": "published", "effective_at": now(), "actions": actions,
        "created_at": now(), "created_by": "system", "published_at": now(),
    })
    return {"added": len(missing), "version": version}


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
    await run_once("stage_gateway_actions_v1", seed_gateway_actions)
    await run_once("stage_gateway_actions_v2", seed_gateway_actions)
    await run_once("stage_gateway_actions_v3", seed_gateway_actions)
    await run_once("stage3_backfill_credit_accounts", backfill_credit_accounts)
