# Production Technical Architecture - AI PersonalOS

Stage 4 (architecture) deliverable. This document defines the complete production system:
frontend (web / mobile / tablet), backend, data, API, security, sync, AI, and operations —
built on Stage 0-3 foundations.

Companion documents:

- `docs/DATA_MODEL.md` - canonical entities, relations, sync classes, permission matrix.
- `docs/INFORMATION_ARCHITECTURE.md` - routes, surfaces, keyboard contract (clients must
  implement the same navigation model on every platform).
- Code mirror: `packages/core` (domain), `apps/web` (web client).

Scope: architecture and standards only. No feature behavior is added here; each rule below is
enforced by the stage that implements it.

---

## 1. Principles and decisions at a glance

Standing priority: **product coherence > UX > data integrity > security > performance >
maintainability > features.** Architecture choices follow from it.

| Area | Decision | Rejected alternative | Why |
|---|---|---|---|
| System shape | **Modular monolith** (`api`) + separate **worker** process, shared domain packages | Microservices | Team-scale operability; modules give boundaries without network failure modes; split later along the same module seams if ever needed |
| Language | **TypeScript everywhere** (client, API, workers, shared domain) | Polyglot | One type system from UI to DB; `@personalos/core` runs on all platforms |
| Client data | **Local-first**: device database is the primary UI source; sync is background reconciliation | Cloud-first request/response | Offline operation and instant UI are requirements; local-first makes them structural, not bolted on |
| Primary DB | **PostgreSQL 16** (document envelope per entity + relational control tables) | Table-per-entity DDL; Mongo | 42 collections evolve migration-free (Data Model §7) while keeping transactions, SQL, RLS, FTS, pgvector |
| Entity storage | `documents` table: `(collection, id, owner_id, workspace_id, version, updated_at, deleted_at, scope, document jsonb)` | EAV columns / JSON blobs per table | One code path for all collections; sync and audit key off the shared columns |
| Realtime | **SSE notification channel + pull-based deltas** (never push payloads over the socket) | WebSocket CRDT replication | Simple, reconnect-safe, proxies well; payload travels over normal authenticated HTTP |
| Sync | Server-assigned monotonic `seq` cursor; per-entity `version`; field-set LWW per sync class (Data Model §1.5) | CRDT (Yjs) everywhere; last-write-wins whole record | CRDTs only where collaborative text is introduced (Page body, later); field-set LWW matches the existing `sync` trait |
| API style | **REST + JSON, `/api/v1`**, OpenAPI 3.1 contract, cursor pagination, RFC 9457 errors | GraphQL | Cacheable, offline-friendly, easy contract tests; graph needs are served by client-side indexes |
| Search | **Postgres FTS (+ `pg_trgm`)** behind a `SearchPort`; SQLite FTS5 on device | Typesense/Elastic from day one | One system to operate; port keeps the swap option open |
| Vector search | **pgvector (HNSW)** with mandatory owner/workspace filter in every query | Separate vector DB | Scale envelope fits; tenancy filter is trivial to enforce in SQL |
| AI | **AI gateway** module: provider abstraction, streaming, budgets, refs-only context (Data Model §1.4 "System AI" row) | Direct provider calls from UI | One place for cost, guardrails, evals, provider swap; UI never holds provider keys |
| Jobs/queues | **BullMQ (Redis)**; transactional **outbox** for domain events | CDC/Debezium, Kafka | At-least-once with idempotent consumers is sufficient; outbox guarantees no lost events |
| Object storage | **S3-compatible** (R2/Spaces/MinIO), presigned uploads, signed downloads | Filesystem on API host | Horizontal scale, lifecycle rules, CDN-compatible |
| AuthN | Session cookie (web) + rotating access/refresh tokens (mobile); **passkeys primary**, email/password Argon2id, OAuth, magic link | Session-only | Every client + background jobs need standards-based auth |
| AuthZ | Shared policy engine `can(actor, action, resource)` in `@personalos/core` (client for affordances, server authoritative) + Postgres RLS as defense-in-depth | Ad-hoc checks in routes | One rule table, identical on all clients, testable in isolation |
| Analytics | First-party event pipeline (allowlisted props), PostHog self-hosted for product funnels; personal Insights computed from domain data only | Third-party pixels | Personal-data sensitivity; no external trackers on user content |
| Offline DB | **SQLite** on every platform (WASM+OPFS web, native mobile) with one schema: `documents` + `outbox` + FTS5 | IndexedDB ad-hoc | Identical queries offline/online; single `LocalRepository` port |
| Monorepo | npm workspaces: `apps/*` (deployables) + `packages/*` (libraries) | Multi-repo | Atomic cross-cutting changes; existing layout already proven (Stage 0) |

---

## 2. System overview

```
                      ┌─────────────────────────────────────────────┐
   Web (Next.js PWA)  │  Clients - local-first                     │
   Mobile (Expo RN)   │  UI → Application services → Domain (core) │
   Tablet (both)      │  LocalRepository(SQLite) + Outbox           │
                      └──────────────┬──────────────────────────────┘
                                     │ HTTPS: REST + SSE   (ETag/seq, idempotency keys)
                      ┌──────────────▼──────────────────────────────┐
                      │ api  (Fastify modular monolith)            │
                      │  auth │ sync │ domain modules │ search │ ai │
                      │  policy engine (shared with clients)       │
                      └───┬─────────┬──────────┬───────────┬────────┘
                          │         │          │           │
              ┌───────────▼──┐ ┌────▼─────┐ ┌──▼──────┐ ┌──▼────────────┐
              │ PostgreSQL   │ │ Redis    │ │ S3      │ │ worker        │
              │ documents,   │ │ cache,   │ │ files,  │ │ outbox relay, │
              │ control tbls,│ │ queues,  │ │ thumbs  │ │ search, embed,│
              │ FTS, pgvector│ │ ratelimit│ │         │ │ notify, AI,   │
              └──────────────┘ │ pub/sub  │ │         │ │ integrations  │
                              └──────────┘ └─────────┘ └──┬────────────┘
                                                         │
                              ┌────────────────────────────▼───────────┐
                              │ External: LLM providers, APNs/FCM,     │
                              │ Web Push, email, Google/Apple CalDAV,  │
                              │ OAuth IdPs, Sentry, OTel collector     │
                              └────────────────────────────────────────┘
```

Processes: `apps/web` (Edge/Node), `apps/api` (stateless, horizontal), `apps/worker`
(queue consumers; scalable independently), `apps/scheduler` (cron entrypoint for delayed
jobs/reminders; can live in worker as a queue repeatable). Local development = one
`docker compose` (Postgres, Redis, MinIO, Mailpit).

---

## 3. Modular boundaries

### 3.1 The six layers

