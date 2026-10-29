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
- `backend/promotions.py`: draft → active → ended campaigns, segments (`all`, `new`, `trial`, `inactive`, `low_credit`, specific users, `plan:<id>`), per-user limits, credit expiry, bulk grants with per-user idempotency, expiry sweep, coupon-code redemption and opt-in scheduled auto-grants every 6 hours.
- `backend/platform_settings.py`: persisted platform settings (model, token/request limits, spend alert, low-credit threshold, reset policy, trial length, feature flags) plus provider status derived from env presence.
- `backend/billing_admin.py`: admin APIs for subscriptions (list/detail/create/update/renew/grant/cancel/resume), promotions (CRUD/activate/end/grant), and settings (read/update). Reads allow any admin role; subscription writes allow billing/support, promotions allow billing, settings require super admin. Every write is audited.
- Public `GET /api/v1/settings/public` exposes the low-credit threshold and feature flags to the app.
- Settings are enforced: `defaultModel`, `maxInputTokens` and `maxRequestsPerMinute` drive `/api/ai/chat`; `annual_bonus_credits` controls annual plan bonuses; `promotions` gates promotional grants; `ai_confirmation_modal` adds a spend confirmation before OpenAI requests.
- `backend/alerts.py`: low-credit email when a balance falls to the configured threshold (24-hour cooldown), a Monday weekly summary with credits used and projected run-out, and a monthly admin spend alert based on charged credits × `creditValuePaise`. Users can opt out via the `notifications.creditAlerts` preference.
- `GET /api/v1/credits/forecast` exposes the run-out estimate to the credits card; the admin dashboard shows the current month's estimated AI spend against the alert threshold.
- Bulk admin tools: multi-select users for credit grants/removals and role changes (`users/bulk-credits`, `users/bulk-role`), plus CSV exports for users (all/selected), the credit ledger and the audit log. CSV cells are formula-injection sanitised.
- Admin alert center: the dashboard surfaces past-due/overdue subscriptions, stale credit holds, ledger/account mismatches and recent AI provider failures, each linking to the relevant admin page. `backend/reconciliation.py` reconciles every account against the immutable ledger hourly and stores open `reconciliation_items`.
- Usage intelligence: `backend/usage_insights.py` estimates provider cost from input/output token estimates and configurable `inputCostPaisePerMTok`/`outputCostPaisePerMTok`, breaks usage down by action and model, projects month-end spend, calculates estimated plan margins, and provides a pricing simulator (`/admin/usage/insights`, `/admin/usage/simulate`).
- Maker-checker approvals: credit changes at/above `approvalThresholdCredits` (default 1000) and all role changes require a second admin. `backend/approvals.py` stores requests; `/admin/approvals` lists/approves/rejects them. Requesters cannot approve their own requests, bulk actions are covered, and decisions are audited.
- Referrals and gifting: every account gets a unique referral code (`/api/v1/referrals`), invite links prefill `/register?ref=...`, and both sides receive configurable credits once. Users can gift up to `giftMaxCredits` to another account (`POST /api/v1/credits/gift`) with separate `gift_sent`/`gift_received` ledger entries.
- MFA and step-up: TOTP authenticator setup with one-time recovery codes, a login challenge before sessions are issued, and a 15-minute step-up window required before approving/rejecting admin requests when MFA is enabled. Settings → Security manages setup/disable.
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

