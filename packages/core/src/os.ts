import { parseCapture, type CaptureParseResult } from "./engines/capture-parser";
import { nextOccurrence } from "./engines/task/recurrence";
import {
  applyCapture,
  resolveCapture,
  type CaptureDraft,
  type CaptureOutcome,
} from "./engines/capture";
import {
  advanceRecurrence,
  isBlocked,
  isOpen,
  plannedStatus,
  reconcileRecurringTask,
  resolveReminderFireAt,
  selectRemindersForTask,
  selectTaskChildren,
  wouldCreateCycle,
} from "./engines/task-engine";
import {
  buildTaskDashboard,
  type TaskDashboard,
  type TaskDashboardOptions,
} from "./engines/task/dashboard";
import {
  buildNotesWorkspace,
  noteToTaskInputs,
  type NotesWorkspace,
  type NotesWorkspaceOptions,
} from "./engines/notes/workspace";
import {
  buildAgendaView,
  buildDayView,
  buildMonthView,
  buildWeekView,
  buildYearView,
  detectImpossibleSchedules,
  detectOverlaps,
  detectTaskConflicts,
  findFreeSlots,
  findFreeSlotsForDay,
  isTimeAvailable,
  selectEventsByCalendar,
  selectEventsByCategory,
  selectEventsInRange,
  suggestTimeSlots,
  totalFreeMinutes,
  validateEvent,
} from "./engines/calendar";
import {
  activeHabits,
  buildHabitsDashboard,
  checkInsForHabit,
  habitAnchorForPeriod,
  habitCheckedOnDay,
  habitDueOn,
  habitPeriodBounds,
  habitStats,
  habitStreaks,
  type HabitsDashboard,
  type HabitsDashboardOptions,
  type HabitStats,
  type HabitStreaks,
} from "./engines/habit";
import {
  activeRoutines,
  routineCompleteOn,
  routineDueOn,
  routineStats,
  type RoutineItem,
  type RoutineStats,
} from "./engines/routine";
import {
  computeGoalProgress,
  goalMetricsProgress,
  milestonesForProject,
  milestoneProgress,
  projectProgress,
  type GoalProgressResult,
} from "./engines/planning";
import {
  applyPlan,
  diffPlan,
  findPlanConflicts,
  findPlanningWindows,
  generatePlan,
  recalculatePlan,
  isTimeAvailableExcluding,
  selectPlanCandidates,
  totalPlanningFreeMinutes,
  type ApplyPlanResult,
  type PlanDiff,
  type PlanProposal,
  type PlannerConflict,
} from "./engines/planner";
import {
  search,
  getSearchSuggestions,
  findByTags,
  getRelatedItems,
  getFolderTree,
  type SearchOptions,
  type SearchResult,
  type FolderNode,
} from "./engines/knowledge/search";
import {
  autoTagItem,
  suggestTagsFromContent,
  extractEntities,
  classifyContent,
  generateTagCloud,
  type AutoTagResult,
  type TagSuggestion,
  type ExtractedEntity,
} from "./engines/knowledge/tagging";
import {
  buildKnowledgeGraph,
  getOutgoingRelationships,
  getIncomingRelationships,
  getRelatedNodes,
  findShortestPath,
  getPageRank,
  suggestRelationships,
  detectCycles,
  getOrphanNodes,
  getHubNodes,
  type KnowledgeGraph,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
} from "./engines/knowledge/relationships";
import {
  semanticSearch,
  findSimilarItems,
  updateItemEmbedding,
  rebuildAllEmbeddings,
  clusterEmbeddings,
  type EmbeddingVector,
} from "./engines/knowledge/embeddings";
import {
  runAssistant,
  buildAIContext,
  contextSummary,
  parseIntent,
  computeInsights,
  computeRecommendations,
  buildWeeklyReview,
  analyzeTranscript,
  applyProposal,
  meetingsNeedingIntelligence,
  summarizeNote,
  hybridSearch,
  matchLifeMemoryItem,
  riskForCapability,
  requiresConfirmation,
  type AIContextBundle,
  type AIProposal,
  type AIResult,
  type AssistantExecutor,
  type ProductivityInsight,
  type AIRecommendation,
  type MeetingAnalysis,
  type NoteSummary,
  type ProposalApplyResult,
  type WeeklyReview,
  type AiIntent,
} from "./engines/ai";
import {
  buildMeetingReport,
  proposeFromReport,
  storeMeetingReport,
  renameSpeaker,
  identifySpeakers,
  appendLiveSegment,
  recordingsNeedingTranscript,
  searchTranscripts as searchTranscriptsEngine,
  type MeetingReport,
  type MeetingProposalSet,
  type LiveTranscriptionSession,
  type MeetingSpeakerProfile,
  type MeetingActionItemDraft,
  type MeetingDecisionDraft,
} from "./engines/meeting/engine";
import {
  buildMeetingsDashboard,
  type MeetingsDashboard,
  type MeetingsDashboardOptions,
} from "./engines/meeting/dashboard";
import { selectPaperPage, templateSpacing, type PaperPageBundle } from "./engines/paper/engine";
import { recognizeShapesBatch, REGISTRY } from "./engines/paper/recognize";
import { recognizeShape } from "./engines/paper/shapes";
import { hitTestStroke } from "./engines/paper/geometry";
import { exportPdf, exportSvg } from "./engines/paper/pdf";
import {
  buildPaperWorkspace,
  type PaperWorkspace,
  type PaperWorkspaceOptions,
} from "./engines/paper/workspace";
import {
  computeFocusStats,
  selectDeepWorkBlocks,
  focusHeatmap,
  bestFocusHours,
  focusSummaryLine,
  estimateAccuracyForTask,
  focusSessionsForTask as focusSessionsForTaskEngine,
  focusSessionsForGoal as focusSessionsForGoalEngine,
  type FocusSessionRow,
  type FocusStats,
  type DeepWorkBlock,
  type FocusHeatCell,
} from "./engines/focus/stats";
import {
  answerWhenDidI,
  computeLifeStats,
  parseLifeEvent,
  buildOverview,
  selectItemsDue,
  selectOverdueItems,
  getHistory,
  type LifeMemoryQueryResult,
  type LifeMemoryStats,
  type LifeMemoryOverview,
  type ParsedLifeEvent,
} from "./engines/life-memory/engine";
import {
  addOccurrence,
  removeOccurrence,
  createLifeMemoryItem,
  moveLifeMemoryItemToTrash,
  restoreLifeMemoryItem,
  archiveLifeMemoryItem,
  type LifeMemoryItem,
  type LifeMemoryOccurrence,
  type NewLifeMemoryItemInput,
  type NewLifeMemoryOccurrenceInput,
} from "./types/life-memory";
import {
  createAIInsight,
  type AIInsight,
  type NewAIInsightInput,
} from "./types/ai";
import {
  createAIConversation,
  createAIMessage,
  type AIConversation,
  type AIMessage,
  type NewAIConversationInput,
  type NewAIMessageInput,
} from "./types/ai";
import {
  createActionItem,
  createDocument,
  type ActionItem,
  type Document,
  type Meeting,
  type NewActionItemInput,
  type NewDocumentInput,
  type NewMeetingInput,
  type Transcript,
  type NewTranscriptInput,
} from "./types/knowledge";
import {
  createBrowserStorage,
  parseRawState,
  serializeState,
  type StorageAdapter,
} from "./store/persistence";
import { SCHEMA_VERSION, createInitialState, type AppState } from "./store/state";
import { Store, type StoreListener } from "./store/store";
import { newId, type ID, type Timestamp } from "./types/common";
import { DAY_MS, MINUTE_MS, startOfDay } from "./engines/date-utils";
import { createAIObject, type AIObject, type NewAIObjectInput } from "./types/ai-object";
import { createAttachment, type Attachment, type NewAttachmentInput } from "./types/attachment";
import {
  createRecording,
  createMeeting,
  createTranscript,
  moveRecordingToTrash,
  moveTranscriptToTrash,
  restoreRecording,
  restoreTranscript,
  archiveRecording,
  type NewRecordingInput,
  type Recording,
  type TranscriptSegment,
} from "./types/knowledge";
import {
  createPaperFolder,
  createPaperNotebook,
  createPaperPage,
  createPaperLayer,
  createPaperStroke,
  countPaperWords,
  DEFAULT_PAGE_H,
  DEFAULT_PAGE_W,
  type NewPaperNotebookInput,
  type NewPaperPageInput,
  type NewPaperStrokeInput,
  type PaperDiagram,
  type PaperFolder,
  type PaperImage,
  type PaperLayer,
  type PaperNotebook,
  type PaperPage,
  type PaperRecognition,
  type PaperShapeKind,
  type PaperSticker,
  type PaperStroke,
} from "./types/paper";
import {
  SKILL_DEFINITIONS,
  XP_RULE_BY_REASON,
  createCoinLedgerEntry,
  type CoinLedgerEntry,
  type GamificationPreferences,
} from "./types/gamification";
import {
  builtinAchievementSeeds,
  buildGamificationProfile,
  canAward,
  evaluateAchievements,
  redeemReward,
  rewardSeeds,
  skillLevelFromXp,
  COIN_RATE,
  type AwardOutcome,
  type GamificationProfile,
  type RedeemResult,
} from "./engines/gamification/engine";
import { generateInsights, type AnalyticsInsight } from "./engines/analytics/insights";
import {
  activeJournalEntries,
  buildJournalWeeklyReview,
  buildJournalMonthlyReview,
  buildMoodCalendar,
  buildMoodInsights,
  computeJournalStreak,
  journalActivities,
  journalAnswerQuestion,
  journalArchive,
  journalAttachEvent,
  journalAttachGoal,
  journalAttachHabit,
  journalAttachLifeMemory,
  journalAttachTask,
  journalDetach,
  journalEntryForCreation,
  journalEntryForDate,
  journalEntryForDateKey,
  journalLifeMemoryInput,
  journalLocations,
  journalPatchForUpdate,
  journalPeopleNames,
  journalRecoverable,
  journalRestore,
  journalTagCloud,
  journalTaskAlreadyExists,
  journalEventAlreadyExists,
  journalTrash,
  journalUnarchive,
  searchJournalEntries,
  type JournalListOptions,
  type JournalSearchFilters,
  type JournalSearchResult,
  type JournalStreak,
  type JournalTaskCandidate,
  type JournalEventCandidate,
  type JournalWeeklyReview,
  type JournalMonthlyReview,
  type MoodInsight,
  type MoodCalendarDay,
} from "./engines/journal";
import {
  BUILTIN_JOURNAL_TEMPLATES,
  createJournalTemplate,
  type JournalEntry,
  type JournalPrivacy,
  type JournalTemplate,
  type NewJournalEntryInput,
  type NewJournalTemplateInput,
} from "./types/journal";
import {
  normalizeMobilePreferences,
  type MobilePreferences,
  type MobileWidgetId,
  type NotificationPreferences,
  type ScheduledReminder,
  type QuickActionId,
  type SwipeActionId,
  type SwipeConfig,
} from "./types/mobile";
import {
  evaluateDueReminders,
  journalStreakDays as journalStreakDaysFor,
  nextReminderAt as nextReminderAtFor,
} from "./engines/notifications";
import {
  INTEGRATION_PROVIDERS,
  PROVIDER_BY_ID,
  createIntegration,
  createSyncConflictRecord,
  type ConflictStrategy,
  type Integration,
  type IntegrationSettings,
  type IntegrationStatus,
  type NewIntegrationInput,
  type NewSyncConflictRecordInput,
  type ProviderDefinition,
  type ResolutionAction,
  type SyncConflictRecord,
  type SyncConflictStatus,
  type SyncDirection,
  type SyncLog,
  type SyncLogStatus,
} from "./types/integration";
import {
  accessCheck,
  buildIcsExport,
  buildTeamRoster,
  commentsFor,
  selectMembers,
  selectSharedCalendar,
  selectSharedProjects,
  selectTasksFor,
  type CommentThread,
  type MemberRef,
  type SharedCalendarRow,
  type SharedProjectRow,
  type SharedTaskRow,
  type TeamRosterRow,
} from "./engines/collaboration/engine";
import {
  buildEmployeeSchedule,
  buildTimeOffBalances,
  buildWeekCoverage,
  selectOpenShifts,
  validateShift,
  validateShiftPickup,
  validateShiftSwap,
  validateTimeOff,
  type EmployeeScheduleRow,
  type OpenShiftRow,
  type ShiftValidation,
  type TimeOffBalanceRow,
  type WeekCoverageRow,
} from "./engines/collaboration/workmode";
import {
  buildTodaySummary,
  buildReview,
  buildGoalAnalytics,
  buildHabitAnalytics,
  buildFocusAnalytics,
  buildAnalyticsOverview,
  buildMeetingAnalytics,
  type AnalyticsOverview,
  type FocusAnalytics,
  type GoalProgressRow,
  type HabitAnalyticsRow,
  type MeetingAnalytics,
  type Review,
  type TodaySummary,
} from "./engines/analytics/engine";
import {
  areaSummaries as buildAreaSummaries,
  dailyProductivity as buildDailyProductivity,
  focusByArea as buildFocusByArea,
  type InsightAreaFocus,
  type InsightAreaSummary,
  type DailyProductivity,
} from "./engines/analytics/areas";
import { createXPTransaction, type XPReason, type XPTransaction } from "./types/engagement";
import { createSkill, levelForXp, type Skill } from "./types/gamification";
import {
  createAchievement,
  createReward,
  type Achievement,
  type NewRewardInput,
  type Reward,
} from "./types/engagement";
import { SKILL_KINDS } from "./types/gamification";
import { createFocusSession, type FocusAmbient, type FocusRound, type FocusSession, type NewFocusSessionInput } from "./types/engagement";
import {
  createMember,
  createTeam,
  createShift,
  type Member,
  type Team,
  type Shift,
  type NewMemberInput,
  type NewTeamInput,
  type NewShiftInput,
} from "./types/identity";
import { createNotification, type Notification } from "./types/engagement";
import {
  createComment,
  createShare,
  editComment,
  extractMentions,
  DEFAULT_MODE,
  type AccessCheck,
  type Comment,
  type Mode,
  type NewCommentInput,
  type NewShareInput,
  type Share,
  type ShareRole,
} from "./types/collaboration";
import {
  createShiftPickup,
  createShiftSwap,
  createTimeOffRequest,
  type NewShiftPickupInput,
  type NewShiftSwapInput,
  type NewTimeOffInput,
  type ShiftPickup,
  type ShiftSwap,
  type TimeOffRequest,
} from "./types/workmode";
import { createEvent, type CalendarEvent, type NewEventInput } from "./types/event";
import { createGoal, type Goal, type GoalMetric, type NewGoalInput } from "./types/goal";
import {
  createHabit,
  createHabitCheckIn,
  type Habit,
  type HabitCheckIn,
  type NewHabitInput,
} from "./types/habit";
import { createNote, updateNoteBlocks, type NewNoteInput, type Note, type NoteBlock } from "./types/note";
import { createFolder, type Folder, type NewFolderInput } from "./types/folder";
import { createInboxItem, type InboxItem, type NewInboxItemInput, type InboxItemStatus } from "./types/inbox";
import {
  createNotebook,
  createPage,
  updatePageBlocks,
  restorePage,
  archivePage,
  type Notebook,
  type NewNotebookInput,
  type NewPageInput,
  type Page,
  type PageRef,
} from "./types/knowledge";
import {
  listArchivedNotebooks,
  listNotebooks,
  listPages,
  nextPageOrder,
  notebookStats,
  notebookToMarkdown,
  pageToMarkdown,
  pagesLinkingTo,
  promoteNoteToPageInput,
  reorderPages,
  searchNotebookPages,
  type NotebookStats,
} from "./engines/notebook";
import {
  buildNotebookWorkspace,
  type NotebookWorkspaceData,
  type NotebookWorkspaceOptions,
} from "./engines/notebook/workspace";
import {
  BOARD_COLUMNS,
  boardColumn,
  boardCompletion,
  boardForProject,
  boardTotal,
  columnForStatus,
  columnCounts,
  isBoardColumnId,
  isOnBoard,
  moveTaskToColumn as moveTaskToColumnEngine,
  nextMove,
  nextTaskOrder,
  statusForColumn,
  tasksInColumn,
  type BoardColumn,
  type BoardColumnId,
  type ProjectBoard,
} from "./engines/work/board";
import {
  activeGoals as activeGoalsFor,
  buildActivityFeed,
  buildTodayGoals,
  buildTodayInsights,
  buildTodayJournal,
  buildTodaySchedule,
  buildTodayStats,
  buildTodayTasks,
  buildTodayWelcome,
  habitsDueToday,
  todayTaskCounts as todayTaskCountsFor,
  type TodayActivityEntry,
  type TodayGoalRow,
  type TodayHabitRow,
  type TodayInsight,
  type TodayJournalPreview,
  type TodayScheduleEntry,
  type TodayStats,
  type TodayTaskBucket,
  type TodayTaskRow,
  type TodayWelcome,
} from "./engines/today";
import {
  buildTodayDeadlines,
  buildTodayFocusLog,
  buildTodayMeetings,
  buildTodayMoments,
  buildTodayNotes,
  buildTodayProjects,
  buildTodayReward,
  buildTodaySteps,
  type TodayDeadlineRow,
  type TodayFocusRow,
  type TodayMeetingRow,
  type TodayMomentRow,
  type TodayNoteRow,
  type TodayProjectRow,
  type TodayRewardRow,
  type TodayStepRow,
} from "./engines/today/sections";
import {
  buildTodayCounts,
  buildTodayDocuments,
  buildTodayGlance,
  buildTodayMonth,
  buildTodayWeekInsights,
  type TodayCounts,
  type TodayDocumentRow,
  type TodayGlance,
  type TodayMonthDay,
  type TodayWeekInsights,
} from "./engines/today/overview";
import {
  buildGoalsDashboard,
  goalHealth,
  goalProgressAt,
  upcomingGoalMilestones as upcomingGoalMilestonesFor,
  type GoalHealth,
  type GoalMilestoneRow,
  type GoalTab,
  type GoalsDashboard,
  type GoalTimeframe,
} from "./engines/planning/goals";
import type { GoalCategory } from "./types/goal";
import {
  answerMemoryQuestion,
  categoryCounts,
  filterMoments,
  glanceStats,
  placesVisited,
  quickFilterCounts,
  recurringMoments,
  type MemoryAnswer,
  type MemoryCategoryCount,
  type MemoryFilters,
  type MemoryGlance,
  type MemoryPlaceVisit,
  type MemoryQuickFilter,
  type MemoryRecurring,
} from "./engines/memory";
import {
  createMemoryMoment,
  moveMemoryMomentToTrash,
  restoreMemoryMoment,
  type MemoryMoment,
  type NewMemoryMomentInput,
} from "./types/memory-moment";
import {
  projectActivity,
  projectStats,
  projectTeam,
  upcomingMilestones,
  type MilestoneHealth,
  type MilestoneView,
  type ProjectStats,
  type TeamMemberView,
  type WorkActivityEntry,
  type WorkActivityKind,
} from "./engines/work/progress";
import {
  createKnowledgeRelationship,
  type KnowledgeRelationship,
  type KnowledgeRelationshipType,
  type NewKnowledgeRelationshipInput,
} from "./types/knowledge";
import type { Profile, PlanningPreferences, Settings } from "./types/profile";
import { createProject, type NewProjectInput, type Project } from "./types/project";
import {
  createCalendar,
  createMilestone,
  createRoutine,
  createTemplate,
  createTemplateItem,
  type Calendar,
  type Milestone,
  type NewCalendarInput,
  type NewMilestoneInput,
  type NewRoutineInput,
  type Routine,
  type RoutineSlot,
  type Template,
  type TemplateCategory,
  type TemplateItemKind,
  type TemplateKind,
  type TemplateUseCreated,
  type TemplateUseResult,
  type NewTemplateInput,
  type PlanTemplateApplyResult,
  type PlanTemplateBlock,
  type PlanTemplatePayload,
  planTemplatePayload,
} from "./types/planning";
import {
  createBuiltinTemplate,
  featuredTemplates,
  popularTemplates,
  recentlyUsedTemplates,
  templateCountsByCategory,
  templateLibrary,
  type TemplateLibraryEntry,
  type TemplateLibraryOptions,
} from "./engines/template/library";
import { BUILTIN_TEMPLATES } from "./engines/template/catalog";
import { createReminder, type NewReminderInput, type Reminder } from "./types/reminder";
import { createTask, type NewTaskInput, type RecurrenceRule, type Task } from "./types/task";
import {
  createTimeBlock,
  type NewTimeBlockInput,
  type TimeBlock,
  type TimeBlockKind,
} from "./types/time-block";

export interface OSCaptureResult {
  kind: "task" | "note" | "empty";
  parse: CaptureParseResult;
  task: Task | null;
  note: Note | null;
  outcome: CaptureOutcome;
}

export interface OSImportResult {
  ok: boolean;
  error?: string;
}

const EMPTY_OUTCOME: CaptureOutcome = {
  status: "empty",
  entityType: null,
  entity: null,
  log: null,
  duplicateOf: null,
};

function sameLocalDay(a: Timestamp, b: Timestamp): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export interface PersonalOSOptions {
  storage?: StorageAdapter | null;
}

export class PersonalOS {
  readonly store: Store;

  constructor(options: PersonalOSOptions = {}) {
    const storage = options.storage !== undefined ? options.storage : createBrowserStorage();
    this.store = new Store({ storage });
  }

  getState = (): AppState => this.store.getState();

  subscribe = (listener: StoreListener): (() => void) => this.store.subscribe(listener);

  hydrate = (): void => this.store.hydrate();

  persistNow = (): void => this.store.persistNow();

  capture = (input: string, now: Timestamp = Date.now()): OSCaptureResult => {
    const parse = parseCapture(input, { now });
    if (!parse.title) return { kind: "empty", parse, task: null, note: null, outcome: EMPTY_OUTCOME };

    const resolved = resolveCapture(input, { now });
    const outcome = applyCapture(
      this.store,
      { ...resolved, mode: "ai", source: "text" },
      now,
    );

    if (outcome.status === "empty") {
      return { kind: "empty", parse, task: null, note: null, outcome };
    }
    if (outcome.status === "created") {
      if (outcome.entity?.type === "task") {
        return { kind: "task", parse, task: outcome.entity, note: null, outcome };
      }
      if (outcome.entity?.type === "note") {
        return { kind: "note", parse, task: null, note: outcome.entity, outcome };
      }
    }
    return { kind: "empty", parse, task: null, note: null, outcome };
  };

  captureDraft = (draft: CaptureDraft, now: Timestamp = Date.now()): CaptureOutcome =>
    applyCapture(this.store, draft, now);

  getTask = (id: ID): Task | null => this.store.getState().tasks[id] ?? null;

  addTask = (input: NewTaskInput, now: Timestamp = Date.now()): Task => {
    const base = createTask(input, now);
    const task = { ...base, status: plannedStatus(base) };
    this.store.insert("tasks", task);
    return task;
  };

  updateTask = (id: ID, patch: Partial<Task>): Task | null => {
    const existing = this.store.getState().tasks[id];
    if (!existing) return null;
    const merged = { ...existing, ...patch };
    return this.store.update("tasks", id, { ...patch, status: plannedStatus(merged) });
  };

