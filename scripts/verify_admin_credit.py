#!/usr/bin/env python3
"""Smoke-check the LifeOS admin console and credit engine against a running server.

Usage:
    python scripts/verify_admin_credit.py --base-url http://localhost:8001 \
        --identifier owner --password '...'

Environment fallbacks: BASE_URL, ADMIN_IDENTIFIER, ADMIN_PASSWORD.
The account must be an admin (super/billing/support/analyst) to read admin APIs.
"""

import argparse
import os
import sys

import requests


class Checker:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.results: list[tuple[str, bool, str]] = []

    def check(self, name: str, fn) -> None:
        try:
            detail = fn()
            self.results.append((name, True, detail or "ok"))
        except Exception as exc:  # noqa: BLE001 - report every failure
            self.results.append((name, False, str(exc)[:240]))

    def get(self, path: str) -> dict:
        res = self.session.get(f"{self.base_url}{path}", timeout=30)
        if not res.ok:
            raise RuntimeError(f"{path} -> HTTP {res.status_code}: {res.text[:200]}")
        return res.json()

    def post(self, path: str, body: dict) -> dict:
        res = self.session.post(f"{self.base_url}{path}", json=body, timeout=30)
        if not res.ok:
            raise RuntimeError(f"{path} -> HTTP {res.status_code}: {res.text[:200]}")
        return res.json()

    def login(self, identifier: str, password: str) -> str:
        res = self.session.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"identifier": identifier, "password": password},
            timeout=30,
        )
        if not res.ok:
            raise RuntimeError(f"login failed: HTTP {res.status_code}: {res.text[:200]}")
        data = res.json()
        if data.get("mfaRequired"):
            raise RuntimeError(
                "This account has MFA enabled. Complete /api/v1/auth/mfa/verify first, "
                "or use an admin account without MFA for this smoke check."
            )
        return data.get("user", {}).get("handle", identifier)

    def report(self) -> int:
        width = max(len(name) for name, _, _ in self.results) if self.results else 10
        print("\nLifeOS admin/credit verification\n" + "=" * (width + 12))
        failures = 0
        for name, ok, detail in self.results:
            print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
            failures += 0 if ok else 1
        print("=" * (width + 12))
        print(f"{len(self.results) - failures}/{len(self.results)} checks passed")
        return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("BASE_URL", "http://localhost:8001"))
    parser.add_argument("--identifier", default=os.environ.get("ADMIN_IDENTIFIER", ""))
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", ""))
    args = parser.parse_args()
    if not args.identifier or not args.password:
        parser.error("provide --identifier/--password or ADMIN_IDENTIFIER/ADMIN_PASSWORD")

    c = Checker(args.base_url)
    handle = ""
    c.check("admin login", lambda: _login(c, args.identifier, args.password))
    if not any(ok for name, ok, _ in c.results if name == "admin login"):
        return c.report()

    # These run only after a successful login.
    handle = _handle(c)
    c.check("admin role", lambda: _role(c))
    c.check("dashboard revenue + distribution", lambda: _overview(c))
    c.check("credit summary reset/reconciliation", lambda: _credit_summary(c))
    c.check("reconciliation queue", lambda: _reconciliations(c))
    c.check("plan features + preview", lambda: _plans(c))
    c.check("pricing version", lambda: _pricing(c))
    c.check("support/security/grace settings", lambda: _settings(c))
    c.check("subscriber credit overview", lambda: _subscriber_credits(c))
    c.check("action estimate", lambda: _estimate(c))
    c.check("usage cost columns", lambda: _usage(c))
    c.check("audit request IDs", lambda: _audit(c))
    print(f"\nSigned in as @{handle}")
    return c.report()


def _login(c: Checker, identifier: str, password: str) -> str:
    return c.login(identifier, password)


def _handle(c: Checker) -> str:
    me = c.get("/api/v1/admin/me")
    return me.get("handle", "admin")


def _role(c: Checker) -> str:
    me = c.get("/api/v1/admin/me")
    if me.get("role") not in ("super_admin", "billing_admin", "support_admin", "ai_ops_admin", "analyst"):
        raise RuntimeError(f"unexpected role {me.get('role')!r}")
    return f"role={me['role']}"


