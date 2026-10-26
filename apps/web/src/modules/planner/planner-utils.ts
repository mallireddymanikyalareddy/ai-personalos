import type { PersonalOS, PlanCandidate, PlanSlotKind, TimeBlockKind, Timestamp } from "@personalos/core";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const HOUR_PX = 46;

export const DRAG_TASK = "application/x-personalos-task";
export const DRAG_BLOCK = "application/x-personalos-block";

export interface TaskDragData {
  taskId: string | null;
  title: string;
  estimateMin: number;
  kind: TimeBlockKind;
}

export interface BlockDragData {
  blockId: string;
}

export interface PlacedItem<T> {
  id: string;
  item: T;
  top: number;
  height: number;
  left: number;
  width: number;
}

export type DropResult = { ok: true; message: string } | { ok: false; message: string };

export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

export function dayWindow(
  dayStart: Timestamp,
  dayStartMin: number,
  dayEndMin: number,
): { from: Timestamp; to: Timestamp } {
  return {
    from: dayStart + dayStartMin * MINUTE_MS,
    to: dayStart + dayEndMin * MINUTE_MS,
  };
}

export function windowRows(fromMin: number, toMin: number): number[] {
  const end = Math.max(fromMin, toMin);
  const hours: number[] = [];
  for (let hour = Math.floor(fromMin / 60); hour < Math.ceil(end / 60); hour++) hours.push(hour);
  return hours;
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function layoutItems<T extends { id: string; startsAt: Timestamp; endsAt: Timestamp }>(
  items: T[],
  from: Timestamp,
  to: Timestamp,
): PlacedItem<T>[] {
  const timed = items
    .filter((item) => item.endsAt > item.startsAt)
    .map((item) => ({
      item,
      start: clamp(item.startsAt, from, to),
      end: clamp(item.endsAt, from, to),
    }))
    .filter((entry) => entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed: PlacedItem<T>[] = [];
  let index = 0;

  while (index < timed.length) {
    const cluster: typeof timed = [timed[index]!];
    let maxEnd = timed[index]!.end;
    let cursor = index + 1;
    while (cursor < timed.length && timed[cursor]!.start < maxEnd) {
      cluster.push(timed[cursor]!);
      maxEnd = Math.max(maxEnd, timed[cursor]!.end);
      cursor += 1;
    }

    const columnEnds: number[] = [];
    const rows = cluster.map((entry) => {
      let column = columnEnds.findIndex((end) => end <= entry.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(entry.end);
      } else {
        columnEnds[column] = entry.end;
      }
      return { entry, column };
    });

    const totalColumns = columnEnds.length;
    for (const { entry, column } of rows) {
      const top = ((entry.start - from) / HOUR_MS) * HOUR_PX;
      const rawHeight = ((entry.end - entry.start) / HOUR_MS) * HOUR_PX - 3;
      placed.push({
        id: entry.item.id,
        item: entry.item,
        top,
        height: Math.max(rawHeight, 18),
        left: (column * 100) / totalColumns,
        width: 100 / totalColumns,
      });
    }

    index = cursor;
  }

  return placed;
}

const SLOT_CHIPS: Record<PlanSlotKind, string> = {
  task: "border-accent/40 bg-accent-soft text-accent-ink",
  routine: "border-chart-2/40 bg-chart-2/15 text-chart-2",
  habit: "border-chart-7/40 bg-chart-7/15 text-chart-7",
  buffer: "border-line bg-surface-2 text-ink-3",
  personal: "border-chart-4/40 bg-chart-4/15 text-chart-4",
};

export const PLAN_KIND_LABELS: Record<PlanSlotKind, string> = {
  task: "Focus",
  routine: "Routine",
  habit: "Habit",
  buffer: "Buffer",
  personal: "Personal",
};

export function slotChip(kind: PlanSlotKind): string {
  return SLOT_CHIPS[kind];
}

export const BLOCK_KIND_LABELS: Record<TimeBlockKind, string> = {
  focus: "Focus",
  meeting: "Meeting",
  routine: "Routine",
  buffer: "Buffer",
  personal: "Personal",
};

const PLAN_DOTS: Record<PlanSlotKind, string> = {
  task: "bg-accent",
  routine: "bg-chart-2",
  habit: "bg-chart-7",
  buffer: "bg-ink-3/40",
  personal: "bg-chart-4",
};

export function planDot(kind: PlanSlotKind): string {
  return PLAN_DOTS[kind];
}

export function blockKindToPlanKind(kind: TimeBlockKind): PlanSlotKind {
  switch (kind) {
    case "focus":
      return "task";
    case "meeting":
      return "task";
    case "routine":
      return "routine";
    case "buffer":
      return "buffer";
    case "personal":
      return "personal";
    default:
      return "task";
  }
}

export function taskKindFor(candidate: PlanCandidate): TimeBlockKind {
  if (candidate.task.routineId != null) return "routine";
  if (candidate.task.habitId != null) return "routine";
  return "focus";
}

export function taskDragPayload(candidate: PlanCandidate): TaskDragData {
  return {
    taskId: candidate.task.id,
    title: candidate.task.title,
    estimateMin: candidate.estimateMin,
    kind: taskKindFor(candidate),
  };
}

export function readDragTask(event: React.DragEvent): TaskDragData | null {
  const raw = event.dataTransfer?.getData(DRAG_TASK);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TaskDragData;
  } catch {
    return null;
  }
}

export function readDragBlock(event: React.DragEvent): BlockDragData | null {
  const raw = event.dataTransfer?.getData(DRAG_BLOCK);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BlockDragData;
  } catch {
    return null;
  }
}

