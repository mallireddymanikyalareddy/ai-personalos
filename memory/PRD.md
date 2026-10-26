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
## Backlog
- P0: user to add OpenAI credits (currently 'no credits' error)
- P1: per-user/server sync of app data (currently browser-only, shared across accounts in same browser)
- P2: greeting displayName from profile; hardcoded "GPT-5" badges in module rails; branding consistency