| Layer | Owns | May depend on | Must never do | Lives in |
|---|---|---|---|---|
| **UI** | Rendering, interaction, navigation, accessibility, optimistic display | Application services (via hooks), design system, domain *types* | Import data-access adapters, SQL, HTTP clients, provider SDKs; contain business rules | `apps/*/src/components|screens`, `apps/web/src/components` |
| **Application services** | Use-case orchestration (`captureInbox`, `completeTask`, `shareEntity`): transaction boundary, policy call, event emission, port invocation | Domain, ports (interfaces), policy engine | Render, talk to a concrete DB/provider directly, hold framework types (Next/RN/Fastify) | `packages/core/src/services/*` (shared) + `apps/api/src/modules/*/services` (server-side orchestration) |
| **Domain logic** | Entities, invariants, engines (task engine, capture parser, date utils, relation rules, indexes), domain events | Nothing (pure, zero I/O) | Import Node/DOM/network/DB; know about HTTP or SQLite | `packages/core/src/{types,engines,schema,store}` |
| **Data access** | Repository **ports** (interfaces) + adapters: SQLite (device), API client → HTTP (device), Drizzle/Postgres (server), memory (tests) | Domain types, storage primitives | Leak SQL/HTTP into application services; be imported by UI components | ports: `packages/core/src/repo/*`; adapters: `apps/*/src/adapters/*`, `apps/api/src/modules/*/repo` |
| **External integrations** | Google/Apple calendar, OAuth IdPs, email, push providers, webhook receivers | Application services (through ports), domain mappers | Be called from UI; mutate domain state directly (must emit through application services) | `apps/api/src/modules/integrations/{providers}` behind `IntegrationPort` |
| **AI services** | Gateway, RAG, prompt templates, tools, evals, usage accounting | Application services via **tool registry**, `SearchPort`, `EmbeddingPort`; provider SDKs behind `LLMProvider` port | Be called directly from UI; read data outside explicit `refs` (no ambient authority, Data Model §1.4); write anything except `AI*` collections | `apps/api/src/modules/ai/*`, prompts in `packages/prompts` |

### 3.2 Dependency rule

Arrows point inward only:

```
UI  ──►  Application services  ──►  Domain  ◄──  Data-access / integration / AI adapters
                ▲                                            │
                └──────────── composition root (wiring) ◄─────┘
```

- The composition root (web: `src/store/os.ts` + adapter bootstrap; api: `apps/api/src/main.ts`
  module registry) is the only place that knows concrete adapters.
- Enforcement: ESLint `no-restricted-paths` per app (components cannot import `adapters/**` or
  `**/repo/**`), `dependency-cruiser` rules in CI, package-level boundaries via workspace
  exports. A violation fails the build, not code review.
- Every port (`LocalRepository`, `RemoteRepository`, `SearchPort`, `LLMProvider`,
  `PushChannel`, `CalendarProvider`, `Clock`, `IdGenerator`) has at least two implementations
  (real + in-memory) - that is what makes domains independently testable.

### 3.3 Domain modules (backend)

One module = one bounded context = own tables, own events, own tests. No cross-module table
reads; cross-module flows go through published events or an exported service interface.

| Module | Collections owned | Key events published |
|---|---|---|
| `identity` | users, sessions, devices | `user.created`, `device.registered`, `auth.failed` |
| `workspace` | workspaces, teams, members, shares | `member.added`, `role.changed`, `share.revoked` |
| `planning` | tasks, projects, milestones, goals, templates | `task.completed`, `goal.progressed` |
| `calendar` | events, calendars, timeBlocks, shifts | `event.moved`, `conflict.detected` |
| `knowledge` | notes, notebooks, pages, documents, recordings, transcripts | `note.updated`, `page.content.changed` |
| `memory` | journalEntries, lifeMemories, achievements, xpTransactions, rewards, focusSessions | `memory.recorded`, `xp.awarded` |
| `habits` | habits, habitCheckins, routines, lifeAreas | `checkin.logged`, `streak.broken` |
| `capture` | inbox items → routes to owning modules | `captured`, `inbox.triaged` |
| `reminders` | reminders, notifications (delivery rows) | `notification.delivered`, `reminder.fired` |
| `files` | attachments | `file.uploaded`, `file.scanned`, `thumbnail.ready` |
| `search` | search_index (projection) | `search.reindexed` |
| `ai` | aiConversations, aiMessages, aiInsights, aiObjects | `ai.suggestion.accepted`, `ai.usage.recorded` |
| `sync` | change_log, sync_state | `sync.applied`, `sync.conflict` |
| `integrations` | integrations | `integration.connected`, `calendar.synced` |
| `analytics` | analytics_events | (terminal consumer) |
| `audit` | audit_log | (terminal consumer) |

Modules map 1:1 to test suites (§22) and to the IA route owners (`docs/INFORMATION_ARCHITECTURE.md` §3).

---

## 4. Repository structure (target)

```
apps/
  web/            Next.js 15 PWA (exists)        - responsive web + tablet browser
  mobile/         Expo / React Native            - iOS + Android phones & tablets
  api/            Fastify modular monolith       - /api/v1, SSE
  worker/         BullMQ consumers               - jobs, outbox relay
  scheduler/      repeatable jobs (reminders, digests, sync sweeps)
packages/
  core/           domain: types, engines, schema, store, services, repo ports,
                  policy engine, sync protocol types, validation schemas (zod)
  design-tokens/  tokens as TS + CSS vars + RN theme (single source for all UI)
  ui-web/         (extracted later from apps/web/src/components)
  ui-native/      RN primitives implementing the same component contracts
  prompts/        versioned prompt templates + eval fixtures
  api-contract/   OpenAPI 3.1 spec, error-code registry, generated client types
  config/         shared tsconfig/eslint/vitest presets
scripts/          icon generation, codegen, migration helpers (exists)
docs/             INFORMATION_ARCHITECTURE, DATA_MODEL, ARCHITECTURE (this file)
```

Rules: apps may import packages, never another app; `core` is imported by every process and
runs in browser, React Native, and Node (no platform globals without guards - verified by a
`core` test that imports it under jsdom and Node).

---

## 5. Frontend architecture

### 5.1 Shared spine (all platforms)

```
UI components/screens
   → hooks (useOS selectors, already useSyncExternalStore)
      → application services (use-cases, in @personalos/core)
         → repository port (LocalRepository - read/write + outbox enqueue)
            → adapter: SQLite (device)  ⇄  SyncEngine  ⇄  RemoteRepository (HTTP)
```

- **Reads** always come from the local database - UI never waits on network.
- **Writes** go: local tx (documents + outbox row) → store notifies subscribers → sync push
  async. The UI reflects `sync.pending/conflict` from the entity trait.
- The `StorageAdapter` + `parseRawState` layer that exists today (Stage 0) is the bootstrap
  path; the SQLite adapter supersedes it for data while keeping the same envelope/version/
  migration semantics (`SCHEMA_VERSION`, backup-on-corrupt).
