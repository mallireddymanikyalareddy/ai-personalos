import random
import re
import string
import uuid

import credits
import platform_settings
from billing import now
from db import db

CODE_RE = re.compile(r"[^A-Z0-9]")


def _iso(value) -> str | None:
    if not value:
        return None
    return value.isoformat().replace("+00:00", "Z")


async def _unique_code(handle: str) -> str:
    base = CODE_RE.sub("", (handle or "FRIEND").upper())[:10] or "FRIEND"
    for _ in range(20):
        code = base + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        if not await db.users.find_one({"referral_code": code}, {"_id": 1}):
            return code
    return f"FRIEND{uuid.uuid4().hex[:8].upper()}"


async def ensure_code(user: dict) -> str:
    if user.get("referral_code"):
        return user["referral_code"]
    code = await _unique_code(user.get("handle", ""))
    await db.users.update_one({"id": user["id"], "referral_code": {"$exists": False}}, {"$set": {"referral_code": code}})
    user["referral_code"] = code
    return code


async def backfill_codes() -> dict:
    created = 0
    async for user in db.users.find({"referral_code": {"$exists": False}}, {"_id": 0, "id": 1, "handle": 1}):
        await ensure_code(user)
        created += 1
    return {"codes_created": created}


async def find_referrer(code: str) -> dict | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    return await db.users.find_one({"referral_code": code}, {"_id": 0})


async def reward(referrer: dict, referee: dict) -> dict | None:
    settings = await platform_settings.get_settings()
    if not settings["flags"].get("referrals", True):
        return None
    if referrer["id"] == referee["id"]:
        return None
    if await db.referrals.find_one({"referee_id": referee["id"]}, {"_id": 1}):
        return None
    referrer_credits = int(settings.get("referralReferrerCredits", 10))
    referee_credits = int(settings.get("referralRefereeCredits", 5))
    key = f"referral:{referee['id']}"
    if referrer_credits:
        await credits.grant(referrer["id"], referrer_credits, "referral_bonus",
                            f"Referral bonus for @{referee['handle']}", f"{key}:referrer", bucket="purchased")
    if referee_credits:
        await credits.grant(referee["id"], referee_credits, "referral_bonus",
                            "Welcome referral credits", f"{key}:referee", bucket="purchased")
    doc = {"id": f"ref_{uuid.uuid4().hex[:12]}", "referrer_id": referrer["id"],
           "referee_id": referee["id"], "code": referrer.get("referral_code"),
           "referrer_credits": referrer_credits, "referee_credits": referee_credits,
           "created_at": now()}
    await db.referrals.insert_one(dict(doc))
    await db.users.update_one({"id": referee["id"]}, {"$set": {"referred_by": referrer["id"]}})
    return doc


async def summary(user: dict) -> dict:
    code = await ensure_code(user)
    invited = await db.referrals.count_documents({"referrer_id": user["id"]})
    total = await db.referrals.aggregate([
        {"$match": {"referrer_id": user["id"]}},
        {"$group": {"_id": None, "n": {"$sum": "$referrer_credits"}}},
    ]).to_list(1)
    rows = await db.referrals.find({"referrer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    handles = {u["id"]: u["handle"] async for u in db.users.find(
        {"id": {"$in": [r["referee_id"] for r in rows]}}, {"_id": 0, "id": 1, "handle": 1})}
    return {"code": code, "invited": invited,
            "creditsEarned": total[0]["n"] if total else 0,
            "recent": [{"handle": handles.get(r["referee_id"], "—"), "credits": r.get("referrer_credits", 0),
                        "createdAt": _iso(r.get("created_at"))} for r in rows]}
