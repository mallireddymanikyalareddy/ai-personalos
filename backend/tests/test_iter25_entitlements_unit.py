# Iteration 25: non-Razorpay billing engine unit tests (no database required)
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "personalos-test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from entitlements import add_months, period_credits, period_end, public_subscription  # noqa: E402
from promotions import PromotionError, parse_eligibility, promotion_status  # noqa: E402


def dt(year, month, day, hour=0):
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


class TestPeriods:
    def test_add_months_clamps_end_of_month(self):
        assert add_months(dt(2026, 1, 31), 1) == dt(2026, 2, 28)
        assert add_months(dt(2028, 1, 31), 1) == dt(2028, 2, 29)

    def test_period_end_monthly_and_annual(self):
        assert period_end(dt(2026, 10, 27), "monthly") == dt(2026, 11, 27)
        assert period_end(dt(2026, 10, 27), "annual") == dt(2027, 10, 27)

    def test_period_end_rolls_year(self):
        assert period_end(dt(2026, 12, 15), "monthly") == dt(2027, 1, 15)

    def test_period_credits_uses_billing_period(self):
        version = {"monthly_credits": 100, "annual_monthly_credits": 150}
        assert period_credits(version, "monthly") == 100
        assert period_credits(version, "annual") == 150


class TestPromotionRules:
    def test_parse_eligibility(self):
        assert parse_eligibility("all") == "all"
        assert parse_eligibility("plan:ai") == "plan:ai"
        with pytest.raises(PromotionError):
            parse_eligibility("everyone")

    def test_status_follows_dates(self):
        assert promotion_status({"status": "draft"}) == "draft"
        assert promotion_status({"status": "active", "ends_at": dt(2026, 1, 1)}) == "ended"
        future = datetime.now(timezone.utc) + timedelta(days=1)
        assert promotion_status({"status": "active", "ends_at": future}) == "active"


class TestSubscriptionView:
    def test_public_subscription_maps_fields_and_iso(self):
        sub = {
            "id": "sub_1", "user_id": "u1", "plan_id": "ai", "plan_version": 2,
            "billing_period": "annual", "status": "active", "payment_status": "manual",
            "provider": "manual", "started_at": dt(2026, 1, 1), "current_period_start": dt(2026, 1, 1),
            "current_period_end": dt(2027, 1, 1), "trial_ends_at": None, "cancel_at_period_end": False,
            "canceled_at": None, "created_at": dt(2026, 1, 1),
        }
        view = public_subscription(sub, {"handle": "demo", "email": "demo@example.com"}, {"name": "PersonalOS AI"})
        assert view["plan"] == "PersonalOS AI"
        assert view["handle"] == "demo"
        assert view["billing"] == "annual"
        assert view["start"] == "2026-01-01T00:00:00Z"
        assert view["cancelAtPeriodEnd"] is False
