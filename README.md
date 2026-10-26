# AI PersonalOS

AI PersonalOS is a local-first personal operating system for planning, capturing, focusing, and reflecting. It combines a Next.js web app, a Fastify API, and a shared TypeScript domain package so the same data model and business rules can run across web and future clients.

The product is built around one place for:

- Today, tasks, calendar, and planning
- Goals, habits, focus, and rewards
- Journal, notes, notebook, and paper
- Life memory, insights, and work mode
- Capture, search, notifications, and integrations

## Tech stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| API | Fastify 5, Zod 4, Drizzle ORM |
| Database | PostgreSQL, PGlite for tests |
| Domain | TypeScript, local-first store in `@personalos/core` |
| Testing | Vitest, Testing Library, PGlite |
| Monorepo | npm workspaces |

## Project structure

```text
.
├── apps/
│   ├── api/                  # Fastify API, auth, account, integrations
│   └── web/                  # Next.js PWA and UI
├── packages/
│   ├── api-contract/         # Shared API schemas and types
│   └── core/                 # Domain types, engines, local store
├── docs/                     # Architecture, data model, IA
├── scripts/                  # Build and asset utilities
└── package.json              # Workspace scripts
```

## Getting started

### Requirements

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL is optional for local development

### Install

```bash
git clone https://github.com/mallireddymanikyalareddy/ai-personalos.git
cd ai-personalos
npm install
```

### Run locally

Start the API:

```bash
npm run api
```

In a second terminal, start the web app:

```bash
npm run dev
```

Open:

- Web app: `http://localhost:3000`
- API health: `http://localhost:8080/healthz`

The web app proxies `/api/*` to `API_URL`, which defaults to `http://localhost:8080`.

### Database

Without `DATABASE_URL`, the API runs in development mode with in-memory auth and profile storage. This is the quickest way to try the app.

To use PostgreSQL:

```bash
export DATABASE_URL="postgres://user:password@localhost:5432/personalos"
npm run db:migrate --workspace @personalos/api
npm run api
```

On PowerShell:

```powershell
$env:DATABASE_URL="postgres://user:password@localhost:5432/personalos"
npm run db:migrate --workspace @personalos/api
npm run api
```

## Environment variables

### API

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset | PostgreSQL connection string. Unset enables in-memory dev mode. |
| `HOST` | `0.0.0.0` | API bind host |
| `PORT` | `8080` | API port |
| `APP_URL` | `http://localhost:3000` | Public web app URL used for OAuth and redirects |
| `LOG_LEVEL` | `info` | Fastify log level |
| `APP_VERSION` | `0.1.0` | Version reported by the API |
| `GOOGLE_CLIENT_ID` | empty | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | empty | Google OAuth client secret |
| `APPLE_CLIENT_ID` | empty | Apple OAuth client ID |
| `APPLE_CLIENT_SECRET` | empty | Apple OAuth client secret |
| `MICROSOFT_CLIENT_ID` | empty | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | empty | Microsoft OAuth client secret |

### Web

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_URL` | `http://localhost:8080` | API origin used by Next.js rewrites |

Secrets belong in a local `.env` file or your deployment environment. `.env` files, logs, private keys, and build output are ignored by Git.

## Features

### Planning and productivity

- Today dashboard with schedule, tasks, habits, focus, deadlines, notes, and activity
- Tasks with projects, priorities, recurrence, reminders, and bulk actions
- Calendar with day, week, month, agenda, and timeline views
- Planner with time blocks and scheduling tools
- Goals, milestones, progress tracking, and goal-linked tasks/habits
- Habit tracking with streaks, calendars, insights, and check-ins
- Focus timer with sessions, pauses, distractions, rounds, and analytics

### Knowledge and reflection

- Journal with autosave, templates, moods, tags, people, and reflection prompts
- Notes with folders, tags, search, and export
- Digital notebook with block editing and page hierarchy
- Paper workspace with templates, drawing, shapes, and export
- Life memory timeline with people, places, tags, and recall questions
- Insights with charts and summaries

### Capture and navigation

- Universal capture for tasks, notes, events, images, documents, and voice
- Inbox triage and AI-assisted capture resolution
- Command palette and global search
- Responsive sidebar, mobile navigation, and keyboard shortcuts
- PWA manifest, service worker, offline cache, and installable app shell

### Notifications

- In-app notification center with ready, waiting, and activity sections
- Journal, reflection, weekly review, streak, habit, and focus reminders
- Quiet hours and per-reminder toggles
- Browser alerts with permission handling and test notifications
- Dismiss and mark-read actions

### Account and integrations

- Registration, login, onboarding, password reset, and email verification
- Session and device management
- Account preferences synced through the API
- Integration catalog with OAuth-ready provider flows
- Calendar and note sync foundations

### AI

- Provider-agnostic AI assistant layer
- Context-aware planning, journal, goal, habit, memory, and notebook helpers
- Proposal review before applying AI-generated changes

## Scripts

Run these from the repository root.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js web app |
| `npm run api` | Start the Fastify API |
| `npm run build` | Build the web app |
| `npm start` | Start the production web build |
| `npm test` | Run all workspace tests |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run icons` | Regenerate app icons |

Workspace-specific examples:

```bash
npm test --workspace @personalos/core
npm test --workspace @personalos/web
npm run typecheck --workspace @personalos/api
```

## Data model

The canonical data model is implemented in `packages/core/src/types` and documented in:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/INFORMATION_ARCHITECTURE.md`](docs/INFORMATION_ARCHITECTURE.md)

The core store is local-first. Browser data is persisted on the device and can be cleared from Settings > Data & backups. The API currently handles account, auth, onboarding, sessions, devices, and integrations.

## PWA and offline behavior

The web app ships with:

- `manifest.webmanifest`
- installable icons
- a service worker with network-first caching
- offline fallback for previously loaded pages
- API requests always bypass the cache

The service worker is registered only in production builds so local development keeps fast refresh.

## Testing

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

API tests use PGlite and apply the real Drizzle migrations, so database changes should include a migration.

## Deployment notes

- Build the web app with `npm run build`.
- Set `API_URL` to the deployed API origin before building the web app.
- Set `DATABASE_URL` and run migrations before starting the API in production.
- Configure OAuth credentials only for the providers you enable.
- Serve the app over HTTPS so service workers and browser notifications work.

## Status

This is an actively developed project. Some surfaces are complete, while others are being expanded. The shared domain package and API contract are the source of truth for behavior and types.

## License

No license has been added to this repository yet. All rights are reserved by the repository owner.
