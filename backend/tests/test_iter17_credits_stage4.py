# Iteration 17: Stage 4 AI credit engine - hold/charge/release, trial grant, chat integration, history, engine unit tests
import asyncio
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import timedelta

import pytest
import requests
from dotenv import dotenv_values, load_dotenv
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"

_env = dotenv_values("/app/backend/.env")
DB = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import credits  # noqa: E402
from billing import now  # noqa: E402

LOOP = asyncio.new_event_loop()


def run(coro):
    return LOOP.run_until_complete(coro)


def login(handle, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": handle, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {handle}: {r.status_code}")
    return s


def purge(uid):
    for c in ("credit_accounts", "credit_ledger", "credit_reservations", "ai_usage", "sessions", "app_state"):
        DB[c].delete_many({"user_id": uid})
    DB.users.delete_one({"id": uid})


def uid_of(handle):
    return DB.users.find_one({"handle": handle})["id"]


def ledger_consistent(uid):
    rows = list(DB.credit_ledger.find({"user_id": uid}))
    acc = DB.credit_accounts.find_one({"user_id": uid})
    return sum(r["available_delta"] for r in rows), sum(r["reserved_delta"] for r in rows), acc["available"], acc["reserved"]


@pytest.fixture(scope="module")
def demo():
    return login("demo", "DemoPass123!")


@pytest.fixture(scope="module")
def mailtest():
    return login("mailtest", "TestPass123!")


@pytest.fixture(scope="module")
def fresh():
    handle = f"test_s4_{uuid.uuid4().hex[:8]}"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "TEST S4", "password": "TestPass12345!"})
    assert r.status_code in (200, 201), r.text
    if not s.cookies.get("pos_session"):
        s = login(handle, "TestPass12345!")
    uid = uid_of(handle)
    yield s, uid
    purge(uid)


def sse_events(resp):
    out = []
    for chunk in resp.text.split("\n\n"):
        chunk = chunk.strip()
        if chunk.startswith("data: "):
            out.append(json.loads(chunk[6:]))
    return out


# Balance endpoint + trial grant
class TestBalance:
    def test_anonymous_401(self):
        assert requests.get(f"{API}/credits").status_code == 401
        assert requests.get(f"{API}/credits/history").status_code == 401

    @pytest.mark.parametrize("handle,pw", [("demo", "DemoPass123!"), ("mailtest", "TestPass123!")])
    def test_existing_trial_once(self, handle, pw):
        s = login(handle, pw)
        r = s.get(f"{API}/credits")
        assert r.status_code == 200
        body = r.json()
        assert set(body) == {"available", "reserved"}
        uid = uid_of(handle)
        grants = list(DB.credit_ledger.find({"user_id": uid, "type": "trial_grant"}))
        assert len(grants) == 1 and grants[0]["credits"] == 10 and grants[0]["idempotency_key"] == f"trial:{uid}"
        assert body["available"] == 10 and body["reserved"] == 0

    def test_register_gets_trial(self, fresh):
        s, uid = fresh
        assert s.get(f"{API}/credits").json() == {"available": 10, "reserved": 0}
        rows = list(DB.credit_ledger.find({"user_id": uid}))
        assert len(rows) == 1 and rows[0]["type"] == "trial_grant" and rows[0]["available_delta"] == 10

    def test_every_account_has_exactly_one_trial(self):
        users = DB.users.count_documents({})
        assert DB.credit_ledger.count_documents({"type": "trial_grant"}) == DB.credit_accounts.count_documents({}) == users


