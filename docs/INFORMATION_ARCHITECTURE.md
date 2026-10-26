# Information Architecture — AI PersonalOS

Stage 2 · built on the Stage 0 foundation (core, store, local-first OS) and the Stage 1 design system (tokens, primitives, overlays, entities).

This document is the single source of truth for **what the product is**, **how it is organized**, and **how a user moves through it**. The route registry in `apps/web/src/lib/ia/routes.ts` encodes the same map in code; the shell navigation, command palette, and placeholder routes derive from that registry so the structure cannot drift from this document.

---

## 1. Principles

1. **One entity, one home.** Every entity type owns exactly one canonical route. Other routes may only ever *lens* the same entity (filter a slice) or *stage* a different entity — never re-list the same collection under a second top-level area.
2. **The area is the roof, the overlay is the room.** Detail lives in modal/drawer overlays anchored to the area route. Flat areas stay flat; nesting only appears where content is genuinely hierarchical (Work > Projects, Notebook > Pages, Life Memory > entries, Settings sections).
3. **Navigation stays a flat list of 8, then a flat list of 11.** Two flat tiers keep the product understandable as it grows. New areas go under **More**; nothing nests deeper than one additional level (via child routes).
4. **Every route is reachable in ≤ 3 steps** from anywhere: Command palette (⌘P), Global search (⌘O), or 2 clicks of navigation.
5. **System lanes are not destinations.** Universal Capture (⌘K), the Inbox queue, reminders, and attachments are system abilities — they are surfaced through every route and are *not* promoted to navigation items.
6. **AI adds, it does not relocate.** AI surfaces (suggestions, plans, summaries, drafts) are stored as `aiObject` records in **AI**, and rendered inline wherever their referenced entity lives. Accepting an AI object never moves content out of its home area.

---

## 2. Navigation model

Primary navigation (persistent, same order everywhere):

```
Today · Calendar · Tasks · Goals · Habits · Notes · AI · More
```

More (secondary tier):

```
Focus · Life Memory · Journal · Planner · Insights · Work
Digital Notebook · Templates · Rewards · Integrations · Settings
```

Canonical URL slugs (deep-link contract — never renamed):

| Area | Slug | Nav | Status |
| --- | --- | --- | --- |
| Today | `/` | Primary | live |
| Calendar | `/calendar` | Primary | live (agenda) |
| Tasks | `/tasks` | Primary | live |
| Goals | `/goals` | Primary | placeholder |
| Habits | `/habits` | Primary | placeholder |
| Notes | `/notes` | Primary | live |
| AI | `/ai` | Primary | placeholder |
| Inbox | `/inbox` | system | live (not in nav) |
| Focus | `/focus` | More 1 | placeholder |
| Life Memory | `/memory` | More 2 | placeholder |
| Journal | `/journal` | More 3 | placeholder |
| Planner | `/planner` | More 4 | placeholder |
| Insights | `/insights` | More 5 | placeholder |
| Work | `/work` | More 6 | placeholder |
| Digital Notebook | `/notebook` | More 7 | placeholder |
| Templates | `/templates` | More 8 | placeholder |
| Rewards | `/rewards` | More 9 | placeholder |
| Integrations | `/integrations` | More 10 | placeholder |
| Settings | `/settings` | More 11 | live |
| Styleguide | `/styleguide` | dev utility | live |

---

## 3. Entity → route ownership (no-duplicate contract)