  completeTask = (id: ID, now: Timestamp = Date.now()): Task | null => {
    const task = this.getTask(id);
    if (!task || !isOpen(task)) return null;
    const updated = this.store.update("tasks", id, { status: "done", completedAt: now });
    this.awardXP({ reason: "task_complete", entityType: "task", entityId: id, note: task.title });
    for (const child of selectTaskChildren(this.getState(), id)) {
      if (isOpen(child)) {
        this.store.update("tasks", child.id, { status: "done", completedAt: now });
      }
    }
    for (const reminder of selectRemindersForTask(this.getState(), id)) {
      if (reminder.firedAt == null) {
        this.store.update("reminders", reminder.id, { firedAt: now });
      }
    }
    if (task.recurrence) {
      const { nextAt, exhausted } = advanceRecurrence(task, now);
      if (nextAt != null && !exhausted) {
        const next: Task = {
          ...task,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          status: "open",
          startedAt: null,
          completedAt: null,
          dueAt: task.dueAt != null ? nextAt : null,
          scheduledAt: task.scheduledAt != null ? nextAt : null,
          recurrenceOrdinal: task.recurrenceOrdinal + 1,
          reminderIds: [],
          dependsOn: [],
        };
        this.store.insert("tasks", next);
      }
    }
    return updated;
  };

  reopenTask = (id: ID): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    if (task.status === "open" || task.status === "in_progress") return null;
    return this.store.update("tasks", id, { status: "open", completedAt: null });
  };

  startTask = (id: ID): Task | null => {
    const task = this.getTask(id);
    if (!task || !isOpen(task)) return null;
    return this.store.update("tasks", id, {
      status: "in_progress",
      startedAt: task.startedAt ?? Date.now(),
    });
  };

  cancelTask = (id: ID): Task | null => {
    const task = this.getTask(id);
    if (!task || !isOpen(task)) return null;
    return this.store.update("tasks", id, { status: "cancelled" });
  };

  archiveTask = (id: ID): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    return this.store.update("tasks", id, { status: "archived" });
  };

  deleteTask = (id: ID): void => {
    const state = this.store.getState();
    if (!state.tasks[id]) return;

    const doomed = new Set<ID>();
    const collect = (taskId: ID): void => {
      doomed.add(taskId);
      for (const task of Object.values(this.store.getState().tasks)) {
        if (task.parentTaskId === taskId && !doomed.has(task.id)) collect(task.id);
      }
    };
    collect(id);

    for (const taskId of doomed) {
      for (const reminder of Object.values(this.store.getState().reminders)) {
        if (reminder.taskId === taskId) this.store.remove("reminders", reminder.id);
      }
      for (const attachment of Object.values(this.store.getState().attachments)) {
        if (attachment.ownerType === "task" && attachment.ownerId === taskId) {
          this.store.remove("attachments", attachment.id);
        }
      }
      for (const block of Object.values(this.store.getState().timeBlocks)) {
        if (block.taskId === taskId) this.store.update("timeBlocks", block.id, { taskId: null });
      }
      for (const checkin of Object.values(this.store.getState().habitCheckins)) {
        if (checkin.taskId === taskId) this.store.update("habitCheckins", checkin.id, { taskId: null });
      }
      for (const event of Object.values(this.store.getState().events)) {
        if (event.taskId === taskId) this.store.update("events", event.id, { taskId: null });
      }
      this.store.remove("tasks", taskId);
    }

    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.dependsOn.includes(id)) {
        this.store.update("tasks", task.id, {
          dependsOn: task.dependsOn.filter((depId) => depId !== id && !doomed.has(depId)),
        });
      }
    }
  };

  scheduleTask = (id: ID, scheduledAt: Timestamp | null): Task | null =>
    this.updateTask(id, { scheduledAt });

  setTaskDue = (id: ID, dueAt: Timestamp | null): Task | null => this.updateTask(id, { dueAt });

  addSubtask = (parentId: ID, title: string, now: Timestamp = Date.now()): Task | null => {
    const parent = this.getTask(parentId);
    if (!parent || !title.trim()) return null;
    const task = createTask(
      { title, parentTaskId: parentId, status: "open", source: "manual" },
      now,
    );
    this.store.insert("tasks", task);
    return task;
  };

  addReminder = (
    taskId: ID,
    input: Omit<NewReminderInput, "fireAt" | "taskId"> & {
      at?: Timestamp | null;
      offsetMin?: number | null;
    },
  ): Reminder | null => {
    const task = this.getTask(taskId);
    if (!task) return null;
    const fireAt = resolveReminderFireAt(input, task);
    if (fireAt == null) return null;
    const reminder = createReminder({ ...input, fireAt, taskId });
    this.store.insert("reminders", reminder);
    this.store.update("tasks", taskId, {
      reminderIds: [...task.reminderIds, reminder.id],
    });
    return reminder;
  };

  updateReminder = (id: ID, patch: Partial<Reminder>): Reminder | null =>
    this.store.update("reminders", id, patch);

  removeReminder = (id: ID): void => {
    const reminder = this.store.getState().reminders[id];
    if (!reminder) return;
    if (reminder.taskId) {
      const task = this.store.getState().tasks[reminder.taskId];
      if (task) {
        this.store.update("tasks", task.id, {
          reminderIds: task.reminderIds.filter((rId) => rId !== id),
        });
      }
    }
    this.store.remove("reminders", id);
  };

  remindersForTask = (taskId: ID): Reminder[] =>
    selectRemindersForTask(this.store.getState(), taskId);

  addEventReminder = (eventId: ID, offsetMin: number, now: Timestamp = Date.now()): Reminder | null => {
    const event = this.store.getState().events[eventId];
    if (!event) return null;
    const fireAt = Math.max(now, event.startsAt - Math.max(offsetMin, 0) * 60_000);
    const reminder = createReminder({ fireAt, eventId, message: event.title });
    this.store.insert("reminders", reminder);
    this.store.update("events", eventId, {
      reminderIds: [...event.reminderIds, reminder.id],
    });
    return reminder;
  };

  clearEventReminders = (eventId: ID): void => {
    const event = this.store.getState().events[eventId];
    if (!event) return;
    for (const reminderId of event.reminderIds) {
      this.store.remove("reminders", reminderId);
    }
    this.store.update("events", eventId, { reminderIds: [] });
  };

  fireReminder = (id: ID): Reminder | null => {
    const reminder = this.store.getState().reminders[id];
    if (!reminder || reminder.firedAt != null) return null;
    return this.store.update("reminders", id, { firedAt: Date.now() });
  };

  setTaskRecurrence = (id: ID, rule: RecurrenceRule | null): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    if (rule && !task.recurrenceId) {
      return this.store.update("tasks", id, {
        recurrence: rule,
        recurrenceId: crypto.randomUUID(),
        recurrenceOrdinal: 1,
      });
    }
    return this.store.update("tasks", id, { recurrence: rule });
  };

  clearTaskRecurrence = (id: ID): Task | null =>
    this.store.update("tasks", id, { recurrence: null, recurrenceId: null });

  skipRecurrence = (id: ID, now: Timestamp = Date.now()): Task | null => {
    const task = this.getTask(id);
    if (!task || !task.recurrence) return null;
    const { nextAt, exhausted } = advanceRecurrence(task, now);
    if (nextAt == null || exhausted) return null;
    const next: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "open",
      startedAt: null,
      completedAt: null,
      dueAt: task.dueAt != null ? nextAt : null,
      scheduledAt: task.scheduledAt != null ? nextAt : null,
      recurrenceOrdinal: task.recurrenceOrdinal + 1,
      reminderIds: [],
      dependsOn: [],
    };
    this.store.insert("tasks", next);
    this.store.update("tasks", id, { status: "cancelled" });
    return next;
  };

  syncRecurringTasks = (now: Timestamp = Date.now()): number => {
    let count = 0;
    for (const task of Object.values(this.store.getState().tasks)) {
      if (!task.recurrence || !isOpen(task)) continue;
      const adjusted = reconcileRecurringTask(task, now);
      if (adjusted) {
        this.store.update("tasks", task.id, adjusted);
        count += 1;
      }
    }
    return count;
  };

  addDependency = (taskId: ID, dependsOnId: ID): Task | null => {
    if (taskId === dependsOnId) return null;
    const task = this.getTask(taskId);
    const dep = this.getTask(dependsOnId);
    if (!task || !dep) return null;
    if (task.dependsOn.includes(dependsOnId)) return task;
    if (wouldCreateCycle(this.store.getState(), taskId, [...task.dependsOn, dependsOnId])) {
      return null;
    }
    return this.store.update("tasks", taskId, {
      dependsOn: [...task.dependsOn, dependsOnId],
    });
  };

  removeDependency = (taskId: ID, dependsOnId: ID): Task | null => {
    const task = this.getTask(taskId);
    if (!task) return null;
    return this.store.update("tasks", taskId, {
      dependsOn: task.dependsOn.filter((id) => id !== dependsOnId),
    });
  };

  setTaskDependencies = (taskId: ID, dependsOnIds: ID[]): Task | null => {
    const task = this.getTask(taskId);
    if (!task) return null;
    const unique = [...new Set(dependsOnIds)].filter((id) => id !== taskId);
    if (wouldCreateCycle(this.store.getState(), taskId, unique)) return null;
    return this.store.update("tasks", taskId, { dependsOn: unique });
  };

  dependenciesFor = (taskId: ID): Task[] => {
    const task = this.getTask(taskId);
    if (!task) return [];
    return task.dependsOn
      .map((id) => this.store.getState().tasks[id])
      .filter((t): t is Task => t != null);
  };

  isTaskBlocked = (taskId: ID): boolean => {
    const task = this.getTask(taskId);
    if (!task) return false;
    return isBlocked(task, this.store.getState());
  };

  addTaskAttachment = (
    taskId: ID,
    input: Omit<NewAttachmentInput, "ownerType" | "ownerId">,
  ): Attachment | null => {
    const task = this.getTask(taskId);
    if (!task) return null;
    const attachment = createAttachment({ ...input, ownerType: "task", ownerId: taskId });
    this.store.insert("attachments", attachment);
    return attachment;
  };

  blockTask = (
    taskId: ID,
    input: { startsAt: Timestamp; durationMin: number; kind?: TimeBlockKind },
  ): TimeBlock | null => {
    const task = this.getTask(taskId);
    if (!task) return null;
    const block = createTimeBlock({
      title: task.title,
      startsAt: input.startsAt,
      endsAt: input.startsAt + input.durationMin * 60_000,
      kind: input.kind ?? "focus",
      taskId,
    });
    this.store.insert("timeBlocks", block);
    return block;
  };

  setTaskCategory = (id: ID, categoryId: ID | null): Task | null =>
    this.updateTask(id, { categoryId });

  setTaskAssignee = (id: ID, assigneeId: ID | null): Task | null =>
    this.updateTask(id, { assigneeId });

  setTaskPriority = (id: ID, priority: Task["priority"]): Task | null =>
    this.updateTask(id, { priority });

  linkTaskToGoal = (id: ID, goalId: ID): Task | null => {
    const task = this.getTask(id);
    if (!task || task.goalIds.includes(goalId)) return task;
    return this.updateTask(id, { goalIds: [...task.goalIds, goalId] });
  };

  unlinkTaskFromGoal = (id: ID, goalId: ID): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    return this.updateTask(id, { goalIds: task.goalIds.filter((g) => g !== goalId) });
  };

  addNote = (input: NewNoteInput, now: Timestamp = Date.now()): Note => {
    const note = createNote(input, now);
    this.store.insert("notes", note);
    return note;
  };

  updateNote = (id: ID, patch: Partial<Note>): Note | null =>
    this.store.update("notes", id, patch);

  getNote = (id: ID): Note | null => this.store.getState().notes[id] ?? null;

  deleteNote = (id: ID): void => {
    const note = this.store.getState().notes[id];
    if (!note) return;
    if (note.status === "trashed") {
      for (const attachment of Object.values(this.store.getState().attachments)) {
        if (attachment.ownerType === "note" && attachment.ownerId === id) {
          this.store.remove("attachments", attachment.id);
        }
      }
      for (const reminder of Object.values(this.store.getState().reminders)) {
        if (reminder.noteId === id) this.store.remove("reminders", reminder.id);
      }
      this.store.remove("notes", id);
    } else {
      this.store.update("notes", id, { status: "trashed", trashedAt: Date.now() });
    }
  };

  addProject = (input: NewProjectInput | string, now: Timestamp = Date.now()): Project => {
    const candidate = typeof input === "string" ? { name: input } : input;
    const name = candidate.name.trim();
    const existing = Object.values(this.store.getState().projects).find(
      (project) => project.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing;
    const project = createProject({ ...candidate, name }, now);
    this.store.insert("projects", project);
    return project;
  };

  updateProject = (id: ID, patch: Partial<Project>): Project | null =>
    this.store.update("projects", id, patch);

  getProject = (id: ID): Project | null => this.store.getState().projects[id] ?? null;

  deleteProject = (id: ID): void => {
    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.projectId === id) this.store.update("tasks", task.id, { projectId: null });
      if (task.milestoneId && this.store.getState().milestones[task.milestoneId]?.projectId === id) {
        this.store.update("tasks", task.id, { milestoneId: null });
      }
    }
    for (const note of Object.values(this.store.getState().notes)) {
      if (note.projectId === id) this.store.update("notes", note.id, { projectId: null });
    }
    for (const event of Object.values(this.store.getState().events)) {
      if (event.projectId === id) this.store.update("events", event.id, { projectId: null });
    }
    for (const meeting of Object.values(this.store.getState().meetings)) {
      if (meeting.projectId === id) this.store.update("meetings", meeting.id, { projectId: null });
    }
    for (const milestone of Object.values(this.store.getState().milestones)) {
      if (milestone.projectId === id) this.store.remove("milestones", milestone.id);
    }
    this.store.remove("projects", id);
  };

  addMilestone = (input: NewMilestoneInput, now: Timestamp = Date.now()): Milestone => {
    const milestone = createMilestone(input, now);
    this.store.insert("milestones", milestone);
    return milestone;
  };

  updateMilestone = (id: ID, patch: Partial<Milestone>): Milestone | null =>
    this.store.update("milestones", id, patch);

  deleteMilestone = (id: ID): void => {
    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.milestoneId === id) this.store.update("tasks", task.id, { milestoneId: null });
    }
    this.store.remove("milestones", id);
  };

  completeMilestone = (id: ID, now: Timestamp = Date.now()): Milestone | null => {
    const milestone = this.store.getState().milestones[id];
    if (!milestone) return null;
    const updated = this.store.update("milestones", id, { status: "completed", completedAt: now });
    if (updated) {
      this.awardXP({
        reason: "goal_milestone",
        entityType: "milestone",
        entityId: id,
        note: milestone.title,
      });
    }
    return updated;
  };

  reopenMilestone = (id: ID): Milestone | null => {
    const milestone = this.store.getState().milestones[id];
    if (!milestone) return null;
    return this.store.update("milestones", id, { status: "open", completedAt: null });
  };

  milestonesFor = (projectId: ID): Milestone[] =>
    milestonesForProject(this.store.getState(), projectId);

  milestoneProgressFor = (id: ID): number => {
    const milestone = this.store.getState().milestones[id];
    return milestone ? milestoneProgress(this.store.getState(), milestone) : 0;
  };

