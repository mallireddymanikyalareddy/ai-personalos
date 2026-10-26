"use client";

import * as React from "react";

import { RefreshCw, Sunrise } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildAIContext, streamAIChat } from "@/lib/ai-stream";
import { getOS } from "@/store/os";

const PROMPT =
  "Write my morning briefing for today in 3-5 short lines: the most important tasks (mention anything overdue or due today), " +
  "habits to keep up, and one goal to move forward. End with one encouraging, practical suggestion. No headings.";

function cacheKey(): string {
  const owner = window.localStorage.getItem("personalos:owner") ?? "local";
  return `personalos:briefing:${owner}:${new Date().toDateString()}`;
}

export function TodayBriefing() {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = React.useState("");

  const generate = React.useCallback(async () => {
    setStatus("loading");
    setError("");
    setText("");
    try {
      const os = getOS();
      const local = os.aiRun("plan my day", { now: Date.now() }).message;
      const full = await streamAIChat({ prompt: PROMPT, context: buildAIContext(os.getState(), local), history: [] }, setText);
      window.localStorage.setItem(cacheKey(), full);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    const cached = window.localStorage.getItem(cacheKey());
    if (cached) {
      setText(cached);
      setStatus("done");
      return;
    }
    void generate();
  }, [generate]);

  return (
    <section
      aria-label="Morning briefing"
      data-testid="today-briefing"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sunrise className="size-4 text-accent" aria-hidden="true" />
          Morning briefing
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3">GPT 6 Luna</span>
        </h2>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Refresh briefing"
          data-testid="today-briefing-refresh"
          disabled={status === "loading"}
          onClick={() => void generate()}
        >
          <RefreshCw className={status === "loading" ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
        </Button>
      </header>
      {status === "error" ? (
        <p data-testid="today-briefing-error" className="text-sm text-ink-3">
          Couldn&apos;t create your briefing: {error}.
        </p>
      ) : (
        <p data-testid="today-briefing-text" className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {text || (status === "loading" ? "Preparing your briefing…" : "")}
        </p>
      )}
    </section>
  );
}
