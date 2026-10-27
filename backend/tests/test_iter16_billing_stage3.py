# Iteration 16: Stage 3 billing records - admin plans/pricing/credits summary, register credit account, idempotent seeds
import os
import subprocess
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"

_env = dotenv_values("/app/backend/.env")
DB = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]


def login(handle, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": handle, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {handle}: {r.status_code}")
    return s


@pytest.fixture(scope="module")
def demo():
    return login("demo", "DemoPass123!")


@pytest.fixture(scope="module")
def mailtest():
    return login("mailtest", "TestPass123!")


EXPECTED_PLANS = {
    "basic": dict(monthly_price_paise=19900, annual_price_paise=178800, monthly_credits=0, annual_monthly_credits=0,
                  annual_bonus_credits=0, trial_days=30, trial_credits=0),
    "ai": dict(monthly_price_paise=29900, annual_price_paise=298800, monthly_credits=100, annual_monthly_credits=150,
               annual_bonus_credits=50, trial_days=30, trial_credits=25),
    "ai_pro": dict(monthly_price_paise=39900, annual_price_paise=418800, monthly_credits=200, annual_monthly_credits=250,
                   annual_bonus_credits=50, trial_days=30, trial_credits=50),
}


# Plans endpoint
class TestPlans:
    def test_plans(self, demo):
        r = demo.get(f"{API}/admin/plans")
        assert r.status_code == 200, r.text
        plans = r.json()["plans"]
        assert [p["plan_id"] for p in plans] == ["basic", "ai", "ai_pro"]
        for p in plans:
            assert "_id" not in p and "_id" not in p["current"]
            assert p["current_version"] == 1
            cur = p["current"]
            assert cur["version"] == 1 and cur["status"] == "published"
            for k, v in EXPECTED_PLANS[p["plan_id"]].items():
                assert cur[k] == v, (p["plan_id"], k, cur[k])
                assert isinstance(cur[k], int)


# Pricing endpoint
class TestPricing:
    def test_pricing(self, demo):
        r = demo.get(f"{API}/admin/pricing")
        assert r.status_code == 200, r.text
        versions = r.json()["versions"]
        assert len(versions) == 1
        v = versions[0]
        assert v["version"] == 1 and v["status"] == "published"
        acts = {a["action"]: a for a in v["actions"]}
        assert len(v["actions"]) == 13 and len(acts) == 13
        assert (acts["document_analysis"]["min_credits"], acts["document_analysis"]["max_credits"]) == (3, 8)
        assert (acts["meeting_analysis"]["min_credits"], acts["meeting_analysis"]["max_credits"]) == (3, 6)
        assert (acts["complex_planning"]["min_credits"], acts["complex_planning"]["max_credits"]) == (5, 5)
        assert all(a["model"] == "gpt-6-luna" for a in v["actions"])


# Credits summary
class TestCreditsSummary:
    def test_summary_matches_users(self, demo):
        r = demo.get(f"{API}/admin/credits/summary")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["accounts"] == DB.users.count_documents({}), (d, DB.users.count_documents({}))
        assert d["available"] == 0 and d["reserved"] == 0 and d["ledgerEntries"] == 0

    def test_register_creates_account(self, demo):
        before = demo.get(f"{API}/admin/credits/summary").json()["accounts"]
        tag = uuid.uuid4().hex[:8]
        handle = f"test_s3_{tag}"
        r = requests.post(f"{API}/auth/register", json={"handle": handle, "displayName": "TEST S3", "password": "TestPass12345!"})
        assert r.status_code in (200, 201), r.text
        try:
            after = demo.get(f"{API}/admin/credits/summary").json()
            assert after["accounts"] == before + 1
            assert after["available"] == 0
            u = DB.users.find_one({"handle": handle})
            acct = DB.credit_accounts.find_one({"user_id": u["id"]})
            assert acct and acct["available"] == 0 and acct["reserved"] == 0
        finally:
            u = DB.users.find_one({"handle": handle})
            if u:
                DB.credit_accounts.delete_many({"user_id": u["id"]})
                DB.sessions.delete_many({"user_id": u["id"]})
                DB.app_state.delete_many({"user_id": u["id"]})
                DB.users.delete_one({"id": u["id"]})


# Access control on new endpoints
@pytest.mark.parametrize("path", ["plans", "pricing", "credits/summary"])
def test_anonymous_401(path):
    assert requests.get(f"{API}/admin/{path}").status_code == 401


@pytest.mark.parametrize("path", ["plans", "pricing", "credits/summary"])
def test_mailtest_403(mailtest, path):
    r = mailtest.get(f"{API}/admin/{path}")
    assert r.status_code == 403
    assert "FORBIDDEN" in r.text


def _counts():
    return dict(plans=DB.plans.count_documents({}), plan_versions=DB.plan_versions.count_documents({}),
                pricing=DB.ai_pricing_versions.count_documents({}),
                audit_mig=DB.admin_audit.count_documents({"actor": "system", "target_type": "migration"}),
                migrations=sorted(m["key"] for m in DB.schema_migrations.find({}, {"key": 1})))


# Restart idempotency
def test_restart_idempotent():
    before = _counts()
    assert before["plans"] == 3 and before["plan_versions"] == 3 and before["pricing"] == 1
    assert before["audit_mig"] == 3
    assert before["migrations"] == ["stage3_backfill_credit_accounts", "stage3_seed_ai_pricing_v1", "stage3_seed_plans_v1"]
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    for _ in range(30):
        time.sleep(2)
        try:
            if requests.get(f"{API}/admin/plans", timeout=5).status_code == 401:
                break
        except requests.RequestException:
            pass
    assert _counts() == before