projectProgressFor = (id: ID): number => {
    const project = this.store.getState().projects[id];
    return project ? projectProgress(this.store.getState(), project) : 0;
  };

  // ========== Project board ==========
  projectBoard = (projectId: ID): ProjectBoard => boardForProject(this.store.getState(), projectId);

  projectColumnTasks = (projectId: ID, column: BoardColumnId): Task[] =>
    tasksInColumn(this.store.getState(), projectId, column);

  moveTaskToColumn = (
    taskId: ID,
    projectId: ID,
    column: BoardColumnId,
    now: Timestamp = Date.now(),
  ): Task | null => {
    const task = this.store.getState().tasks[taskId];
    if (!task || task.projectId !== projectId) return null;
    const order = nextTaskOrder(tasksInColumn(this.store.getState(), projectId, column));
    return this.store.update("tasks", taskId, moveTaskToColumnEngine(task, column, order, now));
  };

  shiftTaskColumn = (
    taskId: ID,
    direction: "left" | "right",
    now: Timestamp = Date.now(),
  ): Task | null => {
    const task = this.store.getState().tasks[taskId];
    if (!task) return null;
    const target = nextMove(task, direction);
    if (target === null || task.projectId == null) return null;
    const order = nextTaskOrder(tasksInColumn(this.store.getState(), task.projectId, target));
    return this.store.update("tasks", taskId, moveTaskToColumnEngine(task, target, order, now));
  };

  projectStats = (projectId: ID): ProjectStats => projectStats(this.store.getState(), projectId);

  projectUpcomingMilestones = (projectId: ID, limit = 5, now: Timestamp = Date.now()): MilestoneView[] =>
    upcomingMilestones(this.store.getState(), projectId, limit, now);

  projectTeam = (projectId: ID): TeamMemberView[] => projectTeam(this.store.getState(), projectId);

  projectActivity = (projectId: ID, limit = 8, now: Timestamp = Date.now()): WorkActivityEntry[] =>
    projectActivity(this.store.getState(), projectId, limit, now);

  addProjectTask = (
    input: NewTaskInput,
    projectId: ID,
    column: BoardColumnId,
    now: Timestamp = Date.now(),
  ): Task => {
    const columnTasks = tasksInColumn(this.store.getState(), projectId, column);
    return this.addTask(
      { ...input, projectId, status: statusForColumn(column), order: nextTaskOrder(columnTasks) },
      now,
    );
  };

  linkGoalToProject = (projectId: ID, goalId: ID): Project | null => {
    const project = this.store.getState().projects[projectId];
    if (!project || project.goalIds.includes(goalId)) return project;
    return this.updateProject(projectId, { goalIds: [...project.goalIds, goalId] });
  };

  unlinkGoalFromProject = (projectId: ID, goalId: ID): Project | null => {
    const project = this.store.getState().projects[projectId];
    if (!project) return null;
    return this.updateProject(projectId, { goalIds: project.goalIds.filter((g) => g !== goalId) });
  };

  completeGoal = (id: ID, now: Timestamp = Date.now()): Goal | null => {
    const goal = this.store.getState().goals[id];
    if (!goal || goal.status === "completed") return goal;
    const progress = this.goalProgressFor(id).progress;
    const updated = this.updateGoal(id, { status: "completed", progress });
    if (updated) {
      this.awardXP({
        reason: "goal_milestone",
        entityType: "goal",
        entityId: id,
        note: goal.title,
      });
    }
    return updated;
  };

  reopenGoal = (id: ID): Goal | null => {
    const goal = this.store.getState().goals[id];
    if (!goal || goal.status === "draft" || goal.status === "active") return goal;
    return this.updateGoal(id, { status: "active" });
  };

  addGoalMetric = (id: ID, metric: GoalMetric): Goal | null => {
    const goal = this.store.getState().goals[id];
    if (!goal) return null;
    return this.updateGoal(id, { metrics: [...goal.metrics, metric] });
  };

  updateGoalMetric = (id: ID, index: number, patch: Partial<GoalMetric>): Goal | null => {
    const goal = this.store.getState().goals[id];
    if (!goal || index < 0 || index >= goal.metrics.length) return null;
    const metrics = goal.metrics.map((metric, i) =>
      i === index ? { ...metric, ...patch } : metric,
    );
    return this.updateGoal(id, { metrics });
  };

  removeGoalMetric = (id: ID, index: number): Goal | null => {
    const goal = this.store.getState().goals[id];
    if (!goal || index < 0 || index >= goal.metrics.length) return null;
    return this.updateGoal(id, { metrics: goal.metrics.filter((_, i) => i !== index) });
  };

  goalMetricProgress = (id: ID): number | null => {
    const goal = this.store.getState().goals[id];
    return goal ? goalMetricsProgress(goal) : null;
  };

  goalProgressFor = (id: ID, now: Timestamp = Date.now()): GoalProgressResult => {
    const goal = this.store.getState().goals[id];
    return {
      progress: 0,
      breakdown: { metric: null, projects: null, tasks: null, habits: null },
      ...(goal
        ? computeGoalProgress(this.store.getState(), goal, now, this.store.getState().settings.weekStart)
        : {}),
    };
  };

  addGoal = (input: NewGoalInput | string, now: Timestamp = Date.now()): Goal => {
    const candidate = typeof input === "string" ? { title: input } : input;
    const goal = createGoal(candidate, now);
    this.store.insert("goals", goal);
    return goal;
  };

  updateGoal = (id: ID, patch: Partial<Goal>): Goal | null =>
    this.store.update("goals", id, patch);

  getGoal = (id: ID): Goal | null => this.store.getState().goals[id] ?? null;

  deleteGoal = (id: ID): void => {
    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.goalIds.includes(id)) {
        this.store.update("tasks", task.id, { goalIds: task.goalIds.filter((g) => g !== id) });
      }
    }
    for (const note of Object.values(this.store.getState().notes)) {
      if (note.goalIds.includes(id)) {
        this.store.update("notes", note.id, { goalIds: note.goalIds.filter((g) => g !== id) });
      }
    }
    for (const project of Object.values(this.store.getState().projects)) {
      if (project.goalIds.includes(id)) {
        this.store.update("projects", project.id, {
          goalIds: project.goalIds.filter((g) => g !== id),
        });
      }
    }
    for (const habit of Object.values(this.store.getState().habits)) {
      if (habit.goalId === id) this.store.update("habits", habit.id, { goalId: null });
    }
    this.store.remove("goals", id);
  };

  addHabit = (input: NewHabitInput | string, now: Timestamp = Date.now()): Habit => {
    const candidate = typeof input === "string" ? { title: input } : input;
    const habit = createHabit(candidate, now);
    this.store.insert("habits", habit);
    return habit;
  };

  updateHabit = (id: ID, patch: Partial<Habit>): Habit | null =>
    this.store.update("habits", id, patch);

  deleteHabit = (id: ID): void => {
    for (const checkin of Object.values(this.store.getState().habitCheckins)) {
      if (checkin.habitId === id) this.store.remove("habitCheckins", checkin.id);
    }
    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.habitId === id) this.store.update("tasks", task.id, { habitId: null });
    }
    for (const reminder of Object.values(this.store.getState().reminders)) {
      if (reminder.habitId === id) this.store.remove("reminders", reminder.id);
    }
    this.store.remove("habits", id);
  };

  addCheckIn = (
    habitId: ID,
    checkedAt: Timestamp = Date.now(),
    now: Timestamp = Date.now(),
  ): HabitCheckIn | null => {
    if (!this.store.getState().habits[habitId]) return null;
    const checkin = createHabitCheckIn(habitId, checkedAt, null, now);
    this.store.insert("habitCheckins", checkin);
    return checkin;
  };

  removeCheckIn = (id: ID): void => {
    this.store.remove("habitCheckins", id);
  };

  ensureHabitOccurrenceTask = (
    habitId: ID,
    dayStart: Timestamp,
    now: Timestamp = Date.now(),
  ): Task | null => {
    const habit = this.store.getState().habits[habitId];
    if (!habit || habit.archived) return null;
    const weekStart = this.store.getState().settings.weekStart;
    const { from, to } = habitPeriodBounds(habit, dayStart, weekStart);
    const anchor = habitAnchorForPeriod(habit, from, to, now);
    if (anchor == null) return null;
    const state = this.store.getState();
    const existing = Object.values(state.tasks).find(
      (task) =>
        task.habitId === habit.id &&
        task.dueAt != null &&
        task.dueAt >= from &&
        task.dueAt < to &&
        (task.status === "open" || task.status === "in_progress" || task.status === "inbox"),
    );
    if (existing) return existing;
    const cancelled = Object.values(state.tasks).find(
      (task) =>
        task.habitId === habit.id && task.dueAt != null && task.dueAt >= from && task.dueAt < to,
    );
    if (cancelled && (cancelled.status === "cancelled" || cancelled.status === "done")) return null;
    const task = createTask(
      {
        title: habit.title,
        dueAt: anchor,
        habitId: habit.id,
        status: "open",
        source: "habit",
        goalIds: habit.goalId ? [habit.goalId] : [],
      },
      now,
    );
    this.store.insert("tasks", task);
    return task;
  };

  syncHabitTasks = (now: Timestamp = Date.now()): number => {
    let created = 0;
    for (const habit of activeHabits(this.store.getState())) {
      const before = Object.keys(this.store.getState().tasks).length;
      this.ensureHabitOccurrenceTask(habit.id, startOfDay(now), now);
      if (Object.keys(this.store.getState().tasks).length > before) created += 1;
    }
    return created;
  };

  completeHabit = (
    habitId: ID,
    at: Timestamp = Date.now(),
    now: Timestamp = Date.now(),
  ): HabitCheckIn | null => {
    const habit = this.store.getState().habits[habitId];
    if (!habit || habit.archived) return null;
    const day = startOfDay(at);
    const existing = Object.values(this.store.getState().habitCheckins).find(
      (checkin) => checkin.habitId === habitId && startOfDay(checkin.checkedAt) === day,
    );
    if (existing) {
      const task = this.ensureHabitOccurrenceTask(habitId, day, now);
      if (task && task.status !== "done") this.store.update("tasks", task.id, { status: "done", completedAt: at });
      return existing;
    }
    const checkin = createHabitCheckIn(habitId, at, null, now);
    this.store.insert("habitCheckins", checkin);
    this.awardXP({ reason: "habit_streak", entityType: "habit", entityId: habitId, note: habit?.title });
    const task = this.ensureHabitOccurrenceTask(habitId, day, now);
    if (task && task.status !== "done") this.store.update("tasks", task.id, { status: "done", completedAt: at });
    return checkin;
  };

  undoHabit = (habitId: ID, dayStart: Timestamp = Date.now()): void => {
    const day = startOfDay(dayStart);
    for (const checkin of Object.values(this.store.getState().habitCheckins)) {
      if (checkin.habitId === habitId && startOfDay(checkin.checkedAt) === day) {
        this.store.remove("habitCheckins", checkin.id);
      }
    }
    const habit = this.store.getState().habits[habitId];
    if (!habit) return;
    const weekStart = this.store.getState().settings.weekStart;
    const { from, to } = habitPeriodBounds(habit, day, weekStart);
    for (const task of Object.values(this.store.getState().tasks)) {
      if (
        task.habitId === habitId &&
        task.completedAt != null &&
        task.completedAt >= from &&
        task.completedAt < to
      ) {
        this.store.update("tasks", task.id, { status: "open", completedAt: null });
      }
    }
  };

  habitsDashboard = (
    options: HabitsDashboardOptions = {},
    now: Timestamp = Date.now(),
  ): HabitsDashboard => buildHabitsDashboard(this.store.getState(), now, options);

  habitStatsFor = (id: ID, now: Timestamp = Date.now()): HabitStats | null => {
    const habit = this.store.getState().habits[id];
    if (!habit) return null;
    return habitStats(this.store.getState(), habit, now, this.store.getState().settings.weekStart);
  };

  habitStreakFor = (id: ID, now: Timestamp = Date.now()): HabitStreaks | null => {
    const habit = this.store.getState().habits[id];
    if (!habit) return null;
    return habitStreaks(this.store.getState(), habit, now, this.store.getState().settings.weekStart);
  };

  habitCheckedOn = (id: ID, dayStart: Timestamp): boolean => {
    const habit = this.store.getState().habits[id];
    return habit ? habitCheckedOnDay(this.store.getState(), habit, dayStart) : false;
  };

  habitDueOnDay = (id: ID, dayStart: Timestamp): boolean => {
    const habit = this.store.getState().habits[id];
    return habit ? habitDueOn(this.store.getState(), habit, dayStart) : false;
  };

  checkInsFor = (habitId: ID): HabitCheckIn[] =>
    checkInsForHabit(this.store.getState(), habitId);

  addHabitReminder = (
    habitId: ID,
    fireAt: Timestamp,
    input?: Omit<NewReminderInput, "fireAt" | "habitId" | "taskId">,
  ): Reminder | null => {
    const habit = this.store.getState().habits[habitId];
    if (!habit || habit.archived) return null;
    const reminder = createReminder({
      ...input,
      fireAt,
      habitId,
      taskId: null,
      eventId: null,
    });
    this.store.insert("reminders", reminder);
    return reminder;
  };

  setTaskProject = (id: ID, projectId: ID | null): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    if (projectId == null) {
      return this.updateTask(id, { projectId: null, milestoneId: null });
    }
    return this.updateTask(id, { projectId });
  };

  setTaskMilestone = (id: ID, milestoneId: ID | null): Task | null => {
    const task = this.getTask(id);
    if (!task) return null;
    if (milestoneId == null) return this.updateTask(id, { milestoneId: null });
    const milestone = this.store.getState().milestones[milestoneId];
    if (!milestone) return null;
    return this.updateTask(id, { milestoneId, projectId: milestone.projectId });
  };

  addRoutine = (input: NewRoutineInput, now: Timestamp = Date.now()): Routine => {
    const routine = createRoutine(input, now);
    this.store.insert("routines", routine);
    return routine;
  };

  updateRoutine = (id: ID, patch: Partial<Routine>): Routine | null =>
    this.store.update("routines", id, patch);

  deleteRoutine = (id: ID): void => {
    for (const task of Object.values(this.store.getState().tasks)) {
      if (task.routineId === id) this.store.update("tasks", task.id, { routineId: null });
    }
    this.store.remove("routines", id);
  };

  routinesFor = (slot?: RoutineSlot): Routine[] => {
    const routines = activeRoutines(this.store.getState());
    return slot ? routines.filter((routine) => routine.slot === slot) : routines;
  };

  routineDueOnDay = (id: ID, dayStart: Timestamp): boolean => {
    const routine = this.store.getState().routines[id];
    return routine ? routineDueOn(this.store.getState(), routine, dayStart) : false;
  };

  materializeRoutine = (
    id: ID,
    dayStart: Timestamp,
    now: Timestamp = Date.now(),
  ): RoutineItem[] => {
    const routine = this.store.getState().routines[id];
    if (!routine) return [];
    if (!routineDueOn(this.store.getState(), routine, startOfDay(dayStart))) return [];
    const dayFrom = startOfDay(dayStart);
    const items: RoutineItem[] = [];
    for (const step of routine.steps) {
      let taskId: string | null = null;
      if (step.taskId != null && this.store.getState().tasks[step.taskId]) {
        taskId = step.taskId;
      } else if (step.habitId != null) {
        const habit = this.store.getState().habits[step.habitId];
        if (habit && !habit.archived) {
          const task = this.ensureHabitOccurrenceTask(habit.id, dayStart, now);
          taskId = task?.id ?? null;
        }
      } else {
        const existing = Object.values(this.store.getState().tasks).find(
          (task) =>
            task.routineId === routine.id &&
            task.title === step.title &&
            task.dueAt != null &&
            task.dueAt >= dayFrom &&
            task.dueAt < dayFrom + 86_400_000 &&
            task.status !== "cancelled" &&
            task.status !== "archived",
        );
        if (existing) {
          taskId = existing.id;
        } else {
          const task = createTask(
            {
              title: step.title,
              dueAt: dayFrom,
              routineId: routine.id,
              status: "open",
              source: "manual",
            },
            now,
          );
          this.store.insert("tasks", task);
          taskId = task.id;
        }
      }
      const title =
        step.title ||
        (taskId ? this.store.getState().tasks[taskId]?.title ?? null : null);
      items.push({
        step,
        taskId,
        habitId: step.habitId,
        title: title ?? "Untitled step",
        durationMin: step.durationMin,
      });
    }
    return items;
  };

  ensureRoutineTasks = (dayStart: Timestamp, now: Timestamp = Date.now()): number => {
    let created = 0;
    const state = this.store.getState();
    for (const routine of activeRoutines(state)) {
      if (!routineDueOn(state, routine, dayStart)) continue;
      const before = Object.keys(this.store.getState().tasks).length;
      this.materializeRoutine(routine.id, dayStart, now);
      if (Object.keys(this.store.getState().tasks).length > before) created += 1;
    }
    return created;
  };

  routineStatsFor = (id: ID, dayStart: Timestamp): RoutineStats | null => {
    const routine = this.store.getState().routines[id];
    return routine ? routineStats(this.store.getState(), routine, dayStart) : null;
  };

  routineCompleteOn = (id: ID, dayStart: Timestamp): boolean => {
    const routine = this.store.getState().routines[id];
    return routine ? routineCompleteOn(this.store.getState(), routine, dayStart) : false;
  };

  addCalendar = (input: NewCalendarInput, now: Timestamp = Date.now()): Calendar => {
    const calendar = createCalendar(input, now);
    this.store.insert("calendars", calendar);
    return calendar;
  };

  calendars = (): Calendar[] =>
    Object.values(this.store.getState().calendars)
      .filter((calendar) => calendar.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name));

  calendarById = (id: ID): Calendar | null =>
    this.store.getState().calendars[id] ?? null;

  addEvent = (input: NewEventInput, now: Timestamp = Date.now()): CalendarEvent => {
    const event = createEvent(input, now);
    this.store.insert("events", event);
    return event;
  };

  updateEvent = (id: ID, patch: Partial<CalendarEvent>): CalendarEvent | null =>
    this.store.update("events", id, patch);

  deleteEvent = (id: ID): void => {
    for (const block of Object.values(this.store.getState().timeBlocks)) {
      if (block.eventId === id) this.store.update("timeBlocks", block.id, { eventId: null });
    }
    this.store.remove("events", id);
  };

  addTimeBlock = (input: NewTimeBlockInput, now: Timestamp = Date.now()): TimeBlock => {
    const block = createTimeBlock(input, now);
    this.store.insert("timeBlocks", block);
    return block;
  };

  updateTimeBlock = (id: ID, patch: Partial<TimeBlock>): TimeBlock | null =>
    this.store.update("timeBlocks", id, patch);

  deleteTimeBlock = (id: ID): void => {
    this.store.remove("timeBlocks", id);
  };

  addAIObject = (input: NewAIObjectInput, now: Timestamp = Date.now()): AIObject => {
    const object = createAIObject(input, now);
    this.store.insert("aiObjects", object);
    return object;
  };

  updateAIObject = (id: ID, patch: Partial<AIObject>): AIObject | null =>
    this.store.update("aiObjects", id, patch);

  updateSettings = (patch: Partial<Settings>): void => {
    const state = this.store.getState();
    this.store.patchState({ settings: { ...state.settings, ...patch } });
  };

  updateProfile = (patch: Partial<Profile>): void => {
    const state = this.store.getState();
    this.store.patchState({
      profile: { ...state.profile, ...patch, updatedAt: Date.now() },
    });
  };

  getDayView = (date: Timestamp, now: Timestamp = Date.now()) =>
    buildDayView(this.store.getState(), date, now);

  getWeekView = (date: Timestamp, now: Timestamp = Date.now()) =>
    buildWeekView(this.store.getState(), date, now);

  getMonthView = (date: Timestamp, now: Timestamp = Date.now()) =>
    buildMonthView(this.store.getState(), date, now);

  getAgendaView = (from: Timestamp, to: Timestamp) =>
    buildAgendaView(this.store.getState(), from, to);

  getYearView = (year: number, now: Timestamp = Date.now()) =>
    buildYearView(this.store.getState(), year, now);

  getEventsInRange = (from: Timestamp, to: Timestamp) =>
    selectEventsInRange(this.store.getState(), from, to);

  getEventsByCalendar = (calendarId: ID) =>
    selectEventsByCalendar(this.store.getState(), calendarId);

  getEventsByCategory = (categoryId: ID) =>
    selectEventsByCategory(this.store.getState(), categoryId);

  getFreeSlots = (from: Timestamp, to: Timestamp, minDurationMin = 30) =>
    findFreeSlots(this.store.getState(), from, to, minDurationMin);

  getFreeSlotsForDay = (date: Timestamp, hourStart = 8, hourEnd = 18, minDurationMin = 30) =>
    findFreeSlotsForDay(this.store.getState(), date, hourStart, hourEnd, minDurationMin);

  isTimeAvailable = (startsAt: Timestamp, endsAt: Timestamp) =>
    isTimeAvailable(this.store.getState(), startsAt, endsAt);

  suggestTimeSlots = (date: Timestamp, durationMin: number, hourStart = 8, hourEnd = 18) =>
    suggestTimeSlots(this.store.getState(), date, durationMin, hourStart, hourEnd);

  getTotalFreeMinutes = (from: Timestamp, to: Timestamp, minDurationMin = 30) =>
    totalFreeMinutes(this.store.getState(), from, to, minDurationMin);

  detectOverlaps = () => detectOverlaps(Object.values(this.store.getState().events));

  detectTaskConflicts = (eventId: ID) => {
    const event = this.store.getState().events[eventId];
    if (!event) return [];
    return detectTaskConflicts(this.store.getState(), event);
  };

  detectImpossibleSchedules = () =>
    detectImpossibleSchedules(this.store.getState(), Object.values(this.store.getState().events));

  validateEvent = (eventId: ID) => {
    const event = this.store.getState().events[eventId];
    if (!event) return null;
    return validateEvent(this.store.getState(), event);
  };

  getPlanningPreferences = (): PlanningPreferences => {
    return this.store.getState().settings.planning;
  };

  updatePlanningPreferences = (patch: Partial<PlanningPreferences>): void => {
    const state = this.store.getState();
    this.store.patchState({
      settings: {
        ...state.settings,
        planning: { ...state.settings.planning, ...patch },
      },
    });
  };

  findPlanningWindows = (from: Timestamp, to: Timestamp, minDurationMin = 30) =>
    findPlanningWindows(this.store.getState(), this.store.getState().settings.planning, from, to, minDurationMin);

  getPlanningFreeMinutes = (from: Timestamp, to: Timestamp, minDurationMin = 30) =>
    totalPlanningFreeMinutes(this.store.getState(), this.store.getState().settings.planning, from, to, minDurationMin);

  getPlanningCandidates = (from: Timestamp, to: Timestamp, now: Timestamp = Date.now()) =>
    selectPlanCandidates(this.store.getState(), this.store.getState().settings.planning, from, to, now);

  generatePlan = (from: Timestamp, to: Timestamp, now: Timestamp = Date.now()): PlanProposal => {
    const state = this.store.getState();
    return generatePlan(state, from, to, { prefs: state.settings.planning, now });
  };

  diffPlan = (proposal: PlanProposal): PlanDiff =>
    diffPlan(this.store.getState(), proposal);

  applyPlan = (proposal: PlanProposal): ApplyPlanResult => {
    const state = this.store.getState();
    const diff = diffPlan(state, proposal);
    return applyPlan(this, diff);
  };

  recalculatePlan = (from: Timestamp, to: Timestamp, now: Timestamp = Date.now()): PlanProposal =>
    recalculatePlan(this.store.getState(), from, to, this.store.getState().settings.planning, now);

  getPlanConflicts = (from: Timestamp, to: Timestamp): PlannerConflict[] =>
    findPlanConflicts(this.store.getState(), from, to);

  exportData = (): string => serializeState(this.getState());

  importData = (json: string): OSImportResult => {
    const state = parseRawState(json);
    if (!state) {
      return { ok: false, error: "This file is not a valid PersonalOS backup." };
    }
    this.store.replaceAll({ ...createInitialState(), ...state, version: SCHEMA_VERSION, hydrated: true });
    this.store.persistNow();
    return { ok: true };
  };

  // ========== Notes (extended) ==========
  archiveNote = (id: ID): Note | null => {
    const note = this.store.getState().notes[id];
    if (!note) return null;
    return this.store.update("notes", id, { status: "archived", updatedAt: Date.now() });
  };

  restoreNote = (id: ID): Note | null => {
    const note = this.store.getState().notes[id];
    if (!note) return null;
    return this.store.update("notes", id, { status: "active", trashedAt: null, updatedAt: Date.now() });
  };

  pinNote = (id: ID, pinned = true): Note | null =>
    this.store.update("notes", id, { pinned, updatedAt: Date.now() });

  moveNoteToFolder = (id: ID, folderId: ID | null): Note | null =>
    this.store.update("notes", id, { folderId, updatedAt: Date.now() });

  moveNoteToNotebook = (id: ID, notebookId: ID | null): Note | null =>
    this.store.update("notes", id, { notebookId, updatedAt: Date.now() });

  updateNoteBlocks = (id: ID, blocks: NoteBlock[], now: Timestamp = Date.now()): Note | null => {
    const note = this.store.getState().notes[id];
    if (!note) return null;
    const updated = updateNoteBlocks(note, blocks, now);
    return this.store.update("notes", id, updated);
  };

  restoreNoteVersion = (id: ID, versionId: ID): Note | null => {
    const note = this.store.getState().notes[id];
    if (!note) return null;
    const version = (note.versions ?? []).find((entry) => entry.id === versionId);
    if (!version) return null;
    const restored = updateNoteBlocks(note, version.blocks, Date.now());
    return this.store.update("notes", id, {
      ...restored,
      title: version.title,
      searchVector: `${version.title.trim()} ${restored.searchVector}`.toLowerCase(),
    });
  };

  addNoteReminder = (noteId: ID, fireAt: Timestamp, now: Timestamp = Date.now()): Reminder | null => {
    const note = this.store.getState().notes[noteId];
    if (!note) return null;
    const reminder = createReminder({
      fireAt: Math.max(now, fireAt),
      noteId,
      message: note.title,
    });
    this.store.insert("reminders", reminder);
    return reminder;
  };

  noteReminders = (noteId: ID): Reminder[] =>
    Object.values(this.store.getState().reminders)
      .filter((reminder) => reminder.noteId === noteId && reminder.firedAt == null)
      .sort((a, b) => a.fireAt - b.fireAt);

  notesWorkspace = (
    options: NotesWorkspaceOptions = {},
    now: Timestamp = Date.now(),
  ): NotesWorkspace => buildNotesWorkspace(this.store.getState(), now, options);

  convertNoteToTasks = (id: ID, now: Timestamp = Date.now()): Task[] => {
    const note = this.store.getState().notes[id];
    if (!note) return [];
    const created: Task[] = [];
    for (const input of noteToTaskInputs(note)) {
      created.push(this.addTask(input, now));
    }
    if (created.length > 0) {
      this.store.update("notes", id, {
        taskIds: [...note.taskIds, ...created.map((task) => task.id)],
      });
    }
    return created;
  };


  // ========== Notebooks ==========
  addNotebook = (input: NewNotebookInput, now: Timestamp = Date.now()): Notebook => {
    const nb = createNotebook(input, now);
    this.store.insert("notebooks", nb);
    return nb;
  };

  updateNotebook = (id: ID, patch: Partial<Notebook>): Notebook | null =>
    this.store.update("notebooks", id, patch);

  getNotebook = (id: ID): Notebook | null => this.store.getState().notebooks[id] ?? null;

  notebooks = (): Notebook[] => listNotebooks(this.store.getState());

  archivedNotebooks = (): Notebook[] => listArchivedNotebooks(this.store.getState());

  notebookPages = (notebookId: ID, includeTrashed = false): Page[] =>
    listPages(this.store.getState(), notebookId, includeTrashed);

  notebookWorkspace = (
    options: NotebookWorkspaceOptions = {},
    now: Timestamp = Date.now(),
  ): NotebookWorkspaceData => buildNotebookWorkspace(this.store.getState(), now, options);

  notebookStats = (notebookId: ID): NotebookStats => notebookStats(this.store.getState(), notebookId);

  searchNotebookPages = (notebookId: ID, query: string): Page[] =>
    searchNotebookPages(this.store.getState(), notebookId, query);

  reorderPages = (notebookId: ID, orderedIds: ID[]): Page[] => {
    const ordered = reorderPages(this.store.getState(), notebookId, orderedIds);
    ordered.forEach((page, index) => {
      this.store.update("pages", page.id, { order: index });
    });
    return ordered;
  };

  deleteNotebook = (id: ID): void => {
    const nb = this.store.getState().notebooks[id];
    if (!nb) return;
    if (nb.status === "archived") {
      this.store.remove("notebooks", id);
    } else {
      this.store.update("notebooks", id, { status: "archived", updatedAt: Date.now() });
    }
  };

  // ========== Pages ==========
  addPage = (input: NewPageInput, now: Timestamp = Date.now()): Page => {
    const page = createPage(input, now);
    this.store.insert("pages", page);
    return page;
  };

  updatePage = (id: ID, patch: Partial<Page>): Page | null =>
    this.store.update("pages", id, patch);

  getPage = (id: ID): Page | null => this.store.getState().pages[id] ?? null;

  deletePage = (id: ID): void => {
    const page = this.store.getState().pages[id];
    if (!page) return;
    if (page.status === "trashed") {
      this.store.remove("pages", id);
    } else {
      this.store.update("pages", id, { status: "trashed", trashedAt: Date.now() });
    }
  };

