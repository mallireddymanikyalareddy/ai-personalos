"use client";

import * as React from "react";

import {
  AlertTriangle,
  CalendarDays,
  Heart,
  Lightbulb,
  Plus,
  Star,
  TrendingUp,
  X,
} from "lucide-react";

import type { JournalEntry } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";

type ListTarget = "highlights" | "challenges" | "gratitude";

export interface JournalReflectionGridProps {
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
}

export function JournalReflectionGrid({ entry, onChange }: JournalReflectionGridProps) {
  return (
    <div
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      data-testid="journal-reflection-grid"
    >
      <ListCard
        icon={Star}
        iconClass="text-warning"
        title="Today's highlights"
        target="highlights"
        entry={entry}
        onChange={onChange}
        placeholder="A win worth remembering"
        checkbox
      />
      <ListCard
        icon={AlertTriangle}
        iconClass="text-danger"
        title="Challenges"
        target="challenges"
        entry={entry}
        onChange={onChange}
        placeholder="Something that got in the way"
      />
      <ListCard
        icon={Heart}
        iconClass="text-accent"
        title="Gratitude"
        target="gratitude"
        entry={entry}
        onChange={onChange}
        placeholder="Who or what helped"
        max={5}
      />
      <TextCard
        icon={Lightbulb}
        iconClass="text-warning"
        title="What did I learn today?"
        value={entry.lessons}
        onChange={(lessons) => onChange({ lessons })}
        placeholder="Anything worth remembering"
      />
      <TextCard
        icon={TrendingUp}
        iconClass="text-danger"
        title="What could I have done better?"
        value={entry.improvements}
        onChange={(improvements) => onChange({ improvements })}
        placeholder="A note to your future self"
      />
      <TomorrowCard entry={entry} onChange={onChange} />
    </div>
  );
}

function CardShell({
  icon: Icon,
  iconClass,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-line bg-surface p-3">
      <header className="mb-2 flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", iconClass)} aria-hidden="true" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function ListCard({
  icon,
  iconClass,
  title,
  target,
  entry,
  onChange,
  placeholder,
  max,
  checkbox,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  target: ListTarget;
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
  placeholder: string;
  max?: number;
  checkbox?: boolean;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState("");
  const items = entry[target];
  const atLimit = max != null && items.length >= max;

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (max != null && items.length >= max) {
      toast(`You can record up to ${max} ${title.toLowerCase()} items`);
      return;
    }
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast("That is already recorded");
      return;
    }
    onChange({ [target]: [...items, value] });
    setDraft("");
  };

  return (
    <CardShell
      icon={icon}
      iconClass={iconClass}
      title={title}
      action={
        <span className="text-xs text-ink-3">
          {max != null ? `${items.length}/${max}` : items.length > 0 ? items.length : null}
        </span>
      }
    >
      {items.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-sm text-ink-2">
              {checkbox ? (
                <input
                  type="checkbox"
                  checked
                  readOnly
                  aria-label={`Recorded: ${item}`}
                  className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
                />
              ) : (
                <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3" />
              )}
              <span className="min-w-0 flex-1">{item}</span>
              <button
                type="button"
                onClick={() => onChange({ [target]: items.filter((value2) => value2 !== item) })}
                aria-label={`Remove ${item}`}
                className="shrink-0 text-ink-3 hover:text-danger"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
placeholder={placeholder}
          aria-label={`New ${title}`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button
          size="icon-sm"
          variant="secondary"
          aria-label={`Add to ${title}`}
          disabled={atLimit}
          onClick={add}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </CardShell>
  );
}

function TextCard({
  icon,
  iconClass,
  title,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = `journal-card-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <CardShell icon={icon} iconClass={iconClass} title={title}>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        aria-label={title}
        className="mt-auto w-full resize-y rounded-lg border border-line bg-surface-2 p-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </CardShell>
  );
}

function TomorrowCard({
  entry,
  onChange,
}: {
  entry: JournalEntry;
  onChange: (patch: Partial<JournalEntry>) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const priorities = entry.tomorrow.priorities;

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange({ tomorrow: { ...entry.tomorrow, priorities: [...priorities, value] } });
    setDraft("");
  };

  return (
    <CardShell
      icon={CalendarDays}
      iconClass="text-info"
      title="Tomorrow"
      action={<span className="text-xs text-ink-3">{priorities.length}</span>}
    >
      {priorities.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {priorities.map((priority) => (
            <li key={priority} className="flex items-start gap-1.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked
                readOnly
                aria-label={`Planned: ${priority}`}
                className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1">{priority}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    tomorrow: {
                      ...entry.tomorrow,
                      priorities: priorities.filter((value) => value !== priority),
                    },
                  })
                }
                aria-label={`Remove ${priority}`}
                className="shrink-0 text-ink-3 hover:text-danger"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
placeholder="Top priority for tomorrow"
          aria-label="New Tomorrow priority"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button size="icon-sm" variant="secondary" aria-label="Add to Tomorrow" onClick={add}>
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </CardShell>
  );
}
