# Seeds a TEST_ user + a known reset token for the forgot-password UI test (prints handle,email,token)
import sys
sys.path.insert(0, "/app/backend/tests")
import requests
import uuid
import test_iter24_forgot_password as t

tag = uuid.uuid4().hex[:8]
handle, email = f"test_fpui_{tag}", f"delivered+fpui{tag}@resend.dev"
s = requests.Session()
r = s.post(f"{t.API}/auth/register", json={"handle": handle, "displayName": "TEST FPUI", "email": email, "password": t.OLD_PW})
uid = (s.get(f"{t.API}/auth/me").json().get("user") or {}).get("id") or s.get(f"{t.API}/auth/me").json().get("id")
print(handle, email, uid, t.insert_token(uid))
