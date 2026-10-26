# Iteration 7: regression for refactor of auth.patch_profile/post_onboarding, digest helpers, server digest loop
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
V1 = f"{BASE_URL}/api/v1"
sys.path.insert(0, "/app/backend")


def _session(ident="demo", pw="DemoPass123!"):
    s = requests.Session()
    r = s.post(f"{V1}/auth/login", json={"identifier": ident, "password": pw})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def fresh():
    h = f"test_rf_{uuid.uuid4().hex[:8]}"
    s = requests.Session()
    r = s.post(f"{V1}/auth/register", json={"handle": h, "displayName": "RF User", "password": "GoodPass1234!"})
    assert r.status_code == 201, r.text
    return s


def _field(r):
    return [e["field"] for e in r.json().get("errors", [])]


# ---- PATCH /users/me
class TestPatchProfile:
    def test_display_name_valid_and_persist(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"displayName": "  TEST Name  "})
        assert r.status_code == 200 and r.json()["displayName"] == "TEST Name"
        assert fresh.get(f"{V1}/users/me").json()["displayName"] == "TEST Name"

    @pytest.mark.parametrize("val", ["", "   ", "x" * 65, 123])
    def test_display_name_invalid(self, fresh, val):
        r = fresh.patch(f"{V1}/users/me", json={"displayName": val})
        assert r.status_code == 400 and _field(r) == ["displayName"]

    def test_display_name_64_ok(self, fresh):
        assert fresh.patch(f"{V1}/users/me", json={"displayName": "y" * 64}).status_code == 200

    def test_timezone(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"timezone": "Europe/Berlin"})
        assert r.status_code == 200 and r.json()["timezone"] == "Europe/Berlin"
        r = fresh.patch(f"{V1}/users/me", json={"timezone": "Mars/Base"})
        assert r.status_code == 400 and _field(r) == ["timezone"]
        assert fresh.get(f"{V1}/users/me").json()["timezone"] == "Europe/Berlin"

    def test_locale(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"locale": "de-DE" + "z" * 50})
        assert r.status_code == 200 and r.json()["locale"] == ("de-DE" + "z" * 50)[:35]

    def test_avatar(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"avatarUrl": "https://example.com/a.png"})
        assert r.status_code == 200 and r.json()["avatarUrl"] == "https://example.com/a.png"
        r = fresh.patch(f"{V1}/users/me", json={"avatarUrl": "data:image/png;base64,AAAA"})
        assert r.status_code == 200 and r.json()["avatarUrl"].startswith("data:image/")
        r = fresh.patch(f"{V1}/users/me", json={"avatarUrl": "http://example.com/a.png"})
        assert r.status_code == 400 and _field(r) == ["avatarUrl"]
        r = fresh.patch(f"{V1}/users/me", json={"avatarUrl": None, "locale": "en"})
        assert r.status_code == 200 and r.json()["avatarUrl"] is None

    def test_preferences_deep_merge(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"preferences": {"theme": "dark", "workingHours": {"start": "08:30"}}})
        assert r.status_code == 200
        p = r.json()["preferences"]
        assert p["theme"] == "dark" and p["workingHours"]["start"] == "08:30" and p["workingHours"]["end"] == "17:00"
        r = fresh.patch(f"{V1}/users/me", json={"preferences": {"notifications": {"aiInsights": False}}})
        p = r.json()["preferences"]
        assert p["theme"] == "dark" and p["workingHours"]["start"] == "08:30" and p["notifications"]["aiInsights"] is False

    def test_preferences_invalid(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json={"preferences": {"theme": "neon"}})
        assert r.status_code == 400 and _field(r) == ["preferences.theme"]
        r = fresh.patch(f"{V1}/users/me", json={"preferences": {"sleepSchedule": {"bedtime": "25:00"}}})
        assert r.status_code == 400 and _field(r) == ["preferences.sleepSchedule.bedtime"]

    @pytest.mark.parametrize("body", [{}, {"displayName": None, "timezone": None}])
    def test_empty_or_all_null(self, fresh, body):
        r = fresh.patch(f"{V1}/users/me", json=body)
        assert r.status_code == 400 and _field(r) == ["(root)"]

    def test_non_object_body(self, fresh):
        r = fresh.patch(f"{V1}/users/me", json=["x"])
        assert r.status_code == 400

    def test_unauth(self):
        assert requests.patch(f"{V1}/users/me", json={"displayName": "x"}).status_code == 401