| Entity | Owning route | Other routes that *lens* it (allowed) |
| --- | --- | --- |
| `task` | `/tasks` | `/` today slice · `/calendar` agenda · `/planner` schedule · `/inbox` unplanned queue |
| `note` | `/notes` | `/ai` draft refs · embedded in journal/memory entries |
| `project` (area) | `/work` | task rows show project chips → `/work/projects/:id` |
| `goal` | `/goals` | habit progress roll-up · Today shows linked progress |
| `habit` + `habitCheckIn` | `/habits` | generated tasks appear on `/`; check-in streaks roll to `/rewards` |
| `event` | `/calendar` | `/planner` renders them read-only |
| `timeBlock` | `/planner` | `/calendar` renders them read-only |
| `aiObject` | `/ai` (pending queue) | inline on any referenced entity |
| `template` | `/templates` | create actions in capture/palette can use them |
| `reward` | `/rewards` | earned in `/habits`, `/goals` |
| `notebook` + `page` | `/notebook` | links into `/notes` entities |
| `journalEntry` | `/journal` | `/memory` timeline references |
| `memoryEntry` | `/memory` | referenced by `/journal`, `/insights` |
| `reminder` | *(no route — system lamp)* | rendered inline on Today, tasks, habits |
| `attachment` | *(no route — belongs to entity)* | rendered inside its owning detail overlay |

Not created: `/reminders`, `/attachments`, `/projects` (projects live under `/work`), a second notes list, a second task list. Anything that looks like a duplicate is a lens or an owned entity of its own.

---

## 4. Navigation surfaces

### 4.1 Desktop navigation (≥ 1024 px)

- Persistent 256 px sidebar. Top: wordmark (link to Today). Body: **primary list** of 8 (Today, Calendar, Tasks, Goals, Habits, Notes, AI, More). **More** opens a dropdown grid of the 11 secondary destinations grouped as *Execute*, *Remember*, *Build*, *System*. Footer: `Capture` (⌘K) with inbox badge, then utility links (Settings is *not* duplicated here — it lives inside More; the footer keeps the dev-only Styleguide).
- Top bar: page title/breadcrumb, **Global search field** (⌘O) on the left, theme toggle and avatar (→ Settings) on the right.
- Selection: active item is tinted and `aria-current="page"`; group headers are static labels, never links.

### 4.2 Tablet navigation (768–1023 px)

- Slim 64 px icon rail instead of the full sidebar. Same primary list as icons, badges collapsed to dots, tooltips on hover/focus. More opens the same dropdown.
- Wordmark + Global search remain in the top bar; avatar accessible there.
- Capture via the floating action button (FAB) — always on-screen.

### 4.3 Mobile navigation (< 768 px)

- No sidebar. Top bar carries wordmark, a search affordance (⌘O/full-width when focused), theme toggle and avatar.
- **Bottom navigation** (see 4.4) is the persistent chrome.
- FAB capture floats above the bottom bar.

### 4.4 Bottom navigation (mobile + touch-tablet)

Five logical slots: `Today · Calendar · Tasks · More · ✚`. The ✚ slot is the **Capture** FAB (Universal Capture), centered. **More** opens a bottom **drawer sheet** listing all 11 secondary destinations grouped the same way as the desktop dropdown; the sheet closes on selection. Badges: Today count dot, inbox dot on the FAB.

### 4.5 Command palette (⌘P)

Fuzzy palette over everything *routable and actionable*. Groups:
1. **Go to** — every registry route (labels + keywords, e.g. "memory", "timeline", "diary").
2. **Create** — capture quick-intents: `Capture task`, `Capture note:`, `New note`, `New project`, `New goal`, `New habit`, `New journal entry`, `New page (Notebook)`, `New template`.
3. **Open** — quick-open entities by title across tasks, notes, goals, habits, memories, journal entries, templates (top 8 matches).
4. **Actions** — app-level verbs: `Accept all pending AI`, `Export backup`, `Go to Inbox`, `Toggle theme`, `Open Shortcuts`.

### 4.6 Global search (⌘O, or `/`)

Cross-entity result surface, grouped by entity with counts. Scopes: Tasks, Notes, Goals, Habits, Projects, Memories, Journal, Templates, Notebook pages. A result opens its **home area** and — when a single entity — its **detail overlay** (modal/drawer route). Search is offline, local, case-insensitive, and matches title + body + tags. Keyboard cursor moves between groups; `Enter` opens, `Esc` closes, `⌘Enter` on a search hits the most relevant.

### 4.7 Universal Capture (⌘K)

Never a route — a modal overlay available from every surface (keyboard, FAB, sidebar footer, top bar field, any empty-state). One line of text in, structured data out:

