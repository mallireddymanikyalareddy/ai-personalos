import type { AppState } from "@personalos/core";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export function buildAIContext(state: AppState, localAnswer: string): string {
  const live = <T,>(rows: Record<string, T>): T[] => Object.values(rows);
  const tasks = live(state.tasks)
    .filter((task) => !["done", "cancelled", "archived"].includes(task.status))
    .slice(0, 40)
    .map((task) => `- ${task.title} [${task.priority}${task.dueAt ? `, due ${new Date(task.dueAt).toDateString()}` : ""}]`);
  const goals = live(state.goals).filter((g) => g.status === "active").slice(0, 15).map((g) => `- ${g.title}`);
  const habits = live(state.habits).slice(0, 15).map((h) => `- ${h.title}`);
  const notes = live(state.notes).filter((n) => n.status === "active").slice(0, 15).map((n) => `- ${n.title}`);
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const doneToday = live(state.tasks)
    .filter((task) => task.status === "done" && (task.completedAt ?? 0) >= dayStart)
    .map((task) => `- ${task.title}`);
  const journalToday = live(state.journalEntries)
    .filter((entry) => entry.updatedAt >= dayStart)
    .map((entry) => `- ${entry.title || "Entry"}${entry.mood ? ` (mood: ${entry.mood})` : ""}: ${entry.body.slice(0, 400)}`);
  return [
    `Today: ${new Date().toDateString()}`,
    `Open tasks:\n${tasks.join("\n") || "none"}`,
    `Active goals:\n${goals.join("\n") || "none"}`,
    `Habits:\n${habits.join("\n") || "none"}`,
    `Notes:\n${notes.join("\n") || "none"}`,
    `Completed today:\n${doneToday.join("\n") || "none"}`,
    `Journal today:\n${journalToday.join("\n") || "none"}`,
    `Built-in assistant analysis:\n${localAnswer}`,
  ].join("\n\n");
}

export async function streamAIChat(
  body: { prompt: string; context: string; history: ChatTurn[] },
  onDelta: (text: string) => void,
): Promise<string> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "AI request failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.replace(/^data: /, "");
      if (!line) continue;
      const payload = JSON.parse(line) as { delta?: string; error?: string };
      if (payload.error) throw new Error(payload.error);
      if (payload.delta) {
        full += payload.delta;
        onDelta(full);
      }
    }
  }
  return full;
}
