# Iteration 20: admin follow-ups - reason stripping before min-length, case-insensitive search, audit target_label
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


@pytest.fixture(scope="module")
def demo():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
    if r.status_code != 200:
        pytest.skip("demo login failed")
    return s


@pytest.fixture(scope="module")
def target():
    handle = f"tests20{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/auth/register", json={"handle": handle, "displayName": "T", "password": "TestPass1234!"})
    assert r.status_code in (200, 201), r.text
    uid = DB.users.find_one({"handle": handle})["id"]
    yield handle, uid
    for c in ("credit_accounts", "credit_ledger", "credit_reservations", "ai_usage", "sessions", "app_state"):
        DB[c].delete_many({"user_id": uid})
    DB.users.delete_one({"id": uid})


def rid():
    return f"test{uuid.uuid4().hex[:12]}"


# Reason stripping (credits)
@pytest.mark.parametrize("reason", ["    x", "   ab   ", "\t\n  abcd \n"])
def test_credit_reason_whitespace_rejected(demo, target, reason):
    _, uid = target
    before = DB.credit_accounts.find_one({"user_id": uid})["available"]
    r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": 1, "reason": reason, "requestId": rid()})
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "VALIDATION_FAILED"
    assert DB.credit_accounts.find_one({"user_id": uid})["available"] == before


def test_credit_reason_padded_valid_is_stored_stripped(demo, target):
    _, uid = target
    req = rid()
    r = demo.post(f"{API}/admin/users/{uid}/credits", json={"amount": 2, "reason": "   valid reason   ", "requestId": req})
    assert r.status_code == 200, r.text
    audit = DB.admin_audit.find_one({"target_id": uid, "reason": "valid reason"}) if "admin_audit" in DB.list_collection_names() else None
    led = DB.credit_ledger.find_one({"user_id": uid, "reason": "valid reason"})
    assert audit is not None or led is not None


# Reason stripping (role)
def test_role_reason_whitespace_rejected(demo, target):
    _, uid = target
    r = demo.post(f"{API}/admin/users/{uid}/role", json={"role": "analyst", "reason": "    x"})
    if r.status_code == 405:
        r = demo.put(f"{API}/admin/users/{uid}/role", json={"role": "analyst", "reason": "    x"})
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "VALIDATION_FAILED"
    assert DB.users.find_one({"id": uid}).get("admin_role") is None


# Case-insensitive search
@pytest.mark.parametrize("q", ["MAILTEST", "MailTest", "mailtest", "  MAILTEST  "])
def test_search_case_insensitive(demo, q):
    r = demo.get(f"{API}/admin/users", params={"q": q})
    assert r.status_code == 200, r.text
    body = r.json()
    items = body["users"]
    assert any(u["handle"] == "mailtest" for u in items), items


def test_search_email_uppercase(demo):
    r = demo.get(f"{API}/admin/users", params={"q": "RESEND.DEV"})
    items = r.json()["users"]
    assert any(u["handle"] == "mailtest" for u in items)


def test_search_regex_escaped(demo):
    r = demo.get(f"{API}/admin/users", params={"q": ".*"})
    assert r.status_code == 200
    assert r.json()["users"] == []


# Audit target_label
def test_audit_target_label_handles(demo, target):
    handle, uid = target
    r = demo.get(f"{API}/admin/audit")
    assert r.status_code == 200, r.text
    items = r.json()["entries"]
    assert all("target_label" in i for i in items)
    mine = [i for i in items if i["target_id"] == uid]
    assert mine and all(i["target_label"] == f"@{handle}" for i in mine)
    routes = [i for i in items if i["target_type"] == "route"]
    for i in routes:
        assert i["target_label"].startswith("/"), i