- Bare text → **Inbox** (`/inbox`).
- Date/time tokens (`friday at 5pm`) → due/scheduled task, visible on `/` and `/calendar`.
- `!!`/`!!!` priorities, `#tag` (matching a project routes the task into `/work/projects/:id`), durations.
- `note:` or multiline → **Notes** (`/notes`).
- `from "template name"` → instantiate a template.
- Preview chips show the parse before saving. Capturing never navigates; the toast gives a path to the destination.

### 4.8 Breadcrumbs

Only on nested areas (never on the two flat tiers): Work > project, Notebook > notebook > page, Memory > entry, Templates > template, Settings subsections, AI > object. Auto-generated from the route registry (`label` of each ancestor), clickable, with the area label at the root. Flat primaries show a single title in the top bar instead.

### 4.9 Context menus

Right-click (desktop) / long-press (touch) on any entity surface — task row, note card, goal, habit, calendar cell, planner block, notebook page. Menu = the entity's actions mirroring the header actions of its area; destructive items separated at the bottom (with confirm). AI-producing actions appear in a distinct section labeled with the model source. Context menu never duplicates an item that only makes sense in the full area page.

### 4.10 Deep links

Contract:
- Routes are stable slugs (section 2). No query string is required to open an area; the default view is always the “smart” view.
- Date-bearing areas accept `?date=YYYY-MM-DD` (`/calendar`, `/planner?week=`, `/journal`).
- List filters are query-only and optional: `/tasks?view=upcoming|all|done`.
- Entity links are modal routes (4.11) and may carry a `?ref=` origin so the back stack returns to the exact source.

### 4.11 Modal routes

Entity detail is a **URL-backed overlay**: `/tasks/:id`, `/notes/:id`, `/goals/:id`, `/habits/:id`, `/memory/entries/:id`, `/journal/:date`, `/ai/objects/:id`, `/templates/:id`. Open = navigate (deep-linkable, reload-safe, back-navigable); the parent area stays mounted underneath; closing pops the history. These are not separate pages — they are overlays owned by the area route.

### 4.12 Drawer routes

For secondary, context-heavy tasks that should not hijack the page: `/planner/block/new` (quick time-block), `/work/projects/:id/settings`, `/notebook/:book/:page/details`, `/templates/new`, `/integrations/:id/connect`, `/settings/:section` (profile, appearance, data, shortcuts, about), `/focus/session/:id` (summary). Drawers open from the right on desktop and as bottom sheets on mobile.

---

## 5. Permissions

Local-first, single-owner today — but defined so a shared-device **Guest** and the **System/AI** lane stay bounded.

| Key | Meaning |
| --- | --- |
| `view` | read area + its entities |
| `manage` | create/edit entities in the area |
| `delete` | destructive delete (always confirm) |
| `data.import` / `data.export` / `data.clear` | backup operations |
| `ai.generate` | invoke model (cost/consent gated) |
| `ai.adopt` | accept an AI-produced object into real data |
| `integrations.connect` | authorize external connections |
| `settings.system` | OS-level settings (theme, formats, shortcuts) |

Roles: **Resident** (primary user, all keys) · **Guest** (`view`, no `delete`, no `data.*`, no `integrations.connect`, `settings.system` reduced to appearance) · **System/AI** (may only create `aiObject` records pending `ai.adopt`; never mutates owned entities directly). Today only Resident exists.

---

## 6. Route map

Legend: **Stage** = current build state (`live` | `placeholder`). **Data** lists the required collections from `AppState`.

---

