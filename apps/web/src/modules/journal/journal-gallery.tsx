"use client";

import * as React from "react";

import { Camera, Trash2 } from "lucide-react";

import type { Attachment } from "@personalos/core";
import type { ID } from "@personalos/core";
import type { PersonalOS } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

interface JournalGalleryProps {
  os: PersonalOS;
  entryId: ID | null;
  attachments: Attachment[];
  onAdd: (files: FileList | null) => void;
}

const MAX_FILE_BYTES = 1_500_000;

export function JournalGallery({ os, entryId, attachments, onAdd }: JournalGalleryProps) {
  const { toast } = useToast();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const images = attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  const files = attachments.filter((attachment) => !attachment.mimeType.startsWith("image/"));

  const removeAttachment = (attachment: Attachment) => {
    os.deleteAttachment(attachment.id);
    for (const entry of Object.values(os.getState().journalEntries)) {
      if (entry.attachmentIds.includes(attachment.id)) {
        os.updateJournalEntry(entry.id, {
          attachmentIds: entry.attachmentIds.filter((id) => id !== attachment.id),
        });
      }
    }
    toast("Attachment removed");
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        toast(`${file.name} is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB`);
        continue;
      }
    }
    onAdd(list);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer?.files ?? null);
        }}
        className={
          dragging
            ? "rounded-xl border-2 border-dashed border-accent bg-accent/5 p-6 text-center"
            : "rounded-xl border-2 border-dashed border-line p-6 text-center"
        }
      >
        <p className="text-sm font-medium">Drop photos and files here</p>
        <p className="mt-1 text-xs text-ink-3">
          Images, PDFs, audio, and documents. Files up to {Math.round(MAX_FILE_BYTES / 1024)} KB each stay on this
          device.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Take a photo"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const camera = document.querySelector<HTMLInputElement>("input[capture='environment']");
              camera?.click();
            }}
          >
            <Camera className="size-3.5" aria-hidden />
            Camera
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Upload journal attachments"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {images.length === 0 && files.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No photos yet"
          description="Attach a photo to any entry and it will show up here."
        />
      ) : null}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((attachment) => (
            <figure key={attachment.id} className="group relative overflow-hidden rounded-xl border border-line">
              <img
                src={attachment.url ?? ""}
                alt={attachment.name}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-surface/90 p-2 text-[11px] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <span className="truncate">{attachment.name}</span>
                <span className="flex items-center gap-2">
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-3 hover:text-ink"
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment)}
                    className="text-ink-3 hover:text-danger"
                    aria-label={`Delete ${attachment.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm">
              <span className="truncate">
                {attachment.name}
                <Badge tone="neutral">{(attachment.sizeBytes / 1024).toFixed(0)} KB</Badge>
              </span>
              <span className="flex items-center gap-2">
                {attachment.url ? (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-3 hover:text-ink"
                  >
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment)}
                  className="text-ink-3 hover:text-danger"
                  aria-label={`Delete ${attachment.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {entryId == null ? <p className="text-xs text-ink-3">Pick a date to attach photos to it.</p> : null}
      <span className="sr-only">{attachCountLabel(attachments.length)}</span>
    </div>
  );
}

function attachCountLabel(count: number): string {
  return `${count} attachment${count === 1 ? "" : "s"}`;
}

export { MAX_FILE_BYTES };
