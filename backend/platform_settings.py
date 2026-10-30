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
    "pastDueGraceDays": 3,
    "supportEmail": "",
    "supportUrl": "",
    "statusPageUrl": "",
    "supportHours": "",
    "requireMfaForAdmins": False,
    "adminSessionMinutes": 1440,
    "auditRetentionDays": 365,
    "seoTitle": "PersonalOS — Your Personal Operating System",
    "seoDescription": "Plan, create, focus and organize your work and life in one personal operating system.",
    "seoKeywords": "personal operating system, productivity, tasks, calendar, notes, goals, habits, AI assistant",
    "seoIndexable": True,
    "seoOgImage": "/landing/hero-devices.png",
    "seoSiteUrl": "",
    "flags": {"ai_confirmation_modal": True, "annual_bonus_credits": True, "promotions": True,
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
    merged = await get_settings() | values
    await db.platform_settings.update_one(
        {"key": KEY}, {"$set": {"values": merged, "updated_at": now(), "updated_by": actor}}, upsert=True)
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
    return {"lowCreditThreshold": values["lowCreditThreshold"], "flags": values["flags"],
            "support": {"email": values.get("supportEmail"), "url": values.get("supportUrl"),
                        "statusPageUrl": values.get("statusPageUrl"), "hours": values.get("supportHours")}}


async def public_seo() -> dict:
    values = await get_settings()
    return {"title": values.get("seoTitle"), "description": values.get("seoDescription"),
            "keywords": values.get("seoKeywords"), "indexable": bool(values.get("seoIndexable", True)),
            "ogImage": values.get("seoOgImage"), "siteUrl": values.get("seoSiteUrl")}