### `/` — Today
- **Purpose**: The day's cockpit — what owes you today, what's due, what you finished, and the day's shape (scheduled blocks + rituals).
- **User type**: Resident.
- **Entry**: Primary nav (1st item), sidebar wordmark, bottom nav, ⌘P “Go to Today”, universal capture back-toast, deep link `/`, keyboard `T`.
- **Exit**: to Inbox (banner), Tasks (task detail → `/tasks/:id`), Calendar (`?date=today`), Focus (start a session on a task), file/area links on any row.
- **Child routes**: `/tasks/:id` (modal), `/inbox` (queue), `/focus/session/:id` (drawer).
- **Required data**: `tasks` (overdue/due/scheduled/completed today), `events` + `timeBlocks` (day shape), `habitCheckins` (ritual dots), `aiObjects` (morning plan), `profile`/`settings` (greeting, formats).
- **Available actions**: complete/reopen/cancel/delete task, add-to-today row (capture), reschedule to today, open detail, jump to inbox.
- **AI actions**: “Plan my day” (ordered plan from open + scheduled + habits → `aiObject`; review before apply), end-of-day summary, overdue digest.
- **Permissions**: `view`, `manage` on tasks; delete on owned tasks with confirm.

### `/inbox` — Inbox (system queue)
- **Purpose**: The landing strip for Universal Capture — everything unstructured until it is triaged into a real area.
- **User type**: Resident.
- **Entry**: capture back-toasts, Today “Review inbox” banner (when non-empty), ⌘P → Inbox, global search, inbox badge on Capture (desktop) / FAB dot (mobile). **Not a navigation item**.
- **Exit**: triage commits an item out to Tasks/Today/Calendar/Work; “go to task” opens `/tasks/:id`.
- **Child routes**: `/tasks/:id` (modal), `/calendar?date=…` (via quick-schedule).
- **Required data**: `tasks` where `status === "inbox"`, `projects` (tag→project resolution), `notes` (note-captures), `settings`.
- **Available actions**: capture, quick-schedule (pick date → moves to Today/Calendar), assign project/tag, open detail, delete, “snooze”.
- **AI actions**: “Triage these” (suggest date + project + priority per capture as `aiObject`s, one-tap apply), summarize backlog.
- **Permissions**: `view`, `manage`, `delete` (with confirm).

