# Iteration 8: password reset / verify email (mailtest only), sessions, devices, integrations, state sync, onboarding
import os
import time
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
def mail():
    return login("mailtest", "TestPass123!")


@pytest.fixture(scope="module")
def demo():
    return login("demo", "DemoPass123!")


# Password reset (mailtest -> resend.dev inbox, safe)
def test_reset_request_mailtest_accepted():
    r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": "mailtest"})
    assert r.status_code == 202
    assert r.json()["status"] == "accepted"


def test_reset_request_unknown_user_same_response():
    r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": f"nouser{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 202 and r.json()["status"] == "accepted"


def test_reset_confirm_bad_token():
    r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": "bad", "password": "NewPass123!xx"})
    assert r.status_code in (400, 404, 410)
    body = r.json()
    assert body.get("message") or body.get("code")
    print(r.status_code, body)


def test_reset_confirm_weak_password():
    r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": "bad", "password": "short"})
    assert r.status_code == 400


# Verify email
def test_verify_request_mailtest(mail):
    r = mail.post(f"{API}/auth/verify-email/request")
    assert r.status_code == 202 and r.json()["status"] == "accepted"


def test_verify_confirm_bad_token():
    r = requests.post(f"{API}/auth/verify-email/confirm", json={"token": "bad"})
    assert r.status_code in (400, 404, 410)


def test_verify_request_unauth():
    assert requests.post(f"{API}/auth/verify-email/request").status_code == 401


# Sessions & devices
def test_sessions_and_revoke_others(mail):
    other = login("mailtest", "TestPass123!")
    r = mail.get(f"{API}/auth/sessions")
    assert r.status_code == 200
    items = r.json()["items"]
    assert sum(1 for i in items if i["current"]) == 1
    assert len(items) >= 2
    r = mail.post(f"{API}/auth/sessions/revoke-others")
    assert r.status_code == 200 and r.json()["revoked"] >= 1
    assert other.get(f"{API}/users/me").status_code == 401
    assert mail.get(f"{API}/users/me").status_code == 200
    items = mail.get(f"{API}/auth/sessions").json()["items"]
    assert len(items) == 1 and items[0]["current"]


def test_revoke_unknown_session_404(mail):
    assert mail.delete(f"{API}/auth/sessions/{uuid.uuid4()}").status_code == 404


def test_devices_list(mail):
    r = mail.get(f"{API}/auth/devices")
    assert r.status_code == 200
    items = r.json()["items"]
    assert isinstance(items, list) and len(items) >= 1
    assert {"id", "name", "platform", "activeSessions"} <= set(items[0])


# Integrations empty catalog
def test_integrations_catalog(demo):
    r = demo.get(f"{API}/integrations/catalog")
    assert r.status_code == 200
    print(r.json())


# State persistence across sessions
def test_state_roundtrip(demo):
    r = demo.get(f"{API}/state")
    assert r.status_code == 200
    data = r.json()
    assert "version" in data
    if data["envelope"]:
        assert isinstance(data["envelope"].get("state"), dict)


def test_state_put_conflict():
    s = requests.Session()
    h = f"t{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/auth/register", json={"handle": h, "displayName": "TEST_State", "password": "TestPass123!x"})
    assert r.status_code == 201
    env = {"version": 1, "state": {"tasks": [{"id": "x", "title": "TEST_task"}]}}
    r1 = s.put(f"{API}/state", json={"envelope": env, "baseVersion": 0})
    assert r1.status_code == 200 and r1.json()["version"] == 1
    r2 = s.put(f"{API}/state", json={"envelope": env, "baseVersion": 0})
    assert r2.status_code == 409
    s2 = login(h, "TestPass123!x")
    got = s2.get(f"{API}/state").json()
    assert got["envelope"]["state"]["tasks"][0]["title"] == "TEST_task"


# Onboarding API: apply name/tz
def test_onboarding_applies_profile():
    s = requests.Session()
    h = f"t{uuid.uuid4().hex[:8]}"
    assert s.post(f"{API}/auth/register", json={"handle": h, "displayName": "Riley", "password": "TestPass123!x"}).status_code == 201
    st = s.get(f"{API}/users/me/onboarding").json()
    assert st["completed"] is False
    r = s.post(f"{API}/users/me/onboarding", json={"displayName": "Sam", "timezone": "America/New_York", "locale": "en-US",
                                                  "lifeAreaNames": ["Work"], "preferences": {"planningPreference": "evening"}})
    assert r.status_code in (200, 201), r.text
    me = s.get(f"{API}/users/me").json()
    assert me["displayName"] == "Sam" and me["timezone"] == "America/New_York"
    assert me["onboardingCompleted"] is True
    assert me["preferences"]["planningPreference"] == "evening"