- State: single `PersonalOS` store per app (existing pattern) + React Query-style server
  cache **only** for server-only resources (audit log, admin, integration status).

### 5.2 Web (`apps/web`, exists)

- Next.js App Router: SSR/SSG for shell, metadata, and first paint; all data flows client-side
  local-first. Route tree = IA route map, unchanged.
- PWA: manifest + service worker (asset precache, offline fallback, `Background Sync` for
  outbox flush when the browser supports it).
- Responsive contract follows IA §4: sidebar ≥1024, rail 768-1023, bottom nav <768; the same
  breakpoints are tokens in `design-tokens`.

### 5.3 Mobile & tablet (`apps/mobile`)

- Expo (RN) with TypeScript; navigation generated from the **same route registry**
  (`apps/web/src/lib/ia/routes.ts` moves to `packages/core/src/ia/routes.ts`; web and native
  navigators both derive from it - one IA, three shells).
- Tablet = same RN app with responsive split views (IA §4.2), iPad/Android-tablet layouts;
  web tablets use the browser PWA. Feature parity is defined by the IA surface list, not by
  platform.
- Native SQLite (`expo-sqlite`), push notifications (APNs/FCM), platform share sheet feeds
  Universal Capture (`origin: capture`), background fetch for reminder catch-up, home-screen
  quick actions (new task, capture).
- Platform adapters (`PlatformFilePicker`, `PlatformCalendar`) live behind ports; services
  are platform-agnostic.

### 5.4 UI decoupling rules (non-negotiable)

1. Components receive data via props/selectors and call **hooks** that wrap application
   services; they never fetch, never see SQL/HTTP, never import adapters.
2. Domain errors surface as typed results (`{ ok, error: AppError }`), never raw HTTP status
   handling in components.
3. Feature modules are self-contained (`modules/<feature>/{ui, hooks, service-wiring}`) and
   communicate through services/events, not sibling imports.

---

## 6. Backend architecture

- **Fastify + TypeScript**, one process per role (`api`, `worker`, `scheduler`), both built
  from `apps/api/src` with different entrypoints so domain code is shared.
- Each module registers: routes (`/api/v1/<resource>`), services, repository (Drizzle),
  policy rules, event handlers, and its own migrations. Module loader enforces "no cross-module
  repo access" (repos are not exported).
- Request pipeline: request-id → structured logger → auth (session/JWT) → rate limit →
  route schema validation (zod, shared with client) → handler → error mapper.
- Health: `/healthz` (liveness), `/readyz` (DB/Redis/S3 checks), `/metrics` (Prometheus).
- Config by env (validated at boot with zod; fail fast). Secrets from env/secret manager only.
- Transactions: application service opens the tx, passes a `UnitOfWork` to the repo; domain
  events are written to `outbox` **inside the same tx** (§17).

---

## 7. Database architecture

### 7.1 PostgreSQL

**Control tables** (relational, FKs, RLS enabled):

- `users`, `credentials` (password hash, passkey credentials), `sessions`, `devices`
  (device_id, platform, push token, last_seen, revocation), `workspaces`, `members`
  (role), `share_links` (token hash, role, expiry), `integrations` metadata
  (encrypted tokens), `audit_log`, `analytics_events`, `outbox`, `consumer_offsets`,
  `change_log`, `idempotency_keys`, `ai_usage`, `files` (attachment metadata),
  `migrations`.

**Entity store** (document envelope - all 41 `COLLECTIONS`):

```sql
documents (
  collection   text        NOT NULL,
  id           uuid        NOT NULL,
  owner_id     uuid        NOT NULL,
  workspace_id uuid        NOT NULL,
  scope        text        NOT NULL,
  version      integer     NOT NULL,           -- optimistic concurrency (Data Model §1.2)
  updated_at   timestamptz NOT NULL,
  deleted_at   timestamptz,                    -- soft delete = tombstone for sync
  document     jsonb       NOT NULL,
  PRIMARY KEY (collection, id)
)
-- indexes: (owner_id, updated_at DESC), (workspace_id, updated_at DESC),
--          partial (collection, id) WHERE deleted_at IS NULL, GIN on document where needed
```

- **Why one table**: adding a collection is a zero-migration operation (Data Model §7);
  sync, audit, search indexing, and RLS all key off shared columns instead of 41 DDL tables.
- Integrity (`schema/relations.ts` 48 ref rules, cascade plans) is enforced in the
  application layer **by the same shared code on client and server**; DB FKs exist only for
  control tables. Rationale: soft-deleted, client-originated, migration-free data cannot
  honor deferrable FKs consistently across local SQLite and Postgres.
- High-query projections live in side tables maintained by consumers: `search_index`,
  `embeddings`, `completion_history`, `reminder_due` (§14-16). Source of truth stays
  `documents`.

### 7.2 Redis

Keyspaces (convention `os:{workspace|user}:{domain}:{id}`): session cache, rate-limit
counters, idempotency responses, hot query cache, BullMQ queues, SSE pub/sub fanout,
distributed locks for integration sync. All cache entries carry TTL; nothing authoritative
is stored only in Redis.

### 7.3 Object storage (S3-compatible)

Bucket layout `files/{workspaceId}/{attachmentId}/{filename}`; private by default;
server-side encryption; lifecycle to infrequent-access after 90 days; versioning on for
uploads. Metadata lives in the `attachments` document + `files` table (size, hash, scan
status, owner).

### 7.4 Migrations

- Drizzle Kit: SQL migrations in `apps/api/migrations`, one directory per module, forward-only
  in CI, reviewed like code; expand → migrate → contract discipline (old readers tolerate
  new columns).
- Local entity documents need **no** migrations (schema evolution rules, Data Model §6-7).

---

## 8. API architecture

### 8.1 Conventions