### `/tasks` — Tasks (canonical owner of `task`)
- **Purpose**: The master task list with views (Today / Upcoming / All / Done) and sort modes; lists already carry smart order, priorities, dates, subtasks, and projects.
- **User type**: Resident.
- **Entry**: Primary nav, ⌘P “Go to Tasks”, global search filter, Today lists (deep-link `/tasks?view=all`), task chips from Planner/Work/Goal.
- **Exit**: detail overlay (`/tasks/:id`), Calendar/Planner (date-bearing tasks), Work (project rows), Focus (start task).
- **Child routes**: `/tasks/:id` (modal detail + subtasks + attachments), `/tasks?view=…` (query lens).
- **Required data**: `tasks`, `projects`, `goals` (linked), `habitCheckins` (habit-generated tasks), `timeBlocks` (in-progress session), `settings`.
- **Available actions**: add (inline row / capture), complete, reopen, start, cancel, archive, delete, schedule, set due, subtask, tag/project, sort/view toggle.
- **AI actions**: “Break down” the selected task into subtasks (draft `aiObject`), suggest dates/effort, reorder today smartly, weekly review draft.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/calendar` — Calendar (canonical owner of `event`)
- **Purpose**: The time surface — when things happen. Grid (month/week/day) + agenda over events, task dates, and (read-only) time blocks.
- **User type**: Resident.
- **Entry**: Primary nav, bottom nav, Today date chip, ⌘P, `/calendar?date=YYYY-MM-DD`, event/task date links.
- **Exit**: to `/tasks/:id` or `/planner/block/new` (schedule), `/notes/:id`, `/focus/session/:id`.
- **Child routes**: `/calendar?date=` (anchor), `/planner/block/new` (drawer), `/tasks/:id` (modal).
- **Required data**: `events`, `tasks` (due/scheduled), `timeBlocks` (read-only), `habits` (recurrence), `settings` (week start, time format).
- **Available actions**: create/edit/delete event, drag-reschedule (agenda future), quick capture into a slot, jump to today, change view period.
- **AI actions**: “Auto-schedule this batch” (suggest dates for undated tasks respecting blocks), weekly template application, conflict detection, “what’s free when”.
- **Permissions**: `view`, `manage` events; `view`/`manage` scoped task rescheduling.

### `/goals` — Goals (canonical owner of `goal`)
- **Purpose**: Direction across horizons (life/year/quarter/month/week) with metrics, targets, and progress rolled up from linked tasks and habits.
- **User type**: Resident.
- **Entry**: Primary nav, ⌘P, capture intents (`goal: …`), planner/insight links, reward tie-ins.
- **Exit**: goal detail (`/goals/:id` modal), linked tasks (`/tasks?project=`), habits (`/habits`), calendar roll-up, rewards.
- **Child routes**: `/goals/:id` (modal detail + metrics + linked work), `/tasks?goal=:id` (lens).
- **Required data**: `goals`, `tasks` (linked), `habits` (linked), `notes` (linked refs), `aiObjects` (drafts), `settings`.
- **Available actions**: create, edit horizon/status/metric, set target date, link tasks/habits/notes, archive, delete, promote/demote horizon.
- **AI actions**: “Draft a goal” from a sentence, quarterly review, suggest next actions from a goal, reforecast milestones, progress narrative.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/habits` — Habits (canonical owner of `habit` + `habitCheckIn`)
- **Purpose**: Consistency engine — cadences (daily/weekdays/weekly/custom), one-tap check-ins, streaks, and habit-generated tasks on Today.
- **User type**: Resident.
- **Entry**: Primary nav, ⌘P, capture, Today ritual dots, rewards/insights cross-links.
- **Exit**: habit detail (`/habits/:id` modal), its calendar pattern (`/calendar`), generated tasks (`/tasks`), rewards ledger (`/rewards`).
- **Child routes**: `/habits/:id` (modal + streak detail + history), `/tasks?habit=:id` (lens).
- **Required data**: `habits`, `habitCheckins`, `tasks` (generated), `goals` (optional link), `settings` (days), `rewards`.
- **Available actions**: create, set cadence/target/period, check-in/undo, archive, delete, link goal, change color/icon.
- **AI actions**: “Suggest a cadence” from intent, missed-day nudge (notification), lapsed-habit recovery plan, monthly consistency summary.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/notes` — Notes (canonical owner of `note`)
- **Purpose**: Atomic knowledge — quick notes, meeting takeaways, references. Short-format; long-form lives in the Notebook.
- **User type**: Resident.
- **Entry**: Primary nav, ⌘P, capture (`note:`), quote from any page, search, Notebook links.
- **Exit**: note editor (`/notes/:id` modal), Notebook (promote to page), memory/journal (embed refs), task (turn into action).
- **Child routes**: `/notes/:id` (modal editor), `/notebook` (promote flow).
- **Required data**: `notes`, `tags`, `notes`-referencing `aiObjects`, `profile` (author), `settings`.
- **Available actions**: create, edit title/body (autosave), tag, link, promote to notebook page, export, delete, view history.
- **AI actions**: “Summarize”, “titles please” (rename suggestions), “extract action items” (turn into tasks), “link related notes”, autotag.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/ai` — AI Hub (canonical owner of the `aiObject` queue)
- **Purpose**: Where model output is curated before it becomes real data. Pending suggestions/plans/summaries/drafts with accept/dismiss; assistant; model + prompt settings entry.
- **User type**: Resident.
- **Entry**: Primary nav, inline “AI” affordances across areas, ⌘P, notification when a suggestion arrives.
- **Exit**: accepting routes content to its home area and closes the card; dismissing removes it; deep link `/ai/objects/:id`.
- **Child routes**: `/ai/objects/:id` (modal detail), `/settings/ai` (drawer).
- **Required data**: `aiObjects` (all statuses), referenced entities (`refs`), `settings` (mode/provider), `profile`.
- **Available actions**: accept, dismiss, regenerate, open source entity, archive accepted, clear dismissed, chat with assistant, choose model.
- **AI actions**: this is the *producer* surface — every AI action in the system lands here pending user adoption.
- **Permissions**: `view`, `ai.generate`, `ai.adopt`; dismissal is `manage`.

