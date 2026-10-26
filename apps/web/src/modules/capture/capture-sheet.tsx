"use client";

import * as React from "react";

import {
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Hash,
  Image as ImageIcon,
  ListTodo,
  Mic,
  MicOff,
  Plus,
  Repeat,
  Sparkles,
  StickyNote,
  Target,
  Users,
  X,
} from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import {
  formatDayLabel,
  formatTime,
  newId,
  resolveCapture,
  type CaptureAttachment,
  type CaptureMode,
  type CaptureOutcome,
  type CaptureSource,
  type CaptureType,
} from "@personalos/core";

import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";
import { useCapture } from "./capture-context";
import { useMediaRecorder } from "./use-media-recorder";

interface ModeOption {
  value: CaptureMode;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: "ai", label: "Let AI decide", icon: Sparkles },
  { value: "task", label: "Task", icon: ListTodo },
  { value: "note", label: "Note", icon: StickyNote },
  { value: "voice", label: "Voice", icon: Mic },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "document", label: "Document", icon: FileText },
  { value: "goal", label: "Goal", icon: Target },
  { value: "habit", label: "Habit", icon: Repeat },
  { value: "event", label: "Event", icon: CalendarDays },
  { value: "meeting", label: "Meeting", icon: Users },
];

const MAX_ATTACHMENT_BYTES = 1_500_000;
const MAX_ATTACHMENTS = 6;

const TYPE_TONE: Record<string, BadgeTone> = {
  task: "accent",
  event: "accent",
  meeting: "accent",
  note: "neutral",
  goal: "success",
  habit: "success",
};