| Concern | Standard |
|---|---|
| Base | `https://<host>/api/v1`, JSON only (UTF-8), `snake_case` never - **camelCase** field names matching `@personalos/core` types verbatim |
| Versioning | Major version in path; additive fields only within v1; sunset header on removals; OpenAPI 3.1 in `packages/api-contract` is the single source of truth; clients generated from it |
| Resources | Nouns, IA-aligned: `/tasks`, `/events`, `/notes`, `/pages`, ... `GET /{resource}` (list), `GET /{resource}/{id}`, `POST /{resource}`, `PATCH /{resource}/{id}`, `DELETE /{resource}/{id}` (soft delete) |
| List query | Filters (`status`, `projectId`, `updatedSince`, `archived`), **cursor pagination**: `?limit=50&cursor=<opaque>`; response `{ items: [...], nextCursor: string \| null }`; never offset |
| ETag/If-Match | Every `GET` returns `ETag: "<version>-<seq>"`; `PATCH` requires `If-Match` or `baseVersion` body field → else 428; stale → 409 `CONFLICT_VERSION` |
| Idempotency | `Idempotency-Key` header required on `POST /sync/push`, `/capture`, `/ai/*` mutations; replayed for 24h (stored response) |
| Timestamps | Millisecond epoch integers (matches `Timestamp` type) OR RFC3339 at the wire boundary? **Decision: RFC3339 ISO-8601 on the wire, epoch ms inside domain** - converters live in `core/transport`; server clock authoritative (skew ±5min clamp for sync) |
| Auth | Web: `HttpOnly; Secure; SameSite=Lax` session cookie + CSRF origin check; Mobile: `Authorization: Bearer <access>` (15 min) + refresh rotation |
| Rate limits | Per token + per IP token buckets; 429 + `Retry-After` + `X-RateLimit-*`; stricter on auth, capture, AI |
| Realtime | `GET /api/v1/sync/stream` (SSE): sends `seq` bumps + invalidation hints only, never payloads; heartbeat 25s; mobile falls back to pull-on-foreground + push wake |
| Streaming | AI responses: `POST ...` → `text/event-stream` events: `delta`, `tool`, `citation`, `usage`, `done`, `error` |
| Webhooks in | `/api/v1/webhooks/:provider` (signature-verified, idempotent by delivery id) |
| OpenAPI | Generated route schemas are the contract; contract tests assert live behavior matches spec |

### 8.2 Error-handling standard (RFC 9457 `application/problem+json`)

```json
{
  "type": "https://api.personalos.dev/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "code": "CONFLICT_VERSION",
  "detail": "Task was modified by another device.",
  "instance": "/api/v1/tasks/3f0c...",
  "requestId": "req_8fa21c",
  "errors": [{ "field": "dueAt", "issue": "must be ISO-8601" }]
}
```

- `code` is a machine string from the registry in `packages/api-contract/errors.ts`
  (stable forever; `title` may change). Tiers:
  - 400 `VALIDATION_*` (422 for semantic violations), 401 `AUTH_*`, 403 `FORBIDDEN_*` /
    `POLICY_DENIED`, 404 `NOT_FOUND`, 409 `CONFLICT_VERSION`,
    `CONFLICT_SERVER_AUTHORITATIVE`, 413 `PAYLOAD_TOO_LARGE`, 423 `LOCKED` (integration
    sync in progress), 429 `RATE_LIMITED` / `AI_BUDGET_EXCEEDED`, 502 `INTEGRATION_UPSTREAM`,
    503 `AI_UNAVAILABLE`, 500 `INTERNAL`.
- Server: domain code throws typed `AppError(code, detail, meta)`; a single error-mapper
  produces the problem body; 500s log stack + `requestId` and return `INTERNAL` only -
  never internals/SQL/provider text (no data leak).
- Client: `RemoteRepository` maps problem+json → `AppError`; application services translate:
  401 → refresh flow then re-auth event; 409 → conflict resolver (§11); 429 → backoff and
  surface "slow down"; offline/timeout → **queue** (outbox), never error; 5xx → retry with
  jitter then surface retry affordance. UI renders from `error.code`, never string matching.

### 8.3 Resource surface (v1 index)

`/auth/*` (login, passkeys, oauth, refresh, mfa, logout) - `/sync/*` (push, pull, snapshot,
stream, devices) - CRUD for all user collections - `/capture` - `/search` -
`/ai/*` (conversations, messages[SSE], insights, suggest) - `/files/*` (init, presigned
upload, complete, download-url) - `/notifications/*` (+ preferences, read) - `/devices/*` -
`/integrations/*` (connect, callback, status, sync-now) - `/workspaces/*`, `/members/*`,
`/shares/*` - `/analytics/events` - `/audit` (owner) - `/export`, `/account/delete` -
`/insights/*` (computed personal analytics) - `/healthz`, `/readyz`, `/metrics`.

---

## 9. Authentication

| Aspect | Standard |
|---|---|
| Primary factor | **Passkeys (WebAuthn)** on web + platform credentials (Face ID/Touch ID/Android Biometric → device key) on mobile |
| Password | Argon2id (m=64MB, t=3, p=4), zxcvbn strength gate, breached-password check (k-anonymity HIBP), no password hints |
| OAuth | Google, Apple (required for iOS sign-in conventions), GitHub; scopes minimally invasive |
| Magic link | Email one-time link (10 min, single-use) for passwordless recovery |
| MFA | TOTP optional, mandatory for `admin` role; 10 recovery codes (hashed) |
| Sessions (web) | Opaque session id in `HttpOnly; Secure; SameSite=Lax` cookie; server-side row (Redis+DB); idle 30d, absolute 90d; rotation on privilege events |
| Tokens (mobile) | Access JWT 15 min (signed, jti), refresh 30 d **rotating + reuse detection** (reuse revokes family + all devices); bound to `device_id` |
| Device registry | First sync/push call registers device (platform, push token, app version); user-visible device list with individual revocation |
| Account recovery | Email flow; hard lock after N failures with progressive delay; suspicious-login alert email; no security questions |
| Service auth | Internal job workers use mTLS/signed service tokens; `/metrics` on private network |
| Session revocation | `sessions.revoked_at` + Redis denylist checked per request; "Sign out everywhere" |

Auth events (login, failure, MFA, token refresh anomaly, device add/remove) → audit log (§18).

---

## 10. Authorization and RBAC

### 10.1 Model (extends Data Model §1.4)

Three inputs, evaluated together:

1. **Principal**: `user` (session), `device`, `service` (worker), `ai` (System AI), `guest`
   (share-link token), `admin-support` (break-glass).
2. **Workspace role** (membership row): `owner | admin | member | guest` - per-table matrix
   exactly as Data Model §1.4.
3. **Resource `scope`** (on every entity): `private | workspace | team | link` +
   `ownerId`/`workspaceId`.

### 10.2 Policy engine

- One pure function in `@personalos/core`: `can(actor, action, resource) → Decision`
  (`allow` / `deny(reason)`), plus `assertCan` that throws `POLICY_DENIED`.
- Action vocabulary: `read | create | update | delete | share | restore | export` (+ domain
  verbs: `ai.read`, `calendar.writeExternal`, ...).
- **Client** uses it to hide affordances (same code); **server** calls it in every
  application service before mutation - the client copy is a UX mirror, never the security
  boundary. Tests: one table-driven suite covering every (role × scope × action) cell, run
  identically on web and API.
- Query scoping is mechanical: every repository query filters `owner_id`/`workspace_id`
  membership; Postgres **RLS policies** on control tables re-assert the same rule
  (defense-in-depth; integration suite proves cross-tenant reads return empty).
- AI principal: `ai` role can only read entities present in the explicit `refs` list of the
  request (context builder resolves and re-checks `can(ai, read, ref)` per entity), can
  write only `aiConversations | aiMessages | aiInsights | aiObjects`, never shares, never
  `audit_log`. (Data Model §1.4 "System AI" row - enforced in `modules/ai` only.)