# Chat failure path: hold then full release
class TestChatFailurePath:
    def test_failed_provider_returns_credits(self, fresh):
        s, uid = fresh
        rid = f"test-{uuid.uuid4().hex[:12]}"
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "daily_plan", "requestId": rid}, timeout=90)
        assert r.status_code == 200, r.text
        events = sse_events(r)
        err = [e for e in events if "error" in e]
        assert err and err[-1]["creditsReturned"] is True, events
        print("error event:", err[-1])
        assert s.get(f"{API}/credits").json() == {"available": 10, "reserved": 0}
        res = DB.credit_reservations.find_one({"user_id": uid, "request_id": rid})
        assert res["status"] == "released" and res["amount"] == 2
        led = {r["type"]: r for r in DB.credit_ledger.find({"reservation_id": res["id"]})}
        assert set(led) == {"reserve", "release"}
        assert (led["reserve"]["available_delta"], led["reserve"]["reserved_delta"]) == (-2, 2)
        assert (led["release"]["available_delta"], led["release"]["reserved_delta"]) == (2, -2)
        usage = DB.ai_usage.find_one({"user_id": uid, "request_id": rid})
        assert usage["status"] == "failed" and usage["charged"] == 0
        a, rsv, acc_a, acc_r = ledger_consistent(uid)
        assert (a, rsv) == (acc_a, acc_r)

    def test_duplicate_request_409(self, fresh):
        s, uid = fresh
        rid = f"test-{uuid.uuid4().hex[:12]}"
        s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "quick_question", "requestId": rid}, timeout=90)
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "quick_question", "requestId": rid}, timeout=90)
        assert r.status_code == 409 and r.json()["code"] == "DUPLICATE_REQUEST"
        assert s.get(f"{API}/credits").json() == {"available": 10, "reserved": 0}

    def test_unknown_action_400(self, fresh):
        s, _ = fresh
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "nope", "requestId": f"test-{uuid.uuid4().hex}"})
        assert r.status_code == 400 and r.json()["code"] == "UNKNOWN_ACTION"
        # priced but not wired action also rejected
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "document_analysis", "requestId": f"test-{uuid.uuid4().hex}"})
        assert r.status_code == 400

    def test_anonymous_chat_401(self):
        r = requests.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "quick_question"})
        assert r.status_code == 401

    def test_insufficient_402(self, fresh):
        s, uid = fresh
        DB.credit_accounts.update_one({"user_id": uid}, {"$set": {"available": 1}})
        try:
            r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "action": "daily_plan", "requestId": f"test-{uuid.uuid4().hex[:12]}"})
            assert r.status_code == 402, r.text
            b = r.json()
            assert b["code"] == "INSUFFICIENT_CREDITS" and b["required"] == 2 and b["available"] == 1
            assert s.get(f"{API}/credits").json() == {"available": 1, "reserved": 0}
        finally:
            DB.credit_accounts.update_one({"user_id": uid}, {"$set": {"available": 10}})


# History endpoint
class TestHistory:
    def test_history_newest_first_own_only(self, fresh, mailtest):
        s, uid = fresh
        entries = s.get(f"{API}/credits/history").json()["entries"]
        assert len(entries) >= 3
        assert all(e["user_id"] == uid for e in entries)
        assert all("_id" not in e and "idempotency_key" not in e for e in entries)
        stamps = [e["created_at"] for e in entries]
        assert stamps == sorted(stamps, reverse=True)
        assert entries[-1]["type"] == "trial_grant"
        m = mailtest.get(f"{API}/credits/history").json()["entries"]
        assert all(e["user_id"] == uid_of("mailtest") for e in m)
        assert len(s.get(f"{API}/credits/history?limit=1").json()["entries"]) == 1


# Engine unit tests (direct credits.py)
@pytest.fixture
def acct():
    uid = f"TEST_s4_{uuid.uuid4().hex[:10]}"
    DB.credit_accounts.insert_one({"user_id": uid, "available": 0, "reserved": 0, "included": 0, "promotional": 0, "created_at": now()})
    assert run(credits.grant_trial(uid)) is True
    yield uid
    purge(uid)


