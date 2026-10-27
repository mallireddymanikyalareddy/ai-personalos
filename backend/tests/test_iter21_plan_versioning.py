# Iteration 21: plan + AI pricing versioning (draft/publish/schedule/discard), RBAC, public /api/v1/plans, reserve uses live pricing
import asyncio
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"
_env = dotenv_values("/app/backend/.env")
DB = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]

ORIGINAL_PLANS = {
    "basic": dict(name="PersonalOS Basic", monthly_price_paise=19900, annual_price_paise=178800, monthly_credits=0,
                  annual_monthly_credits=0, annual_bonus_credits=0, trial_days=30, trial_credits=0),
    "ai": dict(name="PersonalOS AI", monthly_price_paise=29900, annual_price_paise=298800, monthly_credits=100,
               annual_monthly_credits=150, annual_bonus_credits=50, trial_days=30, trial_credits=25),
    "ai_pro": dict(name="PersonalOS AI Pro", monthly_price_paise=39900, annual_price_paise=418800, monthly_credits=200,
                   annual_monthly_credits=250, annual_bonus_credits=50, trial_days=30, trial_credits=50),
}
V1_PRICING = [{k: a[k] for k in ("action", "min_credits", "max_credits", "max_output_tokens")}
              for a in DB.ai_pricing_versions.find_one({"version": 1})["actions"]]


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


def plan_of(demo, pid):
    return next(p for p in demo.get(f"{API}/admin/plans").json()["plans"] if p["plan_id"] == pid)


def restore_all(demo):
    for pid, orig in ORIGINAL_PLANS.items():
        demo.delete(f"{API}/admin/plans/{pid}/draft")
        st = plan_of(demo, pid)
        if st["scheduled"] or any(st["current"][k] != v for k, v in orig.items()):
            demo.put(f"{API}/admin/plans/{pid}/draft", json=orig | {"reason": "restore original values iter21"})
            demo.post(f"{API}/admin/plans/{pid}/publish", json={"effective_at": None, "reason": "restore original iter21"})
    demo.delete(f"{API}/admin/pricing/draft")
    st = demo.get(f"{API}/admin/pricing").json()
    cur = {a["action"]: a for a in st["current"]["actions"]}
    if st["scheduled"] or any((cur[a["action"]]["min_credits"], cur[a["action"]]["max_credits"], cur[a["action"]]["max_output_tokens"])
                              != (a["min_credits"], a["max_credits"], a["max_output_tokens"]) for a in V1_PRICING):
        demo.put(f"{API}/admin/pricing/draft", json={"actions": V1_PRICING, "reason": "restore v1 pricing iter21"})
        demo.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "restore v1 pricing iter21"})


@pytest.fixture(scope="module")
def demo():
    s = login("demo", "DemoPass123!")
    yield s
    restore_all(s)


@pytest.fixture(scope="module")
def mailtest():
    return login("mailtest", "TestPass123!")


@pytest.fixture(scope="module")
def role_users(demo):
    made = {}
    for role in ("billing_admin", "analyst", "ai_ops_admin"):
        handle = f"tests21{role[:3]}{uuid.uuid4().hex[:5]}"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "T", "password": "TestPass1234!"})
        assert r.status_code in (200, 201), r.text
        uid = DB.users.find_one({"handle": handle})["id"]
        r = demo.put(f"{API}/admin/users/{uid}/role", json={"role": role, "reason": f"iter21 {role}"})
        assert r.status_code == 200, r.text
        made[role] = (s, handle, uid)
    yield made
    for _, _, uid in made.values():
        demo.put(f"{API}/admin/users/{uid}/role", json={"role": None, "reason": "cleanup role"})
        purge(uid)


def future(seconds):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


# Plans: GET shape
def test_admin_plans_shape(demo):
    restore_all(demo)
    plans = demo.get(f"{API}/admin/plans").json()["plans"]
    assert [p["plan_id"] for p in plans] == ["basic", "ai", "ai_pro"]
    for p in plans:
        assert {"plan_id", "name", "available", "current", "scheduled", "draft", "history"} <= set(p)
        assert isinstance(p["scheduled"], list) and isinstance(p["history"], list)
        for k, v in ORIGINAL_PLANS[p["plan_id"]].items():
            assert p["current"][k] == v, (p["plan_id"], k)