export function hasPlannerDrag(event: React.DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes(DRAG_TASK) || types.includes(DRAG_BLOCK);
}

function overlapsAnything(
  os: PersonalOS,
  from: Timestamp,
  to: Timestamp,
  excludeId: string | null,
): boolean {
  const state = os.getState();
  for (const event of Object.values(state.events)) {
    if (event.startsAt < to && event.endsAt > from) return true;
  }
  for (const block of Object.values(state.timeBlocks)) {
    if (block.id === excludeId) continue;
    if (block.startsAt < to && block.endsAt > from) return true;
  }
  return false;
}

export function placeDroppedTask(os: PersonalOS, data: TaskDragData, startsAt: Timestamp): DropResult {
  const durationMs = Math.max(15, data.estimateMin) * MINUTE_MS;
  const endsAt = startsAt + durationMs;
  if (startsAt <= Date.now()) return { ok: false, message: "That time is already in the past" };
  if (overlapsAnything(os, startsAt, endsAt, null))
    return { ok: false, message: "That time is already booked" };
  os.addTimeBlock({
    title: data.title,
    startsAt,
    endsAt,
    kind: data.kind,
    taskId: data.taskId ?? null,
    source: "manual",
  });
  if (data.taskId) os.updateTask(data.taskId, { scheduledAt: startsAt });
  return { ok: true, message: `Planned "${data.title}"` };
}

export function moveDroppedBlock(os: PersonalOS, blockId: string, startsAt: Timestamp): DropResult {
  const block = os.getState().timeBlocks[blockId];
  if (!block) return { ok: false, message: "This block no longer exists" };
  const endsAt = startsAt + (block.endsAt - block.startsAt);
  if (startsAt <= Date.now()) return { ok: false, message: "That time is already in the past" };
  if (overlapsAnything(os, startsAt, endsAt, block.id))
    return { ok: false, message: "That time is already booked" };
  os.updateTimeBlock(blockId, { startsAt, endsAt });
  if (block.taskId) os.updateTask(block.taskId, { scheduledAt: startsAt });
  return { ok: true, message: `Moved "${block.title}"` };
}
export function resizeTimeBlock(
  os: PersonalOS,
  blockId: string,
  startsAt: Timestamp,
  endsAt: Timestamp,
): DropResult {
  const block = os.getState().timeBlocks[blockId];
  if (!block) return { ok: false, message: "This block no longer exists" };
  if (endsAt - startsAt < 15 * MINUTE_MS) {
    return { ok: false, message: "Blocks must be at least 15 minutes long" };
  }
  if (overlapsAnything(os, startsAt, endsAt, block.id)) {
    return { ok: false, message: "That would overlap another item" };
  }
  os.updateTimeBlock(blockId, { startsAt, endsAt });
  if (block.taskId) os.updateTask(block.taskId, { scheduledAt: startsAt });
  return { ok: true, message: `Resized "${block.title}"` };
}