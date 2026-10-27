# Iteration 18: /api/ai/chat client-disconnect releases hold (BackgroundTask) + restructured chat_events failure path
import json
import os
import socket
import ssl
import time
import uuid
from urllib.parse import urlparse

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
        pytest.skip(f"login failed {r.status_code}")
    return s


@pytest.fixture(scope="module")
def fresh():
    handle = f"test_s18_{uuid.uuid4().hex[:8]}"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "TEST S18", "password": "TestPass12345!"})
    assert r.status_code in (200, 201), r.text
    if not s.cookies.get("pos_session"):
        s = login(handle, "TestPass12345!")
    uid = DB.users.find_one({"handle": handle})["id"]
    yield s, uid
    for c in ("credit_accounts", "credit_ledger", "credit_reservations", "ai_usage", "sessions", "app_state"):
        DB[c].delete_many({"user_id": uid})
    DB.users.delete_one({"id": uid})


def wait_released(uid, rid, secs=15):
    end = time.time() + secs
    res = None
    while time.time() < end:
        res = DB.credit_reservations.find_one({"user_id": uid, "request_id": rid})
        acc = DB.credit_accounts.find_one({"user_id": uid})
        if res and res["status"] != "held" and acc["reserved"] == 0:
            return res, acc, round(secs - (end - time.time()), 2)
        time.sleep(0.25)
    return res, DB.credit_accounts.find_one({"user_id": uid}), None


def assert_one_release(res):
    led = list(DB.credit_ledger.find({"reservation_id": res["id"]}))
    types = sorted(r["type"] for r in led)
    assert types == ["release", "reserve"], types


def assert_ledger_consistent(uid):
    rows = list(DB.credit_ledger.find({"user_id": uid}))
    acc = DB.credit_accounts.find_one({"user_id": uid})
    assert (sum(r["available_delta"] for r in rows), sum(r["reserved_delta"] for r in rows)) == (acc["available"], acc["reserved"])


def sse_events(r):
    return [json.loads(l[5:].strip()) for l in r.text.splitlines() if l.startswith("data:")]


class TestDisconnect:
    def test_requests_timeout_disconnect(self, fresh):
        s, uid = fresh
        rid = f"test-dc-{uuid.uuid4().hex[:10]}"
        try:
            s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "daily_plan", "requestId": rid}, timeout=0.5)
        except requests.exceptions.RequestException as e:
            print("client aborted:", type(e).__name__)
        res, acc, took = wait_released(uid, rid)
        print("released after", took, "s; status", res and res["status"], "acc", acc["available"], acc["reserved"])
        assert res is not None, "reservation never created"
        assert took is not None, f"hold still held: {res['status']} reserved={acc['reserved']}"
        assert res["status"] == "released"
        assert_one_release(res)
        assert_ledger_consistent(uid)

    def test_raw_socket_abort_before_read(self, fresh):
        s, uid = fresh
        rid = f"test-raw-{uuid.uuid4().hex[:10]}"
        u = urlparse(BASE_URL)
        body = json.dumps({"prompt": "hi", "action": "daily_plan", "requestId": rid})
        cookie = f"pos_session={s.cookies.get('pos_session')}"
        req = (f"POST /api/ai/chat HTTP/1.1\r\nHost: {u.hostname}\r\nContent-Type: application/json\r\n"
               f"Cookie: {cookie}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n{body}")
        raw = socket.create_connection((u.hostname, 443), timeout=10)
        tls = ssl.create_default_context().wrap_socket(raw, server_hostname=u.hostname)
        tls.sendall(req.encode())
        time.sleep(0.4)  # long enough for ingress to forward the request, then abort without reading
        tls.close()
        res, acc, took = wait_released(uid, rid)
        print("raw abort released after", took, "s; status", res and res["status"])
        if res is None:
            pytest.skip("ingress dropped the request before it reached the backend (no hold created)")
        assert took is not None, f"hold leaked: {res['status']} reserved={acc['reserved']}"
        assert_one_release(res)
        assert_ledger_consistent(uid)

    def test_no_held_reservations_left(self, fresh):
        _, uid = fresh
        assert DB.credit_reservations.count_documents({"user_id": uid, "status": "held"}) == 0
        assert DB.credit_accounts.find_one({"user_id": uid})["available"] == 10


class TestFailurePathRegression:
    def test_failure_single_usage_row(self, fresh):
        s, uid = fresh
        rid = f"test-fail-{uuid.uuid4().hex[:10]}"
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "daily_plan", "requestId": rid}, timeout=90)
        assert r.status_code == 200
        ev = sse_events(r)
        err = [e for e in ev if "error" in e]
        assert err and err[-1]["creditsReturned"] is True, ev
        assert not any("credits" in e for e in ev)
        time.sleep(2)  # let BackgroundTask finish
        res = DB.credit_reservations.find_one({"user_id": uid, "request_id": rid})
        assert res["status"] == "released"
        assert_one_release(res)
        usage = list(DB.ai_usage.find({"request_id": rid}))
        assert len(usage) == 1 and usage[0]["status"] == "failed" and usage[0]["charged"] == 0, usage
        assert s.get(f"{API}/credits").json() == {"available": 10, "reserved": 0}
        assert_ledger_consistent(uid)
