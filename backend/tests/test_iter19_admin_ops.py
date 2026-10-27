# Iteration 19: Stage 5/7 admin ops - users/overview/usage/audit/ledger/summary, credit adjust, role changes, RBAC
import os
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


def register(prefix):
    handle = f"{prefix}{uuid.uuid4().hex[:6]}"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "T", "password": "TestPass1234!"})
    assert r.status_code in (200, 201), r.text
    return s, handle, DB.users.find_one({"handle": handle})["id"]


def purge(uid):
    for c in ("credit_accounts", "credit_ledger", "credit_reservations", "ai_usage", "sessions", "app_state"):
        DB[c].delete_many({"user_id": uid})
    DB.users.delete_one({"id": uid})


def consistent(uid):
    rows = list(DB.credit_ledger.find({"user_id": uid}))
    acc = DB.credit_accounts.find_one({"user_id": uid})
    return sum(r["available_delta"] for r in rows) == acc["available"] and sum(r["reserved_delta"] for r in rows) == acc["reserved"]


def rid():
    return f"test{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="module")
def demo():
    return login("demo", "DemoPass123!")


@pytest.fixture(scope="module")
def target():
    s, handle, uid = register("tests19t")
    yield s, handle, uid
    purge(uid)


@pytest.fixture(scope="module")
def billing_user(demo):
    s, handle, uid = register("tests19b")
    r = demo.put(f"{API}/admin/users/{uid}/role", json={"role": "billing_admin", "reason": "test billing role"})
    assert r.status_code == 200, r.text
    yield s, handle, uid
    demo.put(f"{API}/admin/users/{uid}/role", json={"role": None, "reason": "cleanup role"})
    purge(uid)


@pytest.fixture(scope="module")
def analyst_user(demo):
    s, handle, uid = register("tests19a")
    r = demo.put(f"{API}/admin/users/{uid}/role", json={"role": "analyst", "reason": "test analyst role"})
    assert r.status_code == 200, r.text
    yield s, handle, uid
    demo.put(f"{API}/admin/users/{uid}/role", json={"role": None, "reason": "cleanup role"})
    purge(uid)


# --- Read endpoints
class TestReads:
    def test_users_search(self, demo, target):
        _, handle, uid = target
        r = demo.get(f"{API}/admin/users", params={"q": handle})
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) == 1 and users[0]["id"] == uid
        assert users[0]["available"] == 10 and users[0]["reserved"] == 0 and users[0]["role"] is None
        r = demo.get(f"{API}/admin/users", params={"q": "zzznomatch_xyz"})
        assert r.json()["users"] == [] and r.json()["total"] == 0

    def test_users_search_email(self, demo):
        r = demo.get(f"{API}/admin/users", params={"q": "resend.dev"})
        assert any(u["handle"] == "mailtest" for u in r.json()["users"])

    def test_user_detail_no_private(self, demo, target):
        r = demo.get(f"{API}/admin/users/{target[2]}")
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"user", "ledger", "usage"}
        assert any(e["type"] == "trial_grant" for e in d["ledger"])
        body = r.text.lower()
        for k in ("password", "notes", "journal", "_id"):
            assert f'"{k}' not in body
        assert demo.get(f"{API}/admin/users/nope_xxx").status_code == 404

    @pytest.mark.parametrize("days", [7, 30, 90])
    def test_overview_usage(self, demo, days):
        r = demo.get(f"{API}/admin/overview", params={"days": days})
        assert r.status_code == 200
        d = r.json()
        assert len(d["trend"]) == days and d["users"] >= 2 and "credits" in d and len(d["recentAudit"]) <= 5
        u = demo.get(f"{API}/admin/usage", params={"days": days}).json()
        assert len(u["trend"]) == days and {"requests", "succeeded", "failed", "creditsCharged"} <= set(u["totals"])

    def test_audit_ledger_summary(self, demo):
        assert demo.get(f"{API}/admin/audit").status_code == 200
        led = demo.get(f"{API}/admin/credits/ledger").json()["entries"]
        assert led and "idempotency_key" not in led[0] and "handle" in led[0]
        s = demo.get(f"{API}/admin/credits/summary").json()
        for k in ("accounts", "available", "reserved", "consumed", "granted", "removed", "ledgerEntries"):
            assert isinstance(s[k], int)
        assert s["accounts"] == DB.credit_accounts.count_documents({})


