# Iteration 13: lifeAreaNames dedupe (PATCH + onboarding), skipped flag, demo login
import os
import uuid

import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api/v1"


def _register():
    s = requests.Session()
    h = "test" + uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register",
               json={"handle": h, "displayName": "TEST " + h, "email": f"delivered+{h}@resend.dev", "password": "TestPass123!"})
    assert r.status_code in (200, 201), r.text
    return s


def _onboard(s, areas):
    return s.post(f"{API}/users/me/onboarding", json={"timezone": "Europe/Berlin", "locale": "en",
                                                        "lifeAreaNames": areas, "preferences": {}})


# PATCH dedupe keeps order
def test_patch_life_areas_dedupe():
    s = _register()
    assert _onboard(s, ["Health"]).status_code == 200
    r = s.patch(f"{API}/users/me", json={"lifeAreaNames": ["Work", "Work", "Health"]})
    assert r.status_code == 200, r.text
    assert r.json()["lifeAreas"] == ["Work", "Health"]
    assert s.get(f"{API}/users/me").json()["lifeAreas"] == ["Work", "Health"]


def test_patch_life_areas_dedupe_order_kept():
    s = _register()
    r = s.patch(f"{API}/users/me", json={"lifeAreaNames": ["Health", "Work", "Health", "Work", "Learning"]})
    assert r.status_code == 200, r.text
    assert r.json()["lifeAreas"] == ["Health", "Work", "Learning"]


# Onboarding dedupe
def test_onboarding_dedupe():
    s = _register()
    r = _onboard(s, ["Work", "Work", "Health"])
    assert r.status_code == 200, r.text
    assert r.json()["lifeAreas"] == ["Work", "Health"]


# Validation still rejects bad input
def test_patch_life_areas_invalid():
    s = _register()
    assert s.patch(f"{API}/users/me", json={"lifeAreaNames": []}).status_code == 400
    assert s.patch(f"{API}/users/me", json={"lifeAreaNames": ["Nope"]}).status_code == 400
    assert s.patch(f"{API}/users/me", json={"lifeAreaNames": "Work"}).status_code == 400


# Skipped flag drives the Settings banner
def test_skipped_vs_completed_flag():
    s1 = _register()
    assert s1.post(f"{API}/users/me/onboarding/skip", json={}).status_code == 200
    assert s1.get(f"{API}/users/me").json()["onboardingSkipped"] is True
    s2 = _register()
    assert _onboard(s2, ["Health"]).status_code == 200
    assert s2.get(f"{API}/users/me").json()["onboardingSkipped"] is False


def test_unauth_patch_401():
    r = requests.patch(f"{API}/users/me", json={"lifeAreaNames": ["Work"]})
    assert r.status_code == 401


def test_demo_login():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
    assert r.status_code == 200, r.text
    assert s.get(f"{API}/users/me").status_code == 200
