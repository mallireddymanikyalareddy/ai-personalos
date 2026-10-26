"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import type { Timestamp } from "@personalos/core";

import { useOS } from "@/store/use-os";

export interface AddTaskRowProps {
  placeholder?: string;
  defaultDueAt?: Timestamp | null;
  onAdded?: () => void;
}

export function AddTaskRow({ placeholder, defaultDueAt, onAdded }: AddTaskRowProps) {
  const os = useOS();
  const { toast } = useToast();
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    const result = os.capture(text);
    if (result.kind === "empty") return;

    if (result.task && defaultDueAt != null && result.task.dueAt == null && !result.task.scheduledAt) {
      os.updateTask(result.task.id, { dueAt: defaultDueAt });
    }

    setValue("");
    onAdded?.();
    inputRef.current?.focus();

    if (result.kind === "note") {
      toast("Saved as a note", { tone: "success" });
    } else if (defaultDueAt != null && result.task?.dueAt != null) {
      toast("Added to today", { tone: "success" });
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-center gap-2.5 rounded-xl border border-transparent bg-surface-2 px-3.5 py-2.5 transition-colors focus-within:border-accent/40 focus-within:bg-surface"
    >
      <Plus className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? "Add a task — try \"friday at 5pm #home !!\""}
        aria-label="Add a task"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
      />
      {value.trim() && (
        <button
          type="submit"
          className="shrink-0 text-xs font-medium text-accent-ink hover:underline"
        >
          Add
        </button>
      )}
    </form>
  );
}