# --- Credit adjustments
class TestCredits:
    def test_add_remove_replay(self, demo, target):
        uid = target[2]
        r1 = rid()
        r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": 5, "reason": "test add five", "requestId": r1})
        assert r.status_code == 200 and r.json()["applied"] is True and r.json()["balance"]["available"] == 15
        r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": 5, "reason": "test add five", "requestId": r1})
        assert r.json()["applied"] is False and r.json()["balance"]["available"] == 15
        r2 = rid()
        r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": -12, "reason": "test remove", "requestId": r2})
        assert r.json()["applied"] is True and r.json()["balance"]["available"] == 3
        r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": -12, "reason": "test remove", "requestId": r2})
        assert r.json()["applied"] is False and r.json()["balance"]["available"] == 3
        assert DB.credit_ledger.count_documents({"user_id": uid, "type": "admin_grant"}) == 1
        assert DB.credit_ledger.count_documents({"user_id": uid, "type": "admin_debit"}) == 1
        assert DB.admin_audit.count_documents({"target_id": uid, "action": "credit.grant", "outcome": "success"}) == 1
        assert DB.admin_audit.count_documents({"target_id": uid, "action": "credit.remove", "outcome": "success"}) == 1
        assert consistent(uid)
        # client-side history shows the admin entries
        h = target[0].get(f"{API}/credits/history").json()
        assert "admin_debit" in str(h) and "admin_grant" in str(h)

    def test_remove_too_many(self, demo, target):
        uid = target[2]
        before = DB.credit_accounts.find_one({"user_id": uid})["available"]
        r3 = rid()
        r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": -(before + 1), "reason": "test overdraw", "requestId": r3})
        assert r.status_code == 400 and "INSUFFICIENT_CREDITS" in r.text
        assert DB.credit_accounts.find_one({"user_id": uid})["available"] == before
        assert DB.admin_audit.find_one({"target_id": uid, "action": "credit.remove", "outcome": "failed", "details.requestId": r3})
        assert consistent(uid)

    @pytest.mark.parametrize("body", [
        {"amount": 0, "reason": "zero amt", "requestId": "abcdefgh1"},
        {"amount": 10001, "reason": "too big", "requestId": "abcdefgh2"},
        {"amount": -10001, "reason": "too big", "requestId": "abcdefgh3"},
        {"amount": 1, "reason": "abc", "requestId": "abcdefgh4"},
        {"amount": 1, "reason": "valid reason", "requestId": "short"},
    ])
    def test_validation(self, demo, target, body):
        r = demo.post(f"{API}/admin/users/{target[2]}/credits", json=body)
        assert r.status_code in (400, 422), r.text

    def test_unknown_user(self, demo):
        r = demo.post(f"{API}/admin/users/nope_xxx/credits", json={"amount": 1, "reason": "valid reason", "requestId": rid()})
        assert r.status_code == 404


# --- Roles & RBAC
class TestRoles:
    def test_role_rules(self, demo, target):
        me = demo.get(f"{API}/admin/me").json()
        assert demo.put(f"{API}/admin/users/{me['id']}/role", json={"role": None, "reason": "self change"}).status_code == 400
        assert demo.put(f"{API}/admin/users/{target[2]}/role", json={"role": "god", "reason": "bad role"}).status_code == 400
        assert demo.put(f"{API}/admin/users/{target[2]}/role", json={"role": "analyst", "reason": "abc"}).status_code in (400, 422)
        r = demo.put(f"{API}/admin/users/{target[2]}/role", json={"role": "support_admin", "reason": "test support"})
        assert r.status_code == 200 and r.json()["user"]["role"] == "support_admin"
        r = demo.put(f"{API}/admin/users/{target[2]}/role", json={"role": None, "reason": "test revoke"})
        assert r.status_code == 200 and r.json()["user"]["role"] is None
        rows = list(DB.admin_audit.find({"target_id": target[2], "action": "user.role_change"}))
        assert len(rows) == 2 and rows[0]["details"] == {"from": None, "to": "support_admin"}

    def test_env_owner_protected(self, demo):
        owner = DB.users.find_one({"admin_role_source": "env"})
        if not owner:
            pytest.skip("no env-configured owner in DB")
        assert demo.put(f"{API}/admin/users/{owner['id']}/role", json={"role": None, "reason": "try owner"}).status_code == 400

    def test_billing_admin(self, billing_user, target):
        s, handle, _ = billing_user
        r = s.post(f"{API}/admin/users/{target[2]}/credits", json={"amount": 1, "reason": "billing grant", "requestId": rid()})
        assert r.status_code == 200 and r.json()["applied"] is True
        r = s.put(f"{API}/admin/users/{target[2]}/role", json={"role": "analyst", "reason": "billing try"})
        assert r.status_code == 403
        assert DB.admin_audit.find_one({"actor": handle, "outcome": "denied", "role": "billing_admin"})
        assert DB.admin_audit.find_one({"actor": handle, "action": "credit.grant", "outcome": "success"})

    def test_analyst(self, analyst_user, target):
        s, handle, _ = analyst_user
        for p in ("users", "overview", "usage", "audit", "credits/ledger", "credits/summary", f"users/{target[2]}"):
            assert s.get(f"{API}/admin/{p}").status_code == 200, p
        r = s.post(f"{API}/admin/users/{target[2]}/credits", json={"amount": 1, "reason": "analyst try", "requestId": rid()})
        assert r.status_code == 403
        assert DB.admin_audit.find_one({"actor": handle, "outcome": "denied", "role": "analyst"})

    def test_non_admin_and_anon(self, target):
        mt = login("mailtest", "TestPass123!")
        anon = requests.Session()
        for p in ("users", "overview", "usage", "audit", "credits/ledger", "credits/summary"):
            assert mt.get(f"{API}/admin/{p}").status_code == 403, p
            assert anon.get(f"{API}/admin/{p}").status_code == 401, p
        body = {"amount": 1, "reason": "mailtest try", "requestId": rid()}
        assert mt.post(f"{API}/admin/users/{target[2]}/credits", json=body).status_code == 403
        assert anon.post(f"{API}/admin/users/{target[2]}/credits", json=body).status_code == 401
        assert mt.put(f"{API}/admin/users/{target[2]}/role", json={"role": "analyst", "reason": "mailtest"}).status_code == 403


def test_global_ledger_consistency():
    bad = [a["user_id"] for a in DB.credit_accounts.find({}) if not consistent(a["user_id"])]
    assert bad == [], bad