### `/focus` — Focus (Stage 3 Execution)
- **Purpose**: One task, full attention. Sessions bound to a task, Pomodoro-style, writing time blocks back to the calendar and session history to estimates.
- **User type**: Resident.
- **Entry**: More, task row “start”, Today/Planner focus slots, ⌘P, `/focus/session/:id`.
- **Exit**: completing a session returns to originating area with a summary toast; component link to `/tasks/:id`.
- **Child routes**: `/focus/session/:id` (drawer summary), `/planner` (blocks written).
- **Required data**: `tasks` (in-progress), `timeBlocks` (written back), `focusSessions` *(new), `settings` (durations, DND), `events` (already scheduled).
- **Available actions**: start/pause/stop session, attach task, set duration, end early, log manual time.
- **AI actions**: session wrap-up summary, smart duration vs. agenda, focus-time predictions feeding Insights.
- **Permissions**: `view`, `manage`.

### `/memory` — Life Memory (canonical owner of `memoryEntry`)
- **Purpose**: The chronological archive of your life — auto-captured moments, imports (photos, locations, messages), and manual entries, browsed as a timeline with people and places.
- **User type**: Resident (Guest: view only, future).
- **Entry**: More, journal/insights cross-links, ⌘P, global search.
- **Exit**: entry detail (`/memory/entries/:id` modal), related journal note, related attachments, people/places filters.
- **Child routes**: `/memory/entries/:id` (modal), `/memory?period=` (query), `/notebook` (embedded refs).
- **Required data**: `memoryEntries` *(new), `attachments`, `profile`, `settings` (region/timezone), optional imports.
- **Available actions**: add/edit/archive memory entry, attach media, tag person/place, timeline filters (year/month/all), merge duplicates, export.
- **AI actions**: “What happened this week/month/year”, memory search (semantic), “capture this moment” from a photo, organize import batch, weekly memory letter draft.
- **Permissions**: `view`, `manage`, `delete` (confirm); import gated.

