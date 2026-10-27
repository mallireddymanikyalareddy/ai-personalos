# AI PersonalOS (LifeOS) — PRD
## Original request
Import https://github.com/mallireddymanikyalareddy/ai-personalos and get it running; real AI assistant with user's own OpenAI key (GPT 6 Luna); account data persisted permanently.
## Architecture
- apps/web: Next.js 15 (dev on :3000 via /app/frontend/package.json wrapper)
- apps/api: Fastify 5, spawned by /app/backend/server.py (FastAPI on :8001) which proxies all routes to :8080
- DB: PGlite on disk at /app/data/pglite (PGLITE_DATA_DIR, added to apps/api/src/main.ts)
- AI: POST /api/ai/chat (server.py, SSE, emergentintegrations, openai gpt-6-luna, OPENAI_API_KEY, requires login cookie)
- App data (tasks/notes/etc.) is local-first in browser localStorage (user's design)
## Done (2026-10-26)
- Repo running in preview; accounts persist across restarts
- GPT 6 Luna provider in AI assistant with streaming + fallback to local answer
- Fixed proxy cookie-jar session leak
## Done (2026-10-26, iteration 2)
- Per-account data: GET/PUT /api/v1/state (documents table, collection app_state, baseVersion 409 conflict + client per-entity merge); web lib/account-sync.ts pulls on login, debounced push, clears on logout
- Name greeting from account displayName (Today + AI chat)
- Morning briefing card on Today (GPT 6 Luna when selected, local engine otherwise; cached per day)
- ModelLabel component replaces hardcoded GPT-5 badges in 6 assistant panels
## Done (2026-10-26, iteration 3)
- Sync status badge in top bar (Saved / Syncing… / Offline / Not synced)
- Evening reflection card on Journal (GPT 6 Luna or local recap; auto after 5pm)
- Monday briefing email: opt-in in Settings > Notifications, preview send, background loop in server.py (every 15 min, Monday >=7am user tz), Emergent managed email (Resend), digest.py; Fastify /api/v1/digest + token-protected /internal/v1/digest/*
- Branding unified to PersonalOS (BrandMark component replaces LifeOS logo bitmaps; hero mockup bitmap still shows old name)
- PGlite safety: graceful child shutdown + port wait (data dir was corrupted once by concurrent processes; restored from checkpoint)
## Done (2026-10-26, iteration 4-5: deployment re-architecture)
- Backend rebuilt as pure Python FastAPI + MongoDB (backend/server.py, auth.py, db.py, digest.py); same /api/v1 contract; bcrypt + httpOnly pos_session cookie sessions; brute-force limit (ip+identifier 5/15min, identifier 20/15min; cf-connecting-ip trusted)
- Node Fastify/PGlite API (apps/api) no longer used
- Frontend static export: frontend/package.json `build` -> Next export (STATIC_EXPORT=1, distDir .next-export) copied to frontend/build; dev uses distDir .next-dev
- Notebook routes moved to /notebook/view?book=&page=
- .gitignore no longer ignores .env; frontend/.env added
## Done (2026-10-26, iterations 8-11: bug sweep)
- Settings appearance persisted via preferences; profile (name/tz/prefs) applied to local state after account sync
- Reset/verify links use APP_URL or Host (never X-Forwarded-Host); stricter onboarding + preference validation; atomic state PUT; 26MB body limit
- Onboarding draft kept in sessionStorage; testids added
- Paper orphan pages, journal placeholder, Enter-to-submit (Goals/Today), integrations 'Preparing', local AI task questions & polite prefixes
## Done (2026-10-26, iterations 12-13)
- Onboarding step 5 'First steps': first goal (suggested by life area), up to 5 starter habits, GPT 6 Luna toggle, Monday email toggle
- Skip for now -> /users/me/onboarding/skip (onboardingSkipped); Finish setup banner on Today + Settings > Profile -> /onboarding?resume=1
- Life areas: profile.lifeAreas synced to local lifeAreas (os.syncLifeAreas); Settings Life areas card; Life area select on tasks/goals; chips on rows/table/board/goal cards; Tasks life-area filter pills
- Tasks 'All Status' shows completed by default
## Admin Console + AI Credit Engine (8-stage brief, 2026-10-27)
- Plan doc: /app/docs/admin-credit-engine-plan.md
- Stage 1 done (assessment). Stage 2 done: /admin UI (10 sections) with DEMO DATA (modules/admin/demo-data.ts), role gate GET /api/v1/admin/me (backend/admin.py)
- Roles: super_admin, billing_admin, support_admin, ai_ops_admin, analyst. ADMIN_EMAILS env (mallireddymanikyalareddy@gmail.com) -> super_admin only after email verified; env roles auto-demote when removed. demo given super_admin manually in PREVIEW DB only
- Payments: Razorpay chosen (keys not yet collected)
- Next: Stage 3 schema/seeds -> Stage 4 credit engine -> Stage 5 admin APIs -> Stage 6 AI gateway -> Stage 7 subscriber UI -> Stage 8 Razorpay + tests
## Backlog
- P0: user to add OpenAI credits (currently 'no credits' error)
- P1: offline edits queue indicator / sync status badge
- P1: Tasks stats/charts respect life-area filter; Priority Breakdown empty-state mismatch
- P2: Tasks 'All status' hides done tasks; Templates empty text; AI hero icon overlap; Paper dialog Escape timing
- P2: regenerate landing hero mockup image with PersonalOS name; persistent rate limiter for preview emails

## 2026-06 — Admin Stage 3: billing database records (agent-tested, iteration_16 100%)
- backend/billing.py: indexes + one-time, audited, idempotent seeds (schema_migrations): plans + plan_versions (Basic/AI/AI Pro v1 published), ai_pricing_versions v1 (13 actions), empty credit_accounts for every user (new signups get one), credit_ledger + admin_audit collections.
- Read-only admin APIs: GET /api/v1/admin/plans, /pricing, /credits/summary (401 anon / 403 non-admin).
- /admin/plans and /admin/pricing now show LIVE records; other admin pages still DEMO data.
- Next: Stage 4 credit engine (reserve/settle/release, ledger idempotency, resets, annual bonus), then Stage 5 admin APIs/audit UI, Stage 6 AI gateway, Stage 7 subscriber UI, Stage 8 Razorpay.

## 2026-06 — Admin Stage 4: AI credit engine (agent-tested, iterations 17–18 100%)
- backend/credits.py: hold max price → settle by response size (range actions scale with output) / release on failure, cancel or disconnect (BackgroundTask) / stale sweep (10 min). Append-only ledger with available_delta/reserved_delta, idempotent requestId (409), 402 INSUFFICIENT_CREDITS, ai_usage rows (succeeded/failed/cancelled).
- 10 one-time trial credits for every account (migration stage4_trial_credits_10) and every new sign-up.
- AI chat = quick_question (1), morning briefing = daily_plan (2), evening reflection = journal_summary (2). APIs: GET /api/v1/credits, /api/v1/credits/history.
- Briefing double auto-run fixed (in-flight guard in ai-recap-card).
- The success/charge path is verified with unit tests only; the real OpenAI account has no balance, so live AI calls currently fail and return credits.
- Next: Stage 5 admin APIs (live users/credits/audit, admin grants), Stage 7 credit badge/history UI, monthly refills, Stage 8 Razorpay.
