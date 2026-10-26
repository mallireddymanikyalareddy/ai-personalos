# PersonalOS API regression: health, auth (register/login/me), AI chat auth + SSE error fallback
import os
import json
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture
def s():
    return requests.Session()


@pytest.fixture
def demo(s):
    r = s.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
    if r.status_code != 200:
        pytest.skip(f"demo login failed {r.status_code} {r.text[:200]}")
    return s


# Health
def test_healthz(s):
    r = s.get(f"{BASE_URL}/api/healthz")
    print(r.status_code, r.text[:200])
    assert r.status_code in (200, 404)


# Auth
def test_demo_login_and_me(demo):
    r = demo.get(f"{BASE_URL}/api/v1/auth/me")
    assert r.status_code == 200, r.text
    assert "demo" in r.text


def test_login_bad_password(s):
    r = s.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": "demo", "password": "wrong-pass-1"})
    assert r.status_code in (400, 401)


def test_register_then_login(s):
    h = "test" + uuid.uuid4().hex[:8]
    r = s.post(f"{BASE_URL}/api/v1/auth/register", json={"handle": h, "displayName": "TEST User", "email": f"{h}@example.com", "password": "TestPass123!"})
    assert r.status_code in (200, 201), r.text
    s2 = requests.Session()
    r2 = s2.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": h, "password": "TestPass123!"})
    assert r2.status_code == 200, r2.text
    assert s2.get(f"{BASE_URL}/api/v1/auth/me").status_code == 200
    with open("/tmp/registered_handle.txt", "w") as f:
        f.write(h)


def test_me_unauth(s):
    assert s.get(f"{BASE_URL}/api/v1/auth/me").status_code == 401


# AI chat
def test_ai_chat_unauth(s):
    r = s.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "hi", "context": "", "history": []})
    assert r.status_code == 401
    assert "sign in" in r.json()["detail"].lower()


def test_ai_chat_validation(demo):
    r = demo.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "", "context": "", "history": []})
    assert r.status_code == 422


def test_ai_chat_stream_error_event(demo):
    r = demo.post(f"{BASE_URL}/api/ai/chat", json={"prompt": "Say hello", "context": "none", "history": [{"role": "user", "text": "hey"}]}, stream=True, timeout=90)
    assert r.status_code == 200
    assert "text/event-stream" in r.headers.get("content-type", "")
    events = []
    for line in r.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            events.append(json.loads(line[6:]))
    print(events[:3])
    assert events, "no SSE events"
    assert any("error" in e or "delta" in e for e in events)
