import type { Timestamp } from "../types/common";
import { emptyTomorrow, journalDateKey } from "../types/journal";
import { createDefaultMobilePreferences } from "../types/mobile";
import { createDefaultPlanningPreferences, createDefaultSettings, createProfile, type Profile, type Settings } from "../types/profile";
import {
  COLLECTIONS,
  SCHEMA_VERSION,
  createEmptyCollections,
  toPersistedState,
  type AppState,
  type Collections,
  type PersistedState,
} from "./state";

export const PERSIST_KEY = "personalos:data";
export const BACKUP_KEY_PREFIX = "personalos:backup:";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

export function createBrowserStorage(): StorageAdapter | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage;
    const probe = "__personalos_probe__";
    raw.setItem(probe, "1");
    raw.removeItem(probe);
    return {
      getItem(key) {
        return raw.getItem(key);
      },
      setItem(key, value) {
        raw.setItem(key, value);
      },
      removeItem(key) {
        raw.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}

export interface PersistEnvelope {
  version: number;
  savedAt: Timestamp;
  state: PersistedState;
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

function normalizeTaskStatus(value: unknown): string {
  const allowed = ["inbox", "open", "in_progress", "review", "done", "cancelled", "archived"];
  return typeof value === "string" && allowed.includes(value) ? value : "open";
}

const MIGRATIONS: Record<number, Migration> = {
  24: (state) => {
    const meetings = state.meetings as Record<string, Record<string, unknown>> | undefined;
    if (meetings) {
      for (const meeting of Object.values(meetings)) {
        if (!Array.isArray(meeting.attendees)) meeting.attendees = [];
        if (!("recurrence" in meeting)) meeting.recurrence = null;
        if (!("recurrenceId" in meeting)) meeting.recurrenceId = null;
        if (!("recurrenceOrdinal" in meeting)) meeting.recurrenceOrdinal = 1;
      }
    }
    const reminders = state.reminders as Record<string, Record<string, unknown>> | undefined;
    if (reminders) {
      for (const reminder of Object.values(reminders)) {
        if (!("meetingId" in reminder)) reminder.meetingId = null;
      }
    }
    return state;
  },
  23: (state) => {
    const messages = state.aiMessages as Record<string, Record<string, unknown>> | undefined;
    if (messages) {
      for (const message of Object.values(messages)) {
        if (!("feedback" in message)) message.feedback = null;
      }
    }
    const settings = state.settings as Record<string, unknown> | undefined;
    if (settings && (!("aiProvider" in settings) || typeof settings.aiProvider !== "string")) {
      settings.aiProvider = "local";
    }
    return state;
  },
  22: (state) => {
    const messages = state.aiMessages as Record<string, Record<string, unknown>> | undefined;
    if (messages) {
      for (const message of Object.values(messages)) {
        if (!("result" in message)) message.result = null;
      }
    }
    return state;
  },
  1: (state) => {
    const tasks = state.tasks as Record<string, Record<string, unknown>> | undefined;
    if (tasks) {
      for (const task of Object.values(tasks)) {
        if (!("dependsOn" in task)) task.dependsOn = [];
        if (!("recurrenceId" in task)) task.recurrenceId = null;
        if (!("recurrenceOrdinal" in task)) task.recurrenceOrdinal = 1;
        if (task.status !== "review") task.status = normalizeTaskStatus(task.status);
      }
    }
    return state;
  },
  2: (state) => {
    const events = state.events as Record<string, Record<string, unknown>> | undefined;
    if (events) {
      for (const event of Object.values(events)) {
        if (!("attendees" in event)) event.attendees = [];
        if (!("categoryId" in event)) event.categoryId = null;
        if (!("color" in event)) event.color = null;
        if (!("recurrence" in event)) event.recurrence = null;
        if (!("recurrenceId" in event)) event.recurrenceId = null;
        if (!("recurrenceOrdinal" in event)) event.recurrenceOrdinal = 1;
        if (!("reminderIds" in event)) event.reminderIds = [];
      }
    }
    return state;
  },
  3: (state) => {
    const blocks = state.timeBlocks as Record<string, Record<string, unknown>> | undefined;
    if (blocks) {
      for (const block of Object.values(blocks)) {
        if (!("source" in block)) block.source = "manual";
      }
    }
    const settings = state.settings as Record<string, unknown> | undefined;
    if (settings && typeof settings === "object") {
      const planning = createDefaultPlanningPreferences();
      const stored = settings.planning as Record<string, unknown> | undefined;
      if (stored && typeof stored === "object") {
        settings.planning = { ...planning, ...stored };
      } else {
        settings.planning = planning;
      }
    }
    return state;
  },
  4: (state) => {
    const goals = state.goals as Record<string, Record<string, unknown>> | undefined;
    if (goals) {
      for (const goal of Object.values(goals)) {
        if (!("metrics" in goal)) {
          const metric = goal.metric as Record<string, unknown> | null | undefined;
          goal.metrics = metric && typeof metric === "object" ? [metric] : [];
        }
      }
    }
    const habits = state.habits as Record<string, Record<string, unknown>> | undefined;
    if (habits) {
      for (const habit of Object.values(habits)) {
        if (!("daysOfMonth" in habit)) habit.daysOfMonth = [];
      }
    }
    const routines = state.routines as Record<string, Record<string, unknown>> | undefined;
    if (routines) {
      for (const routine of Object.values(routines)) {
        if (!("slot" in routine)) routine.slot = "custom";
        const steps = routine.steps;
        if (Array.isArray(steps)) {
          for (const step of steps) {
            if (step && typeof step === "object" && !("habitId" in step)) {
              (step as Record<string, unknown>).habitId = null;
            }
          }
        }
      }
    }
    return state;
  },
  5: (state) => {
    const notes = state.notes as Record<string, Record<string, unknown>> | undefined;
    if (notes) {
      for (const note of Object.values(notes)) {
        if (!("blocks" in note)) note.blocks = [{ id: `block-${Date.now()}-${Math.random()}`, type: "paragraph", content: note.body ?? "" }];
        if (!("folderId" in note)) note.folderId = null;
        if (!("notebookId" in note)) note.notebookId = null;
        if (!("status" in note)) note.status = "active";
        if (!("trashedAt" in note)) note.trashedAt = null;
        if (!("wordCount" in note)) note.wordCount = (note.body as string ?? "").trim().split(/\s+/).filter(Boolean).length;
        if (!("readingTimeMinutes" in note)) note.readingTimeMinutes = Math.max(1, Math.ceil((note.wordCount as number) / 200));
        if (!("searchVector" in note)) note.searchVector = (note.body as string ?? "").toLowerCase();
        if (!("embedding" in note)) note.embedding = null;
        if (!("aiSummary" in note)) note.aiSummary = null;
        if (!("aiKeyPoints" in note)) note.aiKeyPoints = [];
        if (!("aiEntities" in note)) note.aiEntities = [];
        if (!("relatedNoteIds" in note)) note.relatedNoteIds = [];
        if (!("lastEditedAt" in note)) note.lastEditedAt = note.updatedAt ?? Date.now();
      }
    }
    const pages = state.pages as Record<string, Record<string, unknown>> | undefined;
    if (pages) {
      for (const page of Object.values(pages)) {
        if (!("blocks" in page)) page.blocks = [{ id: `block-${Date.now()}-${Math.random()}`, type: "paragraph", content: page.body ?? "" }];
        if (!("tags" in page)) page.tags = [];
        if (!("folderId" in page)) page.folderId = null;
        if (!("status" in page)) page.status = "active";
        if (!("trashedAt" in page)) page.trashedAt = null;
        if (!("wordCount" in page)) page.wordCount = (page.body as string ?? "").trim().split(/\s+/).filter(Boolean).length;
        if (!("readingTimeMinutes" in page)) page.readingTimeMinutes = Math.max(1, Math.ceil((page.wordCount as number) / 200));
        if (!("searchVector" in page)) page.searchVector = (page.body as string ?? "").toLowerCase();
        if (!("embedding" in page)) page.embedding = null;
        if (!("aiSummary" in page)) page.aiSummary = null;
        if (!("aiKeyPoints" in page)) page.aiKeyPoints = [];
        if (!("aiEntities" in page)) page.aiEntities = [];
        if (!("relatedPageIds" in page)) page.relatedPageIds = [];
        if (!("refs" in page)) page.refs = [];
        if (!("lastEditedAt" in page)) page.lastEditedAt = page.updatedAt ?? Date.now();
      }
    }
    const docs = state.documents as Record<string, Record<string, unknown>> | undefined;
    if (docs) {
      for (const doc of Object.values(docs)) {
        if (!("folderId" in doc)) doc.folderId = null;
        if (!("status" in doc) || doc.status === "processing") doc.status = "ready";
        if (!("trashedAt" in doc)) doc.trashedAt = null;
        if (!("pageCount" in doc)) doc.pageCount = 0;
        if (!("embedding" in doc)) doc.embedding = null;
        if (!("aiSummary" in doc)) doc.aiSummary = null;
        if (!("aiKeyPoints" in doc)) doc.aiKeyPoints = [];
        if (!("aiEntities" in doc)) doc.aiEntities = [];
        if (!("relatedDocumentIds" in doc)) doc.relatedDocumentIds = [];
      }
    }
    const recordings = state.recordings as Record<string, Record<string, unknown>> | undefined;
    if (recordings) {
      for (const rec of Object.values(recordings)) {
        if (!("tags" in rec)) rec.tags = [];
        if (!("folderId" in rec)) rec.folderId = null;
        if (!("status" in rec) || rec.status === "recording") rec.status = "ready";
        if (!("trashedAt" in rec)) rec.trashedAt = null;
        if (!("embedding" in rec)) rec.embedding = null;
        if (!("aiSummary" in rec)) rec.aiSummary = null;
        if (!("aiKeyPoints" in rec)) rec.aiKeyPoints = [];
        if (!("aiActionItems" in rec)) rec.aiActionItems = [];
        if (!("aiSpeakers" in rec)) rec.aiSpeakers = [];
      }
    }
    const transcripts = state.transcripts as Record<string, Record<string, unknown>> | undefined;
    if (transcripts) {
      for (const tr of Object.values(transcripts)) {
        if (!("folderId" in tr)) tr.folderId = null;
        if (!("status" in tr) || tr.status === "processing") tr.status = "ready";
        if (!("trashedAt" in tr)) tr.trashedAt = null;
        if (!("embedding" in tr)) tr.embedding = null;
        if (!("aiSummary" in tr)) tr.aiSummary = null;
        if (!("aiKeyPoints" in tr)) tr.aiKeyPoints = [];
        if (!("aiActionItems" in tr)) tr.aiActionItems = [];
        if (!("aiDecisions" in tr)) tr.aiDecisions = [];
        if (!("aiEntities" in tr)) tr.aiEntities = [];
      }
    }
    const journals = state.journalEntries as Record<string, Record<string, unknown>> | undefined;
    if (journals) {
      for (const j of Object.values(journals)) {
        if (!("blocks" in j)) j.blocks = [{ id: `block-${Date.now()}-${Math.random()}`, type: "paragraph", content: j.body ?? "" }];
        if (!("status" in j)) j.status = "draft";
        if (!("trashedAt" in j)) j.trashedAt = null;
        if (!("wordCount" in j)) j.wordCount = (j.body as string ?? "").trim().split(/\s+/).filter(Boolean).length;
        if (!("readingTimeMinutes" in j)) j.readingTimeMinutes = Math.max(1, Math.ceil((j.wordCount as number) / 200));
        if (!("searchVector" in j)) j.searchVector = (j.body as string ?? "").toLowerCase();
        if (!("embedding" in j)) j.embedding = null;
        if (!("aiSummary" in j)) j.aiSummary = null;
        if (!("aiKeyPoints" in j)) j.aiKeyPoints = [];
        if (!("aiEntities" in j)) j.aiEntities = [];
        if (!("relatedEntryIds" in j)) j.relatedEntryIds = [];
      }
    }
    const memories = state.lifeMemories as Record<string, Record<string, unknown>> | undefined;
    if (memories) {
      for (const m of Object.values(memories)) {
        if (!("embedding" in m)) m.embedding = null;
        if (!("relatedMemoryIds" in m)) m.relatedMemoryIds = [];
        if (!("relatedNoteIds" in m)) m.relatedNoteIds = [];
        if (!("relatedPageIds" in m)) m.relatedPageIds = [];
        if (!("relatedDocumentIds" in m)) m.relatedDocumentIds = [];
      }
    }
    const memoryMoments = state.memoryMoments as Record<string, Record<string, unknown>> | undefined;
    if (memoryMoments) {
      for (const moment of Object.values(memoryMoments)) {
        if (!("place" in moment)) moment.place = null;
        if (!("tags" in moment)) moment.tags = [];
        if (!("attachmentIds" in moment)) moment.attachmentIds = [];
        if (!("people" in moment)) moment.people = [];
        if (!("favorite" in moment)) moment.favorite = false;
        if (!("relatedEntityIds" in moment)) moment.relatedEntityIds = [];
        if (!("bookAuthor" in moment)) moment.bookAuthor = "";
        if (!("kind" in moment)) moment.kind = "note";
        if (!("category" in moment)) moment.category = "other";
      }
    }
    const notebooks = state.notebooks as Record<string, Record<string, unknown>> | undefined;
    if (notebooks) {
      for (const n of Object.values(notebooks)) {
        if (!("embedding" in n)) n.embedding = null;
        if (!("aiSummary" in n)) n.aiSummary = null;
      }
    }
    const meetings = state.meetings as Record<string, Record<string, unknown>> | undefined;
    if (meetings) {
      for (const m of Object.values(meetings)) {
        if (!("embedding" in m)) m.embedding = null;
        if (!("aiSummary" in m)) m.aiSummary = null;
        if (!("aiActionItems" in m)) m.aiActionItems = [];
        if (!("aiDecisions" in m)) m.aiDecisions = [];
        if (!("aiKeyPoints" in m)) m.aiKeyPoints = [];
      }
    }
    return state;
  },
  6: (state) => {
    const items = state.lifeMemoryItems as Record<string, Record<string, unknown>> | undefined;
    if (items) {
      for (const item of Object.values(items)) {
        if (!("category" in item)) item.category = "other";
        if (!("tags" in item)) item.tags = [];
        if (!("targetIntervalDays" in item)) item.targetIntervalDays = null;
        if (!("thresholdDays" in item)) item.thresholdDays = 14;
        if (!("notes" in item)) item.notes = "";
        if (!("lastCompletedAt" in item)) item.lastCompletedAt = null;
        if (!("history" in item)) item.history = [];
        if (!("status" in item)) item.status = "active";
        if (!("trashedAt" in item)) item.trashedAt = null;
        if (!("searchVector" in item)) item.searchVector = "";
        if (!("embedding" in item)) item.embedding = null;
        if (!("linkedGoalIds" in item)) item.linkedGoalIds = [];
      }
    }
    return state;
  },
  7: (state) => {
    const sessions = state.focusSessions as Record<string, Record<string, unknown>> | undefined;
    if (sessions) {
      for (const session of Object.values(sessions)) {
        if (!("goalId" in session)) session.goalId = null;
        if (!("distractions" in session)) session.distractions = [];
        if (!("distractionCount" in session)) session.distractionCount = 0;
        if (!("pausedAt" in session)) session.pausedAt = null;
        if (!("pausedMs" in session)) session.pausedMs = 0;
        if (!("activeMs" in session)) session.activeMs = 0;
        if (!("rounds" in session)) session.rounds = [];
        if (!("ambient" in session)) session.ambient = "none";
        if (!("completedAt" in session)) session.completedAt = null;
        if (!("rating" in session)) session.rating = null;
        if (!("note" in session)) session.note = "";
      }
    }
    return state;
  },
  8: (state) => {
    const transcripts = state.transcripts as Record<string, Record<string, unknown>> | undefined;
    if (transcripts) {
      for (const transcript of Object.values(transcripts)) {
        if (!("segments" in transcript)) transcript.segments = [];
        if (!("aiActionItems" in transcript)) transcript.aiActionItems = [];
        if (!("aiDecisions" in transcript)) transcript.aiDecisions = [];
        if (!("aiEntities" in transcript)) transcript.aiEntities = [];
        if (!("folderId" in transcript)) transcript.folderId = null;
        if (!("trashedAt" in transcript)) transcript.trashedAt = null;
        if (!("confidence" in transcript)) transcript.confidence = null;
        if (!("language" in transcript)) transcript.language = "en";
      }
    }
    const recordings = state.recordings as Record<string, Record<string, unknown>> | undefined;
    if (recordings) {
      for (const rec of Object.values(recordings)) {
        if (!("tags" in rec)) rec.tags = [];
        if (!("folderId" in rec)) rec.folderId = null;
        if (!("trashedAt" in rec)) rec.trashedAt = null;
        if (!("aiSummary" in rec)) rec.aiSummary = null;
        if (!("aiKeyPoints" in rec)) rec.aiKeyPoints = [];
        if (!("aiActionItems" in rec)) rec.aiActionItems = [];
        if (!("aiSpeakers" in rec)) rec.aiSpeakers = [];
      }
    }
    const meetings = state.meetings as Record<string, Record<string, unknown>> | undefined;
    if (meetings) {
      for (const meeting of Object.values(meetings)) {
        if (!("tags" in meeting)) meeting.tags = [];
        if (!("aiSummary" in meeting)) meeting.aiSummary = null;
        if (!("aiActionItems" in meeting)) meeting.aiActionItems = [];
        if (!("aiDecisions" in meeting)) meeting.aiDecisions = [];
        if (!("aiKeyPoints" in meeting)) meeting.aiKeyPoints = [];
      }
    }
    return state;
  },
  9: (state) => {
    for (const name of ["paperNotebooks", "paperPages", "paperLayers", "paperStrokes", "paperImages", "paperStickers", "paperDiagrams", "paperRecognitions"]) {
      const collection = state[name] as Record<string, Record<string, unknown>> | undefined;
      if (collection) {
        for (const entity of Object.values(collection)) {
          if (!("status" in entity)) entity.status = "active";
        }
      }
    }
    return state;
  },
  10: (state) => {
    for (const name of ["skills", "coinLedger", "achievements", "rewards", "xpTransactions"]) {
      const collection = state[name] as Record<string, Record<string, unknown>> | undefined;
      if (collection) {
        for (const entity of Object.values(collection)) {
          if (!("status" in entity)) entity.status = "locked";
          if (!("level" in entity)) entity.level = 1;
          if (!("xp" in entity)) entity.xp = 0;
          if (!("coins" in entity)) entity.coins = 0;
        }
      }
    }
    return state;
  },
  11: (state) => {
    for (const name of ["tasks", "projects", "notes", "events", "users", "workspaces", "teams", "members", "shifts", "approvals"]) {
      const collection = state[name] as Record<string, Record<string, unknown>> | undefined;
      if (collection) {
        for (const entity of Object.values(collection)) {
          if (!("mode" in entity)) entity.mode = "personal";
          if (!("sharedWith" in entity)) entity.sharedWith = [];
          if (!("workspaceId" in entity)) entity.workspaceId = null;
        }
      }
    }
    return state;
  },
  12: (state) => {
    const integrations = state.integrations as Record<string, Record<string, unknown>> | undefined;
    if (integrations) {
      for (const integration of Object.values(integrations)) {
        if (!("credentialRef" in integration)) integration.credentialRef = null;
        if (!("externalAccountId" in integration)) integration.externalAccountId = null;
        if (!("tokenExpiresAt" in integration)) integration.tokenExpiresAt = null;
        if (!("lastErrorAt" in integration)) integration.lastErrorAt = null;
        if (!("connectedAt" in integration)) integration.connectedAt = null;
        if (!("direction" in integration)) integration.direction = "inbound";
        if (!("settings" in integration) || typeof integration.settings !== "object" || integration.settings === null) {
          integration.settings = {
            autoSync: true,
            pushBack: false,
            importRangeDays: 90,
            conflictStrategy: "manual",
            targetCalendarId: null,
            webhookEnabled: false,
          };
        }
      }
    }
    return state;
  },
  13: (state) => {
    const journalEntries = state.journalEntries as Record<string, Record<string, unknown>> | undefined;
    if (journalEntries) {
      for (const entry of Object.values(journalEntries)) {
        if (!("dateKey" in entry) || typeof entry.dateKey !== "string") {
          const at = typeof entry.entryDate === "number" ? entry.entryDate : Date.now();
          entry.dateKey = journalDateKey(at);
        }
        if (!("customMood" in entry)) entry.customMood = null;
        if (!("productivity" in entry)) entry.productivity = null;
        if (!("weather" in entry)) entry.weather = null;
        if (!("location" in entry)) entry.location = null;
        if (!("people" in entry)) entry.people = [];
        if (!("activities" in entry)) entry.activities = [];
        if (!("highlights" in entry)) entry.highlights = [];
        if (!("challenges" in entry)) entry.challenges = [];
        if (!("gratitude" in entry)) entry.gratitude = [];
        if (!("lessons" in entry)) entry.lessons = "";
        if (!("improvements" in entry)) entry.improvements = "";
        if (!("tomorrow" in entry)) entry.tomorrow = emptyTomorrow();
        if (!("taskIds" in entry)) entry.taskIds = [];
        if (!("habitIds" in entry)) entry.habitIds = [];
        if (!("goalIds" in entry)) entry.goalIds = [];
        if (!("eventIds" in entry)) entry.eventIds = [];
        if (!("lifeMemoryIds" in entry)) entry.lifeMemoryIds = [];
        if (!("attachmentIds" in entry)) entry.attachmentIds = [];
        if (!("templateId" in entry)) entry.templateId = null;
        if (!("privacy" in entry)) entry.privacy = "private";
        if (!("blocks" in entry) || !Array.isArray(entry.blocks)) entry.blocks = [];
        if (!("tags" in entry) || !Array.isArray(entry.tags)) entry.tags = [];
        if (!("observationOnly" in entry)) entry.observationOnly = true;
      }
    }
    return state;
  },
  14: (state) => {
    const settings = state.settings as unknown as Record<string, unknown> | undefined;
    if (settings) {
      if (!("mobile" in settings) || typeof settings.mobile !== "object" || settings.mobile === null) {
        settings.mobile = createDefaultMobilePreferences();
      }
    }
    return state;
  },
  15: (state) => {
    const goals = state.goals as Record<string, Record<string, unknown>> | undefined;
    if (goals) {
      for (const goal of Object.values(goals)) {
        if (!("category" in goal)) goal.category = "other";
        if (!("coverUrl" in goal)) goal.coverUrl = null;
      }
    }
    return state;
  },
  16: (state) => {
    const habits = state.habits as Record<string, Record<string, unknown>> | undefined;
    if (habits) {
      for (const habit of Object.values(habits)) {
        if (!("description" in habit)) habit.description = null;
        if (!("priority" in habit)) habit.priority = "medium";
      }
    }
    return state;
  },
  17: (state) => {
    const notes = state.notes as Record<string, Record<string, unknown>> | undefined;
    if (notes) {
      for (const note of Object.values(notes)) {
        if (!("icon" in note)) note.icon = null;
        if (!("taskIds" in note) || !Array.isArray(note.taskIds)) note.taskIds = [];
      }
    }
    return state;
  },
  18: (state) => {
    const pages = state.paperPages as Record<string, Record<string, unknown>> | undefined;
    if (pages) {
      for (const page of Object.values(pages)) {
        if (!("kind" in page)) page.kind = "handwritten";
        if (!("folderId" in page)) page.folderId = null;
        if (!("tags" in page) || !Array.isArray(page.tags)) page.tags = [];
        if (!("favorite" in page)) page.favorite = false;
        if (!("shared" in page)) page.shared = false;
        if (!("textContent" in page) || typeof page.textContent !== "string") page.textContent = "";
        if (!("wordCount" in page) || typeof page.wordCount !== "number") page.wordCount = 0;
      }
    }
    return state;
  },
  21: (state) => {
    const messages = state.aiMessages as Record<string, Record<string, unknown>> | undefined;
    if (messages) {
      for (const message of Object.values(messages)) {
        if (!("result" in message)) message.result = null;
      }
    }
    return state;
  },
  20: (state) => {
    const notes = state.notes as Record<string, Record<string, unknown>> | undefined;
    if (notes) {
      for (const note of Object.values(notes)) {
        if (!("versions" in note) || !Array.isArray(note.versions)) note.versions = [];
      }
    }
    return state;
  },
  19: (state) => {
    const templates = state.templates as Record<string, Record<string, unknown>> | undefined;
    if (templates) {
      for (const template of Object.values(templates)) {
        if (!("description" in template) || typeof template.description !== "string") {
          template.description = "";
        }
        if (!("category" in template) || typeof template.category !== "string") {
          template.category = "productivity";
        }
        if (!("templateKind" in template) || typeof template.templateKind !== "string") {
          template.templateKind = "planner";
        }
        if (!("items" in template) || !Array.isArray(template.items)) template.items = [];
        if (!("popularity" in template) || typeof template.popularity !== "number") {
          template.popularity = 0;
        }
        if (!("useCount" in template) || typeof template.useCount !== "number") {
          template.useCount = 0;
        }
        if (!("favorite" in template) || typeof template.favorite !== "boolean") {
          template.favorite = false;
        }
        if (!("lastUsedAt" in template)) template.lastUsedAt = null;
        if (!("source" in template) || typeof template.source !== "string") {
          template.source = template.builtin ? "builtin" : "custom";
        }
        if (!("createdFromId" in template)) template.createdFromId = null;
      }
    }
    return state;
  },
};

export interface LoadStateResult {
  state: PersistedState | null;
  backupKey: string | null;
}

function backupRaw(storage: StorageAdapter, raw: string): string {
  const key = `${BACKUP_KEY_PREFIX}${Date.now()}`;
  try {
    storage.setItem(key, raw);
  } catch {
    return "";
  }
  return key;
}

function normalizeState(input: Partial<PersistedState>): PersistedState {
  const collections = createEmptyCollections();
  for (const name of COLLECTIONS) {
    const value = input[name];
    collections[name] = (value && typeof value === "object" ? value : {}) as never;
  }

  const habits = collections.habits as unknown as Record<string, Record<string, unknown>>;
  for (const habit of Object.values(habits)) {
    if (typeof habit.description !== "string") habit.description = null;
    if (habit.priority !== "high" && habit.priority !== "low" && habit.priority !== "medium") {
      habit.priority = "medium";
    }
  }

  const rewards = collections.rewards as unknown as Record<string, Record<string, unknown>>;
  for (const reward of Object.values(rewards)) {
    if (typeof reward.builtin !== "boolean") reward.builtin = false;
  }

  const projects = collections.projects as unknown as Record<string, Record<string, unknown>>;
  for (const project of Object.values(projects)) {
    if (
      typeof project.wipLimits !== "object" ||
      project.wipLimits === null ||
      Array.isArray(project.wipLimits)
    ) {
      project.wipLimits = {};
    }
  }

  const aiMessages = collections.aiMessages as unknown as Record<string, Record<string, unknown>>;
  for (const message of Object.values(aiMessages)) {
    if (!("result" in message)) message.result = null;
    if (!("feedback" in message)) message.feedback = null;
  }

  const meetings = collections.meetings as unknown as Record<string, Record<string, unknown>>;
  for (const meeting of Object.values(meetings)) {
    if (!Array.isArray(meeting.attendees)) meeting.attendees = [];
    if (!("recurrence" in meeting)) meeting.recurrence = null;
    if (!("recurrenceId" in meeting)) meeting.recurrenceId = null;
    if (!("recurrenceOrdinal" in meeting)) meeting.recurrenceOrdinal = 1;
  }

  const reminders = collections.reminders as unknown as Record<string, Record<string, unknown>>;
  for (const reminder of Object.values(reminders)) {
    if (!("meetingId" in reminder)) reminder.meetingId = null;
  }

  const notes = collections.notes as unknown as Record<string, Record<string, unknown>>;
  for (const note of Object.values(notes)) {
    if (typeof note.icon !== "string") note.icon = null;
    if (!Array.isArray(note.taskIds)) note.taskIds = [];
    if (!Array.isArray(note.versions)) note.versions = [];
  }

  const paperPages = collections.paperPages as unknown as Record<string, Record<string, unknown>>;
  for (const page of Object.values(paperPages)) {
    if (typeof page.kind !== "string") page.kind = "handwritten";
    if (page.folderId !== null && typeof page.folderId !== "string") page.folderId = null;
    if (!Array.isArray(page.tags)) page.tags = [];
    if (typeof page.favorite !== "boolean") page.favorite = false;
    if (typeof page.shared !== "boolean") page.shared = false;
    if (typeof page.textContent !== "string") page.textContent = "";
    if (typeof page.wordCount !== "number") page.wordCount = 0;
  }

  const templates = collections.templates as unknown as Record<string, Record<string, unknown>>;
  for (const template of Object.values(templates)) {
    if (typeof template.description !== "string") template.description = "";
    if (typeof template.category !== "string") template.category = "productivity";
    if (typeof template.templateKind !== "string") template.templateKind = "planner";
    if (!Array.isArray(template.items)) template.items = [];
    if (typeof template.popularity !== "number") template.popularity = 0;
    if (typeof template.useCount !== "number") template.useCount = 0;
    if (typeof template.favorite !== "boolean") template.favorite = false;
    if (template.lastUsedAt !== null && typeof template.lastUsedAt !== "number") {
      template.lastUsedAt = null;
    }
    if (typeof template.source !== "string") {
      template.source = template.builtin ? "builtin" : "custom";
    }
    if (template.createdFromId !== null && typeof template.createdFromId !== "string") {
      template.createdFromId = null;
    }
  }

  return {
    ...collections,
    profile: { ...createProfile(), ...(input.profile ?? ({} as Profile)) },
    settings: { ...createDefaultSettings(), ...(input.settings ?? ({} as Settings)) },
  };
}

export function serializeState(state: AppState): string {
  const envelope: PersistEnvelope = {
    version: SCHEMA_VERSION,
    savedAt: Date.now(),
    state: toPersistedState(state),
  };
  return JSON.stringify(envelope);
}

export function parseRawState(raw: string): PersistedState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("version" in parsed) ||
    typeof (parsed as PersistEnvelope).version !== "number" ||
    !("state" in parsed) ||
    !parsed.state ||
    typeof parsed.state !== "object"
  ) {
    return null;
  }

  const envelope = parsed as PersistEnvelope;
  if (envelope.version > SCHEMA_VERSION) return null;

// A missing migration must never destroy saved data: skip it and let
  // normalizeState fill the gaps from the current defaults.
  let migrating = envelope.state as unknown as Record<string, unknown>;
  for (let version = envelope.version; version < SCHEMA_VERSION; version += 1) {
    const migrate = MIGRATIONS[version];
    if (!migrate) continue;
    migrating = migrate(migrating);
  }

  return normalizeState(migrating as unknown as Partial<PersistedState>);
}

export function loadState(storage: StorageAdapter, key: string): LoadStateResult {
  const raw = storage.getItem(key);
  if (raw == null) return { state: null, backupKey: null };

  const state = parseRawState(raw);
  if (state) return { state, backupKey: null };
  return { state: null, backupKey: backupRaw(storage, raw) };
}
