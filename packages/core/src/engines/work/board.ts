import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task, TaskStatus } from "../../types/task";

export type BoardColumnId = "todo" | "in_progress" | "review" | "done";

export type BoardColumnTone = "muted" | "info" | "warning" | "success";

export interface BoardColumn {
  id: BoardColumnId;
  label: string;
  status: TaskStatus;
  tone: BoardColumnTone;
}

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  { id: "todo", label: "To Do", status: "open", tone: "muted" },
  { id: "in_progress", label: "In Progress", status: "in_progress", tone: "info" },
  { id: "review", label: "Review", status: "review", tone: "warning" },
  { id: "done", label: "Done", status: "done", tone: "success" },
];

const COLUMN_BY_ID = BOARD_COLUMNS.reduce(
  (map, column) => {
    map[column.id] = column;
    return map;
  },
  {} as Record<BoardColumnId, BoardColumn>,
);

export type ProjectBoard = Record<BoardColumnId, Task[]>;

export function isBoardColumnId(value: string): value is BoardColumnId {
  return value in COLUMN_BY_ID;
}

export function boardColumn(id: BoardColumnId): BoardColumn {
  return COLUMN_BY_ID[id];
}

export function columnForStatus(status: TaskStatus): BoardColumnId | null {
  const match = BOARD_COLUMNS.find((column) => column.status === status);
  return match ? match.id : null;
}

export function statusForColumn(id: BoardColumnId): TaskStatus {
  return COLUMN_BY_ID[id].status;
}

export function emptyBoard(): ProjectBoard {
  return { todo: [], in_progress: [], review: [], done: [] };
}

export function isOnBoard(status: TaskStatus): boolean {
  return columnForStatus(status) !== null;
}

function byRank(task: Task): number {
  if (task.status === "done") return -(task.completedAt ?? task.updatedAt);
  const due = task.dueAt ?? Number.POSITIVE_INFINITY;
  if (due !== Number.POSITIVE_INFINITY) return due;
  return Number.MAX_SAFE_INTEGER - task.priority * 1_000_000_000;
}

export function projectTasks(state: AppState, projectId: ID): Task[] {
  return Object.values(state.tasks)
    .filter((task) => task.projectId === projectId && isOnBoard(task.status))
    .sort((a, b) => byRank(a) - byRank(b));
}

export function boardForProject(state: AppState, projectId: ID): ProjectBoard {
  const board = emptyBoard();
  for (const task of projectTasks(state, projectId)) {
    const column = columnForStatus(task.status);
    if (column) board[column].push(task);
  }
  return board;
}

export function tasksInColumn(state: AppState, projectId: ID, column: BoardColumnId): Task[] {
  return boardForProject(state, projectId)[column];
}

export function columnCounts(board: ProjectBoard): Record<BoardColumnId, number> {
  return {
    todo: board.todo.length,
    in_progress: board.in_progress.length,
    review: board.review.length,
    done: board.done.length,
  };
}

export function boardTotal(board: ProjectBoard): number {
  const counts = columnCounts(board);
  return BOARD_COLUMNS.reduce((total, column) => total + counts[column.id], 0);
}

export function boardCompletion(board: ProjectBoard): number {
  const total = boardTotal(board);
  if (total === 0) return 0;
  return Math.round((board.done.length / total) * 100);
}

export function boardBreakdown(state: AppState, projectId: ID): Record<BoardColumnId, number> {
  return columnCounts(boardForProject(state, projectId));
}

export function moveTaskToColumn(
  task: Task,
  column: BoardColumnId,
  order: number,
  now: Timestamp = Date.now(),
): Task {
  const status = statusForColumn(column);
  if (task.status === status) return { ...task, order };

  const base: Task = {
    ...task,
    status,
    order,
    updatedAt: now,
    completedAt: status === "done" ? (task.completedAt ?? now) : null,
    startedAt:
      status === "done"
        ? task.startedAt
        : status === "in_progress"
          ? (task.startedAt ?? now)
          : task.startedAt,
  };

  return base;
}

export function nextTaskOrder(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.max(...tasks.map((task) => task.order)) + 1;
}

export function nextMove(
  task: Task,
  direction: "left" | "right",
): BoardColumnId | null {
  const current = columnForStatus(task.status);
  if (current === null) return null;
  const index = BOARD_COLUMNS.findIndex((column) => column.id === current);
  const target = direction === "left" ? index - 1 : index + 1;
  if (target < 0 || target >= BOARD_COLUMNS.length) return null;
  return BOARD_COLUMNS[target]!.id;
}