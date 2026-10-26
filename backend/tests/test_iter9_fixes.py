# Iteration 9: preference validation, onboarding validation, atomic state sync, reset-link origin, appearance persistence
import os
import sys
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"


def login(identifier, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed {identifier}: {r.status_code}")
    return s


@pytest.fixture(scope="module")
def demo():
    return login("demo", "DemoPass123!")


@pytest.fixture(scope="module")
def fresh():
    """New throwaway user (TEST_ handle) for onboarding/state tests."""
    s = requests.Session()
    handle = f"test_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "TEST User", "password": "TestPass123!xx"})
    assert r.status_code == 201, r.text
    return s


# Preference enum/bool validation
BAD_PREFS = [
    {"planningPreference": "banana"},
    {"ai": {"tone": 12}},
    {"ai": {"proactivity": "x"}},
    {"notifications": {"emailDigest": "hourly"}},
    {"notifications": {"dailyBriefing": "yes"}},
    {"workingHours": {"days": [9]}},
]


@pytest.mark.parametrize("prefs", BAD_PREFS)
def test_bad_preferences_400(demo, prefs):
    r = demo.patch(f"{API}/users/me", json={"preferences": prefs})
    assert r.status_code == 400, r.text
    assert r.json().get("code") == "VALIDATION_FAILED"


def test_valid_preferences_200(demo):
    before = demo.get(f"{API}/users/me").json()["preferences"]
    prefs = {"planningPreference": "evening", "ai": {"tone": "concise", "proactivity": "plan"},
             "notifications": {"emailDigest": "weekly", "dailyBriefing": False}, "workingHours": {"days": [1, 2, 3]}}
    r = demo.patch(f"{API}/users/me", json={"preferences": prefs})
    assert r.status_code == 200, r.text
    got = demo.get(f"{API}/users/me").json()["preferences"]
    assert got["planningPreference"] == "evening" and got["ai"]["tone"] == "concise"
    assert got["notifications"]["emailDigest"] == "weekly" and got["workingHours"]["days"] == [1, 2, 3]
    # restore
    restore = {k: before[k] for k in ("planningPreference", "ai", "notifications", "workingHours") if k in before}
    assert demo.patch(f"{API}/users/me", json={"preferences": restore}).status_code == 200


def test_appearance_then_schedule_keeps_time_format(demo):
    before = demo.get(f"{API}/users/me").json()["preferences"]
    assert demo.patch(f"{API}/users/me", json={"preferences": {"timeFormat": "12h"}}).status_code == 200
    assert demo.patch(f"{API}/users/me", json={"preferences": {"planningPreference": "evening"}}).status_code == 200
    got = demo.get(f"{API}/users/me").json()["preferences"]
    assert got["timeFormat"] == "12h"
    demo.patch(f"{API}/users/me", json={"preferences": {"timeFormat": before.get("timeFormat", "24h"),
                                                         "planningPreference": before.get("planningPreference", "morning")}})


# Onboarding validation
@pytest.mark.parametrize("body", [
    {"timezone": "UTC", "displayName": "   ", "lifeAreaNames": ["Health"]},
    {"timezone": "UTC", "displayName": "Jordan", "lifeAreaNames": []},
    {"timezone": "UTC", "displayName": "Jordan", "lifeAreaNames": "Health"},
])
def test_onboarding_invalid_400(fresh, body):
    r = fresh.post(f"{API}/users/me/onboarding", json=body)
    assert r.status_code == 400, r.text


def test_onboarding_valid(fresh):
    cat = fresh.get(f"{API}/users/me/onboarding").json()["lifeAreaCatalog"]
    names = [a["name"] for a in cat[:2]]
    r = fresh.post(f"{API}/users/me/onboarding", json={"timezone": "UTC", "displayName": "Jordan", "lifeAreaNames": names})
    assert r.status_code == 200, r.text
    assert r.json()["displayName"] == "Jordan"
    assert fresh.get(f"{API}/users/me/onboarding").json()["completed"] is True


# Atomic state sync
ENV = {"state": {"tasks": []}, "version": 1}


def test_state_version_flow(fresh):
    assert fresh.get(f"{API}/state").json()["version"] == 0
    r = fresh.put(f"{API}/state", json={"envelope": ENV, "baseVersion": 0})
    assert r.status_code == 200 and r.json()["version"] == 1, r.text
    # baseVersion 0 again -> doc exists -> 409
    r = fresh.put(f"{API}/state", json={"envelope": ENV, "baseVersion": 0})
    assert r.status_code == 409 and r.json()["version"] == 1, r.text
    # stale baseVersion -> 409
    r = fresh.put(f"{API}/state", json={"envelope": ENV, "baseVersion": 5})
    assert r.status_code == 409, r.text
    # matching baseVersion -> 200
    r = fresh.put(f"{API}/state", json={"envelope": ENV, "baseVersion": 1})
    assert r.status_code == 200 and r.json()["version"] == 2
    # omit baseVersion -> always writes
    r = fresh.put(f"{API}/state", json={"envelope": ENV})
    assert r.status_code == 200 and r.json()["version"] == 3
    assert fresh.get(f"{API}/state").json()["version"] == 3


def test_state_negative_base_version(fresh):
    r = fresh.put(f"{API}/state", json={"envelope": ENV, "baseVersion": -1})
    print("negative baseVersion ->", r.status_code, r.text[:200])
    assert r.status_code in (400, 409)


def test_state_too_large_413(fresh):
    big = "x" * (26 * 1024 * 1024)
    r = fresh.put(f"{API}/state", json={"envelope": {"state": {"blob": big}, "version": 1}}, timeout=120)
    print("large ->", r.status_code, r.text[:200])
    assert r.status_code == 413


def test_state_requires_auth():
    assert requests.get(f"{API}/state").status_code == 401


# Reset link origin
def test_reset_with_forwarded_host_accepted():
    r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": "mailtest"},
                      headers={"X-Forwarded-Host": "evil.tld"})
    assert r.status_code == 202


def test_origin_of_ignores_forwarded_host(monkeypatch):
    sys.path.insert(0, "/app/backend")
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")  # lazy client, no connection made
    os.environ.setdefault("DB_NAME", "unit_test_only")
    from starlette.requests import Request
    import auth

    monkeypatch.delenv("APP_URL", raising=False)
    scope = {"type": "http", "headers": [(b"host", b"app.example.com"), (b"x-forwarded-host", b"evil.tld")]}
    assert auth.origin_of(Request(scope)) == "https://app.example.com"
    monkeypatch.setenv("APP_URL", "https://configured.example.com/")
    assert auth.origin_of(Request(scope)) == "https://configured.example.com"
    monkeypatch.delenv("APP_URL")
    assert auth.origin_of(Request({"type": "http", "headers": [(b"host", b"localhost:8001")]})) is None
