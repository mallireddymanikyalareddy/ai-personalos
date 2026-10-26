"use client";

import * as React from "react";

import { Camera, Check, FileText, Image as ImageIcon, Mic, Square, X } from "lucide-react";

import { newId, resolveCapture } from "@personalos/core";
import type { CaptureAttachment } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useHaptics } from "@/hooks/use-haptics";
import { useMediaRecorder } from "@/modules/capture/use-media-recorder";
import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

export interface QuickCaptureSheetProps {
  open: boolean;
  onClose: () => void;
}

const TARGETS = [
  { id: "task", label: "Task", icon: Check },
  { id: "note", label: "Note", icon: FileText },
  { id: "event", label: "Event", icon: Camera },
] as const;

export function QuickCaptureSheet({ open, onClose }: QuickCaptureSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const haptics = useHaptics();
  const recorder = useMediaRecorder();

  const [value, setValue] = React.useState("");
  const [target, setTarget] = React.useState<(typeof TARGETS)[number]["id"]>("task");
  const [attachment, setAttachment] = React.useState<CaptureAttachment | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setValue("");
    setAttachment(null);
    haptics.trigger("tap");
    const focus = window.setTimeout(() => areaRef.current?.focus(), 60);
    return () => window.clearTimeout(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    if (!value.trim() && !attachment) return;
    haptics.trigger("success");
    const now = Date.now();
    const resolved = resolveCapture(value, { now, mode: target });
    const outcome = os.captureDraft(
      {
        ...resolved,
        raw: value.trim() || null,
        title: value.trim() || attachment?.name || "Quick capture",
        type: target === "task" ? "task" : target === "note" ? "note" : "event",
        mode: target,
        source: attachment?.kind === "audio" ? "voice" : attachment?.kind === "image" ? "image" : "text",
        attachments: attachment ? [attachment] : [],
      },
      now,
    );

    if (outcome.status === "duplicate") {
      toast("Already captured - no duplicate created", { tone: "danger" });
      return;
    }

    toast(target === "task" ? "Task captured" : target === "note" ? "Note saved" : "Event added", {
      tone: "success",
    });
    setValue("");
    setAttachment(null);
    onClose();
  };

  const toggleVoice = async () => {
    haptics.trigger("tap");
    if (recorder.recording) {
      const media = await recorder.stop();
      if (media) {
        setAttachment({
          id: newId(),
          name: `Voice memo ${new Date().toLocaleTimeString()}`,
          mimeType: media.mimeType,
          sizeBytes: media.blob.size,
          kind: "audio",
          url: URL.createObjectURL(media.blob),
        });
        haptics.trigger("success");
      }
      return;
    }
    recorder.start();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <button
        type="button"
        aria-label="Dismiss quick capture"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
        className="relative z-10 rounded-t-3xl border-t border-line bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop animate-drawer-in-bottom"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />

        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Capture target">
            {TARGETS.map((option) => {
              const Icon = option.icon;
              const active = target === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setTarget(option.id);
                    haptics.trigger("tap");
                  }}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                    active ? "bg-accent-soft text-accent-ink" : "text-ink-3",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick capture"
            className="grid size-10 place-items-center rounded-full text-ink-3 active:bg-surface-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="px-4">
          <Textarea
            ref={areaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={3}
            placeholder="What is on your mind?"
            aria-label="Quick capture text"
            className="min-h-24 resize-none text-base"
          />
        </div>

        {attachment ? (
          <div className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-xs text-ink-3 underline"
            >
              Remove
            </button>
          </div>
        ) : null}

        {recorder.error ? <p className="mx-4 mt-2 text-xs text-danger">{recorder.error}</p> : null}

        <div className="mt-3 flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a file"
            className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-ink-2 active:bg-surface-2"
          >
            <ImageIcon className="size-5" aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            aria-label="Attach a file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setAttachment({
                id: newId(),
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "document",
                url: URL.createObjectURL(file),
              });
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => void toggleVoice()}
            aria-label={recorder.recording ? "Stop recording" : "Record a voice memo"}
            aria-pressed={recorder.recording}
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-full border",
              recorder.recording ? "border-danger bg-danger/10 text-danger" : "border-line text-ink-2 active:bg-surface-2",
            )}
          >
            {recorder.recording ? <Square className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </button>

          <Button
            variant="primary"
            className="h-12 flex-1 text-base"
            onClick={save}
            disabled={!value.trim() && !attachment}
          >
            Capture
          </Button>
        </div>

        <p className="px-4 pb-2 text-center text-[11px] text-ink-3">
          {state.settings.timeFormat === 12 ? "12-hour" : "24-hour"} · saved on this device
        </p>
      </section>
    </div>
  );
}