# Plans: draft save -> update same draft -> discard
def test_plan_draft_save_update_discard(demo):
    base = plan_of(demo, "ai")
    nv = max(h["version"] for h in base["history"]) + 1
    body = ORIGINAL_PLANS["ai"] | {"monthly_price_paise": 34900, "reason": "TEST draft one"}
    r = demo.put(f"{API}/admin/plans/ai/draft", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["draft"]["version"] == nv and d["draft"]["monthly_price_paise"] == 34900 and d["draft"]["status"] == "draft"
    assert d["current"]["monthly_price_paise"] == 29900
    r = demo.put(f"{API}/admin/plans/ai/draft", json=body | {"monthly_price_paise": 35900, "reason": "TEST draft two"})
    assert r.json()["draft"]["version"] == nv and r.json()["draft"]["monthly_price_paise"] == 35900
    assert DB.plan_versions.count_documents({"plan_id": "ai", "status": "draft"}) == 1
    assert DB.admin_audit.find_one({"action": "plan.draft_save", "target_id": "ai", "reason": "TEST draft two"})
    r = demo.delete(f"{API}/admin/plans/ai/draft")
    assert r.status_code == 200 and r.json()["draft"] is None
    assert DB.admin_audit.find_one({"action": "plan.draft_discard", "target_id": "ai"}, sort=[("_id", -1)])
    assert demo.delete(f"{API}/admin/plans/ai/draft").status_code == 404


# Plans: validation
@pytest.mark.parametrize("patch", [{"trial_days": 91}, {"trial_days": -1}, {"reason": "   abc   "}, {"reason": "abc"},
                                   {"monthly_price_paise": -5}, {"name": "ab"}])
def test_plan_draft_validation(demo, patch):
    r = demo.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"reason": "valid reason"} | patch)
    assert r.status_code in (400, 422), r.text
    assert DB.plan_versions.count_documents({"plan_id": "ai", "status": "draft"}) == 0


def test_plan_publish_errors(demo):
    assert demo.post(f"{API}/admin/plans/ai/publish", json={"effective_at": None, "reason": "no draft here"}).status_code == 404
    assert demo.put(f"{API}/admin/plans/nope/draft", json=ORIGINAL_PLANS["ai"] | {"reason": "valid reason"}).status_code == 404
    demo.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"monthly_price_paise": 31900, "reason": "TEST past"})
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = demo.post(f"{API}/admin/plans/ai/publish", json={"effective_at": past, "reason": "past date test"})
    assert r.status_code == 400, r.text
    assert plan_of(demo, "ai")["draft"] is not None
    demo.delete(f"{API}/admin/plans/ai/draft")


