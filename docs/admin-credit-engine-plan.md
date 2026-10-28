# Admin Console + AI Credit Engine — Stage 1 Assessment & Plan

## Current architecture (as inspected)
- **Frontend:** Next.js 15 (App Router) in `apps/web`. It is built as a static export (`STATIC_EXPORT=1` → `frontend/build`) and served as plain files. Design system: `apps/web/src/components/ui/*` with Tailwind tokens (`bg-surface`, `text-ink`, `border-line`, `accent`); charts use `recharts`.
- **Local-first app data:** tasks, notes, journal and the other modules live in the browser store (`packages/core`). Each user's data is synced as one copy per account via `PUT /api/v1/state` (`app_state` collection).
- **Backend:** Python FastAPI (`backend/server.py`, `auth.py`, `admin.py`, `digest.py`, `db.py`) on MongoDB (motor). Every route is under `/api`. The legacy Node API (`apps/api`) is **unused**.
- **Auth:** custom bcrypt password login with an httpOnly `pos_session` cookie (`sessions` collection), brute-force limits, and password reset / email verification links.
- **AI:** `POST /api/ai/chat` (GPT 6 Luna through emergentintegrations, user's `OPENAI_API_KEY`) is used by the AI chat, morning briefing and evening reflection. There are no credits or metering yet. The local rule-based assistant runs in the browser.
- **Email:** Emergent-managed Resend (`digest.py`), used for the Monday briefing and account links.
- **Payments/subscriptions:** none exist. Razorpay was chosen; its keys have not been collected yet.

## Reuse
`users` (+ new `admin_role` field), `sessions`, `require_auth`, the `ApiError` problem format, `digest.send_email`, the `/api/ai/chat` streaming code (to be wrapped by the gateway), and the UI kit.

## Risks
- The AI endpoints are currently free. The gateway must sit in front of `/api/ai/chat` without breaking the briefing/recap cards.
- MongoDB has no SQL transactions on a standalone node. The ledger will use **atomic conditional updates** (`find_one_and_update` with balance guards) plus unique idempotency-key indexes. Multi-document transactions will be used if Atlas replica sets allow them.
- The live database is separate from preview, so admin roles must be granted per environment.

## Data model (MongoDB, additive only — no existing collection is changed destructively)
`plans` (versioned) · `plan_versions` · `subscriptions` · `subscription_events` · `credit_accounts` · `credit_ledger` (immutable, unique `idempotency_key`) · `credit_reservations` · `ai_pricing_versions` (draft/published, effective_at) · `ai_usage` · `promotions` · `promotion_grants` · `admin_audit` (append-only) · `payment_webhook_events` (unique provider event id) · `entitlement_runs` · `reconciliation_items`.
Money is stored in integer paise and credits as integers. Indexes are created by `ensure_indexes()`; seeds are idempotent upserts.

## Roles
`super_admin`, `billing_admin`, `support_admin`, `ai_ops_admin`, `analyst`, enforced server-side by `admin.require_role(...)`.
The initial Super Admin comes from the `ADMIN_EMAILS` environment setting and is granted **only after that email is verified**.

## Stages
1. Inspection & plan (this document) ✅
2. Admin Console UI with clearly labelled demonstration data ✅
3. Schema, indexes and seed plans/pricing ✅
4. Credit engine: entitlements, reserve → settle/release, ledger, idempotency, resets, annual bonus ✅
5. Admin APIs and permissions (replacing the demo data) plus audit logging ✅
6. AI gateway: route `/api/ai/chat`, briefing, recap and future actions through reserve/settle; mock provider for tests ✅
7. Subscriber UI: credit badge, details panel, confirmation modal, low-credit states ✅
8. Razorpay test-mode adapter, webhooks (signature verification, dedupe), concurrency and reconciliation tests — pending (excluded for now; subscriptions are admin-managed)

## Stage 4/5/7 completion — plans, subscriptions, promotions and settings
- `backend/entitlements.py`: subscriptions pinned to a plan version, monthly/annual periods, trial → expired, renewal sweep every 5 minutes, idempotent `entitlement_runs`, exact monthly included-credit reset (unused included credits expire), annual plans grant `annual_monthly_credits` (base + annual bonus). All grants use the immutable ledger.
- Credit accounts track `included`, `promotional` and `purchased` buckets. Reservations hold and refund the same buckets (promotional → included → purchased), so resets, expiry and admin removals are exact; a one-time startup migration backfills older accounts.
- `backend/promotions.py`: draft → active → ended campaigns, eligibility (`all` or `plan:<id>`), per-user limits, credit expiry, bulk grants with per-user idempotency, expiry sweep.
- `backend/platform_settings.py`: persisted platform settings (model, token/request limits, spend alert, low-credit threshold, reset policy, trial length, feature flags) plus provider status derived from env presence.
- `backend/billing_admin.py`: admin APIs for subscriptions (list/detail/create/update/renew/grant/cancel/resume), promotions (CRUD/activate/end/grant), and settings (read/update). Reads allow any admin role; subscription writes allow billing/support, promotions allow billing, settings require super admin. Every write is audited.
- Public `GET /api/v1/settings/public` exposes the low-credit threshold and feature flags to the app.
- Settings are enforced: `defaultModel`, `maxInputTokens` and `maxRequestsPerMinute` drive `/api/ai/chat`; `annual_bonus_credits` controls annual plan bonuses; `promotions` gates promotional grants; `ai_confirmation_modal` adds a spend confirmation before OpenAI requests.
- Admin UI: Subscriptions, Promotions & Grants and Platform Settings are now live (no demo data); the subscriber low-credit threshold and optional AI-spend confirmation modal read platform settings.
- Razorpay remains the only outstanding stage: no card/UPI checkout, payment webhooks or payment reconciliation yet.

## Stage 3 database setup (done) — `backend/billing.py`
Runs on server start via `setup_billing()`:
- Indexes for `plans`, `plan_versions`, `credit_accounts`, `credit_ledger` (unique `id` and `idempotency_key`), `ai_pricing_versions`, `admin_audit`, `schema_migrations`.
- One-time steps tracked in `schema_migrations` (`stage3_seed_plans_v1`, `stage3_seed_ai_pricing_v1`, `stage3_backfill_credit_accounts`); each is logged to `admin_audit` with actor `system`.
- Seeds use `$setOnInsert`, so restarts never overwrite records an admin edits later.
- Every account has a `credit_accounts` row starting at 0; new registrations get one automatically. The ledger starts empty.
- Read-only admin APIs: `GET /api/v1/admin/plans`, `/pricing`, `/credits/summary`.

## Stage 4 credit engine (done) — `backend/credits.py`
- Every account got 10 one-time trial credits (`stage4_trial_credits_10`, ledger key `trial:<user>`); new sign-ups get them on registration.
- `/api/ai/chat` takes `action` (`quick_question` 1, `daily_plan` 2 for the morning briefing, `journal_summary` 2 for the evening reflection) and a `requestId`. It holds the action's maximum price before calling the AI. On success it charges by response size (range actions scale with output length) and returns the rest. On failure or cancellation it returns everything. Not enough credits gives a 402 `INSUFFICIENT_CREDITS`; a reused requestId gives a 409.
- Ledger entries carry `available_delta` / `reserved_delta`; their sums always equal the account balance. Holds left open more than 10 minutes are released by a background sweep. Each request is logged in `ai_usage`.
- User APIs: `GET /api/v1/credits`, `GET /api/v1/credits/history`.

## Backup & recovery
Take an Atlas snapshot before publishing. All Stage 3 changes are additive: existing collections (`users`, `app_state`, …) are untouched. To roll back, deploy the previous build and drop the new collections listed above; to re-run a seed, delete its `schema_migrations` key and restart.
