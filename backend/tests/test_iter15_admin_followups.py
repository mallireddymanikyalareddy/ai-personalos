# Iteration 15: admin follow-ups - /admin/me role gate regression + env-sourced role demotion on restart
import asyncio
import os
import sys
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"

sys.path.insert(0, "/app/backend")


def login(handle, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": handle, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {handle}: {r.status_code}")
    return s


# Role gate regression
class TestAdminMe:
    def test_anonymous_401(self):
        assert requests.get(f"{API}/admin/me").status_code == 401

    def test_demo_200(self):
        r = login("demo", "DemoPass123!").get(f"{API}/admin/me")
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "super_admin"

    def test_mailtest_403(self):
        r = login("mailtest", "TestPass123!").get(f"{API}/admin/me")
        assert r.status_code == 403
        assert "FORBIDDEN" in r.text


# promote_configured_admins demotion logic (runs the startup function directly against the app DB)
class TestPromoteConfiguredAdmins:
    def _run(self, coro_factory):
        from dotenv import load_dotenv

        load_dotenv("/app/backend/.env")
        return asyncio.new_event_loop().run_until_complete(coro_factory())

    def test_env_role_demoted_manual_kept(self):
        async def go():
            import importlib

            import db as dbmod
            importlib.reload(dbmod)
            import admin
            importlib.reload(admin)
            d = dbmod.db
            tag = uuid.uuid4().hex[:8]
            env_id, man_id = f"TEST_env_{tag}", f"TEST_man_{tag}"
            await d.users.insert_many([
                {"id": env_id, "handle": env_id, "email": f"test_env_{tag}@example.com", "admin_role": "super_admin", "admin_role_source": "env", "email_verified_at": "x"},
                {"id": man_id, "handle": man_id, "email": f"test_man_{tag}@example.com", "admin_role": "billing_admin"},
            ])
            try:
                await admin.promote_configured_admins()
                env_u = await d.users.find_one({"id": env_id})
                man_u = await d.users.find_one({"id": man_id})
                demo = await d.users.find_one({"handle": "demo"})
                return env_u, man_u, demo
            finally:
                await d.users.delete_many({"id": {"$in": [env_id, man_id]}})

        env_u, man_u, demo = self._run(go)
        assert "admin_role" not in env_u and "admin_role_source" not in env_u
        assert man_u["admin_role"] == "billing_admin"
        assert demo["admin_role"] == "super_admin"
        assert demo.get("admin_role_source") is None

    def test_demo_still_200_after_promote(self):
        r = login("demo", "DemoPass123!").get(f"{API}/admin/me")
        assert r.status_code == 200


# Regression: mailtest app session works
def test_mailtest_me_ok():
    s = login("mailtest", "TestPass123!")
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 200, r.text
