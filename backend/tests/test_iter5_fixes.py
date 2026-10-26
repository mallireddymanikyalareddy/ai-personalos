# Iteration 5 retest: XFF-proof login rate limit, StrictBool digest, demo onboarded
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
V1 = f"{BASE_URL}/api/v1"


def _register():
    h = f"test_rl_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{V1}/auth/register", json={"handle": h, "displayName": "RL", "password": "GoodPass1234!"})
    assert r.status_code == 201, r.text
    return h


# Brute-force limiter must ignore spoofed X-Forwarded-For
def test_rate_limit_not_bypassable_with_xff():
    h = _register()
    for i in range(5):
        r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "wrongpass!!"},
                          headers={"X-Forwarded-For": f"10.0.{i}.{i + 1}"})
        assert r.status_code == 401, (i, r.status_code, r.text)
        assert r.json()["error"]["code"] == "INVALID_CREDENTIALS" if "error" in r.json() else True
    r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "wrongpass!!"},
                      headers={"X-Forwarded-For": "99.99.99.99"})
    assert r.status_code == 429, r.text
    assert "RATE_LIMITED" in r.text
    # even correct password is blocked while locked
    r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "GoodPass1234!"},
                      headers={"X-Forwarded-For": "1.2.3.4"})
    assert r.status_code == 429
    # identifier case/whitespace variant also locked
    r = requests.post(f"{V1}/auth/login", json={"identifier": f"  {h.upper()} ", "password": "x"})
    assert r.status_code == 429


# Other identifiers unaffected by another user's lock
def test_rate_limit_scoped_to_identifier():
    h = _register()
    r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "GoodPass1234!"})
    assert r.status_code == 200


# DigestIn StrictBool
def test_digest_strict_bool():
    s = requests.Session()
    assert s.post(f"{V1}/auth/login", json={"identifier": "mailtest", "password": "TestPass123!"}).status_code == 200
    for bad in ["yes", "true", 1, 0, None]:
        r = s.put(f"{V1}/digest", json={"enabled": bad})
        assert r.status_code == 400, (bad, r.status_code, r.text)
        assert "VALIDATION_FAILED" in r.text
    r = s.put(f"{V1}/digest", json={})
    assert r.status_code == 400
    r = s.put(f"{V1}/digest", json={"enabled": True})
    assert r.status_code == 200 and r.json()["enabled"] is True
    assert s.get(f"{V1}/digest").json()["enabled"] is True
    r = s.put(f"{V1}/digest", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False


# demo account onboarded
def test_demo_onboarded():
    s = requests.Session()
    r = s.post(f"{V1}/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
    assert r.status_code == 200, r.text
    ob = s.get(f"{V1}/users/me/onboarding").json()
    assert ob["completed"] is True