class TestEngine:
    def test_range_settle(self, acct):
        res = run(credits.reserve(acct, "document_analysis", "rq-aaaaaaaa"))
        assert res["amount"] == 8
        assert run(credits.balance(acct)) == {"available": 2, "reserved": 8}
        assert run(credits.settle(res, 500)) == 5
        assert run(credits.balance(acct)) == {"available": 5, "reserved": 0}
        assert run(credits.settle(res, 2000)) == 5  # no double charge
        assert run(credits.release(res, "x")) is False
        assert run(credits.balance(acct)) == {"available": 5, "reserved": 0}
        kinds = [r["type"] for r in DB.credit_ledger.find({"reservation_id": res["id"]}).sort("created_at", 1)]
        assert sorted(kinds) == ["charge", "release", "reserve"]
        a, r, aa, ar = ledger_consistent(acct)
        assert (a, r) == (aa, ar)

    def test_charge_bounds(self, acct):
        res = run(credits.reserve(acct, "document_analysis", "rq-bbbbbbbb"))
        assert credits.charge_for(res, 0) == 3
        assert credits.charge_for(res, 10 ** 6) == 8
        assert credits.charge_for(res, 1) == 4
        run(credits.release(res, "cleanup"))
        assert run(credits.balance(acct)) == {"available": 10, "reserved": 0}

    def test_trial_idempotent(self, acct):
        assert run(credits.grant_trial(acct)) is False
        assert run(credits.balance(acct))["available"] == 10

    def test_concurrent_reserves(self, acct):
        async def go():
            return await asyncio.gather(*[credits.reserve(acct, "daily_plan", f"rq-c{i:07d}") for i in range(12)],
                                        return_exceptions=True)
        out = run(go())
        ok = [o for o in out if isinstance(o, dict)]
        errs = [o for o in out if isinstance(o, credits.CreditError)]
        assert len(ok) == 5 and len(errs) == 7 and all(e.status == 402 for e in errs)
        assert run(credits.balance(acct)) == {"available": 0, "reserved": 10}
        async def rel():
            await asyncio.gather(*[credits.release(r, "x") for r in ok])
        run(rel())
        assert run(credits.balance(acct)) == {"available": 10, "reserved": 0}
        a, r, aa, ar = ledger_consistent(acct)
        assert (a, r) == (aa, ar)

    def test_concurrent_same_request_id(self, acct):
        async def go():
            return await asyncio.gather(*[credits.reserve(acct, "quick_question", "rq-samesame") for _ in range(6)],
                                        return_exceptions=True)
        out = run(go())
        ok = [o for o in out if isinstance(o, dict)]
        assert len(ok) == 1
        assert all(isinstance(o, credits.CreditError) and o.status == 409 for o in out if not isinstance(o, dict))
        assert run(credits.balance(acct)) == {"available": 9, "reserved": 1}
        a, r, aa, ar = ledger_consistent(acct)
        assert (a, r) == (aa, ar)

    def test_concurrent_settle_and_release(self, acct):
        res = run(credits.reserve(acct, "document_analysis", "rq-race0001"))

        async def go():
            return await asyncio.gather(credits.settle(res, 500), credits.release(res, "x"), credits.settle(res, 500))
        run(go())
        bal = run(credits.balance(acct))
        assert bal["reserved"] == 0 and bal["available"] in (5, 10)
        a, r, aa, ar = ledger_consistent(acct)
        assert (a, r) == (aa, ar)

    def test_release_stale(self, acct):
        old = run(credits.reserve(acct, "daily_plan", "rq-stale001"))
        new = run(credits.reserve(acct, "daily_plan", "rq-fresh001"))
        DB.credit_reservations.update_one({"id": old["id"]}, {"$set": {"created_at": now() - timedelta(minutes=11)}})
        assert run(credits.release_stale()) >= 1
        assert DB.credit_reservations.find_one({"id": old["id"]})["status"] == "released"
        assert DB.credit_reservations.find_one({"id": new["id"]})["status"] == "held"
        assert run(credits.balance(acct)) == {"available": 8, "reserved": 2}
        run(credits.release(new, "x"))


# Restart does not re-grant trial
class TestRestart:
    def test_restart_no_regrant(self):
        before = DB.credit_ledger.count_documents({"type": "trial_grant"})
        demo_av = DB.credit_accounts.find_one({"user_id": uid_of("demo")})["available"]
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
        for _ in range(30):
            try:
                if requests.get(f"{BASE_URL}/api/health", timeout=5).status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(2)
        time.sleep(2)
        assert DB.credit_ledger.count_documents({"type": "trial_grant"}) == before
        assert DB.credit_accounts.find_one({"user_id": uid_of("demo")})["available"] == demo_av
