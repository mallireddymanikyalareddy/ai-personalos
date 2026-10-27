"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";

import { ModelLabel } from "@/components/ai/model-label";
import { Button } from "@/components/ui/button";
import { buildAIContext, streamAIChat, type AIAction } from "@/lib/ai-stream";
import { getOS } from "@/store/os";
import { useAppState } from "@/store/use-os";

export interface AIRecapCardProps {
  id: string;
  title: string;
  icon: LucideIcon;
  prompt: string;
  localFallback: () => string;
  autoRun: boolean;
  idleHint: string;
  action: AIAction;
}

function cacheKey(id: string): string {
  const owner = window.localStorage.getItem("personalos:owner") ?? "local";
  return `personalos:${id}:${owner}:${new Date().toDateString()}`;
}

// One GPT run per card per day at a time, even if the card re-renders or remounts mid-request.
const inFlight = new Map<string, Promise<string>>();

export function AIRecapCard({ id, title, icon: Icon, prompt, localFallback, autoRun, idleHint, action }: AIRecapCardProps) {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = React.useState("");
  const provider = useAppState().settings.aiProvider ?? "local";

  const generate = React.useCallback(async () => {
    setStatus("loading");
    setError("");
    setText("");
    const os = getOS();
    const local = localFallback();
    if ((os.getState().settings.aiProvider ?? "local") !== "openai") {
      setText(local);
      setStatus("done");
      return;
    }
    try {
      const key = cacheKey(id);
      let run = inFlight.get(key);
      if (!run) {
        run = streamAIChat({ prompt, context: buildAIContext(os.getState(), local), history: [], action }, setText);
        inFlight.set(key, run);
        void run.catch(() => undefined).finally(() => inFlight.delete(key));
      }
      const full = await run;
      setText(full);
      window.localStorage.setItem(cacheKey(id), full);
      window.sessionStorage.removeItem(`${cacheKey(id)}:error`);
      setStatus("done");
    } catch (err) {
      const message = (err as Error).message;
      const transient = err instanceof TypeError || (err as Error).name === "AbortError" || /network/i.test(message);
      if (!transient) window.sessionStorage.setItem(`${cacheKey(id)}:error`, message);
      setError(message);
      setStatus("error");
    }
  }, [id, prompt, localFallback, action]);

  React.useEffect(() => {
    const usingGpt = provider === "openai";
    const cached = usingGpt ? window.localStorage.getItem(cacheKey(id)) : null;
    const failed = usingGpt ? window.sessionStorage.getItem(`${cacheKey(id)}:error`) : null;
    if (cached) {
      setText(cached);
      setStatus("done");
    } else if (failed) {
      setError(failed);
      setStatus("error");
    } else if (autoRun) {
      void generate();
    } else {
      setText("");
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, id, autoRun]);

  return (
    <section aria-label={title} data-testid={id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className="size-4 text-accent" aria-hidden="true" />
          {title}
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
            <ModelLabel />
          </span>
        </h2>
        <Button
          variant="secondary"
          size={status === "idle" ? "sm" : "icon"}
          aria-label={status === "idle" ? `Create ${title.toLowerCase()}` : `Refresh ${title.toLowerCase()}`}
          data-testid={`${id}-refresh`}
          disabled={status === "loading"}
          onClick={() => void generate()}
        >
          <RefreshCw className={status === "loading" ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {status === "idle" ? "Create" : null}
        </Button>
      </header>
      {status === "error" ? (
        <p data-testid={`${id}-error`} className="text-sm text-ink-3">
          Couldn&apos;t create this: {error}.
        </p>
      ) : (
        <p data-testid={`${id}-text`} className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {text || (status === "loading" ? "Thinking…" : idleHint)}
        </p>
      )}
    </section>
  );
}