- Share links: token (hashed at rest) → `share_links` row with role `viewer|editor`, optional
  expiry/max-uses; resolves to a synthetic guest principal for `can()`.
- Support access (break-glass): time-boxed elevation, per-tenant consent flag, every
  data access written to `audit_log` with `actor=admin-support`.

### 10.3 RBAC administration

- Role changes are events (`role.changed`) → audit log → notification to affected user.
- Owner transfer is an explicit two-step flow (propose/accept) to avoid lockout.
- Reserved: only `owner` can delete workspace; deletion requires re-auth + 30-day grace.

---

## 11. Sync engine (multi-device from day one)

Designed in Stage 3 (traits: `version`, `updatedAt`, `sync.{revision,syncedAt,pending,
conflict}`, soft delete, sync classes in Data Model §1.5). This section is the protocol.

### 11.1 Server structures

```sql
change_log (
  seq         bigserial PRIMARY KEY,   -- global monotonic cursor
  owner_id    uuid NOT NULL,
  workspace_id uuid NOT NULL,
  collection  text NOT NULL,
  id          uuid NOT NULL,
  op          text NOT NULL,           -- upsert | delete
  actor_device uuid NOT NULL,
  version     integer NOT NULL,
  ts          timestamptz NOT NULL,
  payload     jsonb                     -- changed fields for upsert (delta), not full doc
)
devices (id, owner_id, platform, push_token, last_seq, app_version, revoked_at)
```

### 11.2 Protocol

1. **Push** `POST /sync/push` (`Idempotency-Key`): `{ deviceId, mutations: [{ collection,
   id, op, baseVersion, fields, fieldTs }] }` - only outbox rows; device-local classes are
   never sent; derived collections are never sent.
2. **Apply** in one tx per batch: load current doc → permission check → conflict resolution
   (below) → write `documents` (version+1) → append `change_log` → emit outbox events →
   return `{ applied, rejected[] , serverSeq }`.
3. **Pull** `GET /sync/pull?since=<seq>&limit=` → ordered `change_log` deltas + `serverSeq`
   (new cursor). Client applies in one local tx (idempotent by seq).
4. **Notify** SSE `/sync/stream` emits `{"type":"bump","seq":N,"collections":[...]}` - client
   pulls; no payload on the socket; reconnect with `Last-Event-ID` == cursor.
5. **Snapshot** `GET /sync/snapshot` (chunked, resumable) for new devices/repair; client
   then continues from returned seq.
6. **Bootstrap offline**: device that has never synced downloads snapshot before first
   render of data-dependent UI (progress UI per IA); thereafter offline-first.

### 11.3 Conflict resolution (per sync class)

| Class | Rule |
|---|---|
| Live | **Field-set LWW**: mutation carries `fieldTs` per changed field-set; server applies fields with `fieldTs` newer than current per-field stamp. Clock skew clamped to ±5 min of server time; beyond clamp server time wins and `sync.conflict = local` is set on the loser entity. Equal overlapping edits within clamp → server wins, `conflict = remote`, SSE bump lets client show the resolver (side-by-side values; user choice wins as a fresh mutation). `baseVersion` mismatch on **non-overlapping fields** still merges; on overlapping fields → rule above. |
| Append-only | Union; rewrites rejected (`409 CONFLICT_SERVER_AUTHORITATIVE` with detail); corrections are new rows (e.g., new `habitCheckIns`, `xpTransactions`) |
| Device-local | Filtered at push; never in `change_log` |
| Server-authoritative | Client writes rejected; server mutations flow through pull only |
| Derived | Never synced; both sides rebuild from source rows (server emits `x.recomputed`, client recomputes from synced source - e.g., `CompletionHistory`, indexes) |

After resolution both sides converge on `version`; `sync.conflict` clears when the client
acknowledges the winning revision.

### 11.4 Offline database

One schema on every platform (SQLite):

| Table | Purpose |
|---|---|
| `documents(collection, id, doc, version, updated_at, deleted_at, dirty, conflict_state)` | Mirror of server entity store |
| `outbox(op_id, collection, id, op, fields, base_version, field_ts, created_at, state, attempts)` | Pending mutations (state: `pending → in_flight → done/rejected`) |
| `meta(key, value)` | `seqCursor`, `deviceId`, `schemaVersion`, snapshot state |
| `search_fts` (FTS5) | Offline global search over local documents |
| `files_cache` | Attachment metadata + blob reference |

- Adapters: web `sqlite-wasm + OPFS` (fallback IndexedDB adapter for old browsers), native
  `expo-sqlite`. Both behind `LocalRepository` (the existing `StorageAdapter` remains the
  bootstrap/compat layer with identical envelope semantics: version check, migration hooks,
  backup-on-corrupt - Stage 0 behavior preserved).
- Write path is synchronous-local (tx: documents + outbox) → instant UI; push retries with
  exponential backoff + jitter, resumes from `seqCursor`, respects backpressure (`limit`).
- Tombstone GC: soft-deleted rows compacted after 30 d; snapshot re-fetch repairs corruption
  (`sync.revision` mismatch → refetch entity).
- Quota/eviction: file cache LRU; documents pinned for pinned/starred entities; settings
  expose storage usage.

---

## 12. File storage

- Upload: `POST /files/init` (name, size, hash, mime) → policy check (quota, allowlist) →
  presigned PUT → `POST /files/complete` (row finalized as `attachments` doc, state
  `scanning` → worker AV scan (ClamAV) → `ready` or `rejected`).
- Download: API issues short-lived signed GET URLs (10 min, auth-checked); share links grant
  scoped access through the guest principal; **no public buckets, ever**.
- Processing (worker): AV scan (mandatory before `ready`), image/document thumbnails
  (`sharp`), audio waveform + transcription job for `recordings` (AI pipeline), MIME sniffing
  (never trust extension), strip active content from documents.
- Limits: per-file 100 MB default (config), workspace quota (usage table), type allowlist
  (images, pdf, audio, video, text, office); 413/415 with problem+json codes.
- Integrity: sha256 recorded at upload, verified on complete; dedupe per workspace by hash.
- Sync: metadata syncs as `attachments` document; **blobs sync lazily** (download on demand,
  LRU cache on device) - keeps snapshots small.

---

## 13. Caching

| Layer | What | Strategy |
|---|---|---|
| Device | Documents, indexes, file blobs (LRU) | The local DB **is** the cache (source for UI); no invalidation problem |
| HTTP/CDN | Static assets, manifest, icons | `immutable, max-age=1y` (hashed filenames); HTML `no-store` |
| API/HTTP | Collection GETs | `ETag = "<version>-<seq>"` + `Cache-Control: private, must-revalidate`; client sends `If-None-Match` → 304 |
| Redis | Sessions, rate limits, idempotency replays, hot reads (`os:{ws}:{domain}:{id}`, TTL 5-60 s), search result cache (TTL 30 s) | Cache-aside; invalidated by outbox consumer on the domain's change events; stampede protection via single-flight locks |
| Application | Per-request identity/workspace/permission memoization | In-process, request-scoped only (never cross-request) |