function kindForFile(file: File): CaptureAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function readAsDataUrl(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function successMessage(outcome: CaptureOutcome, now: number): string {
  const entity = outcome.entity;
  if (entity?.type === "task" && entity.dueAt) {
    return `Task scheduled for ${formatDayLabel(entity.dueAt, now)}`;
  }
  if (entity?.type === "event" || entity?.type === "meeting") {
    return `${entity.title} added to your schedule`;
  }
  if (entity?.type === "habit") return "Habit added";
  if (entity?.type === "goal") return "Goal added";
  if (entity?.type === "recording") return "Voice memo saved";
  if (entity?.type === "document") return "Document saved";
  if (entity?.type === "note") return "Note saved";
  return "Captured to your inbox";
}

function whenLabel(
  resolved: ReturnType<typeof resolveCapture>,
  task: boolean,
  hour12: boolean,
  now: number,
): string | null {
  const target = task ? resolved.dueAt : resolved.startsAt;
  if (target === null && resolved.allDay && resolved.dueAt !== null) {
    return formatDayLabel(resolved.dueAt, now);
  }
  if (target === null) return null;
  const day = formatDayLabel(target, now);
  return resolved.hasExplicitTime ? `${day} ${formatTime(target, hour12)}` : day;
}

export function CaptureSheet() {
  const { open, mode, openCapture, closeCapture } = useCapture();
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const recorder = useMediaRecorder();

  const [value, setValue] = React.useState("");
  const [selectedMode, setSelectedMode] = React.useState<CaptureMode>("ai");
  const [attachments, setAttachments] = React.useState<CaptureAttachment[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const now = Date.now();
  const hour12 = state.settings.timeFormat === 12;
  const isRecording = recorder.recording;
  const stopRecording = recorder.stop;

  React.useEffect(() => {
    if (open) {
      setValue("");
      setAttachments([]);
      setSelectedMode(mode);
      setSubmitting(false);
    }
  }, [open, mode]);

  React.useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [isRecording]);

  React.useEffect(() => {
    if (!open && isRecording) void stopRecording();
  }, [open, isRecording, stopRecording]);

  const resolved = React.useMemo(
    () => resolveCapture(value, { now, mode: selectedMode }),
    [value, selectedMode, now],
  );

  const attachmentKind = attachments[0]?.kind;
  const effectiveType = React.useMemo<CaptureMode>(() => {
    if (selectedMode !== "ai") return selectedMode;
    if (value.trim()) return resolved.type;
    if (attachmentKind === "document") return "document";
    if (attachmentKind === "audio") return "voice";
    if (attachmentKind === "image") return "image";
    return "ai";
  }, [selectedMode, value, resolved.type, attachmentKind]);

  const hasInput = value.trim().length > 0 || attachments.length > 0;
  const when = whenLabel(
    resolved,
    effectiveType === "task" || effectiveType === "goal",
    hour12,
    now,
  );

  const addFiles = async (files: FileList | File[] | null) => {
    const incoming = files ? Array.from(files) : [];
    if (incoming.length === 0) return;

    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast(`Up to ${MAX_ATTACHMENTS} attachments per capture`, { tone: "danger" });
      return;
    }

    const accepted: File[] = [];
    for (const file of incoming) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast(
          `${file.name} is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB`,
          { tone: "danger" },
        );
        continue;
      }
      if (accepted.length >= room) {
        toast(`Up to ${MAX_ATTACHMENTS} attachments per capture`, { tone: "danger" });
        break;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    const next = await Promise.all(
      accepted.map(async (file) => ({
        id: newId(),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        kind: kindForFile(file),
        url: await readAsDataUrl(file),
      })),
    );
    setAttachments((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS));
  };

  const recordVoice = async () => {
    if (recorder.recording) {
      const media = await recorder.stop();
      if (!media) {
        toast("No audio was recorded", { tone: "danger" });
        return;
      }
      if (media.blob.size > MAX_ATTACHMENT_BYTES) {
        toast(
          `Recording is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB`,
          { tone: "danger" },
        );
        return;
      }
      const url = await readAsDataUrl(media.blob);
      setAttachments((current) => [
        ...current.filter((attachment) => attachment.kind !== "audio"),
        {
          id: newId(),
          name: `Voice memo ${new Date().toLocaleTimeString()}`,
          mimeType: media.mimeType,
          sizeBytes: media.blob.size,
          kind: "audio",
          url,
        },
      ]);
      return;
    }
    setAttachments((current) => current.filter((attachment) => attachment.kind !== "audio"));
    recorder.start();
  };

  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const documentInputRef = React.useRef<HTMLInputElement>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const clearDraft = () => {
    if (recorder.recording) void recorder.stop();
    setValue("");
    setAttachments([]);
    setSelectedMode("ai");
  };

  const submit = () => {
    if (!hasInput || submitting) return;
    if (recorder.recording) {
      toast("Stop recording before capturing", { tone: "danger" });
      return;
    }

    const requiredKind =
      selectedMode === "image"
        ? "image"
        : selectedMode === "document"
          ? "document"
          : selectedMode === "voice"
            ? "audio"
            : null;
    if (requiredKind && !attachments.some((attachment) => attachment.kind === requiredKind)) {
      toast(
        requiredKind === "image"
          ? "Add an image first"
          : requiredKind === "document"
            ? "Add a document first"
            : "Record or upload audio first",
        { tone: "danger" },
      );
      return;
    }
    if (
      selectedMode === "document" &&
      attachments.filter((attachment) => attachment.kind === "document").length > 1
    ) {
      toast("Attach one document per capture", { tone: "danger" });
      return;
    }
    if (
      !value.trim() &&
      effectiveType !== "image" &&
      effectiveType !== "document" &&
      effectiveType !== "voice"
    ) {
      toast("Add a title or note first", { tone: "danger" });
      return;
    }

    setSubmitting(true);

    const source: CaptureSource =
      selectedMode === "ai"
        ? attachmentKind
          ? attachmentKind === "audio"
            ? "voice"
            : attachmentKind
          : "text"
        : selectedMode === "voice"
          ? "voice"
          : selectedMode === "image"
            ? "image"
            : selectedMode === "document"
              ? "document"
              : "text";

    const outcome = os.captureDraft(
      {
        ...resolved,
        raw: value.trim() || null,
        title: value.trim() ? resolved.title : defaultTitle(effectiveType),
        body: resolved.body,
        type: effectiveType as CaptureType,
        mode: selectedMode,
        workspaceMode: state.settings.activeMode,
        source,
        attachments,
      },
      now,
    );
    setSubmitting(false);

    if (outcome.status === "empty") return;
    closeCapture();

    if (outcome.status === "duplicate") {
      toast("Already captured — no duplicate created", { tone: "danger" });
      return;
    }

    if (outcome.status === "created") {
      toast(successMessage(outcome, now), {
        tone: "success",
        action: { label: "Capture another", onClick: openCapture },
      });
    }
  };

  const submitRef = React.useRef(submit);
  submitRef.current = submit;

  return (
    <Modal
      open={open}
      onClose={closeCapture}
      title="Capture"
      description="One entry, anywhere. Let AI decide where it belongs."
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-ink-3 sm:flex">
            <Kbd>Enter</Kbd> to save
            <span className="mx-1 text-line-strong">·</span>
            <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line
          </span>
          <div className="flex items-center gap-2 sm:ml-auto">
            {hasInput ? (
              <Button variant="ghost" size="sm" onClick={clearDraft} disabled={submitting}>
                Clear
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={submit}
              loading={submitting}
              disabled={!hasInput || recorder.recording}
            >
              {recorder.recording ? "Recording…" : "Capture"}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className={cn(
          "space-y-3 rounded-xl transition-shadow",
          dragging && "ring-2 ring-accent/40 ring-offset-2 ring-offset-surface",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        <div
          role="radiogroup"
          aria-label="Capture type"
          className="flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-surface-2 p-1 -mx-1"
        >
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selectedMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedMode(option.value)}
                className={
                  active
                    ? "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-accent-soft px-2.5 text-xs font-semibold text-accent-ink"
                    : "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-ink-3 transition-colors hover:bg-surface hover:text-ink-2"
                }
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>

        <Textarea
          data-autofocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPaste={(event) => {
            const files = event.clipboardData?.files;
            if (files && files.length > 0) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitRef.current();
            }
          }}
          placeholder={
            selectedMode === "ai"
              ? "Call mom friday at 5pm #home · doctor monday 3pm · meditate every morning…"
              : selectedMode === "voice"
                ? "Speak now, or type a title for your voice memo…"
                : selectedMode === "image" || selectedMode === "document"
                  ? "Add a note about the file (optional)…"
                  : "What should we capture?"
          }
          className="min-h-24 text-[15px]"
          aria-label="Capture text"
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink-2"
              >
                {attachment.kind === "image" && attachment.url && (
                  <img
                    src={attachment.url}
                    alt=""
                    className="size-6 rounded object-cover"
                  />
                )}
                <span className="max-w-40 truncate">{attachment.name}</span>
                <span className="shrink-0 text-ink-3">{bytesLabel(attachment.sizeBytes)}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id),
                    )
                  }
                  aria-label={`Remove ${attachment.name}`}
                  className="grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        {recorder.error && (
          <p className="text-xs text-danger" role="alert">
            {recorder.error}
          </p>
        )}

        {recorder.recording && (
          <p className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger" role="status">
            <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            Recording {formatElapsed(recordingSeconds)} — tap the mic to stop.
          </p>
        )}

        <div className="flex min-h-7 flex-wrap items-center gap-1.5" aria-live="polite">
          {hasInput && effectiveType !== "ai" && (
            <Badge tone={TYPE_TONE[effectiveType] ?? "accent"}>
              {effectiveType === "voice"
                ? "Voice memo"
                : effectiveType === "image"
                  ? "Image → Note"
                  : effectiveType === "document"
                    ? "Document"
                    : modeLabel(effectiveType)}
            </Badge>
          )}
          {hasInput && value.trim() && resolved.type === "note" && selectedMode === "ai" && (
            <Badge tone="neutral">
              <StickyNote className="size-3" aria-hidden="true" />
              Note
            </Badge>
          )}
          {hasInput && when && (
            <Badge tone="neutral">
              <CalendarDays className="size-3" aria-hidden="true" />
              {when}
            </Badge>
          )}
          {hasInput && resolved.priority > 0 && (
            <Badge tone={resolved.priority >= 4 ? "danger" : resolved.priority === 3 ? "warning" : "neutral"}>
              <Flag className="size-3" aria-hidden="true" />
              {priorityLabel(resolved.priority)}
            </Badge>
          )}
          {hasInput && resolved.durationMin && (
            <Badge tone="neutral">
              <Clock className="size-3" aria-hidden="true" />
              {resolved.durationMin} min
            </Badge>
          )}
          {hasInput &&
            resolved.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                <Hash className="size-3" aria-hidden="true" />
                {tag}
              </Badge>
            ))}
        </div>

        {hasInput && value.trim() && (selectedMode === "ai" || selectedMode === "task") && (
          <p className="border-t border-line pt-2.5 text-xs leading-relaxed text-ink-3">
            <Sparkles className="mr-1 inline size-3 text-accent" aria-hidden="true" />
            {resolved.keySignals.join(" · ")}
            {` · confidence ${Math.round(resolved.confidence * 100)}%`}
          </p>
        )}

        <div className="flex items-center gap-1.5 border-t border-line pt-2.5">
          <span className="mr-1 text-xs font-medium text-ink-3">Add</span>
          <Tooltip label="Record a voice memo">
            <button
              type="button"
              onClick={recordVoice}
              aria-label={recorder.recording ? "Stop recording" : "Record voice memo"}
              className={
                recorder.recording
                  ? "grid size-7 place-items-center rounded-lg bg-danger text-white"
                  : "grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              }
            >
              {recorder.recording ? (
                <MicOff className="size-4 animate-pulse" aria-hidden="true" />
              ) : (
                <Mic className="size-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          <Tooltip label="Add an image">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              aria-label="Add an image"
              className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ImageIcon className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label="Add a document">
            <button
              type="button"
              onClick={() => documentInputRef.current?.click()}
              aria-label="Add a document"
              className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <FileText className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label="Upload audio">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              aria-label="Upload audio"
              className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            aria-label="Attach image"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
            className="hidden"
            aria-label="Attach document"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            aria-label="Attach audio"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <span className="ml-auto hidden text-[11px] text-ink-3 sm:inline">
            Paste or drop files · up to {MAX_ATTACHMENTS} · {Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB each
          </span>
        </div>
      </div>
    </Modal>
  );
}

function defaultTitle(type: CaptureMode): string {
  if (type === "voice") return "Voice memo";
  if (type === "image") return "Captured image";
  if (type === "document") return "Captured document";
  return "";
}

function modeLabel(type: string): string {
  const option = MODE_OPTIONS.find((item) => item.value === type);
  return option?.label ?? type;
}

function priorityLabel(priority: number): string {
  if (priority >= 4) return "Urgent";
  if (priority === 3) return "High";
  if (priority === 2) return "Medium";
  return "Low";
}
