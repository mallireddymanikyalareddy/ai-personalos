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
## Backlog
- P0: user to add OpenAI credits (currently 'no credits' error)
- P1: offline edits queue indicator / sync status badge
- P2: branding consistency (LifeOS vs AI PersonalOS)
