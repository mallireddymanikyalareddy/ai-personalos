# Iteration 26: credit alert rules (no database required)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alert_rules import allows_alerts, projected_days  # noqa: E402


class TestProjectedDays:
    def test_no_usage_has_no_forecast(self):
        assert projected_days(100, 0) is None

    def test_days_are_rounded_up(self):
        assert projected_days(100, 14) == 100       # 1/day over 14 days -> 100
        assert projected_days(10, 14) == 10
        assert projected_days(10, 28) == 5
        assert projected_days(1, 28) == 1            # 0.5 days rounds up

    def test_zero_balance_is_zero_days(self):
        assert projected_days(0, 14) == 0

    def test_invalid_window_has_no_forecast(self):
        assert projected_days(10, 14, 0) is None
        assert projected_days(10, 14, -1) is None


class TestAllowsAlerts:
    def test_defaults_on(self):
        assert allows_alerts({}) is True
        assert allows_alerts({"preferences": {}}) is True
        assert allows_alerts({"preferences": {"notifications": {}}}) is True

    def test_user_can_disable(self):
        assert allows_alerts({"preferences": {"notifications": {"creditAlerts": False}}}) is False
        assert allows_alerts({"preferences": {"notifications": {"creditAlerts": True}}}) is True
