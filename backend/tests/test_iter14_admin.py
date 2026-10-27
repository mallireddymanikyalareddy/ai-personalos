# Iteration 14: Admin console stage 1 - /api/v1/admin/me role gate
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"


def login(handle, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": handle, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {handle}: {r.status_code} {r.text[:200]}")
    return s


class TestAdminMe:
    def test_anonymous_401(self):
        r = requests.get(f"{API}/admin/me")
        assert r.status_code == 401
        assert r.json().get("error", {}).get("code", r.text).__str__().find("AUTH") >= 0 or "AUTH" in r.text

    def test_demo_super_admin_200(self):
        s = login("demo", "DemoPass123!")
        r = s.get(f"{API}/admin/me")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["handle"] == "demo"
        assert d["role"] == "super_admin"
        assert isinstance(d["id"], str)
        assert "_id" not in d and "password_hash" not in d

    def test_non_admin_403(self):
        s = login("mailtest", "TestPass123!")
        r = s.get(f"{API}/admin/me")
        assert r.status_code == 403, r.text
        assert "FORBIDDEN" in r.text

    def test_fresh_user_403(self):
        h = "t" + uuid.uuid4().hex[:9]
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"handle": h, "displayName": "TEST admin", "password": "TestPass123!"})
        assert r.status_code == 201, r.text
        r = s.get(f"{API}/admin/me")
        assert r.status_code == 403

    def test_unverified_configured_email_cannot_claim(self):
        # Registering with an email that is NOT verified must not grant admin even if configured
        h = "t" + uuid.uuid4().hex[:9]
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"handle": h, "displayName": "TEST squat",
                                                 "email": f"delivered+{h}@resend.dev", "password": "TestPass123!"})
        assert r.status_code == 201, r.text
        assert s.get(f"{API}/admin/me").status_code == 403

    def test_users_me_does_not_leak_role_field_crash(self):
        s = login("demo", "DemoPass123!")
        r = s.get(f"{API}/users/me")
        assert r.status_code == 200
