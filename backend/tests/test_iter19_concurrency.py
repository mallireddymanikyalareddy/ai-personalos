# Iteration 19: concurrent replays of the same admin credit requestId must apply once
import uuid
from concurrent.futures import ThreadPoolExecutor

from test_iter19_admin_ops import API, DB, consistent, login, purge, register


def test_concurrent_same_request_id():
    demo = login("demo", "DemoPass123!")
    _, _, uid = register("tests19c")
    try:
        for amount in (7, -4):
            key = f"conc{uuid.uuid4().hex[:10]}"
            body = {"amount": amount, "reason": "concurrency test", "requestId": key}
            with ThreadPoolExecutor(8) as ex:
                res = list(ex.map(lambda _: demo.post(f"{API}/admin/users/{uid}/credits", json=body), range(8)))
            assert all(r.status_code == 200 for r in res), [r.text for r in res]
            assert sum(r.json()["applied"] for r in res) == 1
        assert DB.credit_accounts.find_one({"user_id": uid})["available"] == 13
        assert consistent(uid)
    finally:
        purge(uid)