Rules: no cache is authoritative; every cache key includes workspace or owner (tenancy);
caching never crosses a permission boundary (no shared keys across tenants).

---

## 14. Search

- **Port** `SearchPort { index(batch), remove(ids), query(principal, text, filters, page) }`
  with implementations: `PostgresFtsPort` (v1) and `DeviceFtsPort` (SQLite FTS5, local docs).
- Index pipeline: outbox consumer consumes `*.updated/created/deleted` → upsert
  `search_index(collection, id, owner_id, workspace_id, title, body, tsv, updated_at)`;
  title weighted A, body B; `websearch_to_tsquery`; `pg_trgm` GIN for prefix/typo on titles.
- Query: permission-filtered in SQL (membership subquery) - **search can never leak across
  tenants** (dedicated integration test: user B's keyword finds nothing of user A).
- API `GET /search?q&types&scope&cursor` → grouped results per IA Global Search contract
  (§4.6): tasks, events, notes, pages, people, commands - ordering: exact-prefix > title >
  recency.
- Offline: same shape against FTS5; results merge on reconnect.
- Ranking evolution path: tsvector weights → `pg_trgm` blend → optional Typesense behind the
  same port (decision deferred until relevance data justifies it).

---

## 15. Vector search and AI services

### 15.1 Vector store

```sql
embeddings (collection, id, owner_id, workspace_id, model, dims, content_hash,
            vector vector(1536) /* model-specific */, chunk_index, updated_at)
-- HNSW index; EVERY query includes (owner_id OR workspace_id) filter - tenancy invariant,
-- enforced in EmbeddingPort implementation, not at call sites
```

- Trigger: `*.content.changed` events (notes, pages, journal, transcripts) → embed job
  (chunking: ~512 tokens, 64 overlap; content-hash skip; model recorded, re-embed on model
  change as a backfill job).
- Recall: hybrid = FTS (keyword) + ANN (semantic) → RRF fusion in `SearchPort.hybrid`.

### 15.2 AI gateway (`modules/ai`)

| Concern | Standard |
|---|---|
| Provider abstraction | `LLMProvider` port: `stream(request, opts)`, `embed(texts)`; adapters: OpenAI, Anthropic, Google, Ollama (self-hosted/local); routing table by task class (fast / smart / embed) with per-deployment config |
| Entry point | All model calls flow through the gateway; **UI never imports a provider SDK; no provider key exists client-side** |
| Streaming | SSE per §8.1; client renders incremental deltas; cancellation (`AbortSignal` → provider cancel) |
| Context / RAG | Assemble strictly from explicit `refs` (+ optional hybrid search **pre-filtered by `can(ai, read, ...)`**) → context manifest (which refs, tokens, hashes) persisted with the message for auditability |
| Tools | Whitelisted tool registry mapping to application services (`createTask`, `completeTask`, `searchNotes`, ...); model output = tool calls, **server executes through the same policy engine as any user**; every tool call requires user confirmation in UI (AI writes are drafts, `origin: ai`) |
| Guardrails | Input: secret-pattern redaction before egress; output: schema-validated (zod) where structured; jailbreak/prompt-injection heuristics on retrieved content (treat retrieved text as data, never instructions); per-provider no-training flags; PII minimization setting per workspace |
| Budgets | Per-user/day token + cost caps (`ai_usage` rows); 429 `AI_BUDGET_EXCEEDED` + UI meter; workspace-level hard cap for teams |
| Reliability | Timeouts (30 s), retries only on idempotent/prefill-safe calls, circuit breaker per provider, fallback provider, 503 `AI_UNAVAILABLE` degrades gracefully (queue suggestions async) |
| Prompts | Versioned templates in `packages/prompts` (semver, changelog); every AI message records template version + model + temperature + context manifest |
| Evals | Golden datasets per prompt (capture parsing, summarization, suggestions) run in CI as offline evals; regression gate; online sampling of thumbs-up/down → eval corpus |
| Permissions | AI principal rules of §10.2; AI entities flow into existing `aiObjects` queue (IA `/ai` owns it) |

---

## 16. Notification service

- **Pipeline**: domain event → `notification.requested` (in-process) → preference match →
  dedupe/budget → channel fanout → delivery rows (`notifications` collection) + read state.
- **Preferences**: per event-kind × channel matrix + quiet hours (per timezone) + "focus mode
  pauses non-urgent" - stored as user settings, syncs like any entity (device-local read/dismiss
  state per Data Model §1.5).
- **Channels**:
  - In-app: `notifications` doc + SSE bump (badge counts in IA surfaces).
  - Web Push: VAPID/Service Worker; payload minimal (`{id, kind}`) - **no personal content in
    push payloads** (device unlocks content via API).
  - Mobile push: APNs/FCM via device registry; silent push for sync wake + alert push for
    user-facing notifies; handled by `apps/worker`.
  - Email: transactional (auth, sharing) + digests (daily/weekly rollup); provider: Postmark
    behind `EmailPort`.
- **Scheduling**: reminders → durable delayed jobs (`bullmq` repeat/delay) keyed by
  `reminder.id` (idempotent); timezone-aware DST rules in domain (`date-utils`); missed while
  offline → device local notifications on boot + server sweep on reconnect (dedupe by
  `reminder.id + fireDate`).
- **Controls**: per-kind rate caps (e.g., max 1 marketing/hour), global cooldown, mute
  workspace; user-visible "why did I get this" (source event link → audit trail).

---

## 17. Background jobs and event processing

- **Transactional outbox**: every domain write inserts `outbox(id, type, payload, status,
  occurred_at)` in the same DB tx. Relay (worker poll + `LISTEN/NOTIFY` for latency) marks
  claimed rows and fans out to BullMQ. **No event is ever emitted without its tx** (the
  classic dual-write bug is structurally impossible).
- **Event envelope**: `{eventId (ULID), type ("task.completed.v1"), occurredAt, actor:
  {userId, deviceId, kind}, workspaceId, payload}`. Type names versioned (`.v1`); breaking
  changes = new type, consumers tolerate unknown types (skip + log).
- **Consumers** (idempotent: dedupe by `eventId` in `consumer_offsets`): search indexing,
  embedding, notifications, analytics, audit projection, sync broadcast (SSE bump), derived
  recomputation (goal progress, completion history, tag counts), integration fanout.
- **Job rules**: handler idempotent (deterministic `jobId` for dedupe-able jobs), payload =
  **references only** (handler loads fresh state), exponential backoff (3 retries, 10 s base),
  24 h retention, DLQ with alerting, per-queue concurrency limits (AI jobs separate from
  sync sweeps), metrics per job type (duration, failure, depth).
