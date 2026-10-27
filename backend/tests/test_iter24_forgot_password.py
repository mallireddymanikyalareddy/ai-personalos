# Iteration 24: Forgot-password / reset-password flow (request + confirm) regression tests
import asyncio
import hashlib
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"
OLD_PW = "TEST_OldPass123!"
NEW_PW = "TEST_NewPass456!"


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


async def _db_op(fn):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    try:
        return await fn(client[os.environ["DB_NAME"]])
    finally:
        client.close()


def reset_tokens(user_id):
    return run(_db_op(lambda db: db.tokens.find({"user_id": user_id, "kind": "reset"}, {"_id": 0}).to_list(100)))


def insert_token(user_id, ttl=timedelta(hours=1)):
    token = secrets.token_urlsafe(32)
    doc = {"token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user_id, "kind": "reset",
           "expires_at": datetime.now(timezone.utc) + ttl, "used_at": None}
    run(_db_op(lambda db: db.tokens.insert_one(doc)))
    return token


@pytest.fixture(scope="module")
def user():
    tag = uuid.uuid4().hex[:8]
    handle = f"test_fp_{tag}"
    email = f"delivered+fp{tag}@resend.dev"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"handle": handle, "displayName": "TEST FP", "email": email, "password": OLD_PW})
    assert r.status_code == 201, r.text
    me = s.get(f"{API}/auth/me").json()
    uid = (me.get("user") or me).get("id")
    assert uid
    yield {"handle": handle, "email": email, "id": uid, "session": s}

    async def cleanup(db):
        for c in ("users", "sessions", "tokens", "app_state", "digest_prefs", "credit_accounts", "credit_ledger"):
            await db[c].delete_many({"id": uid} if c == "users" else {"user_id": uid})
    run(_db_op(cleanup))


def login(ident, pw):
    return requests.post(f"{API}/auth/login", json={"identifier": ident, "password": pw})


class TestForgotPassword:
    def test_1_request_existing_user_creates_token(self, user):
        t0 = time.time()
        r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": user["email"].upper()})
        print(f"request(existing) took {time.time() - t0:.2f}s")
        assert r.status_code == 202
        assert r.json() == {"status": "accepted"}
        toks = reset_tokens(user["id"])
        assert len(toks) == 1
        assert toks[0]["used_at"] is None
        # handle identifier also works
        r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": user["handle"]})
        assert r.status_code == 202
        assert len(reset_tokens(user["id"])) == 2

    def test_2_unknown_identifier_no_enumeration(self):
        t0 = time.time()
        r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": f"nobody_{uuid.uuid4().hex}@resend.dev"})
        print(f"request(unknown) took {time.time() - t0:.2f}s")
        assert r.status_code == 202
        assert r.json() == {"status": "accepted"}
        r = requests.post(f"{API}/auth/password-reset/request", json={})
        assert r.status_code in (400, 422)

    def test_3_rate_limit_3_per_hour(self, user):
        for _ in range(3):
            r = requests.post(f"{API}/auth/password-reset/request", json={"identifier": user["handle"]})
            assert r.status_code == 202
        assert len(reset_tokens(user["id"])) == 3  # 2 from test_1 + 1, then limited

    def test_4_confirm_validation_and_invalid_tokens(self, user):
        tok = insert_token(user["id"])
        r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": tok, "password": "short"})
        assert r.status_code == 400
        assert r.json().get("code") in ("VALIDATION_FAILED", "INVALID_REQUEST") or "password" in r.text
        # weak password must not burn the token
        doc = [t for t in reset_tokens(user["id"]) if t["token_hash"] == hashlib.sha256(tok.encode()).hexdigest()][0]
        assert doc["used_at"] is None
        r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": "bogus", "password": NEW_PW})
        assert r.status_code == 400 and r.json()["code"] == "TOKEN_INVALID"
        expired = insert_token(user["id"], ttl=timedelta(seconds=-5))
        r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": expired, "password": NEW_PW})
        assert r.status_code == 400 and r.json()["code"] == "TOKEN_INVALID"
        user["pending_token"] = tok

    def test_5_confirm_success_revokes_sessions_single_use(self, user):
        tok = user["pending_token"]
        assert user["session"].get(f"{API}/auth/me").status_code == 200
        r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": tok, "password": NEW_PW})
        assert r.status_code == 204, r.text
        assert user["session"].get(f"{API}/auth/me").status_code == 401
        assert login(user["handle"], OLD_PW).status_code == 401
        r = login(user["email"], NEW_PW)
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/password-reset/confirm", json={"token": tok, "password": "TEST_Another789!"})
        assert r.status_code == 400 and r.json()["code"] == "TOKEN_INVALID"
        # other outstanding reset tokens (from emails) remain valid after a reset
        unused = [t for t in reset_tokens(user["id"]) if t["used_at"] is None and t["expires_at"].replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)]
        print(f"outstanding unused reset tokens after successful reset: {len(unused)}")