### `/journal` — Journal (canonical owner of `journalEntry`)
- **Purpose**: Daily reflective writing — one entry per day, with the day’s record (tasks done, captured moments, notes) beside the blank page. Distinct from Memory: narrative today, archive of the past.
- **User type**: Resident (Guest: personal pages hidden).
- **Entry**: More, Today footer “journal”, ⌘P, `/journal?date=YYYY-MM-DD`, search.
- **Exit**: write → autosave; reference a memory, task, or note inline; jump to related week in Insights.
- **Child routes**: `/journal/:date` (that day’s entry, modal-friendly), `/memory` (embed picker), `/notes/:id` (ref modal).
- **Required data**: `journalEntries` *(new), `tasks` (day record), `memoryEntries` (refs), `notes` (refs), `settings`.
- **Available actions**: write/edit entry (autosave), attach refs, set mood/energy, backfill/forward, export, delete.
- **AI actions**: “draft from today” (prompted from the day’s record), gentle retrieval questions, weekly/monthly review from entries, mood trend line.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/planner` — Planner (canonical owner of `timeBlock`)
- **Purpose**: The planning surface — design your week by placing time blocks, rituals, focus slots, and sequences; the Calendar displays the result.
- **User type**: Resident.
- **Entry**: More, Calendar “plan”, Today “Plan my day”, ⌘P, `/planner?week=YYYY-Www`.
- **Exit**: commit blocks → Calendar/agenda; deep link a task (`/tasks/:id`), focus slot (`/focus/session/:id`), or block (`/planner/block/new`).
- **Child routes**: `/planner/block/new` (drawer), `/planner?week=` (query), `/tasks/:id` (modal).
- **Required data**: `timeBlocks`, `events` (read-only), `tasks` (drag candidates), `habits` (rituals), `rewards` (consistency), `settings`.
- **Available actions**: create/move/copy/duplicate time blocks, drag tasks onto days, auto-fill open slots, save week as template, undo/reset.
- **AI actions**: “build my week” (auto-place tasks + rituals in open slots), “protect focus” (block DND), template regeneration, time-budget report.
- **Permissions**: `view`, `manage`; `delete` (confirm).

### `/insights` — Insights (Stage 5 Learning)
- **Purpose**: Patterns from your own history — completion, time-to-finish, energy windows, reviewed by AI into weekly letters.
- **User type**: Resident.
- **Entry**: More, journal review links, ⌘P, “Ask Insights” from capture.
- **Exit**: question → answer `aiObject` (`/ai/objects/:id`), drill into a source list (`/tasks`, `/habits`, `/journal`, `/memory`).
- **Child routes**: `/insights?range=` (query), `/ai/objects/:id` (answer modal), entity lenses.
- **Required data**: read-only across `tasks`, `habitCheckins`, `timeBlocks`, `journalEntries`, `memoryEntries`, `profile`.
- **Available actions**: pick range/dimension, save a view, export report, ask a natural-language question.
- **AI actions**: weekly review draft, estimate calibration, burnout/cluster warnings, energy-window detection, semantic memory search answers.
- **Permissions**: `view` (read-only area; no mutations).

### `/work` — Work (canonical owner of the `project`/area)
- **Purpose**: Projects & areas — the container that pulls together tasks, notes, goals, and planner effort by area. Not a second task list; a scoped lens plus project management.
- **User type**: Resident.
- **Entry**: More, project chips on task rows/notes, capture `#tag`, ⌘P, search.
- **Exit**: any item → its home area (`/tasks`, `/notes`, `/goals`, `/planner`), project settings drawer (`/work/projects/:id/settings`).
- **Child routes**: `/work/projects/:id` (area board: tasks + notes + goals + effort), `/work/projects/:id/settings` (drawer).
- **Required data**: `projects`, `tasks` (project-linked), `notes` (linked), `goals` (linked), `timeBlocks` (effort), `settings`.
- **Available actions**: create/edit/archive/delete project, add item to area, reorder, rename, set area goal, export area.
- **AI actions**: “area brief” (auto-summary of state), suggest project → goal link, weekly area digest, “what did I ship in X”.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/notebook` — Digital Notebook (canonical owner of `notebook` + `page`)
- **Purpose**: Long-form workspace — notebooks of pages with structure, linking, blocks, and templates. Notes are atoms; notebook pages are essays/compilations.
- **User type**: Resident.
- **Entry**: More, promote from `/notes/:id`, templates, search, ⌘P.
- **Exit**: page edit is inline; links resolve to `/notes/:id`, `/templates/:id`, `/journal/:date`, `/memory/entries/:id`.
- **Child routes**: `/notebook/:book` (page list), `/notebook/:book/:page` (page), `/notebook/:book/:page/details` (drawer).
- **Required data**: `notebooks` *(new), `pages` *(new), `notes` (links), `templates`, `aiObjects` (page drafts), `attachments`.
- **Available actions**: create notebook/page, block editing (heading/text/list/quote/code/image), link entities, drag reorder, export (md/pdf), duplicate page from template, delete.
- **AI actions**: outline from a prompt, “continue”, summarize section, backlink suggestions, auto-TOC, page → journal/notes extraction.
- **Permissions**: `view`, `manage`, `delete` (confirm), export.

### `/templates` — Templates (canonical owner of `template`)
- **Purpose**: Reusable skeletons — task templates, note templates, day/week plans, project setups, journal prompts, notebook page seeds.
- **User type**: Resident.
- **Entry**: More, create-from flows across areas, capture (`from "name"`), ⌘P, duplicating any existing structure “Save as template”.
- **Exit**: instantiate → lands in the owning area (`/tasks`, `/notes`, `/planner`, `/work`, `/journal`, `/notebook`).
- **Child routes**: `/templates/:id` (modal preview), `/templates/new` (drawer).
- **Required data**: `templates` *(new), referenced entity schemas (source shapes), `settings`.
- **Available actions**: create, edit fields/blocks, preview, duplicate, categorize, archive, delete, use-now.
- **AI actions**: “learn this as a template”, generate template from description, suggest fill values from context, smart defaults.
- **Permissions**: `view`, `manage`, `delete` (confirm).

### `/rewards` — Rewards (canonical owner of `reward`)
- **Purpose**: The gentle game layer over consistency — streaks, gems, milestones earned from habits and goals; nothing is invented, all rewards derive from real check-ins and completions.
- **User type**: Resident.
- **Entry**: More, streaks/milestones toasts from `/habits` & `/goals`, ⌘P.
- **Exit**: drill into the streak’s habit (`/habits/:id`) or goal (`/goals/:id`); settings for quiet mode.
- **Child routes**: `/rewards` (ledger by period), `/rewards?history=` (query).
- **Required data**: `habits`, `habitCheckins`, `goals`, `rewards` *(new) — read-mostly.
- **Available actions**: browse milestones, redeem (destructive confirm), mute category, export ledger.
- **AI actions**: “tell me what’s compounding”, celebrate quietly, motivate only when useful (respect quiet mode).
- **Permissions**: `view`, `manage` on own ledger.

### `/integrations` — Integrations
- **Purpose**: The connection registry — calendar providers, file/Dropbox-local stores, AI model providers, export targets. Local-first stays; integrations import/export only with explicit consent.
- **User type**: Resident.
- **Entry**: More, first-run setup, deep links `/integrations/:id/connect`, data imports.
- **Exit**: connect → authorized state + back to source flow; each provider has a drawer.
- **Child routes**: `/integrations/:id/connect` (drawer OAuth/local consent).
- **Required data**: `integrations` *(new) connection records, `profile`, `settings`.
- **Available actions**: list, connect/disconnect, grant/revoke scopes, schedule sync, test, delete connection.
- **AI actions**: provider mapping suggestions, import triage (`/inbox`), sync conflict report.
- **Permissions**: `integrations.connect`, `view`, `delete` (confirm). Secrets never in state/schema — only session-scoped.

### `/settings` — Settings
- **Purpose**: OS settings — profile, appearance (theme/formats/week start), data (backup/restore/clear), shortcuts, AI defaults, about.
- **User type**: Resident (Guest: reduced to appearance).
- **Entry**: More, avatar (top bar), ⌘P “Open Settings”.
- **Exit**: toggles persist locally; data actions toast results; clear-all keeps a confirm; nothing else navigates away.
- **Child routes**: `/settings/:section` (profile | appearance | data | shortcuts | ai) — drawer routes.
- **Required data**: `profile`, `settings`, state stats (counts, version), `integrations` (status), `aiObjects` (counts).
- **Available actions**: edit display name, theme/time/week-start segmented control, export backup, import backup, clear all, add shortcuts reference, configure AI defaults.
- **AI actions**: import triage helper, backup integrity report (local, no telemetry).
- **Permissions**: `settings.system`, `data.import`, `data.export`, `data.clear` (double-confirm).

### `/styleguide` — Design system (dev utility, omitted from product nav)
- **Purpose**: Living spec of tokens, controls, feedback, and data components (Stage 1). Entry: sidebar footer (dev) only.
- **Permissions**: `view`; effectively hidden from Guests.

---

## 7. Keyboards (global)

| Shortcut | Action |
| --- | --- |
| `⌘K` | Universal Capture |
| `⌘P` | Command palette |
| `⌘O` or `/` | Global search |
| `Esc` | Close topmost overlay |
| `T` | Go to Today |
| `G then {p}` | Palette-alias two-key navigation (G = go) |
| `/` in any list | focuses the filter |

---

## 8. Growth rules (how this stays understandable)

1. A new capability first appears **under More**. It earns a primary slot only when its usage/importance is proven and the 8-item list stays justified — primary promotion is a deliberate act, not a default.
2. A new entity gets **exactly one** owning route (section 3). Adding a second list for an existing entity is a bug.
3. New routes are added to `src/lib/ia/routes.ts` **and** this document in the same change; nav, palette, search, and breadcrumbs consume the registry — no hand-edited nav lists.
4. Overlays (modal/drawer) are preferred over new top-level pages for detail, secondary tasks, and settings.
5. Naming: a route’s canonical label is its deep-link slug; renaming requires updating registry + search keywords + this doc together.
6. AI actions never create top-level nav; they are verbs on existing surfaces, producing `aiObject`s in `/ai`.