updatePageBlocks = (id: ID, blocks: NoteBlock[], now: Timestamp = Date.now()): Page | null => {
    const page = this.store.getState().pages[id];
    if (!page) return null;
    const updated = updatePageBlocks(page, blocks, now);
    return this.store.update("pages", id, updated);
  };

  restorePage = (id: ID, now: Timestamp = Date.now()): Page | null =>
    this.store.update("pages", id, restorePage(this.store.getState().pages[id], now));

  archivePage = (id: ID, now: Timestamp = Date.now()): Page | null =>
    this.store.update("pages", id, archivePage(this.store.getState().pages[id], now));

  addPageRef = (id: ID, ref: PageRef, now: Timestamp = Date.now()): Page | null => {
    const page = this.store.getState().pages[id];
    if (!page) return null;
    const refs = page.refs ?? [];
    const key = `${ref.type}:${ref.id}`;
    if (refs.some((entry) => `${entry.type}:${entry.id}` === key)) return page;
    return this.store.update("pages", id, { refs: [...refs, ref], updatedAt: now });
  };

  removePageRef = (id: ID, ref: PageRef, now: Timestamp = Date.now()): Page | null => {
    const page = this.store.getState().pages[id];
    if (!page) return null;
    const key = `${ref.type}:${ref.id}`;
    return this.store.update("pages", id, {
      refs: (page.refs ?? []).filter((entry) => `${entry.type}:${entry.id}` !== key),
      updatedAt: now,
    });
  };

  pageBacklinks = (id: ID): Page[] => pagesLinkingTo(this.store.getState(), { type: "page", id });

  promoteNoteToPage = (noteId: ID, notebookId: ID, now: Timestamp = Date.now()): Page | null => {
    const note = this.store.getState().notes[noteId];
    if (!note) return null;
    const page = createPage(
      { ...promoteNoteToPageInput(note, notebookId), order: nextPageOrder(this.store.getState(), notebookId) },
      now,
    );
    this.store.insert("pages", page);
    this.store.update("notes", noteId, { notebookId, updatedAt: now });
    return page;
  };

  notebookPageToMarkdown = (id: ID, options: { toc?: boolean } = {}): string => {
    const page = this.store.getState().pages[id];
    return page ? pageToMarkdown(page, options) : "";
  };

  notebookToMarkdown = (notebookId: ID): string => {
    const notebook = this.store.getState().notebooks[notebookId];
    if (!notebook) return "";
    return notebookToMarkdown(notebook, listPages(this.store.getState(), notebookId));
  };

  // ========== Folders ==========
  addFolder = (input: NewFolderInput, now: Timestamp = Date.now()): Folder => {
    const folder = createFolder(input, now);
    this.store.insert("folders", folder);
    return folder;
  };

  updateFolder = (id: ID, patch: Partial<Folder>): Folder | null =>
    this.store.update("folders", id, patch);

  getFolder = (id: ID): Folder | null => this.store.getState().folders[id] ?? null;

  deleteFolder = (id: ID): void => {
    const folder = this.store.getState().folders[id];
    if (!folder) return;
    if (folder.status === "trashed") {
      this.store.remove("folders", id);
    } else {
      this.store.update("folders", id, { status: "trashed", trashedAt: Date.now() });
    }
  };

  restoreFolder = (id: ID): Folder | null => {
    const folder = this.store.getState().folders[id];
    if (!folder) return null;
    return this.store.update("folders", id, { status: "active", trashedAt: null, updatedAt: Date.now() });
  };

  getFolderTree = (): FolderNode[] => getFolderTree(this.store.getState());

  // ========== Knowledge Inbox ==========
  addInboxItem = (input: NewInboxItemInput, now: Timestamp = Date.now()): InboxItem => {
    const item = createInboxItem(input, now);
    this.store.insert("inboxItems", item);
    return item;
  };

  getInboxItem = (id: ID): InboxItem | null => this.store.getState().inboxItems[id] ?? null;

  triageInboxItem = (id: ID): InboxItem | null => {
    const item = this.store.getState().inboxItems[id];
    if (!item) return null;
    return this.store.update("inboxItems", id, { status: "triaged", triagedAt: Date.now() }) as InboxItem;
  };

  archiveInboxItem = (id: ID): InboxItem | null => {
    const item = this.store.getState().inboxItems[id];
    if (!item) return null;
    return this.store.update("inboxItems", id, { status: "archived", updatedAt: Date.now() }) as InboxItem;
  };

  getInboxItems = (status?: InboxItemStatus): InboxItem[] => {
    const items = Object.values(this.store.getState().inboxItems);
    if (status) return items.filter((i) => i.status === status);
    return items.filter((i) => i.status !== "archived");
  };

  // ========== Knowledge Search ==========
  search = (options: SearchOptions): SearchResult[] =>
    search(this.store.getState(), options);

  getSearchSuggestions = (partial: string, limit = 10): string[] =>
    getSearchSuggestions(this.store.getState(), partial, limit);

  findByTags = (tags: string[], types?: SearchResult["type"][]): SearchResult[] =>
    findByTags(this.store.getState(), tags, types);

  getRelatedItems = (itemId: ID, itemType: SearchResult["type"], limit = 10): SearchResult[] =>
    getRelatedItems(this.store.getState(), itemId, itemType, limit);

  // ========== Knowledge Tagging ==========
  autoTagItem = (text: string, itemType: "note" | "page" | "document" | "journal_entry", existingTags: string[] = [], itemId?: ID): AutoTagResult =>
    autoTagItem(this.store.getState(), text, itemType, existingTags, itemId);

  suggestTags = (text: string, existingTags?: string[]): TagSuggestion[] =>
    suggestTagsFromContent(text, existingTags);

  extractEntities = (text: string): ExtractedEntity[] =>
    extractEntities(text);

  classifyContent = (text: string) => classifyContent(text);

  getTagCloud = (types?: ("note" | "page" | "document" | "journal_entry")[]) =>
    generateTagCloud(this.store.getState(), types);

  // ========== Knowledge Relationships ==========
  addKnowledgeRelationship = (input: NewKnowledgeRelationshipInput, now: Timestamp = Date.now()): KnowledgeRelationship => {
    const rel = createKnowledgeRelationship(input, now);
    this.store.insert("knowledgeRelationships", rel);
    return rel;
  };

  getKnowledgeRelationship = (id: ID): KnowledgeRelationship | null =>
    this.store.getState().knowledgeRelationships[id] ?? null;

  deleteKnowledgeRelationship = (id: ID): void => {
    this.store.remove("knowledgeRelationships", id);
  };

  getKnowledgeGraph = (): KnowledgeGraph => buildKnowledgeGraph(this.store.getState());

  getOutgoingRelationships = (nodeId: ID, types?: KnowledgeRelationshipType[]): KnowledgeGraphEdge[] =>
    getOutgoingRelationships(buildKnowledgeGraph(this.store.getState()), nodeId, types);

  getIncomingRelationships = (nodeId: ID, types?: KnowledgeRelationshipType[]): KnowledgeGraphEdge[] =>
    getIncomingRelationships(buildKnowledgeGraph(this.store.getState()), nodeId, types);

  getRelatedNodes = (nodeId: ID, maxDepth = 2, relationshipTypes?: KnowledgeRelationshipType[]): Map<ID, { node: KnowledgeGraphNode; distance: number; path: KnowledgeGraphEdge[] }> =>
    getRelatedNodes(buildKnowledgeGraph(this.store.getState()), nodeId, maxDepth, relationshipTypes);

  findShortestPath = (sourceId: ID, targetId: ID, relationshipTypes?: KnowledgeRelationshipType[]): KnowledgeGraphEdge[] | null =>
    findShortestPath(buildKnowledgeGraph(this.store.getState()), sourceId, targetId, relationshipTypes);

  getPageRank = (iterations = 20, damping = 0.85): Map<ID, number> =>
    getPageRank(buildKnowledgeGraph(this.store.getState()), iterations, damping);

  suggestRelationships = (sourceId: ID, sourceType: "note" | "page" | "document" | "journal_entry" | "transcript" | "recording" | "life_memory", limit = 10) =>
    suggestRelationships(this.store.getState(), sourceId, sourceType, limit);

  detectCycles = (): ID[][] => detectCycles(buildKnowledgeGraph(this.store.getState()));

  getOrphanNodes = (): KnowledgeGraphNode[] => getOrphanNodes(buildKnowledgeGraph(this.store.getState()));

  getHubNodes = (limit = 10) => getHubNodes(buildKnowledgeGraph(this.store.getState()), limit);

  // ========== Embeddings & Semantic Search ==========
  updateEmbedding = (itemId: ID, itemType: string, text: string): void =>
    updateItemEmbedding(this.store.getState(), itemId, itemType, text);

  rebuildAllEmbeddings = (): void => rebuildAllEmbeddings(this.store.getState());

  semanticSearch = (query: string, types?: ("note" | "page" | "document" | "journal_entry" | "transcript" | "recording" | "notebook" | "meeting" | "life_memory")[], limit = 10, threshold = 0.3) =>
    semanticSearch(this.store.getState(), query, types, limit, threshold);

  findSimilarItems = (itemId: ID, itemType: string, limit = 10, threshold = 0.4) =>
    findSimilarItems(this.store.getState(), itemId, itemType, limit, threshold);

  rebuildEmbeddings = (): void => rebuildAllEmbeddings(this.store.getState());

  // ========== AI Intelligence Layer ==========

  addMeeting = (input: NewMeetingInput, now: Timestamp = Date.now()): Meeting => {
    const meeting = createMeeting(input, now);
    this.store.insert("meetings", meeting);
    return meeting;
  };

  updateMeeting = (id: ID, patch: Partial<Meeting>): Meeting | null =>
    this.store.update("meetings", id, patch);

  addMeetingSeries = (
    input: NewMeetingInput & { recurrence: RecurrenceRule },
    occurrences = 6,
    now: Timestamp = Date.now(),
  ): Meeting[] => {
    const created: Meeting[] = [];
    const count = Math.max(1, Math.min(52, Math.round(occurrences)));
    const seriesId = crypto.randomUUID();
    let cursor = input.startsAt;
    const duration = input.endsAt != null ? Math.max(0, input.endsAt - input.startsAt) : 0;
    for (let index = 0; index < count; index += 1) {
      const meeting = this.addMeeting(
        {
          ...input,
          startsAt: cursor,
          endsAt: duration > 0 ? cursor + duration : input.endsAt ?? null,
          recurrence: input.recurrence,
          recurrenceId: seriesId,
          recurrenceOrdinal: index + 1,
        },
        now,
      );
      created.push(meeting);
      const next = nextOccurrence(input.recurrence, cursor, input.startsAt);
      if (next == null) break;
      cursor = next;
    }
    return created;
  };

  addMeetingReminder = (meetingId: ID, fireAt: Timestamp, now: Timestamp = Date.now()): Reminder | null => {
    const meeting = this.store.getState().meetings[meetingId];
    if (!meeting) return null;
    const reminder = createReminder({
      fireAt: Math.max(now, fireAt),
      meetingId,
      message: meeting.title,
    });
    this.store.insert("reminders", reminder);
    return reminder;
  };

  meetingReminders = (meetingId: ID): Reminder[] =>
    Object.values(this.store.getState().reminders)
      .filter((reminder) => reminder.meetingId === meetingId && reminder.firedAt == null)
      .sort((a, b) => a.fireAt - b.fireAt);

  addTranscript = (input: NewTranscriptInput, now: Timestamp = Date.now()): Transcript => {
    const transcript = createTranscript(input, now);
    this.store.insert("transcripts", transcript);
    return transcript;
  };

  updateTranscript = (id: ID, patch: Partial<Transcript>): Transcript | null =>
    this.store.update("transcripts", id, patch);

  addActionItem = (input: Omit<NewActionItemInput, "taskId">, now: Timestamp = Date.now()): ActionItem => {
    const { title, transcriptId, meetingId, assigneeId, dueAt, order } = input;
    const item = createActionItem(
      {
        title,
        transcriptId,
        meetingId,
        assigneeId,
        dueAt,
        order,
      },
      now,
    );
    this.store.insert("actionItems", item);
    return item;
  };

  updateActionItem = (id: ID, patch: Partial<ActionItem>): ActionItem | null =>
    this.store.update("actionItems", id, patch);

  addInsight = (input: NewAIInsightInput, now: Timestamp = Date.now()): AIInsight => {
    const insight = createAIInsight(input, now);
    this.store.insert("aiInsights", insight);
    return insight;
  };

  updateInsight = (id: ID, patch: Partial<AIInsight>): AIInsight | null =>
    this.store.update("aiInsights", id, patch);

  addConversation = (input: NewAIConversationInput = {}, now: Timestamp = Date.now()): AIConversation => {
    const conversation = createAIConversation(input, now);
    this.store.insert("aiConversations", conversation);
    return conversation;
  };

  addMessage = (input: NewAIMessageInput, now: Timestamp = Date.now()): AIMessage => {
    const message = createAIMessage(input, now);
    this.store.insert("aiMessages", message);
    const conversation = this.store.getState().aiConversations[input.conversationId];
    if (conversation) {
      this.store.update("aiConversations", conversation.id, { lastMessageAt: now });
    }
    return message;
  };

  renameConversation = (id: ID, title: string, now: Timestamp = Date.now()): AIConversation | null => {
    const conversation = this.store.getState().aiConversations[id];
    if (!conversation) return null;
    const clean = title.trim().slice(0, 80);
    return this.store.update("aiConversations", id, {
      title: clean.length > 0 ? clean : "New conversation",
      updatedAt: now,
    });
  };

  deleteConversation = (id: ID): void => {
    if (!this.store.getState().aiConversations[id]) return;
    for (const message of Object.values(this.store.getState().aiMessages)) {
      if (message.conversationId === id) this.store.remove("aiMessages", message.id);
    }
    this.store.remove("aiConversations", id);
  };

  updateMessage = (id: ID, patch: Partial<AIMessage>): AIMessage | null =>
    this.store.update("aiMessages", id, patch);

  setMessageFeedback = (id: ID, feedback: AIMessage["feedback"]): AIMessage | null =>
    this.store.update("aiMessages", id, { feedback });

  aiFeedbackSummary = (): { up: number; down: number; total: number } => {
    let up = 0;
    let down = 0;
    for (const message of Object.values(this.store.getState().aiMessages)) {
      if (message.feedback === "up") up += 1;
      else if (message.feedback === "down") down += 1;
    }
    return { up, down, total: up + down };
  };

  pinConversation = (id: ID, pinned = true, now: Timestamp = Date.now()): AIConversation | null =>
    this.store.update("aiConversations", id, { pinnedAt: pinned ? now : null });

  clearConversation = (id: ID, now: Timestamp = Date.now()): AIConversation | null => {
    const conversation = this.store.getState().aiConversations[id];
    if (!conversation) return null;
    for (const message of Object.values(this.store.getState().aiMessages)) {
      if (message.conversationId === id) this.store.remove("aiMessages", message.id);
    }
    return this.store.update("aiConversations", id, { summary: "", lastMessageAt: null, updatedAt: now });
  };

  aiContext = (now: Timestamp = Date.now()): AIContextBundle => buildAIContext(this.store.getState(), now);

  aiContextSummary = (now: Timestamp = Date.now()): string => contextSummary(buildAIContext(this.store.getState(), now));

  aiParseIntent = (input: string, now: Timestamp = Date.now()): AiIntent => parseIntent(input, { now });

  aiRun = (input: string, options: { now?: Timestamp; voice?: boolean } = {}): AIResult =>
    runAssistant(this as unknown as AssistantExecutor, { input, now: options.now, voice: options.voice });

  aiComputeInsights = (now: Timestamp = Date.now()): ProductivityInsight[] =>
    computeInsights(this.store.getState(), now);

  aiRecommendations = (now: Timestamp = Date.now()): AIRecommendation[] =>
    computeRecommendations(this.store.getState(), now);

  aiWeeklyReview = (now: Timestamp = Date.now()): WeeklyReview =>
    buildWeeklyReview(this.store.getState(), now, this.store.getState().settings.weekStart);

  aiSummarizeNote = (noteId: ID): NoteSummary | null => {
    const note = this.store.getState().notes[noteId];
    return note ? summarizeNote(note) : null;
  };

  aiAnalyzeTranscript = (transcriptId: ID, now: Timestamp = Date.now()): MeetingAnalysis | null => {
    const transcript = this.store.getState().transcripts[transcriptId];
    return transcript ? analyzeTranscript(transcript, now) : null;
  };

  aiTranscriptsReady = (now: Timestamp = Date.now()) => meetingsNeedingIntelligence(this.store.getState(), now);

  aiHybridSearch = (query: string, limit = 20) => hybridSearch(this.store.getState(), { query, limit });

  aiRiskFor = (capability: AIProposal["capability"]) => riskForCapability(capability);

  aiRequiresConfirmation = (capability: AIProposal["capability"]) => requiresConfirmation(capability);

  aiPendingProposals = (): AIObject[] =>
    Object.values(this.store.getState().aiObjects)
      .filter((object) => object.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt);

  aiProposalFromObject = (object: AIObject): AIProposal | null => {
    const payload = object.payload as { proposal?: AIProposal } | null;
    return payload?.proposal ?? null;
  };

  aiSaveProposal = (proposal: AIProposal, now: Timestamp = Date.now()): AIObject => {
    const object = createAIObject(
      {
        kind: proposal.risk === "high" ? "plan" : "suggestion",
        title: proposal.title,
        body: proposal.summary,
        status: "pending",
        payload: { proposal, capability: proposal.capability },
        refs: proposal.refs.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId })),
        model: "deterministic",
      },
      now,
    );
    this.store.insert("aiObjects", object);
    return object;
  };

  aiAcceptProposal = (id: ID, now: Timestamp = Date.now()): ProposalApplyResult => {
    const object = this.store.getState().aiObjects[id];
    if (!object) {
      return { ok: false, message: "That proposal no longer exists.", created: [], taskIds: [], eventIds: [], blockedByPolicy: [] };
    }
    if (object.status !== "pending") {
      return { ok: false, message: "This proposal has already been reviewed.", created: [], taskIds: [], eventIds: [], blockedByPolicy: [] };
    }
    const proposal = this.aiProposalFromObject(object);
    if (!proposal) {
      return { ok: false, message: "That proposal has no actions attached.", created: [], taskIds: [], eventIds: [], blockedByPolicy: [] };
    }
    const result = applyProposal(this as unknown as Parameters<typeof applyProposal>[0], proposal, now);
    this.store.update("aiObjects", id, { status: result.ok ? "accepted" : "pending", updatedAt: now });
    if (result.ok && result.created.length > 0) {
      for (const item of result.created) {
        const refs = object.refs.map((ref) => ref.entityId);
        if (refs.length > 0) void refs;
      }
    }
    return result;
  };

  aiDismissProposal = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("aiObjects", id, { status: "dismissed", updatedAt: now });
  };

  aiInsights = (): AIInsight[] =>
    Object.values(this.store.getState().aiInsights)
      .filter((insight) => insight.status !== "dismissed")
      .sort((a, b) => b.createdAt - a.createdAt);

  aiStoreInsights = (now: Timestamp = Date.now()): number => {
    let stored = 0;
    for (const insight of computeInsights(this.store.getState(), now)) {
      const existing = Object.values(this.store.getState().aiInsights).find(
        (row) => row.dedupeKey != null && row.dedupeKey === insight.dedupeKey,
      );
      if (existing) continue;
      this.addInsight({
        kind: insight.kind,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        confidence: insight.confidence,
        dedupeKey: insight.dedupeKey,
        refs: [],
      });
      stored += 1;
    }
    return stored;
  };

  aiDismissInsight = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("aiInsights", id, { status: "dismissed", updatedAt: now });
  };

  aiReadInsight = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("aiInsights", id, { status: "read", readAt: now, updatedAt: now });
  };

  // ========== Life Memory ("When Did I?") ==========

  addLifeMemoryItem = (
    input: NewLifeMemoryItemInput,
    now: Timestamp = Date.now(),
  ): LifeMemoryItem => {
    const item = createLifeMemoryItem(input, now);
    this.store.insert("lifeMemoryItems", item);
    return item;
  };

  addAttachment = (
    input: NewAttachmentInput,
    now: Timestamp = Date.now(),
  ): Attachment => {
    const attachment = createAttachment(input, now);
    this.store.insert("attachments", attachment);
    return attachment;
  };

  updateAttachment = (id: ID, patch: Partial<Attachment>): Attachment | null =>
    this.store.update("attachments", id, patch);

  deleteAttachment = (id: ID): void => {
    this.store.remove("attachments", id);
  };

  attachmentsFor = (ownerType: Attachment["ownerType"], ownerId: ID): Attachment[] =>
    Object.values(this.store.getState().attachments).filter(
      (attachment) => attachment.ownerType === ownerType && attachment.ownerId === ownerId,
    );

  attachmentsForOccurrence = (occurrenceId: ID): Attachment[] => {
    const ids = new Set<ID>();
    for (const item of Object.values(this.store.getState().lifeMemoryItems)) {
      for (const occurrence of item.history) {
        if (occurrence.id === occurrenceId) {
          for (const id of occurrence.attachmentIds) ids.add(id);
        }
      }
    }
    return Object.values(this.store.getState().attachments).filter((attachment) => ids.has(attachment.id));
  };

  updateLifeMemoryItem = (id: ID, patch: Partial<LifeMemoryItem>): LifeMemoryItem | null =>
    this.store.update("lifeMemoryItems", id, patch);

  getLifeMemoryItem = (id: ID): LifeMemoryItem | null =>
    this.store.getState().lifeMemoryItems[id] ?? null;

  deleteLifeMemoryItem = (id: ID, now: Timestamp = Date.now()): void => {
    const item = this.store.getState().lifeMemoryItems[id];
    if (!item) return;
    if (item.status === "trashed") {
      this.store.remove("lifeMemoryItems", id);
    } else {
      this.store.update("lifeMemoryItems", id, moveLifeMemoryItemToTrash(item, now));
    }
  };

  archiveLifeMemoryItem = (id: ID, now: Timestamp = Date.now()): void => {
    const item = this.store.getState().lifeMemoryItems[id];
    if (!item) return;
    this.store.update("lifeMemoryItems", id, archiveLifeMemoryItem(item, now));
  };

  restoreLifeMemoryItem = (id: ID, now: Timestamp = Date.now()): void => {
    const item = this.store.getState().lifeMemoryItems[id];
    if (!item) return;
    this.store.update("lifeMemoryItems", id, restoreLifeMemoryItem(item, now));
  };

  recordLifeMemoryCompletion = (
    id: ID,
    input: NewLifeMemoryOccurrenceInput,
    now: Timestamp = Date.now(),
  ): LifeMemoryItem | null => {
    const item = this.store.getState().lifeMemoryItems[id];
    if (!item) return null;
    const next = addOccurrence(item, input, now);
    return this.store.update("lifeMemoryItems", id, next);
  };

  removeLifeMemoryCompletion = (
    id: ID,
    occurrenceId: ID,
    now: Timestamp = Date.now(),
  ): LifeMemoryItem | null => {
    const item = this.store.getState().lifeMemoryItems[id];
    if (!item) return null;
    const next = removeOccurrence(item, occurrenceId, now);
    return this.store.update("lifeMemoryItems", id, next);
  };

  lifeMemoryItems = (includeTrashed = false): LifeMemoryItem[] =>
    Object.values(this.store.getState().lifeMemoryItems).filter(
      (item) => includeTrashed || item.status !== "trashed",
    );

  lifeMemoryStats = (id: ID, now: Timestamp = Date.now()): LifeMemoryStats | null => {
    const item = this.store.getState().lifeMemoryItems[id];
    return item ? computeLifeStats(item, now) : null;
  };