# ---- POST /users/me/onboarding
class TestOnboarding:
    def test_bad_timezone(self, fresh):
        r = fresh.post(f"{V1}/users/me/onboarding", json={"timezone": "Mars/Base"})
        assert r.status_code == 400 and _field(r) == ["timezone"]

    def test_unknown_life_area(self, fresh):
        r = fresh.post(f"{V1}/users/me/onboarding", json={"timezone": "UTC", "lifeAreaNames": ["Work", "Space"]})
        assert r.status_code == 400 and _field(r) == ["lifeAreaNames"] and "Space" in r.json()["errors"][0]["issue"]
        assert fresh.get(f"{V1}/users/me/onboarding").json()["completed"] is False

    def test_valid_without_display_name(self, fresh):
        before = fresh.get(f"{V1}/users/me").json()["displayName"]
        r = fresh.post(f"{V1}/users/me/onboarding", json={"timezone": "America/New_York", "lifeAreaNames": ["Work", "Health"],
                                                         "preferences": {"theme": "light"}})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["onboardingCompleted"] is True and d["timezone"] == "America/New_York" and d["displayName"] == before
        assert d["preferences"]["theme"] == "light" and d["preferences"]["workingHours"]["start"] == "08:30"
        assert fresh.get(f"{V1}/users/me/onboarding").json()["completed"] is True

    def test_valid_with_display_name(self, fresh):
        r = fresh.post(f"{V1}/users/me/onboarding", json={"timezone": "UTC", "displayName": "TEST Onb"})
        assert r.status_code == 200 and r.json()["displayName"] == "TEST Onb"


# ---- digest helpers (pure unit; no email sending)
import digest  # noqa: E402

NOW = datetime(2026, 1, 12, 9, 0, tzinfo=timezone.utc)
MS = NOW.timestamp() * 1000
DAY = 86_400_000


def test_collect():
    env = {"state": {
        "tasks": {
            "a": {"title": "old", "status": "todo", "dueAt": MS - 2 * DAY},
            "b": {"title": "older", "status": "todo", "dueAt": MS - 5 * DAY},
            "c": {"title": "soon", "status": "todo", "dueAt": MS + DAY},
            "d": {"title": "later", "status": "todo", "dueAt": MS + 20 * DAY},
            "e": {"title": "done", "status": "done", "dueAt": MS - DAY},
            "f": {"title": "cancel", "status": "cancelled", "dueAt": MS + DAY},
            "g": {"title": "nodue", "status": "todo"},
            "h": "garbage",
        },
        "goals": {"g1": {"title": "G", "status": "active"}, "g2": {"title": "X", "status": "completed"}},
        "habits": {"h1": {"title": "H"}, "h2": {"title": "Arch", "archivedAt": 1}},
    }}
    out = digest._collect(env, NOW)
    assert [t["title"] for t in out["overdue"]] == ["older", "old"]
    assert [t["title"] for t in out["due_week"]] == ["soon"]
    assert out["open_count"] == 5
    assert [g["title"] for g in out["goals"]] == ["G"]
    assert [h["title"] for h in out["habits"]] == ["H"]
    assert digest._collect(None, NOW) == {"overdue": [], "due_week": [], "open_count": 0, "goals": [], "habits": []}


@pytest.mark.parametrize("html", [
    "<form action='https://x.com'></form>",
    "<a href='http://example.com'>x</a>",
    "<a href='https://bit.ly/abc'>x</a>",
    "<a href='https://evil.com'>paypal.com</a>",
    "<p>Please send your password</p>",
    "<img src='https://1.2.3.4/a.png'>",
])
def test_assert_safe_email_rejects(html):
    with pytest.raises(ValueError):
        digest._assert_safe_email("Subject", html)