## Iteration 27 — high-priority and admin/subscriber completion
- **Settled-charge refunds:** `credits.refund_usage` restores the buckets that paid the charge, supports partial refunds, is idempotent per key, never refunds twice, and writes a `refund` ledger entry. Admin endpoint `POST /admin/credits/refunds` and a refund drawer on AI Usage. Refunds at/above `approvalThresholdCredits` go through maker-checker (`credit_refund`).
- **Reconciliation-required:** a stale hold is only auto-released when the provider never started. Holds where the provider may have completed are marked `reconciliation_required` with credits still reserved. `GET /admin/credits/reconciliations` lists them; `POST /admin/credits/reconciliations/{id}/resolve` charges a confirmed amount or returns the hold. The gateway records `provider_started_at`/`output_started_at` and flags client disconnects instead of blind refunds.
- **Dashboard:** MRR/ARR (monthly-equivalent, paying subscribers only), plan distribution, recent subscription events, estimated cost per successful request, plus the existing alerts.
- **Users:** suspend/reinstate with session revocation and login blocking (`ACCOUNT_SUSPENDED`), plan/status filters, plan + subscription status columns, subscription event history in the drawer.
- **Credits page:** next reset date, refunded total, stuck-hold count, open ledger mismatches with deltas.
- **Plans:** feature entitlements, availability toggle (new subscriptions only), and a pre-publish preview diff with affected subscriber count. Changes remain prospective through plan-version pinning.
- **AI action pricing:** per-action model routing, input-token surcharge (`input_credits_per_1k`), per-action input cap and daily request limit, all enforced in `credits.reserve`. `ai_ops_admin` can write pricing (not plans or billing settings).
- **Platform settings:** support email/link/status page/hours, optional admin-wide MFA requirement, admin session policy and audit-retention targets. Public settings expose support details.
- **Subscriptions:** plan/billing change starts a fresh entitlement period, grants the new allowance exactly once, records `plan_changed` and an entitlement run, and exposes an informational proration preview. Payment status (`manual`/`paid`/`failed`/`refunded`) can be recorded; `past_due` sets `failed`.
- **Subscriber UX:** header badge shows plan and reset date in its tooltip; credits panel shows plan, next reset, allowance, annual bonus and bucket split; the AI confirmation modal shows action, estimated cost, balance, expected remaining, size limits and a shortfall/upgrade path; completed answers show credits used and remaining.

**Still blocked / outstanding**
- Automatic provider-invoice ingestion: costs can be recorded manually per request (`provider_cost_paise`), and reports prefer them, but the provider response does not return a billed amount and no invoice file is imported automatically.
- Razorpay: checkout, webhooks, payment reconciliation, real proration collection and subscription refunds remain excluded.
- Central execution gateway: real provider calls (chat, briefing, reflection) are charged server-side, and the gateway now accepts every priced action with routing/limits. Deterministic browser-side assistants (tasks, habits, journal, goals, notebook, planner) still run locally and do not pass through the server for execution. Moving them requires porting the TS core AI engine or calling it from the Python service.
- Referral rewards are now gated on email verification (see Iteration 28).
- Approval requests claimed as `processing` still need a crash-recovery sweep.
- Full LifeOS regression suite is not run; targeted unit/API checks only.

## Iteration 28 — hardening
- **Referral abuse gate:** registration now stores a `pending_referral` attribution without granting credits. Rewards are granted only after the referee confirms their email; `referrals.reward_pending` is idempotent and safe on repeated confirmations. Users without an email keep a pending attribution and receive nothing.
- **Approval crash recovery:** `approvals.release_stale_claims` returns `processing` approvals older than 10 minutes to `pending`, and `approvals.sweep_loop` runs every minute on startup. Approval decisions no longer stay stuck after a restart.
- **Plan availability enforcement:** hidden plans are rejected by `create_subscription` and subscription plan changes with `PLAN_UNAVAILABLE`, not merely hidden in the UI. Existing subscriptions and renewals are unaffected.
- **Export permissions:** user, ledger and audit CSV exports require `super_admin`, `billing_admin` or `support_admin`. The read-only `analyst` role can still read admin screens but cannot export personal data; the UI hides export controls for that role.
- **Request IDs:** an HTTP middleware assigns or accepts `X-Request-ID`, returns it on every response, and `record_audit` stores it as `request_id`. Audit CSV exports include the column and the Audit Logs table shows it.
- **Actual provider cost (manual):** usage rows accept `provider_cost_paise` via `POST /admin/usage/{id}/cost`. All cost reports and margins prefer a recorded actual cost and fall back to the token-rate estimate. The AI Usage table shows both, with a “Cost” drawer to record invoice/reconciliation amounts. Automatic provider-invoice ingestion is still not available.
- **Regression snapshot:** full web suite currently runs 762 tests; 725 pass. The 37 failures are pre-existing and confined to `today`, `settings`, `onboarding` and one stale AI provider-label assertion; admin/credit/AI-chat tests that touch this work pass.


