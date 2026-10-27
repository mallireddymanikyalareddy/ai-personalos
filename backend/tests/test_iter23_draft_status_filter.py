# Iteration 23: draft update path filters status=draft — save racing publish never mutates a published version
import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.dirname(__file__))
from test_iter21_plan_versioning import API, DB, ORIGINAL_PLANS, V1_PRICING, login, restore_all  # noqa: E402


@pytest.fixture(scope="module")
def demo():
    s = login("demo", "DemoPass123!")
    restore_all(s)
    yield s
    restore_all(s)


def _pair(a, b):
    sa, sb = login("demo", "DemoPass123!"), login("demo", "DemoPass123!")
    barrier = threading.Barrier(2)
    res = {}

    def run(key, fn, s):
        barrier.wait()
        res[key] = fn(s)

    ts = [threading.Thread(target=run, args=("a", a, sa)), threading.Thread(target=run, args=("b", b, sb))]
    [t.start() for t in ts]
    [t.join() for t in ts]
    return res


# Plan: save (update path) racing publish — 200 or 409, never edits the published doc
def test_plan_save_vs_publish_race(demo):
    orig = ORIGINAL_PLANS["basic"]
    codes = set()
    for i in range(6):
        r = demo.put(f"{API}/admin/plans/basic/draft", json=orig | {"reason": f"iter23 seed {i}"})
        assert r.status_code == 200, r.text
        res = _pair(lambda s: s.post(f"{API}/admin/plans/basic/publish", json={"effective_at": None, "reason": "iter23 race publish"}),
                    lambda s: s.put(f"{API}/admin/plans/basic/draft", json=orig | {"reason": "iter23 race save"}))
        assert res["a"].status_code == 200, res["a"].text
        assert res["b"].status_code in (200, 409), res["b"].text
        codes.add(res["b"].status_code)
        if res["b"].status_code == 409:
            assert res["b"].json()["error"]["code"] == "CONFLICT" if "error" in res["b"].json() else True
        bad = [d for d in DB.plan_versions.find({"plan_id": "basic", "status": "published", "published_at": {"$exists": True}})
               if d.get("updated_at") and d["updated_at"] > d["published_at"]]
        assert not bad, f"published version mutated after publish: {[d['version'] for d in bad]}"
        assert DB.plan_versions.count_documents({"plan_id": "basic", "status": "draft"}) <= 1
        demo.delete(f"{API}/admin/plans/basic/draft")
    print("save codes seen:", codes)


# Pricing: same race on /pricing/draft
def test_pricing_save_vs_publish_race(demo):
    acts = V1_PRICING
    for i in range(4):
        r = demo.put(f"{API}/admin/pricing/draft", json={"actions": acts, "reason": f"iter23 seed {i}"})
        assert r.status_code == 200, r.text
        res = _pair(lambda s: s.post(f"{API}/admin/pricing/publish", json={"effective_at": None, "reason": "iter23 race publish"}),
                    lambda s: s.put(f"{API}/admin/pricing/draft", json={"actions": acts, "reason": "iter23 race save"}))
        assert res["a"].status_code == 200, res["a"].text
        assert res["b"].status_code in (200, 409), res["b"].text
        bad = [d for d in DB.ai_pricing_versions.find({"status": "published", "published_at": {"$exists": True}})
               if d.get("updated_at") and d["updated_at"] > d["published_at"]]
        assert not bad, f"published pricing mutated: {[d['version'] for d in bad]}"
        assert DB.ai_pricing_versions.count_documents({"status": "draft"}) <= 1
        demo.delete(f"{API}/admin/pricing/draft")