def test_assert_safe_email_subject_cred_ask():
    with pytest.raises(ValueError):
        digest._assert_safe_email("Reply with your password", "<p>hi</p>")


def test_assert_safe_email_accepts_build_email(monkeypatch):
    monkeypatch.setenv("EMAIL_FROM_NAME", "PersonalOS")
    monkeypatch.setenv("APP_URL", "https://app.personalos.app")
    data = digest._collect({"state": {"tasks": {"a": {"title": "T <b>", "status": "todo", "dueAt": MS + DAY}},
                                      "goals": {"g": {"title": "G", "status": "active", "progress": 40}}}}, NOW)
    subject, html = digest.build_email("Demo", data, "- do x\nGo!", "Jan 12")
    digest._assert_safe_email(subject, html)
    assert "app.personalos.app/today" in html
    digest._assert_safe_email(*digest.build_email("Demo", data, None, "Jan 12"))


# ---- server digest pass (monkeypatched, no real email)
import server  # noqa: E402
from db import db  # noqa: E402


_LOOP = asyncio.new_event_loop()


def _run(coro):
    return _LOOP.run_until_complete(coro)


def test_claim_digest_week_none_cases(monkeypatch):
    async def go():
        assert await server.claim_digest_week(None) is None
        assert await server.claim_digest_week({"id": "x", "email": None}) is None
        # Tuesday
        monkeypatch.setattr(digest, "local_now", lambda tz: datetime(2026, 1, 13, 9, 0, tzinfo=ZoneInfo("UTC")))
        assert await server.claim_digest_week({"id": "x", "email": "a@b.co", "timezone": "UTC"}) is None
        # Monday 6am
        monkeypatch.setattr(digest, "local_now", lambda tz: datetime(2026, 1, 12, 6, 59, tzinfo=ZoneInfo("UTC")))
        assert await server.claim_digest_week({"id": "x", "email": "a@b.co", "timezone": "UTC"}) is None
    _run(go())


def test_claim_digest_week_claims_once(monkeypatch):
    uid = f"TEST_digest_{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(digest, "local_now", lambda tz: datetime(2026, 1, 12, 8, 0, tzinfo=ZoneInfo("UTC")))

    async def go():
        await db.digest_prefs.insert_one({"user_id": uid, "enabled": True, "last_sent_week": None})
        try:
            user = {"id": uid, "email": "a@b.co", "timezone": "UTC"}
            assert await server.claim_digest_week(user) == "2026-W03"
            assert await server.claim_digest_week(user) is None
        finally:
            await db.digest_prefs.delete_many({"user_id": uid})
    _run(go())


def test_run_digest_pass_no_real_send(monkeypatch):
    sent = []

    async def fake_send(item):
        sent.append(item["id"])

    monkeypatch.setattr(digest, "send_digest", fake_send)
    # Not Monday -> pass completes, nothing sent, no claims mutated
    monkeypatch.setattr(digest, "local_now", lambda tz: datetime(2026, 1, 13, 9, 0, tzinfo=ZoneInfo("UTC")))

    async def go():
        await server.run_digest_pass()
    _run(go())
    assert sent == []


def test_send_weekly_digest_billing_pauses(monkeypatch):
    async def boom(item):
        raise digest.EmailUnavailable("insufficient_credits")

    async def fake_item(user):
        return {"id": user["id"]}

    monkeypatch.setattr(digest, "send_digest", boom)
    monkeypatch.setattr(server, "digest_item", fake_item)
    uid = f"TEST_digest_{uuid.uuid4().hex[:8]}"

    async def go():
        await db.digest_prefs.insert_one({"user_id": uid, "enabled": True, "last_sent_week": "2026-W03"})
        try:
            assert await server.send_weekly_digest({"id": uid}, "2026-W02") is False
            doc = await db.digest_prefs.find_one({"user_id": uid})
            assert doc["last_sent_week"] == "2026-W02"
        finally:
            await db.digest_prefs.delete_many({"user_id": uid})
    _run(go())
