# Iteration 19 cleanup helper: restore mailtest to 10 available, remove tests19* throwaway users
import os
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/v1"
_env = dotenv_values("/app/backend/.env")
DB = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]

s = requests.Session()
s.post(f"{API}/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
mt = DB.users.find_one({"handle": "mailtest"})
avail = DB.credit_accounts.find_one({"user_id": mt["id"]})["available"]
if avail != 10:
    r = s.post(f"{API}/admin/users/{mt['id']}/credits",
               json={"amount": 10 - avail, "reason": "restore mailtest after iteration 19", "requestId": f"restore{uuid.uuid4().hex[:10]}"})
    print("restore", r.status_code, r.json())
print("mailtest", DB.credit_accounts.find_one({"user_id": mt["id"]}, {"_id": 0, "available": 1, "reserved": 1}), "role", mt.get("admin_role"))
for u in DB.users.find({"handle": {"$regex": "^tests19"}}):
    for c in ("credit_accounts", "credit_ledger", "credit_reservations", "ai_usage", "sessions", "app_state"):
        DB[c].delete_many({"user_id": u["id"]})
    DB.users.delete_one({"id": u["id"]})
    print("purged", u["handle"])
print("non-demo admins", [(u["handle"], u["admin_role"]) for u in DB.users.find({"admin_role": {"$exists": True}})])
