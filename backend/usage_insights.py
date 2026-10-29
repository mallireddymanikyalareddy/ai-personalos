import math
from datetime import timedelta

import platform_settings
from billing import now
from db import db


def estimate_cost(row: dict, settings: dict) -> float:
    """Provider cost estimate in paise from stored token estimates and configured rates."""
    input_tokens = max(0, int(row.get("est_input_tokens", 0)))
    output_tokens = max(0, int(row.get("est_output_tokens", 0)))
    return (input_tokens * float(settings.get("inputCostPaisePerMTok", 0))
            + output_tokens * float(settings.get("outputCostPaisePerMTok", 0))) / 1_000_000


def actual_cost(row: dict) -> int | None:
    """A cost recorded from a provider invoice or manual reconciliation."""
    value = row.get("provider_cost_paise")
    return None if value is None else int(value)


def _row_cost(row: dict, settings: dict) -> int:
    actual = actual_cost(row)
    return actual if actual is not None else round(estimate_cost(row, settings))


async def _current_prices() -> dict[str, int]:
    version = await db.ai_pricing_versions.find_one(
        {"status": "published", "effective_at": {"$lte": now()}}, {"_id": 0},
        sort=[("effective_at", -1), ("version", -1)])
    return {a["action"]: a["max_credits"] for a in (version or {}).get("actions", [])}


async def insights(days: int = 30) -> dict:
    settings = await platform_settings.get_settings()
    prices = await _current_prices()
    since = now() - timedelta(days=days)
    rows = await db.ai_usage.find({"created_at": {"$gte": since}}, {"_id": 0}).to_list(20000)
    month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def naive(value):
        return value.replace(tzinfo=None) if value.tzinfo else value

    month_rows = [r for r in rows if r.get("created_at") and naive(r["created_at"]) >= naive(month_start)]
    totals = {"requests": len(rows), "succeeded": 0, "failed": 0, "cancelled": 0,
              "credits": 0, "inputTokens": 0, "outputTokens": 0, "estimatedCostPaise": 0,
              "actualCostPaise": 0, "actualRequests": 0, "costPaise": 0}
    for row in rows:
        totals[row.get("status", "failed")] = totals.get(row.get("status", "failed"), 0) + 1
        totals["credits"] += int(row.get("charged", 0))
        totals["inputTokens"] += int(row.get("est_input_tokens", 0))
        totals["outputTokens"] += int(row.get("est_output_tokens", 0))
        estimate = round(estimate_cost(row, settings))
        totals["estimatedCostPaise"] += estimate
        actual = actual_cost(row)
        if actual is not None:
            totals["actualCostPaise"] += actual
            totals["actualRequests"] += 1
        totals["costPaise"] += actual if actual is not None else estimate

    def grouped(key: str) -> list[dict]:
        result: dict[str, dict] = {}
        for row in rows:
            name = row.get(key) or "—"
            item = result.setdefault(name, {key: name, "calls": 0, "credits": 0, "costPaise": 0, "ms": 0})
            item["calls"] += 1
            item["credits"] += int(row.get("charged", 0))
            item["costPaise"] += _row_cost(row, settings)
            item["ms"] += int(row.get("ms", 0))
        return [{**item, "avgMs": round(item["ms"] / item["calls"]) if item["calls"] else 0}
                | ({"priceCredits": prices.get(item[key], 0)} if key == "action" else {})
                for item in sorted(result.values(), key=lambda x: x["calls"], reverse=True)]

    daily: dict[str, dict] = {}
    for row in rows:
        day = row["created_at"].strftime("%Y-%m-%d")
        item = daily.setdefault(day, {"day": day[5:], "calls": 0, "credits": 0, "costPaise": 0})
        item["calls"] += 1
        item["credits"] += int(row.get("charged", 0))
        item["costPaise"] += _row_cost(row, settings)

    month_cost = sum(_row_cost(r, settings) for r in month_rows)
    day_of_month = now().day
    days_in_month = (now().replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    projected = round(month_cost / max(1, day_of_month) * days_in_month.day)
    subscribers = await db.subscriptions.count_documents({"status": {"$in": ["active", "trialing"]}})
    plans: list[dict] = []
    async for plan in db.plan_versions.find(
            {"status": "published", "effective_at": {"$lte": now()}}, {"_id": 0}).sort([("plan_id", 1), ("version", -1)]):
        if any(p["planId"] == plan["plan_id"] for p in plans):
            continue
        count = await db.subscriptions.count_documents({"plan_id": plan["plan_id"], "status": {"$in": ["active", "trialing"]}})
        revenue = plan.get("monthly_price_paise", 0)
        annual_count = await db.subscriptions.count_documents(
            {"plan_id": plan["plan_id"], "billing_period": "annual", "status": {"$in": ["active", "trialing"]}})
        annual_revenue = plan.get("annual_price_paise", 0) / 12 if annual_count else 0
        revenue_total = (count - annual_count) * revenue + annual_count * annual_revenue
        cost_per_sub = month_cost / subscribers if subscribers else 0
        credits_total = ((count - annual_count) * plan.get("monthly_credits", 0)
                         + annual_count * plan.get("annual_monthly_credits", 0))
        plans.append({"planId": plan["plan_id"], "name": plan.get("name", plan["plan_id"]), "subscribers": count,
                      "monthlyRevenuePaise": round(revenue_total),
                      "monthlyCredits": round(credits_total / count) if count else plan.get("monthly_credits", 0),
                      "costPerSubscriberPaise": round(cost_per_sub),
                      "marginPaise": round(revenue_total - cost_per_sub * count)})

    return {"totals": totals, "byAction": grouped("action"), "byModel": grouped("model"),
            "trend": sorted(daily.values(), key=lambda x: x["day"]),
            "month": {"spendPaise": month_cost, "projectedPaise": projected,
                      "credits": sum(int(r.get("charged", 0)) for r in month_rows)},
            "costPerCreditPaise": round(month_cost / max(1, sum(int(r.get("charged", 0)) for r in month_rows)), 2),
            "plans": plans}


async def simulate(days: int, prices: dict[str, int]) -> dict:
    since = now() - timedelta(days=days)
    rows = await db.ai_usage.find({"created_at": {"$gte": since}, "status": "succeeded"}, {"_id": 0}).to_list(20000)
    calls: dict[str, int] = {}
    current: dict[str, int] = {}
    for row in rows:
        action = row.get("action", "—")
        calls[action] = calls.get(action, 0) + 1
        current[action] = current.get(action, 0) + int(row.get("charged", 0))
    projected = sum(calls.get(action, 0) * price for action, price in prices.items())
    return {"calls": calls, "currentCredits": sum(current.values()), "projectedCredits": projected,
            "deltaCredits": projected - sum(current.values()),
            "byAction": [{"action": action, "calls": calls[action], "currentCredits": current.get(action, 0),
                          "projectedCredits": calls[action] * prices.get(action, 0)}
                         for action in sorted(calls)]}
