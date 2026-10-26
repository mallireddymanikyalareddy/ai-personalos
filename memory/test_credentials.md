# Test Credentials
- Login (handle or email): demo / demo@personalos.app
- Password: DemoPass123!
- Register API: POST /api/v1/auth/register {handle, displayName, email, password}
- Login API: POST /api/v1/auth/login {identifier, password}
- Extra test users created by testing agent use password TestPass123! (e.g. Alice Tester)
- Email-deliverable test user: mailtest / TestPass123! (email delivered+personalos@resend.dev — Resend test inbox, safe for "Send me a preview now")
- Note: demo@personalos.app is NOT deliverable (Resend returns undeliverable_recipient)
