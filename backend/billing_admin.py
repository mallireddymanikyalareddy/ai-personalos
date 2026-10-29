import re
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints

import entitlements
import platform_settings
import promotions
from admin import require_role
from auth import ApiError, iso, require_auth
from billing import now, record_audit
from db import db

router = APIRouter(prefix="/api/v1/admin")
public_router = APIRouter(prefix="/api/v1")
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=300)]
WriteSubs = require_role("billing_admin", "support_admin")
WritePromos = require_role("billing_admin")
WriteSettings = require_role("super_admin")


def fail(exc) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message)


async def _views(subs: list[dict]) -> list[dict]:
    user_ids = {s["user_id"] for s in subs}
    plan_ids = {s["plan_id"] for s in subs}
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "handle": 1, "email": 1})}
    versions = {(v["plan_id"], v["version"]): v async for v in db.plan_versions.find(
        {"plan_id": {"$in": list(plan_ids)}}, {"_id": 0, "plan_id": 1, "version": 1, "name": 1})}
    return [entitlements.public_subscription(s, users.get(s["user_id"]), versions.get((s["plan_id"], s["plan_version"])))
            for s in subs]


@router.get("/subscriptions")
async def list_subscriptions(q: str = "", status: str = "", plan_id: str = "", limit: int = 200,
                             _=Depends(require_role())):
    match: dict = {}
    if status:
        match["status"] = status
    if plan_id:
        match["plan_id"] = plan_id
    if q.strip():
        users = [u["id"] async for u in db.users.find(
            {"$or": [{"handle": {"$regex": re.escape(q.strip()), "$options": "i"}}, {"email": {"$regex": re.escape(q.strip()), "$options": "i"}}]},
            {"id": 1})]
        match["user_id"] = {"$in": users}
    rows = await db.subscriptions.find(match, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 500)))
    return {"subscriptions": await _views(rows), "total": await db.subscriptions.count_documents(match)}


