# Iteration 6: login limiter keyed on (client ip + identifier) with identifier-wide cap of 20
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
V1 = f"{BASE_URL}/api/v1"
# Direct backend (bypasses ingress) ONLY to exercise header-parsing logic with controlled client IPs
LOCAL = "http://localhost:8001/api/v1"


def _register():
    h = f"test_rl_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{V1}/auth/register", json={"handle": h, "displayName": "RL", "password": "GoodPass1234!"})
    assert r.status_code == 201, r.text
    return h


def _fail(base, h, headers=None):
    return requests.post(f"{base}/auth/login", json={"identifier": h, "password": "wrongpass!!"}, headers=headers or {})


# Logic: per (ip, ident) 5 failures -> 429 for that ip; other ip still allowed
# client_ip() uses XFF[-3] (client, cloudflare, gcp-lb topology) since commit c678949
def test_pair_limit_per_ip_logic():
    h = _register()
    chain = "9.9.9.9, 172.64.0.1, 34.111.104.211"
    for _ in range(5):
        assert _fail(LOCAL, h, {"X-Forwarded-For": chain}).status_code == 401
    assert _fail(LOCAL, h, {"X-Forwarded-For": chain}).status_code == 429
    # spoofing a prepended left-most entry does not bypass (XFF[-3] is used)
    assert _fail(LOCAL, h, {"X-Forwarded-For": "5.5.5.5, " + chain}).status_code == 429
    # a different client ip can still log in with the right password
    r = requests.post(f"{LOCAL}/auth/login", json={"identifier": h, "password": "GoodPass1234!"},
                      headers={"X-Forwarded-For": "10.0.0.2"})
    assert r.status_code == 200, r.text


# Logic: identifier-wide cap = 20 failures across ips
def test_identifier_cap_20_logic():
    h = _register()
    for i in range(20):
        r = _fail(LOCAL, h, {"X-Forwarded-For": f"10.1.{i // 4}.{i}"})
        assert r.status_code == 401, (i, r.status_code)
    r = requests.post(f"{LOCAL}/auth/login", json={"identifier": h, "password": "GoodPass1234!"},
                      headers={"X-Forwarded-For": "10.9.9.9"})
    assert r.status_code == 429


# Logic: cf-connecting-ip preferred over XFF
def test_cf_connecting_ip_preferred_logic():
    h = _register()
    for i in range(5):
        assert _fail(LOCAL, h, {"CF-Connecting-IP": "4.4.4.4", "X-Forwarded-For": f"10.2.0.{i}"}).status_code == 401
    assert _fail(LOCAL, h, {"CF-Connecting-IP": "4.4.4.4", "X-Forwarded-For": "10.2.0.99"}).status_code == 429


# Public: spoofed XFF via the real ingress does not bypass the limit
def test_public_xff_spoof_no_bypass():
    h = _register()
    for i in range(5):
        assert _fail(V1, h, {"X-Forwarded-For": f"10.0.{i}.{i + 1}"}).status_code == 401
    r = _fail(V1, h, {"X-Forwarded-For": "99.99.99.99"})
    assert r.status_code == 429 and "RATE_LIMITED" in r.text


# Public: mailtest onboarded
def test_mailtest_onboarded():
    s = requests.Session()
    assert s.post(f"{V1}/auth/login", json={"identifier": "mailtest", "password": "TestPass123!"}).status_code == 200
    assert s.get(f"{V1}/users/me/onboarding").json()["completed"] is True