- Job catalog: `sync.sweep`, `search.index`, `embed.update`, `file.scan`, `file.thumbnail`,
  `transcribe`, `ai.suggest`, `ai.backfillEmbeddings`, `notify.deliver`, `digest.daily`,
  `calendar.import`, `calendar.webhookApply`, `export.build`, `retention.gc`,
  `integrity.check` (dangling-ref scan via `findDanglingRefs`), `backup.verify`.
- **No CDC/Kafka**: outbox + BullMQ covers the scale envelope; the module/event interfaces
  would allow swapping the transport later without touching domains.

---

## 18. Audit logging

- `audit_log` append-only: `id, ts, actor_user_id, actor_kind (user|ai|admin|system), device_id,
  session_id, action ("task.deleted", "role.changed", "auth.login", "ai.context.read"),
  resource (collection, id), workspace_id, request_id, ip, user_agent, diff (redacted),
  metadata jsonb`. Written through the outbox (same tx as the change).
- **Always audited**: authentication events, role/share/link changes, deletions & restores,
  exports, account deletion, integration connect/disconnect, support break-glass access,
  AI context assembly (which refs were read) and tool executions, secret access.
- Redaction: never store password/token/note bodies in diffs; store field names + hashes for
  sensitive fields; PII in `metadata` allowlisted.
- Retention: 12 months hot (partitioned monthly), 7 years for security events (policy config);
  rows are immutable (no UPDATE/DELETE privileges for app role; partition drop only).
- Access: owner reads own workspace audit via `GET /audit` (paginated, filterable); auditors
  get read-only role. Export includes audit slice for GDPR transparency.

---

## 19. Monitoring, errors, and SLOs

| Signal | Tool | Contents |
|---|---|---|
| Logs | `pino` JSON → Loki/Grafana (or CloudWatch) | `requestId`, `traceId`, user/workspace (hashed), module, timing; no content bodies |
| Traces | OpenTelemetry → Tempo/Jaeger | api, worker, DB, Redis, S3, providers; sync push/pull spans; W3C `traceparent` propagated to clients via response header |
| Metrics | Prometheus → Grafana | RED per route; `sync_lag_seconds` (max seq gap age), `outbox_backlog`, queue depth/age, AI tokens/latency/cost, search p95, SSE connections, cache hit rate, job failures |
| Errors | **Sentry** (api + web + mobile with releases/source maps) | Fingerprinting, release + commit tagging, user context (id only), sampling 100% for unhandled; client-side reports include `deviceId`, app version, `seqCursor` |
| Frontend vitals | Sentry/OTel RUM (web) | LCP/INP/CLS per route, hydration errors (we had one - see the shell regression test), JS exceptions with stack |
| Synthetic | Cron checks | login → capture → sync roundtrip canary every 5 min from 2 regions |

**SLOs** (alerting on error-budget burn):

| SLO | Target |
|---|---|
| API availability (`/readyz` + canary) | 99.9% / 30 d |
| p95 read latency (`GET` collection) | < 200 ms |
| p95 write → visible on other device (sync propagation) | < 5 s |
| p95 search latency | < 300 ms |
| Job success (excl. DLQ) | > 99% / 24 h |
| Web Core Web Vitals per IA route | INP < 200 ms |
| Crash-free sessions (mobile) | > 99.5% / version |

Alerts route to on-call with runbooks (`docs/runbooks/*` created when the stage ships).

---

## 20. Analytics

- **First-party only.** No third-party pixels, no session replay by default (personal-data
  sensitivity), no content inspection.
- **Pipeline**: client `track(name, props)` → `POST /api/v1/analytics/events` (allowlisted
  event names + prop schemas in `packages/api-contract/analytics.ts`; unknown names rejected;
  PII fields rejected by schema) → queue → `analytics_events` (partitioned by day) →
  nightly rollups (retention/feature usage) → PostHog self-hosted for funnels/retention
  dashboards (reads replica/export, raw PII never leaves our DB).
- **Event taxonomy** (v1): `route.viewed`, `capture.created`, `task.completed`,
  `search.performed`, `ai.message.sent`, `ai.suggestion.accepted`, `sync.conflict.resolved`,
  `share.created`, `onboarding.step`, `notification.opened`. Additions require a one-line
  spec entry + schema; the client only sends names known to the contract.
- **Personal analytics** (user-facing Insights, IA `/insights`): computed **from domain data
  only** (CompletionHistory, indexes, XP ledger) inside `@personalos/core` engines - not from
  the event stream; identical offline and online.
- Privacy: analytics honor workspace opt-out flag; export/delete covers events; counts are
  pseudonymous (user id, no device fingerprinting).

---

## 21. Security requirements for personal data

### 21.1 Data classes

| Class | Examples | Handling |
|---|---|---|
| Secret | passwords (Argon2id), refresh tokens (hashed), OAuth tokens (encrypted at rest: AES-256-GCM envelope key from KMS/age), passkey creds, Web Push keys | Never logged, never in analytics, never returned by API, rotatable |
| Sensitive content | notes, journals, recordings, transcripts, AI context | TLS in transit, encrypted at rest (disk/S3 SSE; optional per-workspace envelope encryption as hardening), access only via policy engine, excluded from logs/diffs |
| Metadata | ids, timestamps, scopes, usage counters | Standard controls, appears in audit diffs (allowlisted fields) |

### 21.2 Requirements (all enforced in the stage that ships the surface)

1. **Transport**: TLS 1.2+ (1.3 preferred), HSTS preload, no plaintext fallback; internal
   mTLS/service tokens.
2. **At rest**: managed-disk encryption + S3 SSE mandatory; documented KMS envelope-encryption
   option for `documents.document` (phase 2 hardening); backups inherit encryption.
3. **Tenant isolation**: mechanical scoping in every repo query + RLS on control tables +
   Redis key prefixing + storage key prefixing; **mandatory cross-tenant test suite**
   (attempt access to foreign ids across all 41 collections → expect 404/deny).
4. **Input**: single zod schema source (shared client/server) for every request body/query;
   Fastify body limits; upload type/size/hash validation; canonicalization before comparison.
5. **Injection**: parameterized SQL only (Drizzle/raw with bind params); no dynamic identifiers
   from input; FTS queries built via `websearch_to_tsquery` only.