lifeMemoryOverview = (now: Timestamp = Date.now()): LifeMemoryOverview =>
    buildOverview(this.store.getState(), now);

  // ========== Memory moments (episodic) ==========
  addMemoryMoment = (input: NewMemoryMomentInput, now: Timestamp = Date.now()): MemoryMoment => {
    const moment = createMemoryMoment(input, now);
    this.store.insert("memoryMoments", moment);
    return moment;
  };

  updateMemoryMoment = (id: ID, patch: Partial<MemoryMoment>): MemoryMoment | null =>
    this.store.update("memoryMoments", id, patch);

  getMemoryMoment = (id: ID): MemoryMoment | null =>
    this.store.getState().memoryMoments[id] ?? null;

  deleteMemoryMoment = (id: ID, now: Timestamp = Date.now()): void => {
    const moment = this.store.getState().memoryMoments[id];
    if (!moment) return;
    if (moment.status === "trashed") this.store.remove("memoryMoments", id);
    else this.store.update("memoryMoments", id, moveMemoryMomentToTrash(moment, now));
  };

  restoreMemoryMoment = (id: ID, now: Timestamp = Date.now()): MemoryMoment | null =>
    this.store.update("memoryMoments", id, restoreMemoryMoment(this.store.getState().memoryMoments[id], now));

  toggleMemoryMomentFavorite = (id: ID, now: Timestamp = Date.now()): MemoryMoment | null => {
    const moment = this.store.getState().memoryMoments[id];
    if (!moment) return null;
    return this.store.update("memoryMoments", id, { favorite: !moment.favorite, updatedAt: now });
  };

  memoryMoments = (filters: MemoryFilters = {}): MemoryMoment[] =>
    filterMoments(this.store.getState(), filters);

  memoryCategoryCounts = (): MemoryCategoryCount[] => categoryCounts(this.store.getState());

  memoryQuickFilterCounts = (now: Timestamp = Date.now()): Record<MemoryQuickFilter, number> =>
    quickFilterCounts(this.store.getState(), now);

  memoryGlance = (year: Timestamp = Date.now()): MemoryGlance => glanceStats(this.store.getState(), year);

  memoryPlaces = (limit = 12): MemoryPlaceVisit[] => placesVisited(this.store.getState(), limit);

  memoryRecurring = (limit = 5): MemoryRecurring[] => recurringMoments(this.store.getState(), limit);

  memoryAsk = (question: string, now: Timestamp = Date.now()): MemoryAnswer =>
    answerMemoryQuestion(this.store.getState(), question, now);

  lifeMemoryDue = (now: Timestamp = Date.now(), windowDays = 7) =>
    selectItemsDue(this.store.getState(), now, windowDays);

  lifeMemoryOverdue = (now: Timestamp = Date.now()) => selectOverdueItems(this.store.getState(), now);

  lifeMemoryHistory = (id: ID, order: "asc" | "desc" = "desc"): LifeMemoryOccurrence[] => {
    const item = this.store.getState().lifeMemoryItems[id];
    return item ? getHistory(item, order) : [];
  };

  aiLifeMemoryAnswer = (question: string, now: Timestamp = Date.now()): LifeMemoryQueryResult =>
    answerWhenDidI(this.store.getState(), question, now);

  aiParseLifeEvent = (text: string, now: Timestamp = Date.now()): ParsedLifeEvent =>
    parseLifeEvent(text, now);

  aiMatchLifeMemory = (query: string): LifeMemoryItem | null => matchLifeMemoryItem(this.store.getState(), query);

  // ========== Meeting Intelligence ==========

  addRecording = (input: NewRecordingInput, now: Timestamp = Date.now()): Recording => {
    const recording = createRecording(input, now);
    this.store.insert("recordings", recording);
    return recording;
  };

  importRecording = (
    input: { title: string; startedAt: Timestamp; mimeType?: string; sizeBytes?: number; url?: string | null; tags?: string[] },
    now: Timestamp = Date.now(),
  ): Recording => {
    const recording = createRecording(
      {
        title: input.title,
        startedAt: input.startedAt,
        mimeType: input.mimeType ?? "audio/mpeg",
        status: "ready",
        tags: input.tags ?? [],
        url: input.url ?? null,
      },
      now,
    );
    this.store.insert("recordings", recording);
    return recording;
  };

  updateRecording = (id: ID, patch: Partial<Recording>): Recording | null =>
    this.store.update("recordings", id, patch);

  deleteRecording = (id: ID, now: Timestamp = Date.now()): void => {
    const recording = this.store.getState().recordings[id];
    if (!recording) return;
    if (recording.status === "trashed") this.store.remove("recordings", id);
    else this.store.update("recordings", id, moveRecordingToTrash(recording, now));
  };

  archiveRecording = (id: ID, now: Timestamp = Date.now()): void => {
    const recording = this.store.getState().recordings[id];
    if (!recording) return;
    this.store.update("recordings", id, archiveRecording(recording, now));
  };

  restoreRecording = (id: ID, now: Timestamp = Date.now()): void => {
    const recording = this.store.getState().recordings[id];
    if (!recording) return;
    this.store.update("recordings", id, restoreRecording(recording, now));
  };

  recordings = (includeTrashed = false): Recording[] =>
    Object.values(this.store.getState().recordings)
      .filter((recording) => includeTrashed || recording.status !== "trashed")
      .sort((a, b) => b.startedAt - a.startedAt);

  getRecording = (id: ID): Recording | null => this.store.getState().recordings[id] ?? null;

  getMeeting = (id: ID): Meeting | null => this.store.getState().meetings[id] ?? null;

  getTranscript = (id: ID): Transcript | null => this.store.getState().transcripts[id] ?? null;

  deleteMeeting = (id: ID): void => {
    for (const transcript of Object.values(this.store.getState().transcripts)) {
      if (transcript.meetingId === id) this.store.update("transcripts", transcript.id, { meetingId: null });
    }
    this.store.remove("meetings", id);
  };

  meetings = (): Meeting[] =>
    Object.values(this.store.getState().meetings).sort((a, b) => b.startsAt - a.startsAt);

  transcripts = (): Transcript[] =>
    Object.values(this.store.getState().transcripts).sort((a, b) => b.updatedAt - a.updatedAt);

  deleteTranscript = (id: ID, now: Timestamp = Date.now()): void => {
    const transcript = this.store.getState().transcripts[id];
    if (!transcript) return;
    if (transcript.status === "trashed") this.store.remove("transcripts", id);
    else this.store.update("transcripts", id, moveTranscriptToTrash(transcript, now));
  };

  restoreTranscript = (id: ID, now: Timestamp = Date.now()): void => {
    const transcript = this.store.getState().transcripts[id];
    if (!transcript) return;
    this.store.update("transcripts", id, restoreTranscript(transcript, now));
  };

  startLiveTranscription = (
    input: { title: string; meetingId?: ID | null; recordingId?: ID | null },
    now: Timestamp = Date.now(),
  ): { meeting: Meeting; transcript: Transcript } => {
    const meeting = createMeeting({ title: input.title, startsAt: now, notes: "" }, now);
    this.store.insert("meetings", meeting);

    const transcript = createTranscript(
      {
        title: input.title,
        source: input.recordingId ? "recording" : "meeting",
        meetingId: meeting.id,
        recordingId: input.recordingId ?? null,
      },
      now,
    );
    this.store.insert("transcripts", transcript);
    return { meeting, transcript };
  };

  appendTranscriptSegment = (
    transcriptId: ID,
    segment: { speaker: string; text: string; at?: Timestamp },
    now: Timestamp = Date.now(),
  ): Transcript | null => {
    const transcript = this.store.getState().transcripts[transcriptId];
    if (!transcript) return null;
    const at = segment.at ?? now;
    const next = appendLiveSegment(
      { transcriptId, recordingId: transcript.recordingId, meetingId: transcript.meetingId, startedAt: transcript.createdAt, segments: transcript.segments },
      { speaker: segment.speaker, text: segment.text, at },
      now,
    ).segments;
    return this.store.update("transcripts", transcriptId, {
      segments: next,
      fullText: next.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n"),
      updatedAt: now,
    });
  };

  finishLiveTranscription = (id: ID, now: Timestamp = Date.now()): Transcript | null => {
    const transcript = this.store.getState().transcripts[id];
    if (!transcript) return null;
    const segments = transcript.segments;
    const durationMs = segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMs)) : 0;
    return this.store.update("transcripts", id, {
      status: "ready",
      fullText: segments.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n"),
      updatedAt: now,
      ...(durationMs > 0 ? { confidence: 0.9 } : {}),
    });
  };

  importTranscript = (
    input: NewTranscriptInput,
    segments: TranscriptSegment[],
    now: Timestamp = Date.now(),
  ): Transcript => {
    const transcript = createTranscript(input, now);
    const imported: Transcript = {
      ...transcript,
      segments,
      fullText: segments.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n"),
      status: "ready",
    };
    this.store.insert("transcripts", imported);
    if (input.recordingId) {
      const recording = this.store.getState().recordings[input.recordingId];
      if (recording && recording.status !== "trashed") {
        this.store.update("recordings", recording.id, { status: "ready", documentId: transcript.id });
      }
    }
    return this.store.getState().transcripts[transcript.id]!;
  };

  renameTranscriptSpeaker = (id: ID, from: string, to: string, now: Timestamp = Date.now()): Transcript | null => {
    const transcript = this.store.getState().transcripts[id];
    if (!transcript) return null;
    const segments = renameSpeaker(transcript, from, to);
    return this.store.update("transcripts", id, {
      segments,
      fullText: segments.map((entry) => `${entry.speaker}: ${entry.text}`).join("\n"),
      updatedAt: now,
      confidence: 0.95,
    });
  };

  meetingReport = (transcriptId: ID, now: Timestamp = Date.now()): MeetingReport | null =>
    buildMeetingReport(this.store.getState(), transcriptId, now);

  meetingsDashboard = (
    options: MeetingsDashboardOptions = {},
    now: Timestamp = Date.now(),
  ): MeetingsDashboard => buildMeetingsDashboard(this.store.getState(), now, options);


  storeMeetingReport = (transcriptId: ID, now: Timestamp = Date.now()): MeetingReport | null => {
    const report = buildMeetingReport(this.store.getState(), transcriptId, now);
    if (!report) return null;
    storeMeetingReport(this.store.getState(), report, now);
    return report;
  };

  meetingProposals = (transcriptId: ID, now: Timestamp = Date.now()): MeetingProposalSet | null => {
    const report = buildMeetingReport(this.store.getState(), transcriptId, now);
    if (!report) return null;
    return proposeFromReport(this.store.getState(), report, now);
  };

  searchTranscripts = (
    query: string,
    filters: { meetingId?: ID | null; speaker?: string; limit?: number } = {},
    now: Timestamp = Date.now(),
  ) => searchTranscriptsEngine(this.store.getState(), query, filters, now);

  transcriptsNeedingAudio = (): Recording[] => recordingsNeedingTranscript(this.store.getState());

  // ========== Gamification ==========

  awardXP = (
    input: {
      reason: XPReason;
      entityType?: string | null;
      entityId?: ID | null;
      note?: string;
      minutes?: number;
    },
    now: Timestamp = Date.now(),
  ): AwardOutcome => {
    const state = this.store.getState();
    const rule = XP_RULE_BY_REASON[input.reason];
    const verdict = canAward(state, input.reason, input.entityId ?? null, now);
    const before = this.gamificationXpTotal();
    if (!verdict.allowed || !rule) {
      return {
        ok: false,
        message: verdict.reason || "That activity does not earn XP.",
        amount: 0,
        skill: rule?.skill ?? "execution",
        coins: 0,
        xpTotal: before,
        level: levelForXp(before),
        capped: verdict.capped,
        unlocked: [],
      };
    }

    const transaction = createXPTransaction(
      {
        amount: verdict.amount,
        reason: input.reason,
        entityType: (input.entityType ?? null) as XPTransaction["entityType"],
        entityId: input.entityId ?? null,
        note: input.note ?? rule.label,
      },
      now,
    );
    this.store.insert("xpTransactions", transaction);

    const skill = this.store.getState().skills[rule.skill];
    if (skill) {
      const xp = skill.xp + verdict.amount;
      this.store.update("skills", skill.id, { xp, level: skillLevelFromXp(xp), updatedAt: now });
    } else {
      const seeded = createSkill(
        {
          kind: rule.skill,
          label: rule.skill,
          level: skillLevelFromXp(verdict.amount),
          xp: verdict.amount,
        },
        now,
      );
      this.store.insert("skills", seeded);
    }

    const coins = Math.max(1, Math.round(verdict.amount * COIN_RATE));
    const coinEntry = createCoinLedgerEntry(
      {
        amount: coins,
        sink: "manual",
        reason: input.reason,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        note: input.note ?? rule.label,
      },
      now,
    );
    this.store.insert("coinLedger", coinEntry);

    const after = this.gamificationXpTotal();
    const unlocked = this.unlockAchievementsForProgress(now);

    return {
      ok: true,
      message: verdict.reason || `+${verdict.amount} XP`,
      amount: verdict.amount,
      skill: rule.skill,
      coins,
      xpTotal: after,
      level: levelForXp(after),
      levelBefore: levelForXp(before),
      capped: verdict.capped,
      unlocked,
    };
  };

  gamificationXpTotal = (): number =>
    Object.values(this.store.getState().xpTransactions)
      .filter((transaction) => transaction.status === "posted")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

  private unlockAchievementsForProgress = (now: Timestamp): Achievement[] => {
    const unlocked: Achievement[] = [];
    const xpTotal = this.gamificationXpTotal();
    for (const achievement of Object.values(this.store.getState().achievements)) {
      if (achievement.status !== "locked") continue;
      if (xpTotal < achievement.threshold) continue;
      this.store.update("achievements", achievement.id, {
        progress: achievement.threshold,
        unlockedAt: now,
        status: "unlocked",
        updatedAt: now,
      });
      const updated = this.store.getState().achievements[achievement.id]!;
      unlocked.push(updated);
      this.awardXP(
        { reason: "achievement", entityType: "achievement", entityId: achievement.id, note: achievement.title },
        now,
      );
    }
    return unlocked;
  };

  evaluateGamificationAchievements = (now: Timestamp = Date.now()) =>
    evaluateAchievements(this.store.getState(), now);

  gamificationEnabled = (): boolean => this.store.getState().settings.gamification.enabled;

  setGamificationEnabled = (enabled: boolean): void => {
    const current = this.store.getState().settings;
    this.store.patchState({
      settings: { ...current, gamification: { ...current.gamification, enabled } },
    });
  };

  updateGamificationPreferences = (patch: Partial<GamificationPreferences>): void => {
    const current = this.store.getState().settings;
    this.store.patchState({
      settings: { ...current, gamification: { ...current.gamification, ...patch } },
    });
  };

  gamificationProfile = (): GamificationProfile => buildGamificationProfile(this.store.getState());

  skills = (): Skill[] =>
    Object.values(this.store.getState().skills).sort((a, b) => a.kind.localeCompare(b.kind));

  coinBalance = (): number =>
    Object.values(this.store.getState().coinLedger).reduce((sum, entry) => sum + entry.amount, 0);

  coinLedger = (): CoinLedgerEntry[] =>
    Object.values(this.store.getState().coinLedger).sort((a, b) => b.createdAt - a.createdAt);

  redeemReward = (id: ID, now: Timestamp = Date.now()): RedeemResult => {
    const reward = this.store.getState().rewards[id];
    if (!reward) return { ok: false, message: "That reward no longer exists.", cost: 0 };
    const verdict = redeemReward(this.store.getState(), reward, now);
    if (verdict.ok && verdict.entry) {
      this.store.insert("coinLedger", verdict.entry);
      this.store.update("rewards", id, { status: "redeemed", redeemedAt: now, updatedAt: now });
      this.awardXP(
        { reason: "reward_redeem", entityType: "reward", entityId: id, note: reward.title },
        now,
      );
    }
    return { ok: verdict.ok, message: verdict.message, cost: reward.cost };
  };

  addReward = (input: NewRewardInput, now: Timestamp = Date.now()): Reward => {
    const reward = createReward(input, now);
    this.store.insert("rewards", reward);
    return reward;
  };

  updateReward = (id: ID, patch: Partial<Reward>): Reward | null =>
    this.store.update("rewards", id, patch);

  deleteReward = (id: ID): void => {
    this.store.remove("rewards", id);
  };

  grantRewardPoints = (
    input: { points: number; note: string; entityType?: string | null; entityId?: ID | null },
    now: Timestamp = Date.now(),
  ): { ok: boolean; message: string; coins: number; balance: number } => {
    const state = this.store.getState();
    if (!state.settings.gamification.enabled) {
      return { ok: false, message: "Gamification is switched off.", coins: 0, balance: this.coinBalance() };
    }
    const points = Math.max(0, Math.floor(input.points));
    if (points === 0) {
      return { ok: false, message: "Nothing to claim yet.", coins: 0, balance: this.coinBalance() };
    }
    const entry = createCoinLedgerEntry(
      {
        amount: points,
        sink: "gift",
        reason: "manual",
        entityType: input.entityType ?? "challenge",
        entityId: input.entityId ?? null,
        note: input.note,
      },
      now,
    );
    this.store.insert("coinLedger", entry);
    return { ok: true, message: `+${points} points`, coins: points, balance: this.coinBalance() };
  };

  availableRewards = (): Reward[] =>
    Object.values(this.store.getState().rewards)
      .filter((reward) => reward.status === "available")
      .sort((a, b) => a.cost - b.cost);

  redeemedRewards = (): Reward[] =>
    Object.values(this.store.getState().rewards)
      .filter((reward) => reward.status === "redeemed")
      .sort((a, b) => (b.redeemedAt ?? 0) - (a.redeemedAt ?? 0));

  seedGamificationCatalog = (now: Timestamp = Date.now()): void => {
    for (const seed of builtinAchievementSeeds()) {
      const existing = Object.values(this.store.getState().achievements).find(
        (achievement) => achievement.key === seed.key,
      );
      if (existing) continue;
      this.store.insert("achievements", createAchievement({ ...seed, builtin: true }));
    }
    for (const seed of rewardSeeds()) {
      const existing = Object.values(this.store.getState().rewards).find(
        (reward) => reward.title === seed.title,
      );
      if (existing) {
        if (!existing.builtin) this.store.update("rewards", existing.id, { builtin: true });
        continue;
      }
      this.store.insert("rewards", createReward({ ...seed, builtin: true }, now));
    }
    for (const definition of SKILL_DEFINITIONS) {
      const existing = Object.values(this.store.getState().skills).find(
        (skill) => skill.kind === definition.kind,
      );
      if (existing) continue;
      this.store.insert(
        "skills",
        createSkill({ kind: definition.kind, label: definition.label, level: 1, xp: 0 }, now),
      );
    }
  };

  // ========== Analytics & Insights ==========

  // ========== Today Dashboard ==========

  todayWelcome = (now: Timestamp = Date.now()): TodayWelcome =>
    buildTodayWelcome(this.store.getState(), now);

  todayStats = (now: Timestamp = Date.now()): TodayStats =>
    buildTodayStats(this.store.getState(), now);

  todaySchedule = (now: Timestamp = Date.now()): TodayScheduleEntry[] =>
    buildTodaySchedule(this.store.getState(), now);

  todayTasks = (bucket: TodayTaskBucket, now: Timestamp = Date.now(), limit = 8): TodayTaskRow[] =>
    buildTodayTasks(this.store.getState(), now, bucket, limit);

  todayTaskCounts = (now: Timestamp = Date.now()): Record<TodayTaskBucket, number> =>
    todayTaskCountsFor(this.store.getState(), now);

  todayHabits = (now: Timestamp = Date.now()): TodayHabitRow[] =>
    habitsDueToday(this.store.getState(), now);

  todayGoals = (now: Timestamp = Date.now(), limit = 4): TodayGoalRow[] =>
    buildTodayGoals(this.store.getState(), now, limit);

  todayJournal = (now: Timestamp = Date.now()): TodayJournalPreview =>
    buildTodayJournal(this.store.getState(), now);

  todayActivity = (now: Timestamp = Date.now(), limit = 12): TodayActivityEntry[] =>
    buildActivityFeed(this.store.getState(), now, limit);

  todayInsights = (now: Timestamp = Date.now(), limit = 4): TodayInsight[] =>
    buildTodayInsights(this.store.getState(), now, limit);

  todayMeetings = (now: Timestamp = Date.now()): TodayMeetingRow[] =>
    buildTodayMeetings(this.store.getState(), now);

  todaySteps = (now: Timestamp = Date.now()): TodayStepRow[] =>
    buildTodaySteps(this.store.getState(), now);

  todayProjects = (now: Timestamp = Date.now(), limit = 4): TodayProjectRow[] =>
    buildTodayProjects(this.store.getState(), now, limit);

  todayDeadlines = (now: Timestamp = Date.now(), limit = 6): TodayDeadlineRow[] =>
    buildTodayDeadlines(this.store.getState(), now, limit);

  todayNotes = (now: Timestamp = Date.now(), limit = 5): TodayNoteRow[] =>
    buildTodayNotes(this.store.getState(), now, limit);

  todayFocusLog = (now: Timestamp = Date.now()): TodayFocusRow[] =>
    buildTodayFocusLog(this.store.getState(), now);

  todayMoments = (now: Timestamp = Date.now(), limit = 4): TodayMomentRow[] =>
    buildTodayMoments(this.store.getState(), now, limit);

  todayReward = (): TodayRewardRow => buildTodayReward(this.store.getState());

  todayGlance = (now: Timestamp = Date.now()): TodayGlance =>
    buildTodayGlance(this.store.getState(), now);

  todayCounts = (now: Timestamp = Date.now()): TodayCounts =>
    buildTodayCounts(this.store.getState(), now);

  todayWeekInsights = (now: Timestamp = Date.now()): TodayWeekInsights =>
    buildTodayWeekInsights(this.store.getState(), now);

  todayDocuments = (now: Timestamp = Date.now(), limit = 4): TodayDocumentRow[] =>
    buildTodayDocuments(this.store.getState(), now, limit);

  todayMonth = (now: Timestamp = Date.now(), anchor: Timestamp = now): TodayMonthDay[] =>
    buildTodayMonth(this.store.getState(), now, anchor);

  documents = (): Document[] =>
    Object.values(this.store.getState().documents).sort((a, b) => b.updatedAt - a.updatedAt);

  addDocument = (input: NewDocumentInput, now: Timestamp = Date.now()): Document => {
    const document = createDocument(input, now);
    this.store.insert("documents", document);
    return document;
  };

  activeGoals = (): Goal[] => activeGoalsFor(this.store.getState());

  // ========== Goals Dashboard ==========

  goalsDashboard = (
    options: { tab?: GoalTab; category?: GoalCategory | "all"; timeframe?: GoalTimeframe } = {},
    now: Timestamp = Date.now(),
  ): GoalsDashboard => buildGoalsDashboard(this.store.getState(), now, options);

  goalHealthFor = (id: ID, now: Timestamp = Date.now()): GoalHealth | null => {
    const goal = this.store.getState().goals[id];
    if (!goal) return null;
    return goalHealth(goal, goalProgressAt(this.store.getState(), goal, now), now);
  };

  upcomingGoalMilestones = (limit = 5, now: Timestamp = Date.now()): GoalMilestoneRow[] =>
    upcomingGoalMilestonesFor(this.store.getState(), now, limit);

  // ========== Analytics & Insights ==========

  taskDashboard = (
    options: TaskDashboardOptions = {},
    now: Timestamp = Date.now(),
  ): TaskDashboard => buildTaskDashboard(this.store.getState(), now, options);

  analyticsToday = (now: Timestamp = Date.now()): TodaySummary => buildTodaySummary(this.store.getState(), now);

  analyticsReview = (kind: "week" | "month", now: Timestamp = Date.now()): Review =>
    buildReview(this.store.getState(), kind, now);

  analyticsGoals = (now: Timestamp = Date.now()): GoalProgressRow[] =>
    buildGoalAnalytics(this.store.getState(), now);

  analyticsHabits = (now: Timestamp = Date.now(), windowDays = 28): HabitAnalyticsRow[] =>
    buildHabitAnalytics(this.store.getState(), now, windowDays);

  analyticsFocus = (days = 7, now: Timestamp = Date.now()): FocusAnalytics =>
    buildFocusAnalytics(this.store.getState(), now - days * 86_400_000, now, now);

  analyticsOverview = (days = 7, now: Timestamp = Date.now()): AnalyticsOverview =>
    buildAnalyticsOverview(this.store.getState(), now - days * 86_400_000, now, now);

  analyticsOverviewRange = (
    from: Timestamp,
    to: Timestamp,
    now: Timestamp = Date.now(),
  ): AnalyticsOverview => buildAnalyticsOverview(this.store.getState(), from, to, now);

  analyticsMeetings = (
    from: Timestamp,
    to: Timestamp,
    now: Timestamp = Date.now(),
  ): MeetingAnalytics => buildMeetingAnalytics(this.store.getState(), from, to, now);

  areaSummaries = (from: Timestamp, to: Timestamp): InsightAreaSummary[] =>
    buildAreaSummaries(this.store.getState(), from, to);

  dailyProductivity = (
    from: Timestamp,
    to: Timestamp,
  ): DailyProductivity[] => buildDailyProductivity(this.store.getState(), from, to);

  focusByArea = (from: Timestamp, to: Timestamp): InsightAreaFocus[] =>
    buildFocusByArea(this.store.getState(), from, to);

  analyticsInsights = (days = 7, now: Timestamp = Date.now()): AnalyticsInsight[] =>
    generateInsights(this.store.getState(), now - days * 86_400_000, now, now);

  // ========== Collaboration ==========

  activeMode = (): Mode => this.store.getState().settings.activeMode ?? DEFAULT_MODE;

  setActiveMode = (mode: Mode): void => {
    this.store.patchState({ settings: { ...this.store.getState().settings, activeMode: mode } });
  };

  addShare = (
    input: NewShareInput,
    now: Timestamp = Date.now(),
  ): Share => {
    const share = createShare(input, now);
    this.store.insert("shares", share);
    return share;
  };

  deleteShare = (id: ID): void => {
    this.store.remove("shares", id);
  };

  sharesFor = (entityType: Share["entityType"], entityId: ID): Share[] =>
    Object.values(this.store.getState().shares).filter(
      (share) => share.entityType === entityType && share.entityId === entityId,
    );

  updateShareRole = (id: ID, role: ShareRole): Share | null =>
    this.store.update("shares", id, { role });

  addComment = (input: NewCommentInput, now: Timestamp = Date.now()): Comment => {
    const members = selectMembers(this.store.getState());
    const mentions = input.mentions ?? extractMentions(input.body, members);
    const comment = createComment({ ...input, mentions }, now);
    this.store.insert("comments", comment);
    if (mentions.length > 0) {
      for (const memberId of mentions) {
        this.store.insert(
          "notifications",
          createNotification({
            title: `You were mentioned in a comment`,
            kind: "mention",
            body: comment.body.slice(0, 200),
            entityType: "comment",
            entityId: comment.id,
          }, now),
        );
      }
    }
    return comment;
  };

  updateComment = (id: ID, body: string, now: Timestamp = Date.now()): Comment | null => {
    const comment = this.store.getState().comments[id];
    if (!comment) return null;
    return this.store.update("comments", id, editComment(comment, body, now));
  };

  deleteComment = (id: ID): void => {
    for (const reply of Object.values(this.store.getState().comments)) {
      if (reply.parentId === id) this.store.remove("comments", reply.id);
    }
    this.store.remove("comments", id);
  };

  commentsFor = (targetType: Comment["targetType"], targetId: ID): CommentThread[] =>
    commentsFor(this.store.getState(), targetType, targetId);

  members = (teamId?: ID | null): MemberRef[] => selectMembers(this.store.getState(), teamId ?? null);

  addMember = (input: NewMemberInput, now: Timestamp = Date.now()): Member => {
    const member = createMember(input, now);
    this.store.insert("members", member);
    return member;
  };

  updateMember = (id: ID, patch: Partial<Member>): Member | null =>
    this.store.update("members", id, patch);

  deleteMember = (id: ID): void => {
    this.store.remove("members", id);
  };

  addTeam = (input: NewTeamInput, now: Timestamp = Date.now()): Team => {
    const team = createTeam(input, now);
    this.store.insert("teams", team);
    return team;
  };

  teams = (): Team[] => Object.values(this.store.getState().teams);

  assignTask = (taskId: ID, memberId: ID, now: Timestamp = Date.now()): Task | null => {
    const member = this.store.getState().members[memberId];
    if (!member) return null;
    const task = this.store.getState().tasks[taskId];
    if (!task) return null;
    const updated = this.store.update("tasks", taskId, {
      assigneeId: memberId,
      mode: "work",
    });
    this.store.insert(
      "notifications",
      createNotification(
        {
          title: `You were assigned "${task.title}"`,
          kind: "assignment",
          entityType: "task",
          entityId: taskId,
        },
        now,
      ),
    );
    return updated;
  };

  collectionTasksFor = (memberId: ID | null): SharedTaskRow[] =>
    selectTasksFor(this.store.getState(), memberId, { mode: DEFAULT_MODE });

  sharedTasks = (mode: Mode = DEFAULT_MODE): SharedTaskRow[] =>
    selectTasksFor(this.store.getState(), null, { mode });

  sharedProjects = (mode: Mode = DEFAULT_MODE): SharedProjectRow[] =>
    selectSharedProjects(this.store.getState(), mode);

  sharedCalendar = (from: Timestamp, to: Timestamp, mode: Mode = DEFAULT_MODE): SharedCalendarRow[] =>
    selectSharedCalendar(this.store.getState(), from, to, mode);

  exportIcs = (from: Timestamp, to: Timestamp, mode: Mode = DEFAULT_MODE): string =>
    buildIcsExport(this.store.getState(), from, to, mode);

  teamRoster = (): TeamRosterRow[] => buildTeamRoster(this.store.getState());

  checkAccess = (
    entityType: "task" | "project" | "note" | "event",
    entityId: ID,
    memberId: ID | null,
    required: ShareRole = "viewer",
  ): AccessCheck => accessCheck(this.store.getState(), entityType, entityId, memberId, required);

  // ========== Work Mode ==========

  addShift = (input: NewShiftInput, now: Timestamp = Date.now()): Shift => {
    const shift = createShift(input, now);
    this.store.insert("shifts", shift);
    return shift;
  };

  updateShift = (id: ID, patch: Partial<Shift>): Shift | null =>
    this.store.update("shifts", id, patch);

  deleteShift = (id: ID): void => {
    this.store.remove("shifts", id);
  };

  shifts = (memberId?: ID | null): Shift[] =>
    Object.values(this.store.getState().shifts)
      .filter((shift) => memberId == null || shift.memberId === memberId)
      .sort((a, b) => a.startsAt - b.startsAt);

  checkShift = (memberId: ID, startsAt: Timestamp, endsAt: Timestamp, excludeShiftId?: ID | null) =>
    validateShift(this.store.getState(), memberId, startsAt, endsAt, excludeShiftId ?? null);

  requestShiftSwap = (input: NewShiftSwapInput, now: Timestamp = Date.now()): ShiftValidation => {
    const verdict = validateShiftSwap(
      this.store.getState(),
      input.shiftId,
      input.requesterId,
      input.targetMemberId ?? null,
    );
    if (!verdict.ok) return verdict;
    this.store.insert("shiftSwaps", createShiftSwap(input, now));
    return { ok: true, reason: "" };
  };

  respondShiftSwap = (id: ID, accept: boolean, note = "", now: Timestamp = Date.now()): ShiftSwap | null => {
    const swap = this.store.getState().shiftSwaps[id];
    if (!swap || swap.status !== "pending") return null;
    if (accept) {
      const shift = this.store.getState().shifts[swap.shiftId];
      const targetId = swap.targetMemberId;
      if (shift && targetId) {
        this.store.update("shifts", shift.id, {
          memberId: targetId,
          status: "swapped",
        });
      }
      return this.store.update("shiftSwaps", id, {
        status: "accepted",
        respondedAt: now,
        responseNote: note,
      });
    }
    return this.store.update("shiftSwaps", id, {
      status: "rejected",
      respondedAt: now,
      responseNote: note,
    });
  };

  shiftSwaps = (memberId?: ID | null): ShiftSwap[] =>
    Object.values(this.store.getState().shiftSwaps)
      .filter((swap) => memberId == null || swap.requesterId === memberId || swap.targetMemberId === memberId)
      .sort((a, b) => b.createdAt - a.createdAt);

  requestShiftPickup = (input: NewShiftPickupInput, now: Timestamp = Date.now()): ShiftValidation => {
    const verdict = validateShiftPickup(this.store.getState(), input.shiftId, input.memberId);
    if (!verdict.ok) return verdict;
    this.store.insert("shiftPickups", createShiftPickup(input, now));
    return { ok: true, reason: "" };
  };

  respondShiftPickup = (id: ID, accept: boolean, now: Timestamp = Date.now()): ShiftPickup | null => {
    const pickup = this.store.getState().shiftPickups[id];
    if (!pickup || pickup.status !== "pending") return null;
    if (accept) {
      this.store.update("shifts", pickup.shiftId, { memberId: pickup.memberId, status: "scheduled" });
      return this.store.update("shiftPickups", id, { status: "approved", respondedAt: now });
    }
    return this.store.update("shiftPickups", id, { status: "rejected", respondedAt: now });
  };

  releaseShift = (shiftId: ID, now: Timestamp = Date.now()): Shift | null => {
    const shift = this.store.getState().shifts[shiftId];
    if (!shift) return null;
    return this.store.update("shifts", shiftId, { status: "cancelled", updatedAt: now });
  };

  openShifts = (now: Timestamp = Date.now()): OpenShiftRow[] => selectOpenShifts(this.store.getState(), now);

  weekCoverage = (now: Timestamp = Date.now()): WeekCoverageRow[] =>
    buildWeekCoverage(this.store.getState(), now);

  requestTimeOff = (input: NewTimeOffInput, now: Timestamp = Date.now()): ShiftValidation => {
    const verdict = validateTimeOff(
      this.store.getState(),
      input.memberId,
      input.startsAt,
      input.endsAt,
      input.requestedHours,
    );
    if (!verdict.ok) return verdict;
    this.store.insert("timeOffRequests", createTimeOffRequest(input, now));
    return { ok: true, reason: "" };
  };

  decideTimeOff = (
    id: ID,
    approve: boolean,
    approverId: ID,
    note = "",
    now: Timestamp = Date.now(),
  ): TimeOffRequest | null => {
    const request = this.store.getState().timeOffRequests[id];
    if (!request || request.status !== "pending") return null;
    return this.store.update("timeOffRequests", id, {
      status: approve ? "approved" : "rejected",
      approverId,
      decidedAt: now,
      decisionNote: note,
    });
  };

  timeOffRequests = (memberId?: ID | null): TimeOffRequest[] =>
    Object.values(this.store.getState().timeOffRequests)
      .filter((request) => memberId == null || request.memberId === memberId)
      .sort((a, b) => b.createdAt - a.createdAt);

  timeOffBalances = (year = new Date().getFullYear()): TimeOffBalanceRow[] =>
    buildTimeOffBalances(this.store.getState(), year);

  employeeSchedule = (memberId: ID, now: Timestamp = Date.now()): EmployeeScheduleRow | null =>
    buildEmployeeSchedule(this.store.getState(), memberId, now);

  // ========== Mobile ==========

  mobilePreferences = (): MobilePreferences => this.store.getState().settings.mobile;

  patchMobile = (mobile: MobilePreferences): void => {
    const current = this.store.getState().settings;
    this.store.patchState({ settings: { ...current, mobile } });
  };

  updateMobilePreferences = (patch: Partial<MobilePreferences>): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile = normalizeMobilePreferences({ ...current.mobile, ...patch });
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setOneHandedMode = (enabled: boolean, handedness?: "left" | "right"): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = {
      ...current.mobile,
      oneHanded: enabled,
      handedness: handedness ?? current.mobile.handedness,
    };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setHaptics = (enabled: boolean, intensity?: "light" | "medium" | "strong"): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = {
      ...current.mobile,
      hapticsEnabled: enabled,
      hapticIntensity: intensity ?? current.mobile.hapticIntensity,
    };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setSwipeConfig = (patch: Partial<SwipeConfig>): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = {
      ...current.mobile,
      swipe: { ...current.mobile.swipe, ...patch },
    };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setSwipeActions = (patch: {
    entity?: "task" | "journal_entry";
    right?: SwipeActionId;
    left?: SwipeActionId;
  }): MobilePreferences => {
    const current = this.store.getState().settings;
    const entity = patch.entity ?? "task";
    const mobile: MobilePreferences =
      entity === "task"
        ? {
            ...current.mobile,
            swipeRightTask: patch.right ?? current.mobile.swipeRightTask,
            swipeLeftTask: patch.left ?? current.mobile.swipeLeftTask,
          }
        : {
            ...current.mobile,
            swipeRightJournal: patch.right ?? current.mobile.swipeRightJournal,
            swipeLeftJournal: patch.left ?? current.mobile.swipeLeftJournal,
          };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setQuickActions = (actions: QuickActionId[]): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = { ...current.mobile, quickActions: actions };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setMobileWidgets = (widgets: MobileWidgetId[]): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = { ...current.mobile, widgets, widgetOrder: widgets };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  setNotificationPreferences = (patch: Partial<NotificationPreferences>): MobilePreferences => {
    const current = this.store.getState().settings;
    const mobile: MobilePreferences = {
      ...current.mobile,
      notifications: { ...current.mobile.notifications, ...patch },
    };
    this.store.patchState({ settings: { ...current, mobile } });
    return mobile;
  };

  notifications = (includeDismissed = false): Notification[] =>
    Object.values(this.store.getState().notifications)
      .filter((notification) => includeDismissed || notification.status !== "dismissed")
      .sort((a, b) => (b.fireAt ?? b.createdAt) - (a.fireAt ?? a.createdAt));

  unreadNotifications = (): Notification[] =>
    this.notifications().filter(
      (notification) => notification.readAt == null && notification.status !== "read",
    );

  unreadNotificationCount = (): number => this.unreadNotifications().length;

  markNotificationRead = (id: ID, now: Timestamp = Date.now()): Notification | null => {
    const notification = this.store.getState().notifications[id];
    if (!notification || notification.status === "dismissed") return null;
    return this.store.update("notifications", id, { readAt: now, status: "read" });
  };

  markAllNotificationsRead = (now: Timestamp = Date.now()): number => {
    const unread = this.unreadNotifications();
    for (const notification of unread) {
      this.store.update("notifications", notification.id, { readAt: now, status: "read" });
    }
    return unread.length;
  };

  dismissNotification = (id: ID, now: Timestamp = Date.now()): Notification | null => {
    const notification = this.store.getState().notifications[id];
    if (!notification) return null;
    return this.store.update("notifications", id, {
      status: "dismissed",
      dismissedAt: now,
      readAt: notification.readAt ?? now,
    });
  };

  dismissScheduledReminder = (reminder: ScheduledReminder, now: Timestamp = Date.now()): void => {
    if (this.store.getState().reminders[reminder.id]) {
      this.fireReminder(reminder.id);
      return;
    }
    const existing = Object.values(this.store.getState().notifications).find(
      (notification) =>
        notification.kind === "reminder" &&
        notification.entityId === reminder.id &&
        sameLocalDay(notification.createdAt, now),
    );
    if (existing) {
      if (existing.status !== "dismissed") {
        this.store.update("notifications", existing.id, {
          status: "dismissed",
          dismissedAt: now,
          readAt: existing.readAt ?? now,
        });
      }
      return;
    }
    const notification = createNotification(
      {
        title: reminder.title,
        body: reminder.body,
        kind: "reminder",
        entityId: reminder.id,
        fireAt: reminder.dueAt,
        priority: 2,
      },
      now,
    );
    this.store.insert("notifications", notification);
    this.store.update("notifications", notification.id, {
      status: "dismissed",
      dismissedAt: now,
      readAt: now,
    });
  };

  dismissDueReminders = (now: Timestamp = Date.now()): number => {
    const due = this.dueReminders(now).filter((entry) => entry.allowed);
    for (const entry of due) this.dismissScheduledReminder(entry.reminder, now);
    return due.length;
  };

  dueReminders = (now: Timestamp = Date.now()) =>
    evaluateDueReminders(this.store.getState(), this.store.getState().settings.mobile.notifications, now);

  nextReminderAt = (now: Timestamp = Date.now()): Timestamp | null =>
    nextReminderAtFor(this.store.getState(), this.store.getState().settings.mobile.notifications, now);

  journalStreakDays = (now: Timestamp = Date.now()): number =>
    journalStreakDaysFor(this.store.getState(), now);

  // ========== Journal ==========

  addJournalEntry = (input: NewJournalEntryInput, now: Timestamp = Date.now()): JournalEntry => {
    const entry = journalEntryForCreation(this.store.getState(), input, now);
    const existing = this.store.getState().journalEntries[entry.id];
    if (existing) {
      this.store.update("journalEntries", entry.id, entry);
    } else {
      this.store.insert("journalEntries", entry);
    }
    return entry;
  };

  updateJournalEntry = (id: ID, patch: Partial<JournalEntry>, now: Timestamp = Date.now()): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[id];
    if (!entry) return null;
    return this.store.update("journalEntries", id, journalPatchForUpdate(entry, patch, now));
  };

  getJournalEntry = (id: ID): JournalEntry | null => this.store.getState().journalEntries[id] ?? null;

  journalEntryFor = (at: Timestamp): JournalEntry | null =>
    journalEntryForDate(this.store.getState(), at);

  journalEntryForDateKey = (dateKey: string): JournalEntry | null =>
    journalEntryForDateKey(this.store.getState(), dateKey);

  journalEntries = (options: JournalListOptions = {}): JournalEntry[] => {
    const entries = activeJournalEntries(this.store.getState());
    const filtered = entries.filter((entry) => {
      if (options.from != null && entry.entryDate < options.from) return false;
      if (options.to != null && entry.entryDate > options.to) return false;
      return true;
    });
    const offset = options.offset ?? 0;
    const limit = options.limit ?? filtered.length;
    return filtered.slice(offset, offset + limit);
  };

  journalEntryCount = (): number => activeJournalEntries(this.store.getState()).length;

  openJournalFor = (at: Timestamp, now: Timestamp = Date.now()): JournalEntry => {
    const existing = journalEntryForDate(this.store.getState(), at);
    if (existing) return existing;
    return this.addJournalEntry({ entryDate: at }, now);
  };

  saveJournalEntry = (entry: JournalEntry): JournalEntry => {
    const stored = this.store.getState().journalEntries[entry.id];
    if (stored) return this.store.update("journalEntries", entry.id, entry) ?? entry;
    this.store.insert("journalEntries", entry);
    return entry;
  };

  deleteJournalEntry = (id: ID, now: Timestamp = Date.now()): void => {
    const entry = this.store.getState().journalEntries[id];
    if (!entry) return;
    if (entry.status === "trashed") {
      for (const attachment of Object.values(this.store.getState().attachments)) {
        if (attachment.ownerType === "journal_entry" && attachment.ownerId === id) {
          this.store.remove("attachments", attachment.id);
        }
      }
      this.store.remove("journalEntries", id);
      return;
    }
    this.store.update("journalEntries", id, journalTrash(entry, now));
  };

  emptyJournalTrash = (now: Timestamp = Date.now()): number => {
    const trashed = journalRecoverable(this.store.getState());
    for (const entry of trashed) this.deleteJournalEntry(entry.id, now);
    return trashed.length;
  };

  restoreJournalEntry = (id: ID, now: Timestamp = Date.now()): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[id];
    if (!entry) return null;
    return this.store.update("journalEntries", id, journalRestore(entry, now));
  };

  archiveJournalEntry = (id: ID, now: Timestamp = Date.now()): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[id];
    if (!entry) return null;
    return this.store.update("journalEntries", id, journalArchive(entry, now));
  };

  unarchiveJournalEntry = (id: ID, now: Timestamp = Date.now()): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[id];
    if (!entry) return null;
    return this.store.update("journalEntries", id, journalUnarchive(entry, now));
  };

  journalRecoverable = (): JournalEntry[] => journalRecoverable(this.store.getState());

  // ========== Templates ==========

  templates = (): Template[] =>
    Object.values(this.store.getState().templates).sort((a, b) => {
      if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  templateById = (id: ID): Template | null => this.store.getState().templates[id] ?? null;

  addTemplate = (input: NewTemplateInput, now: Timestamp = Date.now()): Template => {
    const template = createTemplate(input, now);
    this.store.insert("templates", template);
    return template;
  };

  updateTemplate = (id: ID, patch: Partial<Template>): Template | null =>
    this.store.update("templates", id, patch);

  deleteTemplate = (id: ID): void => {
    this.store.remove("templates", id);
  };

  toggleTemplateFavorite = (id: ID, now: Timestamp = Date.now()): Template | null => {
    const template = this.store.getState().templates[id];
    if (!template) return null;
    return this.store.update("templates", id, { favorite: !template.favorite, updatedAt: now });
  };

  duplicateTemplate = (id: ID, now: Timestamp = Date.now()): Template | null => {
    const template = this.store.getState().templates[id];
    if (!template) return null;
    const copy = createTemplate(
      {
        name: `${template.name} copy`,
        target: template.target,
        title: template.title,
        body: template.body,
        description: template.description,
        category: template.category,
        templateKind: template.templateKind,
        icon: template.icon,
        items: template.items.map((item) => ({ ...item })),
        tags: template.tags,
        builtin: false,
        source: "custom",
        createdFromId: template.id,
      },
      now,
    );
    this.store.insert("templates", copy);
    return copy;
  };

  useTemplate = (id: ID, now: Timestamp = Date.now()): TemplateUseResult => {
    const template = this.store.getState().templates[id];
    if (!template) {
      return { ok: false, message: "That template no longer exists.", created: [] };
    }
    if (planTemplatePayload(template)) {
      return { ok: false, message: "Open the Planner to apply plan templates.", created: [] };
    }
    const created: TemplateUseCreated[] = [];
    const groups = new Map<string, ID>();

    for (const item of template.items) {
      if (item.kind === "project") {
        const project = this.addProject({ name: item.title, summary: item.detail }, now);
        if (item.group) groups.set(item.group, project.id);
        created.push({ kind: "project", id: project.id, title: project.name });
        continue;
      }
      if (item.kind === "goal") {
        const goal = this.addGoal({ title: item.title, description: item.detail }, now);
        if (item.group) groups.set(item.group, goal.id);
        created.push({ kind: "goal", id: goal.id, title: goal.title });
        continue;
      }
      if (item.kind === "task") {
        const projectId = item.group ? (groups.get(item.group) ?? null) : null;
        const task = this.addTask(
          {
            title: item.title,
            notes: item.detail,
            tags: item.tags,
            priority: item.priority,
            projectId,
          },
          now,
        );
        created.push({ kind: "task", id: task.id, title: task.title });
        continue;
      }
      if (item.kind === "habit") {
        const habit = this.addHabit(
          {
            title: item.title,
            description: item.detail,
            cadence: item.cadence ?? "daily",
            daysOfWeek: [],
            daysOfMonth: [],
          },
          now,
        );
        created.push({ kind: "habit", id: habit.id, title: habit.title });
        continue;
      }
      if (item.kind === "note") {
        const body = item.sections.map((section) => `## ${section}`).join("\n\n");
        const note = this.addNote({ title: item.title, body, tags: [template.category] }, now);
        created.push({ kind: "note", id: note.id, title: note.title });
        continue;
      }
      const routine = this.addRoutine(
        { title: item.title, description: item.detail, steps: [], cadence: item.cadence ?? "weekly" },
        now,
      );
      created.push({ kind: "routine", id: routine.id, title: routine.title });
    }

    this.store.update("templates", id, {
      useCount: template.useCount + 1,
      lastUsedAt: now,
      popularity: template.popularity + 1,
      updatedAt: now,
    });

    return {
      ok: true,
      message: `Created ${created.length} item${created.length === 1 ? "" : "s"} from ${template.name}`,
      created,
    };
  };

  savePlanTemplate = (
    input: { name: string; from: Timestamp; to: Timestamp },
    now: Timestamp = Date.now(),
  ): Template => {
    const state = this.store.getState();
    const from = startOfDay(input.from);
    const to = startOfDay(input.to);
    const dayCount = Math.max(1, Math.floor((to - from) / DAY_MS) + 1);
    const blocks: PlanTemplateBlock[] = [];
    for (const block of Object.values(state.timeBlocks)) {
      if (block.startsAt >= input.to || block.endsAt <= input.from) continue;
      const blockDay = startOfDay(block.startsAt);
      const dayOffset = Math.floor((blockDay - from) / DAY_MS);
      if (dayOffset < 0 || dayOffset >= dayCount) continue;
      blocks.push({
        dayOffset,
        startMin: Math.round((block.startsAt - blockDay) / MINUTE_MS),
        durationMin: Math.max(15, Math.round((block.endsAt - block.startsAt) / MINUTE_MS)),
        title: block.title,
        kind: block.kind,
        taskId: block.taskId != null && state.tasks[block.taskId] ? block.taskId : null,
      });
    }
    blocks.sort((a, b) => a.dayOffset - b.dayOffset || a.startMin - b.startMin);
    const name = input.name.trim() || "Untitled plan";
    const payload: PlanTemplatePayload = { kind: "plan_template", dayCount, blocks };
    const template = createTemplate(
      {
        name,
        target: "task",
        title: name,
        description: `${blocks.length} block${blocks.length === 1 ? "" : "s"} across ${dayCount} day${dayCount === 1 ? "" : "s"}`,
        category: "planning",
        templateKind: "plan",
        icon: "calendar",
        tags: ["planning", "plan-template"],
        builtin: false,
        source: "custom",
        payload: payload as unknown as Record<string, unknown>,
        items: [],
      },
      now,
    );
    this.store.insert("templates", template);
    return template;
  };

  applyPlanTemplate = (
    id: ID,
    from: Timestamp,
    now: Timestamp = Date.now(),
  ): PlanTemplateApplyResult => {
    const template = this.store.getState().templates[id];
    if (!template) {
      return { ok: false, message: "That template no longer exists.", createdBlockIds: [], skipped: 0 };
    }
    const payload = planTemplatePayload(template);
    if (!payload || payload.blocks.length === 0) {
      return { ok: false, message: "That template has no plan blocks.", createdBlockIds: [], skipped: 0 };
    }
    const base = startOfDay(from);
    const createdBlockIds: ID[] = [];
    let skipped = 0;
    for (const entry of payload.blocks) {
      const startsAt = base + entry.dayOffset * DAY_MS + entry.startMin * MINUTE_MS;
      const endsAt = startsAt + entry.durationMin * MINUTE_MS;
      const state = this.store.getState();
      if (startsAt <= now || !isTimeAvailableExcluding(state, startsAt, endsAt, null)) {
        skipped += 1;
        continue;
      }
      const block = this.addTimeBlock(
        {
          title: entry.title,
          startsAt,
          endsAt,
          kind: entry.kind,
          taskId: entry.taskId != null && state.tasks[entry.taskId] ? entry.taskId : null,
          source: "manual",
        },
        now,
      );
      createdBlockIds.push(block.id);
      if (block.taskId != null) this.updateTask(block.taskId, { scheduledAt: startsAt });
    }
    this.store.update("templates", id, {
      useCount: template.useCount + 1,
      lastUsedAt: now,
      popularity: template.popularity + 1,
      updatedAt: now,
    });
    const skippedText = skipped > 0 ? `, skipped ${skipped}` : "";
    return {
      ok: createdBlockIds.length > 0,
      message:
        createdBlockIds.length > 0
          ? `Added ${createdBlockIds.length} block${createdBlockIds.length === 1 ? "" : "s"}${skippedText}`
          : "No blocks could be placed — that time is already booked.",
      createdBlockIds,
      skipped,
    };
  };

  templateLibrary = (options: TemplateLibraryOptions = {}): TemplateLibraryEntry[] =>
    templateLibrary(this.store.getState(), options);

  templateCounts = (): Record<TemplateCategory, number> =>
    templateCountsByCategory(this.store.getState());

  recentlyUsedTemplates = (now: Timestamp = Date.now(), limit = 4): Template[] =>
    recentlyUsedTemplates(this.store.getState(), now, limit);

  featuredTemplates = (): Template[] => featuredTemplates(this.store.getState());

  popularTemplates = (limit = 6): Template[] => popularTemplates(this.store.getState(), limit);

  seedTemplateCatalog = (now: Timestamp = Date.now()): Template[] => {
    const existing = this.store.getState().templates;
    const created: Template[] = [];
    for (const seed of BUILTIN_TEMPLATES) {
      const id = `template_${seed.key}`;
      if (existing[id]) continue;
      const template = createBuiltinTemplate(seed, now, id);
      this.store.insert("templates", template);
      created.push(template);
    }
    return created;
  };

  createTemplateFromPrompt = (prompt: string, now: Timestamp = Date.now()): Template | null => {
    const trimmed = prompt.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    const category: TemplateCategory = lower.includes("money") || lower.includes("budget") || lower.includes("expense")
      ? "finance"
      : lower.includes("health") || lower.includes("fit") || lower.includes("workout") || lower.includes("meal")
        ? "health"
        : lower.includes("learn") || lower.includes("study") || lower.includes("read")
          ? "learning"
          : lower.includes("project") || lower.includes("sprint")
            ? "projects"
            : lower.includes("goal") || lower.includes("plan") || lower.includes("week") || lower.includes("day")
              ? "planning"
              : lower.includes("personal") || lower.includes("travel") || lower.includes("journal")
                ? "personal"
                : lower.includes("work") || lower.includes("meeting") || lower.includes("report")
                  ? "work"
                  : "productivity";
    const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
    const subject = title.charAt(0).toUpperCase() + title.slice(1);
    const template = createTemplate(
      {
        name: subject,
        target: "task",
        title: subject,
        body: `Generated from: ${trimmed}`,
        description: `A ${category} template generated from your prompt.`,
        category,
        templateKind: "planner",
        icon: "sparkles",
        builtin: false,
        source: "ai",
        tags: [category, "ai"],
        items: [
          { kind: "task", title: `Define what "${subject}" means`, detail: "Write the outcome in one sentence.", cadence: null, tags: [category], priority: 4, sections: [], group: "scope" },
          { kind: "task", title: "Break it into the first three steps", detail: "", cadence: null, tags: [category], priority: 3, sections: [], group: "scope" },
          { kind: "habit", title: `Keep ${subject.toLowerCase()} alive`, detail: "Small and repeatable.", cadence: "daily", tags: [category], priority: 2, sections: [], group: "" },
          { kind: "note", title: subject, detail: "", cadence: null, tags: [category], priority: 2, sections: ["What matters", "Next steps", "Notes"], group: "" },
        ],
      },
      now,
    );
    this.store.insert("templates", template);
    return template;
  };

  importTemplate = (raw: string, now: Timestamp = Date.now()): { ok: boolean; message: string; template: Template | null } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, message: "That file is not valid JSON.", template: null };
    }
    const payload = parsed as {
      name?: string;
      title?: string;
      description?: string;
      category?: string;
      templateKind?: string;
      icon?: string;
      items?: unknown[];
    };
    const name = (payload.name ?? payload.title ?? "").trim();
    if (!name) {
      return { ok: false, message: "That file has no template name.", template: null };
    }
    const category = (payload.category ?? "productivity") as TemplateCategory;
    const templateKind = (payload.templateKind ?? "planner") as TemplateKind;
    const items = Array.isArray(payload.items)
      ? payload.items
          .filter((item): item is { kind: string; title: string } => {
            const entry = item as { kind?: unknown; title?: unknown };
            return (
              typeof entry === "object" &&
              entry !== null &&
              typeof entry.kind === "string" &&
              typeof entry.title === "string"
            );
          })
          .map((item) => {
            const entry = item as Record<string, unknown>;
            const cadence =
              entry.cadence === "daily" ||
              entry.cadence === "weekly" ||
              entry.cadence === "monthly"
                ? entry.cadence
                : null;
            return createTemplateItem({
              kind: entry.kind as TemplateItemKind,
              title: String(entry.title),
              detail: typeof entry.detail === "string" ? entry.detail : undefined,
              cadence,
              tags: Array.isArray(entry.tags)
                ? entry.tags.filter((tag): tag is string => typeof tag === "string")
                : undefined,
              priority:
                typeof entry.priority === "number"
                  ? (Math.max(0, Math.min(4, Math.round(entry.priority))) as 0 | 1 | 2 | 3 | 4)
                  : undefined,
              sections: Array.isArray(entry.sections)
                ? entry.sections.filter(
                    (section): section is string => typeof section === "string",
                  )
                : undefined,
              group: typeof entry.group === "string" ? entry.group : undefined,
            });
          })
      : [];
    const template = createTemplate(
      {
        name,
        target: "task",
        title: name,
        body: payload.description ?? "",
        description: payload.description ?? "Imported template.",
        category,
        templateKind,
        icon: payload.icon ?? "download",
        builtin: false,
        source: "imported",
        tags: [category, templateKind],
        items,
      },
      now,
    );
    this.store.insert("templates", template);
    return { ok: true, message: `Imported "${name}"`, template };
  };

  // ========== Journal: templates ==========

  addJournalTemplate = (input: NewJournalTemplateInput, now: Timestamp = Date.now()): JournalTemplate => {
    const template = createJournalTemplate(input, now);
    this.seedJournalTemplates(now);
    this.store.insert("journalTemplates", template);
    return template;
  };

  updateJournalTemplate = (id: ID, patch: Partial<JournalTemplate>): JournalTemplate | null =>
    this.store.update("journalTemplates", id, patch);

  deleteJournalTemplate = (id: ID): void => {
    this.store.remove("journalTemplates", id);
  };

  journalTemplates = (): JournalTemplate[] =>
    Object.values(this.store.getState().journalTemplates).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "builtin" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  seedJournalTemplates = (now: Timestamp = Date.now()): JournalTemplate[] => {
    const existing = this.store.getState().journalTemplates;
    const created: JournalTemplate[] = [];
    for (const template of BUILTIN_JOURNAL_TEMPLATES) {
      if (Object.values(existing).some((entry) => entry.id === template.id)) continue;
      const record = createJournalTemplate(
        {
          name: template.name,
          description: template.description,
          sections: template.sections,
          kind: "builtin",
        },
        now,
      );
      this.store.insert("journalTemplates", { ...record, id: template.id });
      created.push(record);
    }
    return created;
  };

  // ========== Journal: links ==========

  linkJournalToTask = (entryId: ID, taskId: ID): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalAttachTask(entry, taskId));
  };

  linkJournalToGoal = (entryId: ID, goalId: ID): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalAttachGoal(entry, goalId));
  };

  linkJournalToHabit = (entryId: ID, habitId: ID): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalAttachHabit(entry, habitId));
  };

  linkJournalToEvent = (entryId: ID, eventId: ID): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalAttachEvent(entry, eventId));
  };

  linkJournalToLifeMemory = (entryId: ID, lifeMemoryId: ID): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalAttachLifeMemory(entry, lifeMemoryId));
  };

  unlinkJournalEntity = (
    entryId: ID,
    kind: "task" | "goal" | "habit" | "event" | "life_memory",
    id: ID,
  ): JournalEntry | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    return this.store.update("journalEntries", entryId, journalDetach(entry, kind, id));
  };

  createTaskFromJournal = (
    entryId: ID,
    candidate: JournalTaskCandidate,
    now: Timestamp = Date.now(),
  ): Task | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    if (journalTaskAlreadyExists(candidate, Object.values(this.store.getState().tasks).map((task) => task.title))) {
      return null;
    }
    const task = this.addTask(
      {
        title: candidate.title,
        notes: `From your journal entry on ${new Date(entry.entryDate).toLocaleDateString()}.`,
        dueAt: candidate.dueAt,
        scheduledAt: candidate.scheduledAt,
        priority: candidate.priority,
        estimateMin: candidate.estimateMin,
        projectId: candidate.projectId,
        goalIds: candidate.goalIds,
        source: "manual",
        status: "inbox",
      },
      now,
    );
    this.store.update("journalEntries", entryId, journalAttachTask(entry, task.id));
    return task;
  };

  createEventFromJournal = (
    entryId: ID,
    candidate: JournalEventCandidate,
    now: Timestamp = Date.now(),
  ): CalendarEvent | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    if (
      journalEventAlreadyExists(
        candidate,
        Object.values(this.store.getState().events).map((event) => ({
          startsAt: event.startsAt,
          title: event.title,
        })),
      )
    ) {
      return null;
    }
    const event = this.addEvent(
      {
        title: candidate.title,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
        location: candidate.location ?? "",
        notes: `From your journal entry on ${new Date(entry.entryDate).toLocaleDateString()}.`,
        source: "integration",
      },
      now,
    );
    this.store.update("journalEntries", entryId, journalAttachEvent(entry, event.id));
    return event;
  };

  createLifeMemoryFromJournalEntry = (
    entryId: ID,
    now: Timestamp = Date.now(),
  ): LifeMemoryItem | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    if (entry.lifeMemoryIds.length > 0) {
      return this.store.getState().lifeMemoryItems[entry.lifeMemoryIds[0]!] ?? null;
    }
    const memory = this.addLifeMemoryItem(journalLifeMemoryInput(entry), now);
    this.store.update("journalEntries", entryId, journalAttachLifeMemory(entry, memory.id));
    return memory;
  };

  confirmJournalHabitCompletion = (
    entryId: ID,
    habitId: ID,
    now: Timestamp = Date.now(),
  ): HabitCheckIn | null => {
    const entry = this.store.getState().journalEntries[entryId];
    if (!entry) return null;
    const alreadyLinked = entry.habitIds.includes(habitId);
    const checkIn = this.completeHabit(habitId, entry.entryDate, now);
    if (!alreadyLinked) {
      this.store.update("journalEntries", entryId, journalAttachHabit(entry, habitId));
    }
    return checkIn;
  };

  journalAttachments = (entryId: ID): Attachment[] =>
    Object.values(this.store.getState().attachments).filter(
      (attachment) => attachment.ownerType === "journal_entry" && attachment.ownerId === entryId,
    );

  // ========== Journal: search and analytics ==========

  searchJournal = (filters: JournalSearchFilters): JournalSearchResult[] =>
    searchJournalEntries(this.store.getState(), filters);

  journalStreak = (now: Timestamp = Date.now()): JournalStreak => computeJournalStreak(this.store.getState(), now);

  journalMoodInsights = (windowDays: 7 | 30 | 90 | 365, now: Timestamp = Date.now()): MoodInsight =>
    buildMoodInsights(Object.values(this.store.getState().journalEntries), windowDays, now);

  journalMoodCalendar = (month: number, year: number): MoodCalendarDay[] =>
    buildMoodCalendar(Object.values(this.store.getState().journalEntries), month, year);

  journalTags = (limit = 20): Array<{ tag: string; count: number }> => journalTagCloud(this.store.getState(), limit);

  journalPeople = (): string[] => journalPeopleNames(this.store.getState());

  journalLocations = (): string[] => journalLocations(this.store.getState());

  journalActivities = (): string[] => journalActivities(this.store.getState());

  journalWeeklyReview = (now: Timestamp = Date.now()): JournalWeeklyReview =>
    buildJournalWeeklyReview(this.store.getState(), now);

  journalMonthlyReview = (now: Timestamp = Date.now()): JournalMonthlyReview =>
    buildJournalMonthlyReview(this.store.getState(), now);

  journalAnswer = (question: string): string => journalAnswerQuestion(this.store.getState(), question);

  journalPrivacy = (entryId: ID, privacy: JournalPrivacy): JournalEntry | null =>
    this.store.update("journalEntries", entryId, { privacy });

  // ========== Integrations ==========

  listProviders = (): ProviderDefinition[] => INTEGRATION_PROVIDERS;

  getProvider = (id: string): ProviderDefinition | null => PROVIDER_BY_ID[id] ?? null;

  integrations = (): Integration[] =>
    Object.values(this.store.getState().integrations).sort((a, b) => b.createdAt - a.createdAt);

  integrationFor = (provider: string): Integration | null =>
    Object.values(this.store.getState().integrations).find(
      (integration) => integration.provider === provider,
    ) ?? null;

  getIntegration = (id: ID): Integration | null => this.store.getState().integrations[id] ?? null;

  connectIntegration = (
    input: {
      provider: string;
      accountLabel?: string;
      credentialRef: string;
      externalAccountId?: string;
      direction?: SyncDirection;
      scopes?: string[];
      settings?: Partial<IntegrationSettings>;
    },
    now: Timestamp = Date.now(),
  ): Integration | null => {
    const definition = PROVIDER_BY_ID[input.provider];
    if (!definition) return null;

    const existing = this.integrationFor(input.provider);
    const integration = createIntegration(
      {
        provider: input.provider,
        kind: definition.kind,
        accountLabel: input.accountLabel ?? definition.label,
        scopes: input.scopes ?? definition.scopes,
        credentialRef: input.credentialRef,
        externalAccountId: input.externalAccountId,
        direction: input.direction ?? "inbound",
        settings: input.settings,
      },
      now,
    );

    const record: Integration = {
      ...integration,
      status: "connected",
      connectedAt: now,
      lastSyncAt: null,
      lastError: null,
      id: existing?.id ?? integration.id,
    };
    this.store.insert("integrations", record);
    return record;
  };

  disconnectIntegration = (id: ID, now: Timestamp = Date.now()): void => {
    const integration = this.store.getState().integrations[id];
    if (!integration) return;
    this.store.update("integrations", id, {
      status: "disconnected",
      credentialRef: null,
      connectedAt: null,
      lastSyncAt: null,
      lastError: `Disconnected by user at ${new Date(now).toISOString()}`,
      lastErrorAt: now,
      updatedAt: now,
    });
  };

  reauthorizeIntegration = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("integrations", id, {
      status: "reauthorizing",
      updatedAt: now,
    });
  };

  updateIntegration = (id: ID, patch: Partial<Integration>): Integration | null =>
    this.store.update("integrations", id, patch);

  updateIntegrationSettings = (id: ID, settings: Partial<IntegrationSettings>): Integration | null => {
    const integration = this.store.getState().integrations[id];
    if (!integration) return null;
    return this.store.update("integrations", id, { settings: { ...integration.settings, ...settings } });
  };

  pauseIntegration = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("integrations", id, { status: "paused", updatedAt: now });
  };

  resumeIntegration = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("integrations", id, { status: "connected", lastError: null, updatedAt: now });
  };

  registerExternalEntity = (integrationId: ID, externalId: ID | string, entityId: ID): void => {
    const integration = this.store.getState().integrations[integrationId];
    if (!integration) return;
    this.store.update("integrations", integrationId, {
      mappings: { ...integration.mappings, [externalId]: entityId },
    });
  };

  externalIdFor = (integrationId: ID, entityId: ID): string | null => {
    const integration = this.store.getState().integrations[integrationId];
    if (!integration) return null;
    for (const [externalId, mapped] of Object.entries(integration.mappings)) {
      if (mapped === entityId) return externalId;
    }
    return null;
  };

  updateIntegrationSync = (id: ID, at: Timestamp, token: string | null): void => {
    this.store.update("integrations", id, {
      lastSyncAt: at,
      lastError: null,
      lastErrorAt: null,
    });
    void token;
  };

  recordIntegrationError = (id: ID, message: string, now: Timestamp = Date.now()): void => {
    this.store.update("integrations", id, {
      status: "error",
      lastError: message,
      lastErrorAt: now,
      updatedAt: now,
    });
  };

  addSyncConflict = (input: NewSyncConflictRecordInput, now: Timestamp = Date.now()): SyncConflictRecord => {
    const conflict = createSyncConflictRecord(input, now);
    this.store.insert("syncConflicts", conflict);
    return conflict;
  };

  syncConflicts = (integrationId?: ID, status: SyncConflictStatus = "pending"): SyncConflictRecord[] =>
    Object.values(this.store.getState().syncConflicts)
      .filter((conflict) => integrationId == null || conflict.integrationId === integrationId)
      .filter((conflict) => conflict.status === status)
      .sort((a, b) => b.createdAt - a.createdAt);

  resolveSyncConflict = (id: ID, action: ResolutionAction, now: Timestamp = Date.now()): SyncConflictRecord | null => {
    const conflict = this.store.getState().syncConflicts[id];
    if (!conflict) return null;
    return this.store.update("syncConflicts", id, {
      status: "resolved",
      resolution: action,
      resolvedAt: now,
      updatedAt: now,
    });
  };

  syncLogs = (integrationId?: ID, limit = 20): SyncLog[] =>
    Object.values(this.store.getState().syncLogs)
      .filter((log) => integrationId == null || log.integrationId === integrationId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

  addSyncLog = (log: SyncLog): SyncLog => {
    this.store.insert("syncLogs", log);
    return log;
  };

  integrationSummary = (): {
    connected: number;
    errors: number;
    pendingConflicts: number;
    lastSyncAt: Timestamp | null;
    providers: Array<{ id: string; label: string; status: Integration["status"]; lastSyncAt: Timestamp | null; conflictCount: number }>;
  } => {
    const integrations = this.integrations();
    const conflicts = this.syncConflicts();
    const connected = integrations.filter((i) => i.status === "connected").length;
    const errors = integrations.filter((i) => i.status === "error" || i.status === "reauthorizing").length;
    const lastSyncAt = integrations.reduce((max, i) => Math.max(max, i.lastSyncAt ?? 0), 0);

    return {
      connected,
      errors,
      pendingConflicts: conflicts.length,
      lastSyncAt: lastSyncAt === 0 ? null : lastSyncAt,
      providers: INTEGRATION_PROVIDERS.map((provider) => {
        const integration = integrations.find((i) => i.provider === provider.id);
        const conflictCount = integration
          ? conflicts.filter((c) => c.integrationId === integration.id).length
          : 0;
        return {
          id: provider.id,
          label: provider.label,
          status: integration?.status ?? "disconnected",
          lastSyncAt: integration?.lastSyncAt ?? null,
          conflictCount,
        };
      }),
    };
  };

  clearAll = (): void => {
    this.store.replaceAll({ ...createInitialState(), hydrated: true });
    this.store.persistNow();
  };

  paperWorkspace = (
    options: PaperWorkspaceOptions = {},
    now: Timestamp = Date.now(),
  ): PaperWorkspace => buildPaperWorkspace(this.store.getState(), now, options);

  addPaperFolder = (
    input: { name: string; color?: string; icon?: string; order?: number },
    now: Timestamp = Date.now(),
  ): PaperFolder => {
    const folder = createPaperFolder(input, now);
    this.store.insert("paperFolders", folder);
    return folder;
  };

  paperFolders = (): PaperFolder[] =>
    Object.values(this.store.getState().paperFolders).sort((a, b) => a.order - b.order);

  updatePaperFolder = (id: ID, patch: Partial<PaperFolder>): PaperFolder | null =>
    this.store.update("paperFolders", id, patch);

  deletePaperFolder = (id: ID): void => {
    for (const page of Object.values(this.store.getState().paperPages)) {
      if (page.folderId === id) this.store.update("paperPages", page.id, { folderId: null });
    }
    this.store.remove("paperFolders", id);
  };

  setPaperPageFavorite = (id: ID, favorite = true): PaperPage | null => {
    const page = this.store.getState().paperPages[id];
    if (!page) return null;
    return this.store.update("paperPages", id, { favorite, updatedAt: Date.now() });
  };

  setPaperPageShared = (id: ID, shared = true): PaperPage | null => {
    const page = this.store.getState().paperPages[id];
    if (!page) return null;
    return this.store.update("paperPages", id, { shared, updatedAt: Date.now() });
  };

  addPaperNotebook = (input: NewPaperNotebookInput, now: Timestamp = Date.now()): PaperNotebook => {    const notebook = createPaperNotebook(input, now);
    this.store.insert("paperNotebooks", notebook);
    const page = createPaperPage({ notebookId: notebook.id, name: input.firstPageName ?? "Page 1", template: input.template }, now);
    this.store.insert("paperPages", page);
    const layer = createPaperLayer({ notebookId: notebook.id, pageId: page.id, name: "Ink", order: 1 }, now);
    this.store.insert("paperLayers", layer);
    this.store.update("paperNotebooks", notebook.id, { pageIds: [page.id] });
    return this.store.getState().paperNotebooks[notebook.id]!;
  };

  updatePaperNotebook = (id: ID, patch: Partial<PaperNotebook>): PaperNotebook | null =>
    this.store.update("paperNotebooks", id, patch);

  deletePaperNotebook = (id: ID): void => {
    const notebook = this.store.getState().paperNotebooks[id];
    if (!notebook) return;
    for (const pageId of notebook.pageIds) {
      for (const stroke of Object.values(this.store.getState().paperStrokes)) {
        if (stroke.pageId === pageId) this.store.remove("paperStrokes", stroke.id);
      }
      for (const layer of Object.values(this.store.getState().paperLayers)) {
        if (layer.pageId === pageId) this.store.remove("paperLayers", layer.id);
      }
      this.store.remove("paperPages", pageId);
    }
    this.store.remove("paperNotebooks", id);
  };

  getPaperNotebook = (id: ID): PaperNotebook | null => this.store.getState().paperNotebooks[id] ?? null;

  paperNotebooks = (): PaperNotebook[] =>
    Object.values(this.store.getState().paperNotebooks).sort(
      (a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt),
    );

  addPaperPage = (input: NewPaperPageInput, now: Timestamp = Date.now()): PaperPage => {
    const page = createPaperPage(input, now);
    this.store.insert("paperPages", page);
    const layers = Object.values(this.store.getState().paperLayers).filter((entry) => entry.pageId === page.id);
    const layer = createPaperLayer({ notebookId: page.notebookId, pageId: page.id, name: "Ink", order: layers.length + 1 }, now);
    this.store.insert("paperLayers", layer);
    const notebook = this.store.getState().paperNotebooks[page.notebookId];
    if (notebook && !notebook.pageIds.includes(page.id)) {
      this.store.update("paperNotebooks", notebook.id, { pageIds: [...notebook.pageIds, page.id] });
    }
    return page;
  };

  updatePaperPage = (id: ID, patch: Partial<PaperPage>): PaperPage | null => {
    const page = this.store.getState().paperPages[id];
    if (!page) return null;
    const next = { ...patch };
    if (patch.textContent !== undefined) next.wordCount = countPaperWords(patch.textContent);
    return this.store.update("paperPages", id, next);
  };

  deletePaperPage = (id: ID): void => {
    const page = this.store.getState().paperPages[id];
    if (!page) return;
    for (const stroke of Object.values(this.store.getState().paperStrokes)) {
      if (stroke.pageId === id) this.store.remove("paperStrokes", stroke.id);
    }
    for (const layer of Object.values(this.store.getState().paperLayers)) {
      if (layer.pageId === id) this.store.remove("paperLayers", layer.id);
    }
    for (const image of Object.values(this.store.getState().paperImages ?? {})) {
      if (image.pageId === id) this.store.remove("paperImages", image.id);
    }
    for (const sticker of Object.values(this.store.getState().paperStickers ?? {})) {
      if (sticker.pageId === id) this.store.remove("paperStickers", sticker.id);
    }
    for (const diagram of Object.values(this.store.getState().paperDiagrams ?? {})) {
      if (diagram.pageId === id) this.store.remove("paperDiagrams", diagram.id);
    }
    for (const recognition of Object.values(this.store.getState().paperRecognitions ?? {})) {
      if (recognition.pageId === id) this.store.remove("paperRecognitions", recognition.id);
    }
    for (const attachment of Object.values(this.store.getState().attachments)) {
      if ((attachment.ownerType as string) === "paper_image" && attachment.ownerId === id) {
        this.store.remove("attachments", attachment.id);
      }
    }
    const notebook = this.store.getState().paperNotebooks[page.notebookId];
    if (notebook) {
      this.store.update("paperNotebooks", notebook.id, {
        pageIds: notebook.pageIds.filter((pageId) => pageId !== id),
      });
    }
    this.store.remove("paperPages", id);
  };

  getPaperPage = (id: ID): PaperPage | null => this.store.getState().paperPages[id] ?? null;

  paperPages = (notebookId: ID): PaperPage[] =>
    Object.values(this.store.getState().paperPages)
      .filter((page) => page.notebookId === notebookId)
      .sort((a, b) => a.order - b.order);

  paperPageBundle = (pageId: ID, now: Timestamp = Date.now()): PaperPageBundle | null =>
    selectPaperPage(this.store.getState(), pageId, now);

  addPaperLayer = (input: { notebookId: ID; pageId: ID; name?: string }): PaperLayer => {
    const layers = Object.values(this.store.getState().paperLayers).filter(
      (layer) => layer.pageId === input.pageId,
    );
    const layer = createPaperLayer({ ...input, order: layers.length + 1 });
    this.store.insert("paperLayers", layer);
    return layer;
  };

  updatePaperLayer = (id: ID, patch: Partial<PaperLayer>): PaperLayer | null =>
    this.store.update("paperLayers", id, patch);

  deletePaperLayer = (id: ID): void => {
    const strokes = Object.values(this.store.getState().paperStrokes).filter((stroke) => stroke.layerId === id);
    if (strokes.length > 0) {
      const remaining = Object.values(this.store.getState().paperLayers).filter(
        (layer) => layer.pageId === strokes[0]!.pageId && layer.id !== id,
      );
      if (remaining.length === 0) return;
    }
    for (const stroke of strokes) this.store.remove("paperStrokes", stroke.id);
    this.store.remove("paperLayers", id);
  };

  paperLayers = (pageId: ID): PaperLayer[] =>
    Object.values(this.store.getState().paperLayers)
      .filter((layer) => layer.pageId === pageId)
      .sort((a, b) => a.order - b.order);

  addPaperStroke = (input: NewPaperStrokeInput, now: Timestamp = Date.now()): PaperStroke => {
    const stroke = createPaperStroke(input, now);
    this.store.insert("paperStrokes", stroke);
    return stroke;
  };

  addPaperStrokes = (inputs: NewPaperStrokeInput[], now: Timestamp = Date.now()): PaperStroke[] =>
    inputs.map((input) => this.addPaperStroke(input, now));

  updatePaperStroke = (id: ID, patch: Partial<PaperStroke>): PaperStroke | null =>
    this.store.update("paperStrokes", id, patch);

  deletePaperStroke = (id: ID): void => {
    this.store.remove("paperStrokes", id);
  };

  deletePaperStrokes = (ids: ID[]): void => {
    for (const id of ids) this.store.remove("paperStrokes", id);
  };

  erasePaperStrokesAt = (pageId: ID, x: number, y: number, radius = 12): ID[] => {
    const removed: ID[] = [];
    const editable = new Set(
      this.paperLayers(pageId)
        .filter((layer) => layer.visible && !layer.locked)
        .map((layer) => layer.id),
    );

    for (const stroke of Object.values(this.store.getState().paperStrokes)) {
      if (stroke.pageId !== pageId || !editable.has(stroke.layerId)) continue;
      if (hitTestStroke(stroke, x, y, radius)) removed.push(stroke.id);
    }
    for (const id of removed) this.store.remove("paperStrokes", id);
    return removed;
  };

  paperStrokes = (pageId: ID): PaperStroke[] =>
    Object.values(this.store.getState().paperStrokes)
      .filter((stroke) => stroke.pageId === pageId)
      .sort((a, b) => a.createdAt - b.createdAt);

  recognizePaperShapes = (pageId: ID): Array<{ strokeId: ID; shape: PaperShapeKind }> => {
    const strokes = Object.values(this.store.getState().paperStrokes).filter((stroke) => stroke.pageId === pageId);
    return recognizeShapesBatch(strokes, 0.75).map((entry) => ({ strokeId: entry.strokeId, shape: entry.shape }));
  };

  replacePaperStrokeWithShape = (strokeId: ID): PaperStroke | null => {
    const stroke = this.store.getState().paperStrokes[strokeId];
    if (!stroke) return null;
    const result = recognizeShape(stroke.points);
    if (!result.shape || result.confidence < 0.7) return null;
    return this.store.update("paperStrokes", strokeId, {
      recognizedShape: result.shape,
      recognitionConfidence: Math.round(result.confidence * 100) / 100,
      closedPath: result.closed,
    });
  };

  recognizePaperHandwriting = async (pageId: ID): Promise<string> => {
    const strokes = this.paperStrokes(pageId).map((stroke) => ({ id: stroke.id, points: stroke.points }));
    const result = await REGISTRY.handwriting.recognize(strokes);
    for (const line of result.lines) {
      for (const strokeId of line.strokeIds) {
        this.store.update("paperStrokes", strokeId, {
          recognizedText: line.text,
          recognitionConfidence: Math.round(line.confidence * 100) / 100,
        });
      }
    }
    return result.text;
  };

  recognizePaperMath = async (pageId: ID): Promise<string | null> => {
    const strokes = this.paperStrokes(pageId).map((stroke) => ({ id: stroke.id, points: stroke.points }));
    const result = await REGISTRY.math.recognize(strokes);
    return result.latex;
  };

  recognizePaperDiagram = async (pageId: ID, now: Timestamp = Date.now()): Promise<PaperDiagram | null> => {
    const strokes = this.paperStrokes(pageId).map((stroke) => ({ id: stroke.id, points: stroke.points }));
    const result = await REGISTRY.diagram.recognize(strokes);
    if (result.nodes.length === 0) return null;
    const notebookId = this.store.getState().paperPages[pageId]?.notebookId ?? "";
    const diagram: PaperDiagram = {
      type: "paper_diagram",
      id: newId(),
      createdAt: now,
      updatedAt: now,
      notebookId,
      pageId,
      kind: result.kind,
      title: result.kind === "mindmap" ? "Recognised mind map" : "Recognised diagram",
      nodes: result.nodes,
      edges: result.edges,
      recognitionConfidence: Math.round(result.confidence * 100) / 100,
    };
    this.store.insert("paperDiagrams", diagram);
    return diagram;
  };

  addPaperRecognition = (
    input: Omit<PaperRecognition, "type" | "id" | "createdAt" | "updatedAt">,
    now: Timestamp = Date.now(),
  ): PaperRecognition => {
    const record: PaperRecognition = {
      type: "paper_recognition",
      id: newId(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.store.insert("paperRecognitions", record);
    return record;
  };

  acceptPaperRecognition = (id: ID, text: string, now: Timestamp = Date.now()): void => {
    this.store.update("paperRecognitions", id, { status: "accepted", text, updatedAt: now });
  };

  rejectPaperRecognition = (id: ID, now: Timestamp = Date.now()): void => {
    this.store.update("paperRecognitions", id, { status: "rejected", updatedAt: now });
  };

  addPaperImage = (
    input: {
      notebookId: ID;
      pageId: ID;
      layerId: ID;
      url: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    },
    now: Timestamp = Date.now(),
  ): PaperImage => {
    const attachment = createAttachment(
      {
        ownerType: "paper_image" as never,
        ownerId: input.pageId,
        name: input.name,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        source: "upload",
        url: input.url,
      },
      now,
    );
    this.store.insert("attachments", attachment);
    const image: PaperImage = {
      type: "paper_image",
      id: attachment.id,
      createdAt: now,
      updatedAt: now,
      notebookId: input.notebookId,
      pageId: input.pageId,
      layerId: input.layerId,
      url: input.url,
      name: input.name,
      mimeType: input.mimeType,
      x: input.x ?? 40,
      y: input.y ?? 40,
      width: input.width ?? 320,
      height: input.height ?? 240,
      rotation: 0,
    };
    const store = this.store as unknown as { insert: (name: string, entity: unknown) => void };
    store.insert("paperImages", image);
    return image;
  };

  paperImages = (pageId: ID): PaperImage[] => {
    const state = this.store.getState() as unknown as { paperImages?: Record<string, PaperImage> };
    if (state.paperImages) {
      return Object.values(state.paperImages)
        .filter((image) => image.pageId === pageId)
        .sort((a, b) => a.createdAt - b.createdAt);
    }
    return selectPaperPage(this.store.getState(), pageId)?.images ?? [];
  };

  deletePaperImage = (id: ID): void => {
    const store = this.store as unknown as { remove: (name: string, id: string) => void };
    store.remove("paperImages", id);
    this.store.remove("attachments", id);
  };

  addPaperSticker = (
    input: { notebookId: ID; pageId: ID; stickerId: string; x: number; y: number; scale?: number; rotation?: number },
    now: Timestamp = Date.now(),
  ): PaperSticker => {
    const sticker: PaperSticker = {
      type: "paper_sticker",
      id: newId(),
      createdAt: now,
      updatedAt: now,
      notebookId: input.notebookId,
      pageId: input.pageId,
      stickerId: input.stickerId,
      x: input.x,
      y: input.y,
      scale: input.scale ?? 1,
      rotation: input.rotation ?? 0,
    };
    const store = this.store as unknown as { insert: (name: string, entity: unknown) => void };
    store.insert("paperStickers", sticker);
    return sticker;
  };

  deletePaperSticker = (id: ID): void => {
    const store = this.store as unknown as { remove: (name: string, id: string) => void };
    store.remove("paperStickers", id);
  };

  paperStickers = (pageId: ID): PaperSticker[] => {
    const state = this.store.getState() as unknown as { paperStickers?: Record<string, PaperSticker> };
    return state.paperStickers ? Object.values(state.paperStickers).filter((sticker) => sticker.pageId === pageId) : [];
  };

  exportPaperPdf = (input: {
    notebookId: ID;
    pageId: ID;
    width?: number;
    height?: number;
    background?: string;
  }): string => {
    const page = this.store.getState().paperPages[input.pageId];
    if (!page) return "";
    const strokes = this.paperStrokes(input.pageId);
    const notebook = this.store.getState().paperNotebooks[input.notebookId];
    return exportPdf(
      {
        title: notebook ? `${notebook.title} — ${page.name}` : page.name,
        width: input.width ?? DEFAULT_PAGE_W,
        height: input.height ?? DEFAULT_PAGE_H,
        background: input.background ?? page.paperColor,
        guidelineSpacing: templateSpacing(page.template, page.patternScale),
        guidelineColor: "#d8d2c8",
        template: page.template,
      },
      strokes,
    );
  };

  exportPaperSvg = (input: {
    notebookId: ID;
    pageId: ID;
    width?: number;
    height?: number;
    background?: string;
  }): string => {
    const page = this.store.getState().paperPages[input.pageId];
    if (!page) return "";
    return exportSvg(
      {
        width: input.width ?? DEFAULT_PAGE_W,
        height: input.height ?? DEFAULT_PAGE_H,
        background: input.background ?? page.paperColor,
      },
      this.paperStrokes(input.pageId).map((stroke) => ({
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity,
        points: stroke.points,
      })),
    );
  };

  // ========== Focus Engine ==========

  getFocusSession = (id: ID): FocusSession | null =>
    this.store.getState().focusSessions[id] ?? null;

  focusSessions = (includeArchived = false): FocusSession[] =>
    Object.values(this.store.getState().focusSessions)
      .filter((session) => includeArchived || session.status === "running" || session.status === "paused")
      .sort((a, b) => b.startedAt - a.startedAt);

  activeFocusSession = (): FocusSession | null =>
    Object.values(this.store.getState().focusSessions)
      .filter((session) => session.status === "running" || session.status === "paused")
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;

  startFocusSession = (input: NewFocusSessionInput, now: Timestamp = Date.now()): FocusSession => {
    const startedAt = input.startedAt ?? now;
    const plannedMin = input.plannedMin ?? null;
    const roundLengthMs = plannedMin != null && plannedMin > 0 ? Math.round(plannedMin * 60_000) : null;
    const session = createFocusSession(
      {
        ...input,
        startedAt,
        goalId: input.goalId ?? this.goalForTask(input.taskId),
        rounds: [
          {
            index: 1,
            phase: "work" as const,
            startedAt,
            endsAt: roundLengthMs != null ? startedAt + roundLengthMs : null,
            completed: false,
          },
        ],
      },
      now,
    );
    this.store.insert("focusSessions", session);
    if (session.taskId) {
      const task = this.store.getState().tasks[session.taskId];
      if (task && (task.status === "open" || task.status === "inbox")) {
        this.store.update("tasks", task.id, { status: "in_progress", startedAt: now });
      }
    }
    return session;
  };

  pauseFocusSession = (id: ID, now: Timestamp = Date.now()): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session || session.status !== "running") return null;
    return this.store.update("focusSessions", id, {
      status: "paused",
      pausedAt: now,
    });
  };

  resumeFocusSession = (id: ID, now: Timestamp = Date.now()): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session || session.status !== "paused") return null;
    const gap = session.pausedAt != null ? Math.max(0, now - session.pausedAt) : 0;
    return this.store.update("focusSessions", id, {
      status: "running",
      pausedAt: null,
      pausedMs: (session.pausedMs ?? 0) + gap,
    });
  };

  completeFocusSession = (
    id: ID,
    input: { note?: string; rating?: number | null; rounds?: FocusRound[] } = {},
    now: Timestamp = Date.now(),
  ): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session || session.status === "completed" || session.status === "aborted") return null;
    const paused = (session.pausedMs ?? 0) + (session.pausedAt != null ? Math.max(0, now - session.pausedAt) : 0);
    return this.store.update("focusSessions", id, {
      status: "completed",
      completedAt: now,
      endsAt: now,
      pausedMs: paused,
      pausedAt: null,
      activeMs: Math.max(0, now - session.startedAt - paused),
      ...(input.rounds ? { rounds: input.rounds } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      distractions: session.distractions ?? [],
      distractionCount: (session.distractions ?? []).length,
    });
    this.awardXP({
      reason: "focus_session",
      entityType: "focus_session",
      entityId: session.id,
      note: input.note ?? `Focus session · ${Math.round(Math.max(0, now - session.startedAt - paused) / 60000)} min`,
    });
  };

  abortFocusSession = (id: ID, now: Timestamp = Date.now()): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session || session.status === "completed" || session.status === "aborted") return null;
    const paused = (session.pausedMs ?? 0) + (session.pausedAt != null ? Math.max(0, now - session.pausedAt) : 0);
    return this.store.update("focusSessions", id, {
      status: "aborted",
      endsAt: now,
      pausedMs: paused,
      pausedAt: null,
      activeMs: Math.max(0, now - session.startedAt - paused),
    });
  };

  logFocusDistraction = (
    id: ID,
    reason = "",
    now: Timestamp = Date.now(),
  ): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session) return null;
    const distractions = [...(session.distractions ?? []), { at: now, resumedAt: null, durationMs: null, reason }];
    return this.store.update("focusSessions", id, {
      distractions,
      distractionCount: distractions.length,
      interruptions: distractions.length,
    });
  };

  resumeFromFocusDistraction = (id: ID, now: Timestamp = Date.now()): FocusSession | null => {
    const session = this.store.getState().focusSessions[id];
    if (!session) return null;
    const distractions = (session.distractions ?? []).map((distraction, index) =>
      index === session.distractions.length - 1 && distraction.resumedAt == null
        ? { ...distraction, resumedAt: now, durationMs: Math.max(0, now - distraction.at) }
        : distraction,
    );
    return this.store.update("focusSessions", id, { distractions });
  };

  updateFocusSession = (id: ID, patch: Partial<FocusSession>): FocusSession | null =>
    this.store.update("focusSessions", id, patch);

  focusStats = (from: Timestamp, to: Timestamp, now: Timestamp = Date.now()): FocusStats =>
    computeFocusStats(this.store.getState(), from, to, now);

  focusSessionsForTask = (taskId: ID, limit = 20): FocusSessionRow[] =>
    focusSessionsForTaskEngine(this.store.getState(), taskId, limit);

  focusSessionsForGoal = (goalId: ID, limit = 20): FocusSessionRow[] =>
    focusSessionsForGoalEngine(this.store.getState(), goalId, limit);

  focusDeepWorkBlocks = (from: Timestamp, to: Timestamp, minMinutes = 45, now = Date.now()): DeepWorkBlock[] =>
    selectDeepWorkBlocks(this.store.getState(), from, to, minMinutes, now);

  focusHeatmap = (from: Timestamp, to: Timestamp, now = Date.now()): FocusHeatCell[] =>
    focusHeatmap(this.store.getState(), from, to, now);

  focusBestHours = (from: Timestamp, to: Timestamp, now = Date.now()): number[] =>
    bestFocusHours(this.store.getState(), from, to, now);

  focusAmbientBreakdown = (from: Timestamp, to: Timestamp, now = Date.now()) =>
    computeFocusStats(this.store.getState(), from, to, now).byAmbient;

  taskEstimateAccuracy = (taskId: ID): number | null => estimateAccuracyForTask(this.store.getState(), taskId);

  focusSummaryLine = (from: Timestamp, to: Timestamp, now = Date.now()): string =>
    focusSummaryLine(this.store.getState(), from, to, now);

  goalForTask = (taskId: ID | null | undefined): ID | null => {
    if (!taskId) return null;
    const task = this.store.getState().tasks[taskId];
    if (!task || task.goalIds.length === 0) return null;
    return task.goalIds[0];
  };

}
