import type { ID, Timestamp } from "../types/common";
import type { AIConversation, AIInsight, AIMessage } from "../types/ai";
import type { AIObject } from "../types/ai-object";
import type {
  Achievement,
  FocusSession,
  Notification,
  Reward,
  XPTransaction,
} from "../types/engagement";
import type { Attachment } from "../types/attachment";
import type { CaptureLog } from "../types/capture";
import type { CalendarEvent } from "../types/event";
import type { Goal } from "../types/goal";
import type { Habit, HabitCheckIn } from "../types/habit";
import type { LifeMemory } from "../types/knowledge";
import type { JournalEntry, JournalTemplate } from "../types/journal";
import type { LifeMemoryItem } from "../types/life-memory";
import type { MemoryMoment } from "../types/memory-moment";
import type {
  PaperDiagram,
  PaperFolder,
  PaperImage,
  PaperSticker,
  PaperLayer,
  PaperNotebook,
  PaperPage,
  PaperRecognition,
  PaperStroke,
} from "../types/paper";
import type {
  CoinLedgerEntry,
  Skill,
} from "../types/gamification";
import type {
  Share,
  Comment,
} from "../types/collaboration";
import type {
  ShiftSwap,
  ShiftPickup,
  TimeOffRequest,
} from "../types/workmode";
import type {
  ActionItem,
  Document,
  KnowledgeRelationship,
  Meeting,
  Notebook,
  Page,
  Recording,
  Transcript,
} from "../types/knowledge";
import type { Approval, Member, Shift, Team, User, Workspace } from "../types/identity";
import type { Integration } from "../types/integration";
import type { SyncConflictRecord, SyncLog } from "../types/integration";
import type { Note } from "../types/note";
import type { Folder } from "../types/folder";
import type { InboxItem } from "../types/inbox";
import type {
  Calendar,
  LifeArea,
  Milestone,
  Routine,
  Template,
} from "../types/planning";
import type { Profile, Settings } from "../types/profile";
import type { Project } from "../types/project";
import type { Reminder } from "../types/reminder";
import type { Task } from "../types/task";
import type { Category, Tag } from "../types/taxonomy";
import type { TimeBlock } from "../types/time-block";
import { createDefaultSettings, createProfile } from "../types/profile";

export const SCHEMA_VERSION = 25;

export const COLLECTIONS = [
  "tasks",
  "events",
  "notes",
  "projects",
  "goals",
  "habits",
  "habitCheckins",
  "timeBlocks",
  "reminders",
  "attachments",
  "captures",
  "aiObjects",
  "users",
  "workspaces",
  "teams",
  "members",
  "shifts",
  "approvals",
  "lifeAreas",
  "milestones",
  "routines",
  "calendars",
  "templates",
  "tags",
  "categories",
  "notebooks",
  "pages",
  "documents",
  "recordings",
  "transcripts",
  "meetings",
  "actionItems",
  "journalEntries",
  "journalTemplates",
  "lifeMemories",
  "lifeMemoryItems",
  "memoryMoments",
  "paperNotebooks",
  "paperFolders",
  "paperPages",
  "paperLayers",
  "paperStrokes",
  "paperDiagrams",
  "paperRecognitions",
  "paperImages",
  "paperStickers",
  "folders",
  "inboxItems",
  "knowledgeRelationships",
  "achievements",
  "xpTransactions",
  "rewards",
  "focusSessions",
  "notifications",
  "integrations",
  "syncConflicts",
  "syncLogs",
  "aiConversations",
  "aiMessages",
  "aiInsights",
  "skills",
  "coinLedger",
  "shares",
  "comments",
  "shiftSwaps",
  "shiftPickups",
  "timeOffRequests",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export interface EntityMap {
  tasks: Task;
  events: CalendarEvent;
  notes: Note;
  projects: Project;
  goals: Goal;
  habits: Habit;
  habitCheckins: HabitCheckIn;
  timeBlocks: TimeBlock;
  reminders: Reminder;
  attachments: Attachment;
  captures: CaptureLog;
  aiObjects: AIObject;
  users: User;
  workspaces: Workspace;
  teams: Team;
  members: Member;
  shifts: Shift;
  approvals: Approval;
  lifeAreas: LifeArea;
  milestones: Milestone;
  routines: Routine;
  calendars: Calendar;
  templates: Template;
  tags: Tag;
  categories: Category;
  notebooks: Notebook;
  pages: Page;
  documents: Document;
  recordings: Recording;
  transcripts: Transcript;
  meetings: Meeting;
  actionItems: ActionItem;
  journalEntries: JournalEntry;
  journalTemplates: JournalTemplate;
  lifeMemories: LifeMemory;
  lifeMemoryItems: LifeMemoryItem;
  memoryMoments: MemoryMoment;
  paperNotebooks: PaperNotebook;
  paperFolders: PaperFolder;
  paperPages: PaperPage;
  paperLayers: PaperLayer;
  paperStrokes: PaperStroke;
  paperDiagrams: PaperDiagram;
  paperRecognitions: PaperRecognition;
  paperImages: PaperImage;
  paperStickers: PaperSticker;
  folders: Folder;
  inboxItems: InboxItem;
  knowledgeRelationships: KnowledgeRelationship;
  achievements: Achievement;
  xpTransactions: XPTransaction;
  rewards: Reward;
  focusSessions: FocusSession;
  notifications: Notification;
  integrations: Integration;
  syncConflicts: SyncConflictRecord;
  syncLogs: SyncLog;
  aiConversations: AIConversation;
  aiMessages: AIMessage;
  aiInsights: AIInsight;
  skills: Skill;
  coinLedger: CoinLedgerEntry;
  shares: Share;
  comments: Comment;
  shiftSwaps: ShiftSwap;
  shiftPickups: ShiftPickup;
  timeOffRequests: TimeOffRequest;
}

export type Collections = {
  [K in CollectionName]: Record<ID, EntityMap[K]>;
};

export interface PersistedState extends Collections {
  profile: Profile;
  settings: Settings;
}

export interface AppState extends PersistedState {
  version: number;
  hydrated: boolean;
}

export function createEmptyCollections(): Collections {
  const collections = {} as Collections;
  for (const name of COLLECTIONS) {
    collections[name] = {} as never;
  }
  return collections;
}

export function createInitialState(now: Timestamp = Date.now()): AppState {
  return {
    ...createEmptyCollections(),
    profile: createProfile(now),
    settings: createDefaultSettings(),
    version: SCHEMA_VERSION,
    hydrated: false,
  };
}

export function toPersistedState(state: AppState): PersistedState {
  const collections = createEmptyCollections();
  for (const name of COLLECTIONS) {
    collections[name] = state[name] as never;
  }
  return {
    ...collections,
    profile: state.profile,
    settings: state.settings,
  };
}
