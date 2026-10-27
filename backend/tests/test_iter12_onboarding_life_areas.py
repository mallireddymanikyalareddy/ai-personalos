# Iteration 12: onboarding skip/resume, life areas in profile, PATCH lifeAreaNames
import os
import uuid

import pytest
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


def _onboard_body(areas):
    return {"displayName": "TEST Onb", "timezone": "Europe/Berlin", "locale": "en", "lifeAreaNames": areas, "preferences": {}}


# Fresh user profile shape
def test_fresh_profile_fields():
    s = _register()
    p = s.get(f"{API}/users/me").json()
    assert p["onboardingSkipped"] is False
    assert p["lifeAreas"] == []
    st = s.get(f"{API}/users/me/onboarding").json()
    assert st["completed"] is False
    assert isinstance(st["lifeAreaCatalog"], list) and len(st["lifeAreaCatalog"]) >= 6


# Skip: completed + skipped, then complete later -> skipped false
def test_skip_then_complete():
    s = _register()
    r = s.post(f"{API}/users/me/onboarding/skip", json={"timezone": "America/New_York"})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["onboardingSkipped"] is True
    assert p["onboardingCompleted"] is True if "onboardingCompleted" in p else True
    assert p["timezone"] == "America/New_York"
    st = s.get(f"{API}/users/me/onboarding").json()
    assert st["completed"] is True
    assert st["profile"]["onboardingSkipped"] is True
    # idempotent skip
    r2 = s.post(f"{API}/users/me/onboarding/skip", json={})
    assert r2.status_code == 200 and r2.json()["onboardingSkipped"] is True
    # complete later
    r3 = s.post(f"{API}/users/me/onboarding", json=_onboard_body(["Health", "Work"]))
    assert r3.status_code == 200, r3.text
    assert r3.json()["onboardingSkipped"] is False
    assert r3.json()["lifeAreas"] == ["Health", "Work"]
    p = s.get(f"{API}/users/me").json()
    assert p["onboardingSkipped"] is False and p["lifeAreas"] == ["Health", "Work"]


def test_skip_invalid_timezone_ignored():
    s = _register()
    r = s.post(f"{API}/users/me/onboarding/skip", json={"timezone": "Mars/Base"})
    assert r.status_code == 200, r.text
    assert r.json()["timezone"] != "Mars/Base"


def test_skip_unauth():
    r = requests.post(f"{API}/users/me/onboarding/skip", json={})
    assert r.status_code == 401


def test_skip_after_complete_does_not_set_skipped():
    s = _register()
    assert s.post(f"{API}/users/me/onboarding", json=_onboard_body(["Money"])).status_code == 200
    r = s.post(f"{API}/users/me/onboarding/skip", json={})
    assert r.status_code == 200 and r.json()["onboardingSkipped"] is False


# PATCH lifeAreaNames
@pytest.fixture(scope="module")
def onboarded():
    s = _register()
    assert s.post(f"{API}/users/me/onboarding", json=_onboard_body(["Work"])).status_code == 200
    return s


def test_patch_life_areas_persist(onboarded):
    r = onboarded.patch(f"{API}/users/me", json={"lifeAreaNames": ["Work", "Learning"]})
    assert r.status_code == 200, r.text
    assert r.json()["lifeAreas"] == ["Work", "Learning"]
    assert onboarded.get(f"{API}/users/me").json()["lifeAreas"] == ["Work", "Learning"]


def test_patch_life_areas_empty_refused(onboarded):
    r = onboarded.patch(f"{API}/users/me", json={"lifeAreaNames": []})
    assert r.status_code == 400, r.text
    assert onboarded.get(f"{API}/users/me").json()["lifeAreas"] != []


def test_patch_life_areas_unknown_refused(onboarded):
    r = onboarded.patch(f"{API}/users/me", json={"lifeAreaNames": ["Bogus"]})
    assert r.status_code == 400, r.text


def test_patch_life_areas_wrong_type(onboarded):
    r = onboarded.patch(f"{API}/users/me", json={"lifeAreaNames": "Work"})
    assert r.status_code == 400, r.text


def test_patch_life_areas_duplicates(onboarded):
    r = onboarded.patch(f"{API}/users/me", json={"lifeAreaNames": ["Work", "Work"]})
    # report: duplicates should be deduped or rejected
    assert r.status_code in (200, 400)
    if r.status_code == 200:
        assert r.json()["lifeAreas"].count("Work") == 1, f"duplicates stored: {r.json()['lifeAreas']}"


def test_onboarding_empty_life_areas_refused():
    s = _register()
    r = s.post(f"{API}/users/me/onboarding", json=_onboard_body([]))
    assert r.status_code == 400
