import os

from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


async def ensure_indexes() -> None:
    await db.users.create_index("id", unique=True)
    await db.users.create_index("handle", unique=True)
    await db.users.create_index("email", unique=True, partialFilterExpression={"email": {"$type": "string"}})
    await db.users.create_index("referral_code", unique=True,
                                partialFilterExpression={"referral_code": {"$type": "string"}})
    await db.referrals.create_index("id", unique=True)
    await db.referrals.create_index("referee_id", unique=True)
    await db.referrals.create_index([("referrer_id", 1), ("created_at", -1)])
    await db.sessions.create_index("token_hash", unique=True)
    await db.sessions.create_index("user_id")
    await db.tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index([("key", 1), ("at", -1)])
    await db.login_attempts.create_index([("ident", 1), ("at", -1)])
    await db.app_state.create_index("user_id", unique=True)
    await db.digest_prefs.create_index("user_id", unique=True)
