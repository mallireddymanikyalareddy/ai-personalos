# Python FastAPI/MongoDB backend regression: auth contract, account, sessions, state sync, digest, AI chat
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
V1 = f"{BASE_URL}/api/v1"
PW = "TestPass123!"


def reg(email=True, ua=None):
    s = requests.Session()
    if ua:
        s.headers["User-Agent"] = ua
    h = "test_" + uuid.uuid4().hex[:8]
    body = {"handle": h, "displayName": "TEST " + h, "password": PW}
    if email:
        body["email"] = f"{h}@example.com"
    r = s.post(f"{V1}/auth/register", json=body)
    assert r.status_code == 201, r.text
    return s, h, r


# ---------- health ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


# ---------- register ----------
class TestRegister:
    def test_register_contract_and_cookie(self):
        s, h, r = reg()
        d = r.json()
        assert d["user"]["handle"] == h and d["user"]["displayName"] == "TEST " + h
        assert d["user"]["email"] == f"{h}@example.com"
        assert isinstance(d["token"], str) and len(d["token"]) > 20 and d["expiresAt"].endswith("Z")
        sc = r.headers.get("set-cookie", "")
        assert "pos_session=" in sc and "HttpOnly" in sc, sc

    def test_duplicate_handle_409(self):
        s, h, _ = reg()
        r = requests.post(f"{V1}/auth/register", json={"handle": h, "displayName": "x", "password": PW})
        assert r.status_code == 409 and r.json()["code"] == "CONFLICT_ALREADY_EXISTS"

    def test_duplicate_handle_case_insensitive(self):
        s, h, _ = reg()
        r = requests.post(f"{V1}/auth/register", json={"handle": h.upper(), "displayName": "x", "password": PW})
        assert r.status_code == 409

    @pytest.mark.parametrize("body,field", [
        ({"handle": "a!", "displayName": "x", "password": PW}, "handle"),
        ({"handle": "test_" + uuid.uuid4().hex[:6], "displayName": "x", "password": "short"}, "password"),
        ({"handle": "test_" + uuid.uuid4().hex[:6], "displayName": "x", "password": PW, "email": "bad"}, "email"),
        ({"handle": "test_" + uuid.uuid4().hex[:6], "displayName": "   ", "password": PW}, "displayName"),
    ])
    def test_register_validation(self, body, field):
        r = requests.post(f"{V1}/auth/register", json=body)
        assert r.status_code == 400, r.text
        d = r.json()
        assert d["code"] == "VALIDATION_FAILED"
        assert any(e["field"] == field and e["issue"] for e in d["errors"])

    def test_register_missing_fields(self):
        r = requests.post(f"{V1}/auth/register", json={"handle": "abc"})
        assert r.status_code == 400 and r.json()["code"] == "VALIDATION_FAILED"
        assert len(r.json()["errors"]) >= 1


