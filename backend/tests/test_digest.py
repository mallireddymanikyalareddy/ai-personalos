# Weekly briefing email (digest) API: auth, opt-in persistence, internal path isolation
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _register(email=True):
    s = requests.Session()
    h = "test" + uuid.uuid4().hex[:8]
    body = {"handle": h, "displayName": "TEST " + h, "password": "TestPass123!"}
    if email:
        body["email"] = f"{h}@example.com"
    r = s.post(f"{BASE_URL}/api/v1/auth/register", json=body)
    assert r.status_code in (200, 201), r.text
    return s, h


# Auth required
def test_digest_get_anon_401():
    assert requests.get(f"{BASE_URL}/api/v1/digest").status_code == 401


def test_digest_put_anon_401():
    assert requests.put(f"{BASE_URL}/api/v1/digest", json={"enabled": True}).status_code == 401


def test_send_now_anon_401():
    r = requests.post(f"{BASE_URL}/api/digest/send-now")
    assert r.status_code == 401
    assert "sign in" in r.json()["detail"].lower()


# Internal paths not reachable externally
@pytest.mark.parametrize("path", [
    "/internal/v1/digest/subscribers",
    "/api/internal/v1/digest/subscribers",
    "/api//internal/v1/digest/subscribers",
    "/api/../internal/v1/digest/subscribers",
    "/api/%2E%2E/internal/v1/digest/subscribers",
    "//internal/v1/digest/subscribers",
    "/api/v1/../../internal/v1/digest/subscribers",
])
def test_internal_not_reachable(path):
    r = requests.get(BASE_URL + path, headers={"x-internal-token": "x" * 64})
    assert r.status_code == 404, f"{path} -> {r.status_code} {r.text[:200]}"
    assert '"items"' not in r.text


# Default pref, toggle on/off, persistence
def test_digest_toggle_persists():
    s, h = _register()
    d = s.get(f"{BASE_URL}/api/v1/digest").json()
    assert d["enabled"] is False and d["lastSentWeek"] is None and d["email"] == f"{h}@example.com"
    r = s.put(f"{BASE_URL}/api/v1/digest", json={"enabled": True})
    assert r.status_code == 200 and r.json()["enabled"] is True
    assert s.get(f"{BASE_URL}/api/v1/digest").json()["enabled"] is True
    r = s.put(f"{BASE_URL}/api/v1/digest", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert s.get(f"{BASE_URL}/api/v1/digest").json()["enabled"] is False


def test_digest_put_validation():
    s, _ = _register()
    r = s.put(f"{BASE_URL}/api/v1/digest", json={"enabled": "yes"})
    assert r.status_code in (400, 422), r.text
    r = s.put(f"{BASE_URL}/api/v1/digest", json={})
    assert r.status_code in (400, 422), r.text


def test_digest_isolation_between_users():
    a, _ = _register()
    b, _ = _register()
    a.put(f"{BASE_URL}/api/v1/digest", json={"enabled": True})
    assert b.get(f"{BASE_URL}/api/v1/digest").json()["enabled"] is False
    a.put(f"{BASE_URL}/api/v1/digest", json={"enabled": False})
