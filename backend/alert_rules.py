import math


def projected_days(available: int, charged: int, days: int = 14) -> int | None:
    """Estimate how many days the current balance lasts at the recent daily burn rate."""
    if days <= 0 or charged <= 0:
        return None
    daily = charged / days
    return max(0, math.ceil(max(0, available) / daily))


def allows_alerts(user: dict) -> bool:
    notifications = ((user.get("preferences") or {}).get("notifications") or {})
    return bool(notifications.get("creditAlerts", True))