6. **XSS**: React escaping defaults; markdown rendered with strict allowlist (no raw HTML);
   CSP (`default-src 'self'`, no `unsafe-inline` scripts; Next nonce), `X-Frame-Options:
   DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, permissions policy.
7. **CSRF**: SameSite cookies + custom-header/origin check for state-changing requests.
8. **Abuse**: rate limits (§8.1), auth lockout w/ delay, bot mitigation on signup, webhook
   signature verification, AI prompt-injection hygiene (§15.2).
9. **Key/secrets**: env/secret manager only, never repo; quarterly rotation; scanners
   (gitleaks) in CI; provider keys server-side only.
10. **User rights (GDPR/CCPA)**: `GET /export` (JSON + files, zip, async job, verified
    re-auth), `DELETE /account` (30-day grace → crypto-shred + object purge + backups age out
    ≤30 d), consent record for optional processing (AI provider selection), DPA with any
    processor, subprocessor list published.
11. **Backups**: Postgres PITR + daily snapshots (30 d), S3 versioning; **quarterly restore
    drill** recorded as an ops test.
12. **Incident response**: severity matrix, 24-h internal ack SLA, 72-h user/regulator
    notification path, postmortem template, audit log as forensic source.
13. **Dependency/supply chain**: lockfile + npm audit gate in CI, pinned actions, provenance
    where available.
14. **Client hardening**: no secrets in bundles (build-time assert), remote config cannot
    escalate permissions, screenshots/foreground protections on sensitive mobile screens
    (journal) as platform capability flags.

---

## 22. Testing strategy - every domain independently testable

### 22.1 Guarantees

1. **Ports have memory doubles** (`MemoryRepository`, `FakeLLMProvider`, `FakePushChannel`,
   `Clock` injection): any application service runs end-to-end with zero infrastructure.
2. **Module test suites are isolated**: each domain module's tests use its own schema subset
   (ephemeral DB per suite via testcontainers in CI) - no shared global fixtures, no order
   dependence; CI shards by module (fast feedback, parallelism).
3. **Shared domain stays pure**: `packages/core` tests (existing 85+ vitest) run in Node +
   jsdom (browser-compat gate); no timers/IO without `Clock`.
4. **Contract tests**: one generic suite per port, run against *every* adapter (memory,
   SQLite, Postgres) - proves offline/online equivalence of repositories (the sync invariant).

### 22.2 Pyramid per domain

| Level | Scope | Example |
|---|---|---|
| Unit (majority) | Domain invariants, engines, policy matrix | `can()` table: roles × scopes × actions; relation cascades; conflict-merge function (property-based: two devices, random field edits → converge) |
| Service | Application service + memory ports | `completeTask`: policy → mutate → events → outbox row asserted |
| Integration | Module routes + ephemeral Postgres/Redis/SQLite | `/tasks` CRUD, ETag/If-Match, 409 conflict, RLS cross-tenant denial |
| Contract | OpenAPI ↔ live routes; generated client types | Spec drift fails CI |
| Sync/propagation | Two in-memory clients against real API (test harness) | offline edits → reconnect → convergence; crash mid-push → idempotent replay |
| E2E (thin) | Playwright (web) + Maestro (mobile) over IA happy paths | capture → plan → complete → search → AI suggest → share; runs against production-like build with seeded data |
| Non-functional | k6 smoke on `/sync/pull`, `/search`; fuzzing on capture parser & payload validation | Budget gates in CI (regression >10% fails) |

### 22.3 What exists today vs what each stage adds

- Exists (Stage 0-3): core unit tests (engines, store, schema, relations, indexes), design
  system, IA registry, AppShell client regression test.
- Each future feature stage must ship: its module's service + integration tests, its port
  contract tests, and at least one cross-device sync test if the feature writes data.

---

## 23. Environments and delivery

- **Environments**: `local` (compose: Postgres, Redis, MinIO, Mailpit, fake AI provider),
  `preview` (per-PR, seeded, isolated schema), `staging` (prod-shaped, provider sandboxes),
  `prod` (multi-AZ, managed data services).
- **CI** (GitHub Actions, per-workspace): lint → typecheck → unit (shard by module) →
  contract → integration (testcontainers) → build (web, api, worker, mobile bundle) →
  Playwright smoke → security gates (gitleaks, npm audit, dependency-cruiser boundary check).
  Mobile: EAS builds on tag; store releases manual-approve.
- **Migrations**: expand/contract, forward-only, auto-applied in preview, gated (manual
  approve) in prod; rollback = re-deploy previous release (migrations backward-compatible).
- **Feature flags**: env/config-driven boolean registry (server-evaluated, client can read
  non-secret flags); every new surface ships flag-guarded until stage acceptance.
- **Observability ships with code**: every module adds its RED metrics + Sentry wiring in the
  same PR that adds its routes.

---

## 24. From Stage 0-3 to this architecture (delivery map)

| Stage | Delivers | Architecture sections |
|---|---|---|
| 0-3 (done) | Monorepo, design system, IA, canonical data model with sync/permission traits, relation+index schema, local-first store, web shell | §3 domain, §5.2 base, traits for §10/§11 |
| 4 | `apps/api` skeleton (Fastify, modules, error mapper, OpenAPI pipeline), Postgres + Drizzle, `documents` store, auth (passkeys/password/sessions/devices), policy engine wired, audit log, compose env, CI integration lane | §6, §7.1, §8, §9, §10, §18, §23 |
| 5 | SQLite `LocalRepository` (web WASM/OPFS + native scaffold), outbox, sync push/pull/stream/snapshot, device registry, conflict resolver, two-device convergence suite; `apps/mobile` scaffold consuming core | §11, §5.1/5.3, §22 sync lane |
| 6 | Search (FTS pipeline + hybrid API + offline FTS5), notifications (preferences, in-app, Web Push, reminders scheduling, email port) | §14, §16 |
| 7 | Files (presigned upload, scan, thumbnails, lazy blob sync), AI gateway (providers, streaming, RAG, tools, budgets, evals), vector store + embedding pipeline | §12, §15 |
| 8 | Collaboration: workspaces/teams/shares UI, RBAC administration, realtime presence-light, E2E collaboration tests | §10.3 |
| 9 | Integrations: Google/Apple calendar + OAuth, webhooks, import/export | §3.3 integrations |
| 10 | Analytics pipeline + dashboards, personal Insights, SLO dashboards + alerts, runbooks, load tests, security hardening review (§21 checklist sign-off) | §19, §20, §21 |

Ordering rationale: sync before features (multi-device designed from the beginning - every
stage after 5 writes data through the outbox, so no later re-platforming); search/notifications
before AI (AI depends on the search port); collaboration after the permission engine is
battle-tested by real writes.

---

## 25. Growth rules (how this stays understandable)

1. New entity collection: add to `core` types + `COLLECTIONS` + module ownership + FTS
   projection + sync class row. **No DB migration, no UI architecture change.**
2. New backend module: must declare routes, ports, events, policy rules, tests, metrics in
   its own directory; cross-module access only via events/service interfaces.
3. New external provider: implement its port adapter; no domain or UI changes permitted.
4. New AI capability: prompt template + eval fixture + budget class + tool registration;
   provider calls outside the gateway are a CI failure.
5. Breaking API change: new major version path; old version sunset with header; clients
   regenerated from contract.
6. Revisit only with evidence: microservices split (module seams ready), Typesense (relevance
   data), CRDT text (multi-user editing demand), Kafka (outbox throughput ceiling).