# Plans: publish now -> current + public
def test_plan_publish_now(demo):
    demo.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"monthly_price_paise": 32900, "reason": "TEST publish now"})
    r = demo.post(f"{API}/admin/plans/ai/publish", json={"effective_at": None, "reason": "TEST publish now"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["draft"] is None and d["current"]["monthly_price_paise"] == 32900 and d["current"]["status"] == "published"
    assert DB.admin_audit.find_one({"action": "plan.publish", "target_id": "ai", "reason": "TEST publish now"})
    pub = requests.get(f"{API}/plans").json()
    ai = next(p for p in pub["plans"] if p["planId"] == "ai")
    assert ai["monthly_price_paise"] == 32900 and ai["version"] == d["current"]["version"]


# Plans: schedule a few seconds ahead -> scheduled; current unchanged; public unchanged; then becomes live
def test_plan_schedule(demo):
    demo.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"monthly_price_paise": 33900, "reason": "TEST schedule"})
    # a draft must not leak to public
    assert next(p for p in requests.get(f"{API}/plans").json()["plans"] if p["planId"] == "ai")["monthly_price_paise"] == 32900
    r = demo.post(f"{API}/admin/plans/ai/publish", json={"effective_at": future(4), "reason": "TEST schedule soon"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["current"]["monthly_price_paise"] == 32900
    assert len(d["scheduled"]) == 1 and d["scheduled"][0]["monthly_price_paise"] == 33900
    assert next(p for p in requests.get(f"{API}/plans").json()["plans"] if p["planId"] == "ai")["monthly_price_paise"] == 32900
    time.sleep(6)
    d = plan_of(demo, "ai")
    assert d["current"]["monthly_price_paise"] == 33900 and d["scheduled"] == []
    restore_all(demo)
    assert plan_of(demo, "ai")["current"]["monthly_price_paise"] == 29900


# Pricing: shape + validation
def test_pricing_shape(demo):
    d = demo.get(f"{API}/admin/pricing").json()
    assert {"current", "scheduled", "draft", "history"} <= set(d)
    assert len(d["current"]["actions"]) == 13


def test_pricing_validation(demo):
    acts = [dict(a) for a in V1_PRICING]
    assert demo.put(f"{API}/admin/pricing/draft", json={"actions": acts[:-1], "reason": "missing one"}).status_code == 400
    extra = acts + [{"action": "bogus", "min_credits": 1, "max_credits": 1, "max_output_tokens": 100}]
    assert demo.put(f"{API}/admin/pricing/draft", json={"actions": extra, "reason": "extra action"}).status_code == 400
    dup = acts[:-1] + [acts[0]]
    assert demo.put(f"{API}/admin/pricing/draft", json={"actions": dup, "reason": "duplicate action"}).status_code == 400
    bad = [dict(a) for a in acts]
    bad[0] |= {"min_credits": 5, "max_credits": 2}
    r = demo.put(f"{API}/admin/pricing/draft", json={"actions": bad, "reason": "min above max"})
    assert r.status_code == 400 and "minimum" in r.text
    assert demo.put(f"{API}/admin/pricing/draft", json={"actions": acts, "reason": "    "}).status_code in (400, 422)
    assert demo.get(f"{API}/admin/pricing").json()["draft"] is None
    assert demo.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "nothing to do"}).status_code == 404
    assert demo.delete(f"{API}/admin/pricing/draft").status_code == 404


# Pricing: draft/discard, publish now -> new reservations use new version, held ones keep old
def test_pricing_publish_and_reservations(demo):
    sys.path.insert(0, "/app/backend")
    os.environ.setdefault("MONGO_URL", _env["MONGO_URL"])
    os.environ.setdefault("DB_NAME", _env["DB_NAME"])
    import credits  # noqa: E402
    import db as dbmod  # noqa: E402

    handle = f"tests21r{uuid.uuid4().hex[:5]}"
    requests.post(f"{API}/auth/register", json={"handle": handle, "displayName": "T", "password": "TestPass1234!"})
    uid = DB.users.find_one({"handle": handle})["id"]
    loop = asyncio.new_event_loop()
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        dbmod.db = credits.db = AsyncIOMotorClient(_env["MONGO_URL"], io_loop=loop)[_env["DB_NAME"]]
        old = loop.run_until_complete(credits.reserve(uid, "quick_question", rid := f"t{uuid.uuid4().hex[:12]}"))
        old_v = old["pricing_version"]
        acts = [dict(a) for a in V1_PRICING]
        for a in acts:
            if a["action"] == "quick_question":
                a |= {"min_credits": 1, "max_credits": 3}
        r = demo.put(f"{API}/admin/pricing/draft", json={"actions": acts, "reason": "TEST pricing draft"})
        assert r.status_code == 200, r.text
        assert r.json()["draft"]["version"] == r.json()["history"][0]["version"] + 1
        r2 = demo.put(f"{API}/admin/pricing/draft", json={"actions": acts, "reason": "TEST pricing draft again"})
        assert r2.json()["draft"]["version"] == r.json()["draft"]["version"]
        assert DB.ai_pricing_versions.count_documents({"status": "draft"}) == 1
        r = demo.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "TEST pricing publish"})
        assert r.status_code == 200, r.text
        new_v = r.json()["current"]["version"]
        assert new_v > old_v
        pub = requests.get(f"{API}/plans").json()
        assert pub["pricingVersion"] == new_v
        assert next(a for a in pub["actions"] if a["action"] == "quick_question")["maxCredits"] == 3
        new = loop.run_until_complete(credits.reserve(uid, "quick_question", f"t{uuid.uuid4().hex[:12]}"))
        assert new["pricing_version"] == new_v and new["amount"] == 3
        led = DB.credit_ledger.find_one({"reservation_id": new["id"], "type": "reserve"})
        assert led["pricing_version"] == new_v and led["credits"] == 3
        held = DB.credit_reservations.find_one({"id": old["id"]})
        assert held["status"] == "held" and held["pricing_version"] == old_v and held["amount"] == 1
        loop.run_until_complete(credits.release(old, "test"))
        loop.run_until_complete(credits.release(new, "test"))
        acc = DB.credit_accounts.find_one({"user_id": uid})
        assert acc["available"] == 10 and acc["reserved"] == 0
        assert DB.admin_audit.find_one({"action": "pricing.publish", "reason": "TEST pricing publish"})
    finally:
        loop.close()
        purge(uid)
        restore_all(demo)
    cur = demo.get(f"{API}/admin/pricing").json()["current"]
    assert next(a for a in cur["actions"] if a["action"] == "quick_question")["max_credits"] == 1