@router.get("/subscriptions/{subscription_id}")
async def subscription_detail(subscription_id: str, _=Depends(require_role())):
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    events = await db.subscription_events.find({"subscription_id": subscription_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    runs = await db.entitlement_runs.find({"subscription_id": subscription_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"subscription": (await _views([sub]))[0],
            "events": [e | {"created_at": iso(e["created_at"])} for e in events],
            "runs": [r | {k: iso(r[k]) for k in ("period_start", "period_end", "created_at", "granted_at") if r.get(k)} for r in runs]}


class SubscriptionIn(BaseModel):
    identifier: str = Field(min_length=1, max_length=120)
    plan_id: str = Field(min_length=1, max_length=40)
    billing_period: Literal["monthly", "annual"] = "monthly"
    trial_days: int | None = Field(default=None, ge=0, le=365)
    status: Literal["trialing", "active", "past_due", "canceled", "expired"] | None = None
    reason: Reason


@router.post("/subscriptions", status_code=201)
async def create_subscription(body: SubscriptionIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    try:
        sub = await entitlements.create_subscription(body.identifier, body.plan_id, body.billing_period,
                                                     admin["handle"], body.trial_days, body.status)
    except entitlements.SubscriptionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "subscription.create", "subscription", sub["id"], body.reason,
                       role=admin["admin_role"], details={"plan_id": body.plan_id, "billing": body.billing_period,
                                                          "status": sub["status"]})
    return (await _views([sub]))[0]


class SubscriptionUpdateIn(BaseModel):
    plan_id: str | None = None
    billing_period: Literal["monthly", "annual"] | None = None
    status: Literal["trialing", "active", "past_due", "canceled", "expired"] | None = None
    payment_status: Literal["manual", "paid", "failed", "refunded"] | None = None
    reason: Reason


@router.put("/subscriptions/{subscription_id}")
async def update_subscription(subscription_id: str, body: SubscriptionUpdateIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    update: dict = {"updated_at": now()}
    changed_plan = bool(body.plan_id and body.plan_id != sub["plan_id"])
    changed_billing = bool(body.billing_period and body.billing_period != sub["billing_period"])
    if changed_plan:
        version = await entitlements.live_plan_version(body.plan_id)
        plan = await db.plans.find_one({"plan_id": body.plan_id}, {"_id": 0, "available": 1})
        if not version or not plan or not plan.get("available", True):
            raise ApiError(404, "PLAN_UNAVAILABLE", "That plan isn't available for new subscriptions.")
        update |= {"plan_id": body.plan_id, "plan_version": version["version"]}
    if changed_billing:
        update["billing_period"] = body.billing_period
    if changed_plan or changed_billing:
        # A plan change starts a fresh entitlement period and never carries included credits over.
        start = now()
        billing = body.billing_period or sub["billing_period"]
        update |= {"current_period_start": start, "current_period_end": entitlements.period_end(start, billing)}
    if body.status:
        update["status"] = body.status
        if body.status == "canceled" and not sub.get("canceled_at"):
            update["canceled_at"] = now()
        if body.status == "past_due":
            update["payment_status"] = "failed"
    if body.payment_status:
        update["payment_status"] = body.payment_status
    await db.subscriptions.update_one({"id": subscription_id}, {"$set": update})
    if changed_plan or changed_billing:
        fresh = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
        await entitlements.grant_period(fresh, entitlements.utc(update["current_period_start"]), admin["handle"])
        await entitlements._event(subscription_id, "plan_changed", admin["handle"], {
            "from_plan": sub["plan_id"], "to_plan": update.get("plan_id", sub["plan_id"]),
            "from_billing": sub["billing_period"], "to_billing": update.get("billing_period", sub["billing_period"]),
            "proration": "manual"})
    await entitlements._event(subscription_id, "updated", admin["handle"], {"changes": {k: str(v) for k, v in update.items() if k != "updated_at"}})
    await record_audit(admin["handle"], "subscription.update", "subscription", subscription_id, body.reason,
                       role=admin["admin_role"], details={k: str(v) for k, v in update.items() if k != "updated_at"})
    fresh = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    return (await _views([fresh]))[0]


@router.get("/subscriptions/{subscription_id}/change-preview")
async def preview_subscription_change(subscription_id: str, plan_id: str = "", billing_period: str = "",
                                      _=Depends(require_role())):
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    next_plan = plan_id or sub["plan_id"]
    next_billing = billing_period or sub["billing_period"]
    old_version = await entitlements.pinned_plan_version(sub) or {}
    new_version = await entitlements.live_plan_version(next_plan)
    if not new_version:
        raise ApiError(404, "NOT_FOUND", "That plan is not available.")
    now_ts = now()
    end = entitlements.utc(sub["current_period_end"])
    days_left = max(0, (end - now_ts).days)
    days_in_period = max(1, (end - entitlements.utc(sub["current_period_start"])).days)
    old_monthly = (round(old_version.get("annual_price_paise", 0) / 12) if sub["billing_period"] == "annual"
                   else old_version.get("monthly_price_paise", 0))
    new_monthly = (round(new_version.get("annual_price_paise", 0) / 12) if next_billing == "annual"
                   else new_version.get("monthly_price_paise", 0))
    return {"subscriptionId": subscription_id, "fromPlan": sub["plan_id"], "toPlan": next_plan,
            "fromBilling": sub["billing_period"], "toBilling": next_billing,
            "daysLeft": days_left, "daysInPeriod": days_in_period,
            "currentMonthlyPaise": old_monthly, "newMonthlyPaise": new_monthly,
            "estimatedProrationPaise": round((new_monthly - old_monthly) * days_left / days_in_period),
            "newAllowance": entitlements.period_credits(new_version, next_billing),
            "note": ("Manual/manual-mode billing: no money is collected here. The amount is an estimate for "
                     "the admin; a payment provider must collect or credit it.")}


class CancelIn(BaseModel):
    at_period_end: bool = True
    reason: Reason


@router.post("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(subscription_id: str, body: CancelIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    try:
        fresh = await entitlements.cancel(sub, admin["handle"], body.reason, body.at_period_end)
    except entitlements.SubscriptionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "subscription.cancel", "subscription", subscription_id, body.reason,
                       role=admin["admin_role"], details={"at_period_end": body.at_period_end})
    return (await _views([fresh]))[0]


class ActionIn(BaseModel):
    reason: Reason


@router.post("/subscriptions/{subscription_id}/resume")
async def resume_subscription(subscription_id: str, body: ActionIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    try:
        fresh = await entitlements.resume(sub, admin["handle"])
    except entitlements.SubscriptionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "subscription.resume", "subscription", subscription_id, body.reason,
                       role=admin["admin_role"])
    return (await _views([fresh]))[0]


@router.post("/subscriptions/{subscription_id}/renew")
async def renew_subscription(subscription_id: str, body: ActionIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    fresh = await entitlements.renew(sub, admin["handle"])
    await record_audit(admin["handle"], "subscription.renew", "subscription", subscription_id, body.reason,
                       role=admin["admin_role"])
    return (await _views([fresh]))[0]


@router.post("/subscriptions/{subscription_id}/grant")
async def grant_subscription(subscription_id: str, body: ActionIn, auth=Depends(WriteSubs)):
    admin = auth[0]
    sub = await db.subscriptions.find_one({"id": subscription_id}, {"_id": 0})
    if not sub:
        raise ApiError(404, "NOT_FOUND", "Subscription not found.")
    run = await entitlements.grant_period(sub, sub["current_period_start"], admin["handle"])
    await record_audit(admin["handle"], "subscription.grant", "subscription", subscription_id, body.reason,
                       role=admin["admin_role"], details={"credits": (run or {}).get("credits", 0),
                                                          "already_granted": run is None})
    return {"already_granted": run is None, "credits": (run or {}).get("credits", 0)}


class PromotionIn(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    credits: int = Field(ge=1, le=10000)
    eligibility: str = Field(default="all", max_length=80)
    starts_at: datetime
    ends_at: datetime
    per_user_limit: int = Field(default=1, ge=1, le=10)
    credit_expiry_days: int = Field(default=0, ge=0, le=365)
    segment_days: int = Field(default=30, ge=1, le=365)
    user_ids: list[str] = Field(default_factory=list, max_length=200)
    auto_grant: bool = False
    code: str | None = Field(default=None, max_length=32)
    reason: Reason


@router.get("/promotions")
async def list_promotions(_=Depends(require_role())):
    return {"promotions": await promotions.list_promotions()}


@router.get("/promotions/{promotion_id}")
async def promotion_detail(promotion_id: str, _=Depends(require_role())):
    promo = await promotions.get_promotion(promotion_id)
    return {"promotion": await promotions._view(promo), "grants": await promotions.grants_for(promotion_id)}


@router.post("/promotions", status_code=201)
async def create_promotion(body: PromotionIn, auth=Depends(WritePromos)):
    admin = auth[0]
    try:
        promo = await promotions.create_promotion(
            body.name, body.credits, body.eligibility, body.starts_at, body.ends_at, body.per_user_limit,
            body.credit_expiry_days, admin["handle"], body.segment_days, body.user_ids, body.auto_grant, body.code)
    except promotions.PromotionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "promotion.create", "promotion", promo["id"], body.reason,
                       role=admin["admin_role"], details={"credits": body.credits, "eligibility": body.eligibility,
                                                          "auto_grant": body.auto_grant, "code": promo.get("code")})
    return promo


@router.put("/promotions/{promotion_id}")
async def update_promotion(promotion_id: str, body: PromotionIn, auth=Depends(WritePromos)):
    admin = auth[0]
    try:
        promo = await promotions.update_promotion(
            promotion_id, name=body.name, credits_amount=body.credits, eligibility=body.eligibility,
            starts_at=body.starts_at, ends_at=body.ends_at, per_user_limit=body.per_user_limit,
            credit_expiry_days=body.credit_expiry_days, segment_days=body.segment_days,
            user_ids=body.user_ids, auto_grant=body.auto_grant, code=body.code)
    except promotions.PromotionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "promotion.update", "promotion", promotion_id, body.reason,
                       role=admin["admin_role"])
    return promo


@router.post("/promotions/{promotion_id}/activate")
async def activate_promotion(promotion_id: str, body: ActionIn, auth=Depends(WritePromos)):
    admin = auth[0]
    try:
        promo = await promotions.set_status(promotion_id, "active")
    except promotions.PromotionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "promotion.activate", "promotion", promotion_id, body.reason,
                       role=admin["admin_role"])
    return promo


@router.post("/promotions/{promotion_id}/end")
async def end_promotion(promotion_id: str, body: ActionIn, auth=Depends(WritePromos)):
    admin = auth[0]
    try:
        promo = await promotions.set_status(promotion_id, "ended")
    except promotions.PromotionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "promotion.end", "promotion", promotion_id, body.reason,
                       role=admin["admin_role"])
    return promo


@router.post("/promotions/{promotion_id}/grant")
async def grant_promotion(promotion_id: str, body: ActionIn, auth=Depends(WritePromos)):
    admin = auth[0]
    try:
        result = await promotions.grant_now(promotion_id, admin["handle"], body.reason)
    except promotions.PromotionError as exc:
        raise fail(exc)
    await record_audit(admin["handle"], "promotion.grant", "promotion", promotion_id, body.reason,
                       role=admin["admin_role"], details=result)
    return result


class SettingsIn(BaseModel):
    default_model: str = Field(min_length=1, max_length=60)
    max_input_tokens: int = Field(ge=1000, le=200000)
    max_requests_per_minute: int = Field(ge=1, le=600)
    monthly_spend_alert_paise: int = Field(ge=0, le=100_000_000)
    credit_value_paise: int = Field(default=250, ge=1, le=100_000)
    approval_threshold_credits: int = Field(default=1000, ge=0, le=100_000)
    referral_referrer_credits: int = Field(default=10, ge=0, le=1000)
    referral_referee_credits: int = Field(default=5, ge=0, le=1000)
    gift_max_credits: int = Field(default=1000, ge=1, le=100_000)
    input_cost_paise_per_mtok: int = Field(default=0, ge=0, le=100_000_000)
    output_cost_paise_per_mtok: int = Field(default=0, ge=0, le=100_000_000)
    low_credit_threshold: int = Field(ge=0, le=1000)
    reset_policy: str = Field(min_length=10, max_length=500)
    trial_days: int = Field(ge=0, le=90)
    support_email: str = Field(default="", max_length=120)
    support_url: str = Field(default="", max_length=200)
    status_page_url: str = Field(default="", max_length=200)
    support_hours: str = Field(default="", max_length=120)
    require_mfa_for_admins: bool = False
    admin_session_minutes: int = Field(default=1440, ge=30, le=10080)
    audit_retention_days: int = Field(default=365, ge=30, le=3650)
    flags: dict[str, bool]
    reason: Reason


def settings_payload(body: SettingsIn) -> dict:
    return {"defaultModel": body.default_model, "maxInputTokens": body.max_input_tokens,
            "maxRequestsPerMinute": body.max_requests_per_minute,
            "monthlySpendAlertPaise": body.monthly_spend_alert_paise,
            "creditValuePaise": body.credit_value_paise,
            "approvalThresholdCredits": body.approval_threshold_credits,
            "referralReferrerCredits": body.referral_referrer_credits,
            "referralRefereeCredits": body.referral_referee_credits,
            "giftMaxCredits": body.gift_max_credits,
            "inputCostPaisePerMTok": body.input_cost_paise_per_mtok,
            "outputCostPaisePerMTok": body.output_cost_paise_per_mtok,
            "lowCreditThreshold": body.low_credit_threshold, "resetPolicy": body.reset_policy,
            "trialDays": body.trial_days, "flags": body.flags,
            "supportEmail": body.support_email, "supportUrl": body.support_url,
            "statusPageUrl": body.status_page_url, "supportHours": body.support_hours,
            "requireMfaForAdmins": body.require_mfa_for_admins,
            "adminSessionMinutes": body.admin_session_minutes,
            "auditRetentionDays": body.audit_retention_days}


@router.get("/settings")
async def get_settings(_=Depends(require_role())):
    return {"settings": await platform_settings.get_settings(), "providers": platform_settings.provider_status()}


@router.put("/settings")
async def save_settings(body: SettingsIn, auth=Depends(WriteSettings)):
    admin = auth[0]
    values = await platform_settings.update_settings(settings_payload(body), admin["handle"])
    await record_audit(admin["handle"], "settings.update", "settings", platform_settings.KEY, body.reason,
                       role=admin["admin_role"], details={"settings": values})
    return {"settings": values, "providers": platform_settings.provider_status()}


@public_router.get("/settings/public")
async def public_settings():
    return await platform_settings.public_settings()


class RedeemIn(BaseModel):
    code: str = Field(min_length=3, max_length=32)


@public_router.post("/promotions/redeem")
async def redeem_promotion(body: RedeemIn, auth=Depends(require_auth)):
    try:
        return await promotions.redeem_code(body.code, auth[0]["id"])
    except promotions.PromotionError as exc:
        raise fail(exc)
