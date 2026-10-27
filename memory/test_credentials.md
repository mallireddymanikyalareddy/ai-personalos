# Test Credentials (MongoDB-backed Python auth, recreated after server rebuild)
- demo / DemoPass123! (email demo@personalos.app — NOT deliverable by Resend)
- mailtest / TestPass123! (email delivered+personalos@resend.dev — Resend test inbox, safe for preview email sends)
- Register: POST /api/v1/auth/register {handle, displayName, email?, password(min 10)}
- Login: POST /api/v1/auth/login {identifier (handle or email), password}; session cookie pos_session (httpOnly)
- Brute force: 5 failed logins per ip+identifier in 15 min -> 429 RATE_LIMITED
- Admin console: demo has admin_role=super_admin (set in DB; demo email is unverified and not in ADMIN_EMAILS). mailtest has no admin role (403 on /api/v1/admin/me). Do not delete.
- Admin: demo has admin_role=super_admin (set manually in preview DB only). /admin requires GET /api/v1/admin/me 200
- Real super admin: mallireddymanikyalareddy@gmail.com via ADMIN_EMAILS once that account's email is verified
