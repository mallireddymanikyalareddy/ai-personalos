"use client";

import * as React from "react";

import { Archive, Brain, Camera, Clock, Download, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";

import {
  formatFullDate,
  LIFE_MEMORY_CATEGORY_LABELS,
  LIFE_MEMORY_CATEGORIES,
  type LifeMemoryCategory,
  type LifeMemoryItem,
  type LifeMemoryStats,
  type ID,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { MemoryTimelineWorkspace } from "./memory-timeline-workspace";
import { seedSampleMemory } from "./sample-memory";
import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";
import { downloadText } from "@/modules/notebook/notebook-export";

type Tab = "all" | "due" | "overdue" | "never" | "archived" | "trash";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due soon" },
  { value: "overdue", label: "Overdue" },
  { value: "never", label: "Never recorded" },
  { value: "archived", label: "Archived" },
  { value: "trash", label: "Trash" },
];

const URGENCY_TONE: Record<LifeMemoryStats["urgency"], "success" | "accent" | "warning" | "neutral"> = {
  ok: "success",
  soon: "accent",
  due: "warning",
  overdue: "warning",
  never: "neutral",
};

const URGENCY_LABEL: Record<LifeMemoryStats["urgency"], string> = {
  ok: "On track",
  soon: "Coming up",
  due: "Due",
  overdue: "Overdue",
  never: "No forecast",
};

function relativeDays(days: number | null): string {
  if (days == null) return "never recorded";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function countdown(days: number | null): string {
  if (days == null) return "no forecast yet";
  if (days === 0) return "expected today";
  if (days > 0) return `expected in ${days} days`;
  return `${Math.abs(days)} days past expected`;
}

function ItemDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: LifeMemoryItem | null;
}) {
  const os = useOS();
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<LifeMemoryCategory>("other");
  const [targetDays, setTargetDays] = React.useState("");
  const [thresholdDays, setThresholdDays] = React.useState("14");

  React.useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setCategory(editing?.category ?? "other");
    setTargetDays(editing?.targetIntervalDays != null ? String(editing.targetIntervalDays) : "");
    setThresholdDays(String(editing?.thresholdDays ?? 14));
  }, [open, editing]);

  const parsedTarget = targetDays.trim() === "" ? null : Number(targetDays);
  const validTarget = parsedTarget == null || (Number.isFinite(parsedTarget) && parsedTarget > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit memory" : "New life memory"}
      description="Something you want to remember historically, not just schedule."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim() || !validTarget}
            onClick={() => {
              const input = {
                title: title.trim(),
                description: description.trim(),
                category,
                targetIntervalDays: parsedTarget,
                thresholdDays: Math.max(1, Number(thresholdDays) || 14),
              };
              if (editing) os.updateLifeMemoryItem(editing.id, input);
              else os.addLifeMemoryItem(input);
              toast(editing ? "Memory updated" : "Memory added");
              onClose();
            }}
          >
            {editing ? "Save changes" : "Add memory"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="lm-title">What do you want to remember?</FieldLabel>
          <Input
            id="lm-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Service car, clean water tank, fertilize plants…"
            autoFocus
          />
        </div>
        <div>
          <FieldLabel htmlFor="lm-desc">Description</FieldLabel>
          <Textarea
            id="lm-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional details — what counts as a completion?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="lm-category">Category</FieldLabel>
            <Select
              id="lm-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as LifeMemoryCategory)}
            >
              {LIFE_MEMORY_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {LIFE_MEMORY_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="lm-target">Expected interval (days)</FieldLabel>
            <Input
              id="lm-target"
              type="number"
              min={1}
              value={targetDays}
              onChange={(event) => setTargetDays(event.target.value)}
              placeholder="auto from history"
            />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="lm-threshold">Warn me this many days past expected</FieldLabel>
          <Input
            id="lm-threshold"
            type="number"
            min={1}
            value={thresholdDays}
            onChange={(event) => setThresholdDays(event.target.value)}
          />
        </div>
        {!validTarget && <p className="text-xs text-danger">Enter a whole number of days, or leave it blank.</p>}
      </div>
    </Modal>
  );
}

function CompletionDialog({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: LifeMemoryItem | null;
}) {
  const os = useOS();
  const { toast } = useToast();
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [photo, setPhoto] = React.useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  } | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setNote("");
    setPhoto(null);
    setPhotoError(null);
  }, [open, item]);

  if (!item) return null;

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      setPhotoError("That image is over 1.5 MB — pick a smaller one.");
      return;
    }
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto({
        name: file.name,
        mimeType: file.type || "image/*",
        sizeBytes: file.size,
        dataUrl: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  const [year, month, day] = date.split("-").map(Number);
  const completedAt = year && month && day ? new Date(year, month - 1, day, 12, 0, 0, 0).getTime() : Date.now();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record completion`}
      description={item.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              let attachmentIds: ID[] = [];
              if (photo) {
                const attachment = os.addAttachment({
                  ownerType: "life_memory_item",
                  ownerId: item.id,
                  name: photo.name,
                  mimeType: photo.mimeType,
                  sizeBytes: photo.sizeBytes,
                  source: "upload",
                  url: photo.dataUrl,
                });
                attachmentIds = [attachment.id];
              }
              os.recordLifeMemoryCompletion(item.id, {
                completedAt,
                note: note.trim(),
                attachmentIds,
              });
              toast("Completion recorded");
              onClose();
            }}
          >
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="lm-date">Completed on</FieldLabel>
          <Input id="lm-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="lm-note">Note</FieldLabel>
          <Textarea
            id="lm-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you do, and anything worth remembering?"
          />
        </div>
        <div>
          <FieldLabel htmlFor="lm-photo">Photo</FieldLabel>
          <label
            htmlFor="lm-photo"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-6 text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.dataUrl} alt="" className="max-h-32 rounded-lg" />
            ) : (
              <>
                <Camera className="size-4" aria-hidden="true" />
                Add a photo
              </>
            )}
          </label>
          <input
            id="lm-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onPhoto(event.target.files?.[0])}
          />
          {photoError && <p className="mt-1 text-xs text-danger">{photoError}</p>}
        </div>
      </div>
    </Modal>
  );
}

function DetailDialog({
  itemId,
  onClose,
  onEdit,
}: {
  itemId: ID | null;
  onClose: () => void;
  onEdit: (item: LifeMemoryItem) => void;
}) {
  const os = useOS();
  const { toast } = useToast();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState<ID | null>(null);
  const item = itemId ? (os.getLifeMemoryItem(itemId) ?? null) : null;

  React.useEffect(() => {
    setConfirmingDelete(false);
    setConfirmRemove(null);
  }, [itemId]);

  if (!item) return null;

  const stats = os.lifeMemoryStats(item.id)!;
  const history = os.lifeMemoryHistory(item.id, "desc");
  const ordered = os.lifeMemoryHistory(item.id, "asc");

  return (
    <Modal
      open={item != null}
      onClose={onClose}
      size="lg"
      title={item.title}
      description={item.description || LIFE_MEMORY_CATEGORY_LABELS[item.category]}
      footer={
        <>
          {item.status === "active" ? (
            <Button
              variant="ghost"
              onClick={() => {
                os.archiveLifeMemoryItem(item.id);
                toast("Memory archived");
                onClose();
              }}
            >
              <Archive className="size-3.5" />
              Archive
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                os.restoreLifeMemoryItem(item.id);
                toast("Memory restored");
                onClose();
              }}
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
          )}
          <Button variant="ghost" onClick={() => onEdit(item)}>
            Edit
          </Button>
          {item.status === "active" ? (
            <Button
              variant="secondary"
              onClick={() => {
                os.recordLifeMemoryCompletion(item.id, { completedAt: Date.now(), note: "" });
                toast("Completion recorded");
              }}
            >
              Record completion
            </Button>
          ) : null}
          <Button
            variant="danger"
            data-testid="memory-delete"
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              os.deleteLifeMemoryItem(item.id);
              toast(item.status === "trashed" ? "Memory deleted forever" : "Memory moved to trash");
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            {item.status === "trashed"
              ? confirmingDelete
                ? "Confirm delete forever"
                : "Delete forever"
              : confirmingDelete
                ? "Confirm delete"
                : "Delete"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Last completed" value={relativeDays(stats.daysSinceCompletion)} />
          <Stat label="Expected" value={countdown(stats.daysUntilExpected)} />
          <Stat
            label="Interval"
            value={
              stats.effectiveIntervalDays != null
                ? `${Math.round(stats.effectiveIntervalDays)} d`
                : "unknown"
            }
          />
          <Stat label="Confidence" value={`${Math.round(stats.confidence * 100)}%`} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={URGENCY_TONE[stats.urgency]}>{URGENCY_LABEL[stats.urgency]}</Badge>
          <Badge tone="neutral">{LIFE_MEMORY_CATEGORY_LABELS[item.category]}</Badge>
          {item.status !== "active" ? <Badge tone="outline">{item.status}</Badge> : null}
          <Badge tone="outline">
            {stats.intervalSource === "target"
              ? "target interval"
              : stats.intervalSource === "observed"
                ? "learned from history"
                : "no forecast yet"}
          </Badge>
          {item.targetIntervalDays != null && stats.intervalSource === "target" && (
            <Badge tone="outline">history says {Math.round(stats.intervals.observedIntervalDays ?? 0)} d</Badge>
          )}
        </div>

        {stats.completionCount >= 2 && (
          <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs text-ink-3">
            {stats.completionCount} completions · intervals {ordered.length > 0 ? "" : ""}
            {formatRange(stats.intervals.shortestIntervalDays, stats.intervals.longestIntervalDays)} ·
            median {Math.round(stats.intervals.medianIntervalDays ?? 0)} d · trimmed mean{" "}
            {stats.intervals.trimmedMeanIntervalDays != null ? `${Math.round(stats.intervals.trimmedMeanIntervalDays)} d` : "n/a"}
            {stats.intervals.coefficientOfVariation != null &&
              ` · variance ±${Math.round(stats.intervals.coefficientOfVariation * 100)}%`}
          </div>
        )}

        {item.notes.trim() && (
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-3">Notes</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{item.notes}</p>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-medium text-ink-3">
            History ({history.length})
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((occurrence) => {
                const photos = os.attachmentsForOccurrence(occurrence.id);
                return (
                  <li key={occurrence.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{formatFullDate(occurrence.completedAt)}</div>
                      {occurrence.note && (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{occurrence.note}</p>
                      )}
                      {photos.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {photos.map((photo) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={photo.id}
                              src={photo.url ?? ""}
                              alt={photo.name}
                              className="size-16 rounded-lg border border-line object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        confirmRemove === occurrence.id
                          ? "Confirm remove completion"
                          : "Remove completion"
                      }
                      title={confirmRemove === occurrence.id ? "Click again to confirm" : "Remove completion"}
                      onClick={() => {
                        if (confirmRemove === occurrence.id) {
                          os.removeLifeMemoryCompletion(item.id, occurrence.id);
                          setConfirmRemove(null);
                          toast("Completion removed");
                        } else {
                          setConfirmRemove(occurrence.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function formatRange(shortest: number | null, longest: number | null): string {
  if (shortest == null || longest == null) return "";
  if (shortest === longest) return `${Math.round(shortest)} d`;
  return `${Math.round(shortest)}–${Math.round(longest)} d`;
}

export function MemoryModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [view, setView] = React.useState<"timeline" | "trackers">("timeline");
  const [tab, setTab] = React.useState<Tab>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LifeMemoryItem | null>(null);
  const [detailId, setDetailId] = React.useState<ID | null>(null);
  const [completingId, setCompletingId] = React.useState<ID | null>(null);
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<LifeMemoryCategory | null>(null);
  const [search, setSearch] = React.useState("");

  const rows = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return Object.values(state.lifeMemoryItems)
      .filter((item) =>
        tab === "trash"
          ? item.status === "trashed"
          : tab === "archived"
            ? item.status === "archived"
            : item.status === "active",
      )
      .filter((item) => !category || item.category === category)
      .filter(
        (item) =>
          !needle ||
          `${item.title} ${item.description} ${item.notes} ${item.tags.join(" ")}`
            .toLowerCase()
            .includes(needle),
      )
      .map((item) => ({ item, stats: os.lifeMemoryStats(item.id) }))
      .filter((row): row is { item: LifeMemoryItem; stats: LifeMemoryStats } => row.stats != null)
      .map((row) => ({
        ...row,
        weight:
          row.stats.urgency === "overdue"
            ? 5
            : row.stats.urgency === "due"
              ? 4
              : row.stats.urgency === "soon"
                ? 3
                : row.stats.urgency === "never"
                  ? 2
                  : 1,
      }))
      .sort(
        (a, b) =>
          b.weight - a.weight ||
          (a.stats.daysUntilExpected ?? 9999) - (b.stats.daysUntilExpected ?? 9999),
      );
  }, [category, os, search, state, tab]);

  const filtered = React.useMemo(() => {
    if (tab === "due") {
      return rows.filter(
        (row) => row.stats.urgency === "soon" || row.stats.urgency === "due",
      );
    }
    if (tab === "overdue") return rows.filter((row) => row.stats.urgency === "overdue");
    if (tab === "never") return rows.filter((row) => row.stats.lastCompletedAt == null);
    return rows;
  }, [rows, tab]);

  const overview = os.lifeMemoryOverview();
  const summaryParts = [`${overview.total} tracked`];
  if (overview.overdue > 0) summaryParts.push(`${overview.overdue} overdue`);
  if (overview.due + overview.soon > 0) summaryParts.push(`${overview.due + overview.soon} due`);
  if (overview.neverRecorded > 0) {
    summaryParts.push(`${overview.neverRecorded} not yet recorded`);
  }
  const summary =
    overview.total === 0
      ? "Remember everything. Capture moments, track experiences and never forget what matters."
      : summaryParts.join(" · ");

  const ask = (text: string) => {
    if (!text.trim()) return;
    const result = os.aiLifeMemoryAnswer(text.trim());
    setAnswer(result.answer);
    setQuestion("");
  };

  const loadSampleMemory = () => {
    const result = seedSampleMemory(os);
    if (result.moments === 0 && result.trackers === 0) {
      toast("Sample memories are already loaded");
      return;
    }
    toast(
      `Added ${result.moments} moments and ${result.trackers} trackers`,
      { tone: "success" },
    );
  };

  const exportMemories = () => {
    const lines = [
      "# Life Memory",
      "",
      `Exported ${new Date().toLocaleString()} · view: ${tab}`,
      "",
    ];
    for (const { item, stats } of filtered) {
      lines.push(`## ${item.title}`);
      lines.push(`- Category: ${LIFE_MEMORY_CATEGORY_LABELS[item.category]}`);
      lines.push(`- Status: ${item.status}`);
      lines.push(
        `- Last completed: ${
          stats.lastCompletedAt != null ? formatFullDate(stats.lastCompletedAt) : "never"
        }`,
      );
      lines.push(
        `- Expected next: ${
          stats.expectedNextAt != null ? formatFullDate(stats.expectedNextAt) : "unknown"
        }`,
      );
      lines.push(
        `- Interval: ${
          stats.effectiveIntervalDays != null
            ? `${Math.round(stats.effectiveIntervalDays)} days`
            : "unknown"
        } (${stats.intervalSource})`,
      );
      if (item.description) lines.push(`- Description: ${item.description}`);
      if (item.tags.length > 0) lines.push(`- Tags: ${item.tags.join(", ")}`);
      if (item.history.length > 0) {
        lines.push("", "### History");
        for (const occurrence of os.lifeMemoryHistory(item.id, "desc")) {
          lines.push(
            `- ${formatFullDate(occurrence.completedAt)}${
              occurrence.note ? ` — ${occurrence.note}` : ""
            }`,
          );
        }
      }
      lines.push("");
    }
    downloadText(`life-memory-${tab}.md`, lines.join("\n"));
    toast("Memory report downloaded", { tone: "success" });
  };
  return (
    <>
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink"
              aria-hidden="true"
            >
              <Brain className="size-4" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Life Memory</h1>
              <p className="mt-0.5 text-sm text-ink-3">{summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadSampleMemory}
              data-testid="memory-load-sample"
            >
              <Sparkles className="size-4" aria-hidden />
              Load sample
            </Button>
            <Segmented
              options={[
                { value: "timeline", label: "Timeline" },
                { value: "trackers", label: "Trackers" },
              ]}
              value={view}
              onChange={setView}
              label="Memory view"
            />
          </div>
        </div>
      </header>

      {view === "timeline" ? (
        <MemoryTimelineWorkspace />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Segmented options={TABS} value={tab} onChange={setTab} label="Tracker view" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={exportMemories}
                data-testid="memory-export"
              >
                <Download className="size-4" />
                Export
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New memory
              </Button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="memory-stats">
            {[
              { id: "all" as const, label: "Tracked", value: overview.total, tone: "text-ink" },
              { id: "overdue" as const, label: "Overdue", value: overview.overdue, tone: "text-danger" },
              { id: "due" as const, label: "Due soon", value: overview.due + overview.soon, tone: "text-warning" },
              { id: "never" as const, label: "Never recorded", value: overview.neverRecorded, tone: "text-ink-3" },
            ].map((stat) => (
              <button
                key={stat.id}
                type="button"
                data-testid={`memory-stat-${stat.id}`}
                onClick={() => setTab(stat.id)}
                aria-pressed={tab === stat.id}
                className={cn(
                  "rounded-xl border bg-surface px-3 py-2 text-left transition-colors",
                  tab === stat.id ? "border-accent" : "border-line hover:border-line-strong",
                )}
              >
                <span className={cn("block text-lg font-bold tabular-nums", stat.tone)}>
                  {stat.value}
                </span>
                <span className="block text-[11px] text-ink-3">{stat.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search memories"
                aria-label="Search memories"
                className="pl-8"
              />
            </div>
            <Select
              value={category ?? ""}
              onChange={(event) =>
                setCategory((event.target.value || null) as LifeMemoryCategory | null)
              }
              aria-label="Filter by category"
              className="w-auto min-w-36"
            >
              <option value="">All categories</option>
              {LIFE_MEMORY_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {LIFE_MEMORY_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <FieldLabel htmlFor="lm-ask">Ask about your history</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="lm-ask"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") ask(question);
            }}
            placeholder="When did I last service my car?"
          />
          <Button variant="secondary" size="sm" onClick={() => ask(question)} disabled={!question.trim()}>
            Ask
          </Button>
        </div>
        {answer && (
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/60 p-3 text-sm leading-relaxed text-ink-2">
            {answer}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={
            tab === "trash"
              ? "Trash is empty"
              : tab === "archived"
                ? "No archived memories"
                : tab === "never"
                  ? "Everything has been recorded at least once"
                  : "Nothing here yet"
          }
          description={
            tab === "trash"
              ? "Memories you delete land here. Restore them or delete them forever."
              : tab === "archived"
                ? "Archived memories are hidden from your trackers. Restore one to bring it back."
                : "Track things you want to remember historically — servicing, cleaning, replacing — and the engine learns the interval for you."
          }
          action={
            tab === "trash" || tab === "archived" ? (
              <Button variant="secondary" size="md" onClick={() => setTab("all")}>
                Back to trackers
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                Add a memory
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ item, stats }) => (
            <li key={item.id} className="list-none">
              <div
                className={cn(
                  "rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop",
                  item.status !== "active" && "opacity-75",
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetailId(item.id)}
                  className="w-full text-left"
                  aria-label={`Open ${item.title}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">{item.title}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.status !== "active" ? (
                        <Badge tone="neutral">{item.status}</Badge>
                      ) : null}
                      <Badge tone={URGENCY_TONE[stats.urgency]}>{URGENCY_LABEL[stats.urgency]}</Badge>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">{LIFE_MEMORY_CATEGORY_LABELS[item.category]}</p>

                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Last completed</dt>
                      <dd className="font-medium text-ink-2">{relativeDays(stats.daysSinceCompletion)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Expected next</dt>
                      <dd className="font-medium text-ink-2">
                        {stats.expectedNextAt ? formatFullDate(stats.expectedNextAt) : "unknown"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Interval</dt>
                      <dd className="font-medium text-ink-2">
                        {stats.effectiveIntervalDays != null ? `${Math.round(stats.effectiveIntervalDays)} d` : "—"}
                      </dd>
                    </div>
                  </dl>
                </button>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                  <span className="text-[11px] text-ink-3">
                    {stats.completionCount} record{stats.completionCount === 1 ? "" : "s"} ·{" "}
                    {Math.round(stats.confidence * 100)}% confidence
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="memory-record"
                    onClick={() => setCompletingId(item.id)}
                    disabled={item.status !== "active"}
                  >
                    Record
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ItemDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
      <CompletionDialog
        open={completingId != null}
        onClose={() => setCompletingId(null)}
        item={completingId ? os.getLifeMemoryItem(completingId) : null}
      />
      <DetailDialog
          itemId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(item) => {
            setEditing(item);
            setDialogOpen(true);
            setDetailId(null);
          }}
        />
        </>
      )}
    </>
  );
}