def _overview(c: Checker) -> str:
    data = c.get("/api/v1/admin/overview?days=30")
    for key in ("revenue", "planDistribution", "recentSubscriptionEvents", "costPerSuccessPaise"):
        if key not in data:
            raise RuntimeError(f"missing {key}")
    revenue = data["revenue"]
    if revenue["arrPaise"] != revenue["mrrPaise"] * 12:
        raise RuntimeError("ARR is not MRR x 12")
    return f"MRR={revenue['mrrPaise']} ARR={revenue['arrPaise']} plans={len(data['planDistribution'])}"


def _credit_summary(c: Checker) -> str:
    data = c.get("/api/v1/admin/credits/summary")
    for key in ("nextResetAt", "refunded", "stuckHolds", "reconciliationOpen", "reconciliationItems"):
        if key not in data:
            raise RuntimeError(f"missing {key}")
    return f"nextReset={data['nextResetAt']} refunded={data['refunded']} recon={data['reconciliationOpen']}"


def _reconciliations(c: Checker) -> str:
    data = c.get("/api/v1/admin/credits/reconciliations")
    if "items" not in data:
        raise RuntimeError("missing items")
    return f"pending={len(data['items'])}"


def _plans(c: Checker) -> str:
    data = c.get("/api/v1/admin/plans")
    plans = data.get("plans", [])
    if not plans:
        raise RuntimeError("no plans")
    missing = [p["plan_id"] for p in plans if "features" not in (p.get("current") or {})]
    if missing:
        raise RuntimeError(f"plans missing features: {missing}")
    preview = c.get("/api/v1/admin/plans/ai/preview")
    for key in ("hasDraft", "diff", "note", "subscribers"):
        if key not in preview:
            raise RuntimeError(f"preview missing {key}")
    return f"plans={len(plans)} draft={preview['hasDraft']}"


def _pricing(c: Checker) -> str:
    data = c.get("/api/v1/admin/pricing")
    current = data.get("current")
    if not current or not current.get("actions"):
        raise RuntimeError("no published pricing")
    return f"v{current['version']} actions={len(current['actions'])}"


def _settings(c: Checker) -> str:
    data = c.get("/api/v1/admin/settings").get("settings", {})
    for key in ("supportEmail", "supportUrl", "requireMfaForAdmins", "adminSessionMinutes",
                "auditRetentionDays", "pastDueGraceDays"):
        if key not in data:
            raise RuntimeError(f"missing {key}")
    providers = c.get("/api/v1/admin/settings").get("providers", [])
    return f"grace={data['pastDueGraceDays']}d mfa={data['requireMfaForAdmins']} providers={len(providers)}"


def _subscriber_credits(c: Checker) -> str:
    data = c.get("/api/v1/credits")
    for key in ("available", "reserved", "aiAllowed", "planId", "nextResetAt", "allowance"):
        if key not in data:
            raise RuntimeError(f"missing {key}")
    return f"available={data['available']} plan={data['planId']} aiAllowed={data['aiAllowed']}"


def _estimate(c: Checker) -> str:
    data = c.post("/api/v1/ai/estimate", {"action": "task_breakdown", "inputChars": 500})
    for key in ("minCredits", "maxCredits", "available", "expectedRemaining", "allowed", "model"):
        if key not in data:
            raise RuntimeError(f"missing {key}")
    return f"{data['label']}: {data['minCredits']}–{data['maxCredits']} credits, allowed={data['allowed']}"


def _usage(c: Checker) -> str:
    data = c.get("/api/v1/admin/usage?days=7&limit=5")
    rows = data.get("requests", [])
    if rows and "estimated_cost_paise" not in rows[0]:
        raise RuntimeError("usage rows missing estimated_cost_paise")
    insights = c.get("/api/v1/admin/usage/insights?days=30")
    totals = insights.get("totals", {})
    for key in ("costPaise", "actualCostPaise", "actualRequests"):
        if key not in totals:
            raise RuntimeError(f"insights missing {key}")
    return f"rows={len(rows)} actualRequests={totals['actualRequests']}"


def _audit(c: Checker) -> str:
    data = c.get("/api/v1/admin/audit?limit=5")
    entries = data.get("entries", [])
    if entries and "request_id" not in entries[0]:
        raise RuntimeError("audit entries missing request_id")
    return f"entries={len(entries)}"


if __name__ == "__main__":
    sys.exit(main())