def test_pricing_schedule(demo):
    r = demo.put(f"{API}/admin/pricing/draft", json={"actions": V1_PRICING, "reason": "TEST pricing schedule"})
    assert r.status_code == 200
    r = demo.post(f"{API}/admin/pricing/publish", json={"effective_at": future(3), "reason": "TEST pricing schedule"})
    assert r.status_code == 200 and len(r.json()["scheduled"]) == 1
    cur_v = r.json()["current"]["version"]
    time.sleep(5)
    d = demo.get(f"{API}/admin/pricing").json()
    assert d["scheduled"] == [] and d["current"]["version"] > cur_v


# Permissions
@pytest.mark.parametrize("role", ["billing_admin", "analyst", "ai_ops_admin"])
def test_non_owner_read_only(role_users, role):
    s, handle, _ = role_users[role]
    assert s.get(f"{API}/admin/plans").status_code == 200
    assert s.get(f"{API}/admin/pricing").status_code == 200
    calls = [s.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"reason": "not allowed"}),
             s.delete(f"{API}/admin/plans/ai/draft"),
             s.post(f"{API}/admin/plans/ai/publish", json={"effective_at": None, "reason": "not allowed"}),
             s.put(f"{API}/admin/pricing/draft", json={"actions": V1_PRICING, "reason": "not allowed"}),
             s.delete(f"{API}/admin/pricing/draft"),
             s.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "not allowed"})]
    assert [c.status_code for c in calls] == [403] * 6
    assert DB.admin_audit.count_documents({"actor": handle, "outcome": "denied", "role": role}) >= 6


def test_mailtest_and_anon(mailtest):
    assert mailtest.get(f"{API}/admin/plans").status_code == 403
    assert mailtest.put(f"{API}/admin/plans/ai/draft", json=ORIGINAL_PLANS["ai"] | {"reason": "not allowed"}).status_code == 403
    assert mailtest.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "nope!"}).status_code == 403
    assert requests.get(f"{API}/admin/plans").status_code == 401
    assert requests.put(f"{API}/admin/pricing/draft", json={"actions": V1_PRICING, "reason": "anon try"}).status_code == 401


# Public plans endpoint
def test_public_plans(demo):
    restore_all(demo)
    d = requests.get(f"{API}/plans").json()
    assert [p["planId"] for p in d["plans"]] == ["basic", "ai", "ai_pro"]
    for p in d["plans"]:
        for k, v in ORIGINAL_PLANS[p["planId"]].items():
            assert p[k] == v
    assert len(d["actions"]) == 13 and all({"action", "label", "minCredits", "maxCredits"} <= set(a) for a in d["actions"])
    assert "_id" not in str(d)
