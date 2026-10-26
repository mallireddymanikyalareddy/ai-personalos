# Per-account state sync API: GET/PUT /api/v1/state auth, upsert/version, isolation
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _register():
    s = requests.Session()
    h = "test" + uuid.uuid4().hex[:8]
    r = s.post(f"{BASE_URL}/api/v1/auth/register",
               json={"handle": h, "displayName": "TEST " + h, "email": f"{h}@example.com", "password": "TestPass123!"})
    assert r.status_code in (200, 201), r.text
    return s, h


def _env(marker):
    return {"envelope": {"version": 1, "savedAt": int(time.time() * 1000), "state": {"marker": marker, "tasks": [{"id": "t1", "title": marker}]}}}


def test_state_unauth_get():
    r = requests.get(f"{BASE_URL}/api/v1/state")
    assert r.status_code == 401, r.text


def test_state_unauth_put():
    r = requests.put(f"{BASE_URL}/api/v1/state", json=_env("x"))
    assert r.status_code == 401, r.text


def test_state_new_user_empty():
    s, _ = _register()
    r = s.get(f"{BASE_URL}/api/v1/state")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["envelope"] is None and d["version"] == 0


def test_state_put_upsert_and_version():
    s, _ = _register()
    r1 = s.put(f"{BASE_URL}/api/v1/state", json=_env("A1"))
    assert r1.status_code == 200, r1.text
    v1 = r1.json()["version"]
    r2 = s.put(f"{BASE_URL}/api/v1/state", json=_env("A2"))
    assert r2.status_code == 200
    v2 = r2.json()["version"]
    assert v2 == v1 + 1
    g = s.get(f"{BASE_URL}/api/v1/state").json()
    assert g["version"] == v2
    assert g["envelope"]["state"]["marker"] == "A2"


def test_state_validation():
    s, _ = _register()
    r = s.put(f"{BASE_URL}/api/v1/state", json={"envelope": {"foo": 1}})
    assert r.status_code in (400, 422), r.text
    r = s.put(f"{BASE_URL}/api/v1/state", json={})
    assert r.status_code in (400, 422), r.text


def test_state_isolation():
    a, _ = _register()
    b, _ = _register()
    assert a.put(f"{BASE_URL}/api/v1/state", json=_env("SECRET_A")).status_code == 200
    gb = b.get(f"{BASE_URL}/api/v1/state").json()
    assert gb["envelope"] is None
    assert b.put(f"{BASE_URL}/api/v1/state", json=_env("B_DATA")).status_code == 200
    assert a.get(f"{BASE_URL}/api/v1/state").json()["envelope"]["state"]["marker"] == "SECRET_A"
    assert b.get(f"{BASE_URL}/api/v1/state").json()["envelope"]["state"]["marker"] == "B_DATA"


def test_state_second_login_session_sees_data():
    a, h = _register()
    a.put(f"{BASE_URL}/api/v1/state", json=_env("DEVICE1"))
    s2 = requests.Session()
    assert s2.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": h, "password": "TestPass123!"}).status_code == 200
    assert s2.get(f"{BASE_URL}/api/v1/state").json()["envelope"]["state"]["marker"] == "DEVICE1"
    with open("/tmp/state_user.txt", "w") as f:
        f.write(h)


def test_me_unauth_no_leak():
    assert requests.get(f"{BASE_URL}/api/v1/auth/me").status_code == 401
