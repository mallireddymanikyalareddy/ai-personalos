# Iteration 22: scheduled publish does not rename header early, no plans.current_version, unique draft indexes / concurrent saves
import os
import sys
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter21_plan_versioning import API, DB, ORIGINAL_PLANS, V1_PRICING, login, plan_of, restore_all  # noqa: E402


@pytest.fixture(scope="module")
def demo():
    s = login("demo", "DemoPass123!")
    restore_all(s)
    yield s
    restore_all(s)


def future(seconds):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


# Plans header: top-level name comes from current live version, not from a scheduled draft
def test_scheduled_rename_does_not_change_header(demo):
    orig = ORIGINAL_PLANS["ai"]
    r = demo.put(f"{API}/admin/plans/ai/draft", json=orig | {"name": "PersonalOS AI Renamed22", "reason": "iter22 rename test"})
    assert r.status_code == 200, r.text
    r = demo.post(f"{API}/admin/plans/ai/publish", json={"effective_at": future(4), "reason": "iter22 schedule rename"})
    assert r.status_code == 200, r.text
    p = plan_of(demo, "ai")
    assert p["name"] == "PersonalOS AI"
    assert p["current"]["name"] == "PersonalOS AI"
    assert p["scheduled"] and p["scheduled"][0]["name"] == "PersonalOS AI Renamed22"
    assert DB.plans.find_one({"plan_id": "ai"})["name"] == "PersonalOS AI"
    # public endpoint also still old
    pub = requests.get(f"{API}/plans").json()
    assert next(x for x in pub["plans"] if x["planId"] == "ai")["name"] == "PersonalOS AI"
    time.sleep(6)
    p = plan_of(demo, "ai")
    assert p["name"] == "PersonalOS AI Renamed22"
    assert p["current"]["name"] == "PersonalOS AI Renamed22"
    assert p["scheduled"] == []
    restore_all(demo)
    p = plan_of(demo, "ai")
    assert p["name"] == "PersonalOS AI"


# db.plans has no current_version field
def test_no_current_version_field():
    assert DB.plans.count_documents({}) == 3
    assert DB.plans.count_documents({"current_version": {"$exists": True}}) == 0


# Unique partial indexes exist
def test_partial_unique_indexes():
    pv = DB.plan_versions.index_information()
    assert "one_draft_per_plan" in pv
    assert pv["one_draft_per_plan"].get("unique") is True
    assert pv["one_draft_per_plan"]["partialFilterExpression"] == {"status": "draft"}
    pr = DB.ai_pricing_versions.index_information()
    assert "one_pricing_draft" in pr
    assert pr["one_pricing_draft"].get("unique") is True
    assert pr["one_pricing_draft"]["partialFilterExpression"] == {"status": "draft"}


def _race(fn, n=2):
    barrier = threading.Barrier(n)
    out = []

    def run(i):
        s = login("demo", "DemoPass123!")
        barrier.wait()
        out.append(fn(s, i))

    ts = [threading.Thread(target=run, args=(i,)) for i in range(n)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    return out


# Concurrent first plan draft saves: exactly one draft, other either 409 or updates the same draft
def test_concurrent_plan_draft(demo):
    codes_seen = []
    for trial in range(5):
        demo.delete(f"{API}/admin/plans/basic/draft")
        orig = ORIGINAL_PLANS["basic"]
        res = _race(lambda s, i: s.put(f"{API}/admin/plans/basic/draft",
                                       json=orig | {"trial_credits": i + 1, "reason": f"iter22 race {i}"}))
        codes = sorted(r.status_code for r in res)
        codes_seen.append(codes)
        assert all(c in (200, 409) for c in codes), [r.text for r in res]
        assert 200 in codes
        assert DB.plan_versions.count_documents({"plan_id": "basic", "status": "draft"}) == 1
        for r in res:
            if r.status_code == 409:
                assert r.json()["error"]["code"] == "CONFLICT" if "error" in r.json() else True
    demo.delete(f"{API}/admin/plans/basic/draft")
    assert DB.plan_versions.count_documents({"plan_id": "basic", "status": "draft"}) == 0
    print("plan race codes", codes_seen)


# Concurrent first pricing draft saves
def test_concurrent_pricing_draft(demo):
    codes_seen = []
    for trial in range(5):
        demo.delete(f"{API}/admin/pricing/draft")
        res = _race(lambda s, i: s.put(f"{API}/admin/pricing/draft", json={
            "actions": [a | {"max_output_tokens": a["max_output_tokens"] + i + 1} for a in V1_PRICING],
            "reason": f"iter22 race {i}"}))
        codes = sorted(r.status_code for r in res)
        codes_seen.append(codes)
        assert all(c in (200, 409) for c in codes), [r.text for r in res]
        assert DB.ai_pricing_versions.count_documents({"status": "draft"}) == 1
    demo.delete(f"{API}/admin/pricing/draft")
    assert DB.ai_pricing_versions.count_documents({"status": "draft"}) == 0
    print("pricing race codes", codes_seen)


# Final state: originals, no drafts, no future scheduled
def test_final_state(demo):
    restore_all(demo)
    for pid, orig in ORIGINAL_PLANS.items():
        p = plan_of(demo, pid)
        assert p["draft"] is None and p["scheduled"] == []
        assert all(p["current"][k] == v for k, v in orig.items())
        assert p["name"] == orig["name"]
    st = demo.get(f"{API}/admin/pricing").json()
    assert st["draft"] is None and st["scheduled"] == []
    cur = {a["action"]: a for a in st["current"]["actions"]}
    for a in V1_PRICING:
        c = cur[a["action"]]
        assert (c["min_credits"], c["max_credits"], c["max_output_tokens"]) == (a["min_credits"], a["max_credits"], a["max_output_tokens"])
