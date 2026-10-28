import os

from billing import now
from db import db

KEY = "platform"

DEFAULT_SETTINGS = {
    "defaultModel": "gpt-6-luna",
    "maxInputTokens": 12000,
    "maxRequestsPerMinute": 20,
    "monthlySpendAlertPaise": 500000,
    "creditValuePaise": 250,
    "approvalThresholdCredits": 1000,
    "referralReferrerCredits": 10,
    "referralRefereeCredits": 5,
    "giftMaxCredits": 1000,
    "inputCostPaisePerMTok": 0,
    "outputCostPaisePerMTok": 0,
    "lowCreditThreshold": 3,
    "resetPolicy": "Included credits reset each entitlement period; unused included credits do not carry over.",
    "trialDays": 30,
    "flags": {"ai_confirmation_modal": False, "annual_bonus_credits": True, "promotions": True,
              "referrals": True},
}


async def ensure_indexes() -> None:
    await db.platform_settings.create_index("key", unique=True)


async def seed_settings() -> None:
    await db.platform_settings.update_one(
        {"key": KEY}, {"$setOnInsert": {"key": KEY, "values": DEFAULT_SETTINGS, "updated_at": now()}}, upsert=True)


async def get_settings() -> dict:
    doc = await db.platform_settings.find_one({"key": KEY}, {"_id": 0}) or {}
    values = DEFAULT_SETTINGS | (doc.get("values") or {})
    values["flags"] = DEFAULT_SETTINGS["flags"] | (values.get("flags") or {})
    return values


async def update_settings(values: dict, actor: str) -> dict:
    await db.platform_settings.update_one(
        {"key": KEY}, {"$set": {"values": values, "updated_at": now(), "updated_by": actor}}, upsert=True)
    return await get_settings()


def provider_status() -> list[dict]:
    return [
        {"provider": "OpenAI (GPT 6 Luna)", "status": "configured" if os.environ.get("OPENAI_API_KEY") else "not configured"},
        {"provider": "Email (Emergent / Resend)", "status": "configured" if os.environ.get("EMERGENT_EMAIL_KEY") else "not configured"},
        {"provider": "Razorpay", "status": "configured" if os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET") else "not configured"},
        {"provider": "Mock AI provider", "status": "available in tests only"},
    ]


async def public_settings() -> dict:
    values = await get_settings()
    return {"lowCreditThreshold": values["lowCreditThreshold"], "flags": values["flags"]}