# ---------- login / me / logout ----------
class TestLogin:
    def test_login_by_handle_and_email(self):
        s, h, _ = reg()
        r1 = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": PW})
        assert r1.status_code == 200 and r1.json()["user"]["handle"] == h
        r2 = requests.post(f"{V1}/auth/login", json={"identifier": f"{h}@EXAMPLE.com", "password": PW})
        assert r2.status_code == 200

    def test_seed_users(self):
        for ident, pw in [("demo", "DemoPass123!"), ("mailtest", "TestPass123!")]:
            r = requests.post(f"{V1}/auth/login", json={"identifier": ident, "password": pw})
            assert r.status_code == 200, f"{ident}: {r.text}"

    def test_wrong_password_401(self):
        s, h, _ = reg()
        r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "nopenopenope"})
        assert r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS"

    def test_rate_limit_after_5(self):
        s, h, _ = reg()
        codes = [requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "wrongwrong1"}).status_code for _ in range(5)]
        assert codes == [401] * 5, codes
        r = requests.post(f"{V1}/auth/login", json={"identifier": h, "password": PW})
        assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"

    def test_me_anon_and_auth(self):
        assert requests.get(f"{V1}/auth/me").status_code == 401
        s, h, r = reg()
        me = s.get(f"{V1}/auth/me")
        assert me.status_code == 200 and me.json()["user"]["handle"] == h and me.json()["session"]["id"]
        bearer = requests.get(f"{V1}/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})
        assert bearer.status_code == 200

    def test_logout_revokes(self):
        s, h, r = reg()
        tok = r.json()["token"]
        lo = s.post(f"{V1}/auth/logout")
        assert lo.status_code == 204
        assert s.get(f"{V1}/auth/me").status_code == 401
        assert requests.get(f"{V1}/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


# ---------- profile / onboarding ----------
class TestAccount:
    def test_profile_get_and_patch_deep_merge(self):
        s, h, _ = reg()
        p = s.get(f"{V1}/users/me").json()
        assert p["handle"] == h and p["onboardingCompleted"] is False and p["timezone"] == "UTC"
        assert p["preferences"]["notifications"]["quietHours"]["start"] == "22:00"
        r = s.patch(f"{V1}/users/me", json={"displayName": "TEST Renamed", "timezone": "Europe/Berlin",
                                             "preferences": {"theme": "dark", "notifications": {"quietHours": {"start": "21:00"}}}})
        assert r.status_code == 200, r.text
        g = s.get(f"{V1}/users/me").json()
        assert g["displayName"] == "TEST Renamed" and g["timezone"] == "Europe/Berlin"
        assert g["preferences"]["theme"] == "dark"
        qh = g["preferences"]["notifications"]["quietHours"]
        assert qh["start"] == "21:00" and qh["end"] == "07:00" and qh["enabled"] is True
        assert g["preferences"]["notifications"]["dailyBriefing"] is True

    @pytest.mark.parametrize("body", [{"timezone": "Mars/Base"}, {"preferences": {"theme": "neon"}},
                                      {"preferences": {"workingHours": {"start": "25:00"}}}, {}])
    def test_profile_patch_validation(self, body):
        s, _, _ = reg()
        r = s.patch(f"{V1}/users/me", json=body)
        assert r.status_code == 400 and r.json()["code"] == "VALIDATION_FAILED", r.text

    def test_profile_patch_non_object_body(self):
        s, _, _ = reg()
        r = s.patch(f"{V1}/users/me", json=["x"])
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_onboarding_flow(self):
        s, _, _ = reg()
        g = s.get(f"{V1}/users/me/onboarding").json()
        assert g["completed"] is False and {a["name"] for a in g["lifeAreaCatalog"]} == {"Work", "Health", "Relationships", "Money", "Learning", "Personal"}
        r = s.post(f"{V1}/users/me/onboarding", json={"timezone": "America/New_York", "locale": "en-US", "lifeAreaNames": ["Work", "Health"]})
        assert r.status_code == 200, r.text
        assert r.json()["onboardingCompleted"] is True and r.json()["timezone"] == "America/New_York"
        assert s.get(f"{V1}/users/me/onboarding").json()["completed"] is True

    def test_onboarding_validation(self):
        s, _, _ = reg()
        assert s.post(f"{V1}/users/me/onboarding", json={"timezone": "Nope/X", "lifeAreaNames": []}).status_code == 400
        r = s.post(f"{V1}/users/me/onboarding", json={"timezone": "UTC", "lifeAreaNames": ["Gaming"]})
        assert r.status_code == 400 and r.json()["errors"][0]["field"] == "lifeAreaNames"

    def test_account_anon_401(self):
        for m, p in [("get", "/users/me"), ("patch", "/users/me"), ("get", "/users/me/onboarding"), ("get", "/auth/sessions"), ("get", "/auth/devices")]:
            assert getattr(requests, m)(f"{V1}{p}", json={}).status_code == 401, p


# ---------- password / sessions / devices ----------
class TestSessions:
    def test_password_change_revokes_others(self):
        s1, h, _ = reg()
        s2 = requests.Session()
        assert s2.post(f"{V1}/auth/login", json={"identifier": h, "password": PW}).status_code == 200
        bad = s1.post(f"{V1}/auth/password", json={"currentPassword": "wrongwrong1", "password": "NewPass12345!"})
        assert bad.status_code == 401
        short = s1.post(f"{V1}/auth/password", json={"currentPassword": PW, "password": "short"})
        assert short.status_code == 400
        r = s1.post(f"{V1}/auth/password", json={"currentPassword": PW, "password": "NewPass12345!"})
        assert r.status_code == 204
        assert s1.get(f"{V1}/auth/me").status_code == 200
        assert s2.get(f"{V1}/auth/me").status_code == 401
        assert requests.post(f"{V1}/auth/login", json={"identifier": h, "password": "NewPass12345!"}).status_code == 200

    def test_sessions_list_revoke_and_revoke_others(self):
        s1, h, _ = reg(ua="Mozilla/5.0 (Windows NT 10.0) Chrome/120")
        s2 = requests.Session(); s2.headers["User-Agent"] = "Mozilla/5.0 (iPhone) Safari"
        s3 = requests.Session()
        s2.post(f"{V1}/auth/login", json={"identifier": h, "password": PW})
        s3.post(f"{V1}/auth/login", json={"identifier": h, "password": PW})
        items = s1.get(f"{V1}/auth/sessions").json()["items"]
        assert len(items) == 3 and sum(i["current"] for i in items) == 1
        cur = next(i for i in items if i["current"])
        assert cur["deviceName"] == "Chrome on Windows"
        s2_id = next(i["id"] for i in s2.get(f"{V1}/auth/sessions").json()["items"] if i["current"])
        assert s1.delete(f"{V1}/auth/sessions/{s2_id}").status_code == 204
        assert s2.get(f"{V1}/auth/me").status_code == 401
        assert s1.delete(f"{V1}/auth/sessions/{uuid.uuid4()}").status_code == 404
        ro = s1.post(f"{V1}/auth/sessions/revoke-others")
        assert ro.status_code == 200 and ro.json()["revoked"] == 1
        assert s3.get(f"{V1}/auth/me").status_code == 401
        assert len(s1.get(f"{V1}/auth/sessions").json()["items"]) == 1

    def test_cannot_revoke_other_users_session(self):
        a, _, _ = reg()
        b, _, _ = reg()
        b_id = b.get(f"{V1}/auth/sessions").json()["items"][0]["id"]
        assert a.delete(f"{V1}/auth/sessions/{b_id}").status_code == 404
        assert b.get(f"{V1}/auth/me").status_code == 200

    def test_devices(self):
        s, _, _ = reg(ua="Mozilla/5.0 (Macintosh; Mac OS X) Firefox/120")
        items = s.get(f"{V1}/auth/devices").json()["items"]
        assert len(items) == 1 and items[0]["platform"] == "macos" and items[0]["activeSessions"] == 1

    def test_password_reset_no_enumeration(self):
        a = requests.post(f"{V1}/auth/password-reset/request", json={"identifier": "nouser_" + uuid.uuid4().hex[:6]})
        s, h, _ = reg(email=False)  # no email -> no send
        b = requests.post(f"{V1}/auth/password-reset/request", json={"identifier": h})
        assert a.status_code == 202 and b.status_code == 202 and a.json() == b.json() == {"status": "accepted"}

    def test_reset_confirm_bad_token(self):
        r = requests.post(f"{V1}/auth/password-reset/confirm", json={"token": "bogus", "password": "NewPass12345!"})
        assert r.status_code == 400 and r.json()["code"] == "TOKEN_INVALID"

    def test_oauth_providers(self):
        r = requests.get(f"{V1}/auth/oauth/providers")
        assert r.status_code == 200 and len(r.json()["items"]) == 3


# ---------- state sync ----------
def env(marker):
    return {"version": 1, "savedAt": int(time.time() * 1000), "state": {"marker": marker}}


class TestState:
    def test_state_flow_and_conflict(self):
        s, _, _ = reg()
        assert s.get(f"{V1}/state").json() == {"envelope": None, "version": 0}
        r1 = s.put(f"{V1}/state", json={"envelope": env("A"), "baseVersion": 0})
        assert r1.status_code == 200 and r1.json()["version"] == 1
        r2 = s.put(f"{V1}/state", json={"envelope": env("B"), "baseVersion": 1})
        assert r2.json()["version"] == 2
        stale = s.put(f"{V1}/state", json={"envelope": env("C"), "baseVersion": 1})
        assert stale.status_code == 409 and stale.json()["code"] == "CONFLICT_VERSION" and stale.json()["version"] == 2
        g = s.get(f"{V1}/state").json()
        assert g["version"] == 2 and g["envelope"]["state"]["marker"] == "B"

    def test_state_isolation_and_validation(self):
        a, _, _ = reg()
        b, _, _ = reg()
        a.put(f"{V1}/state", json={"envelope": env("ONLY_A")})
        assert b.get(f"{V1}/state").json()["envelope"] is None
        assert a.put(f"{V1}/state", json={"envelope": {"foo": 1}}).status_code == 400
        assert requests.get(f"{V1}/state").status_code == 401


# ---------- digest / AI ----------
class TestDigestAI:
    def test_digest_auth_and_toggle(self):
        assert requests.get(f"{V1}/digest").status_code == 401
        assert requests.put(f"{V1}/digest", json={"enabled": True}).status_code == 401
        assert requests.post(f"{BASE_URL}/api/digest/send-now").status_code == 401
        s, h, _ = reg()
        assert s.get(f"{V1}/digest").json()["enabled"] is False
        assert s.put(f"{V1}/digest", json={"enabled": True}).json()["enabled"] is True
        assert s.get(f"{V1}/digest").json()["enabled"] is True
        s.put(f"{V1}/digest", json={"enabled": False})
        n, _, _ = reg(email=False)
        assert n.put(f"{V1}/digest", json={"enabled": True}).status_code == 400

    def test_ai_chat(self):
        assert requests.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi"}).status_code == 401
        s, _, _ = reg()
        assert s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": ""}).status_code == 400
        r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "Say hi"}, timeout=90)
        assert r.status_code == 200 and "text/event-stream" in r.headers["content-type"]
        assert "data:" in r.text
        print("AI SSE:", r.text[:300])

    def test_mailtest_send_now_once(self):
        s = requests.Session()
        assert s.post(f"{V1}/auth/login", json={"identifier": "mailtest", "password": "TestPass123!"}).status_code == 200
        r = s.post(f"{BASE_URL}/api/digest/send-now", timeout=90)
        print("SEND-NOW:", r.status_code, r.text)
        assert r.status_code == 200 and r.json()["status"] == "sent"
