"use client";

import * as React from "react";

import { ExternalLink, Trash2 } from "lucide-react";

import type { ID } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

import { notebookTagColor } from "./notebook-meta";

export function NoteEditorDialog({
  pageId,
  onClose,
  onTrashed,
}: {
  pageId: ID | null;
  onClose: () => void;
  onTrashed?: (pageId: ID) => void;
}) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const page = pageId != null ? state.pages[pageId] ?? null : null;
  const notebook = page != null ? state.notebooks[page.notebookId] ?? null : null;

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [confirmTrash, setConfirmTrash] = React.useState(false);

  const pageRef = React.useRef(page);
  pageRef.current = page;

  React.useEffect(() => {
    const current = pageRef.current;
    if (current == null) return;
    setTitle(current.title);
    setBody(current.body);
    setTagInput("");
    setConfirmTrash(false);
  }, [page?.id]);

  if (page == null) return null;

  const structured = page.blocks.some(
    (block) => block.type !== "paragraph" || (block.children?.length ?? 0) > 0,
  );

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (tag.length === 0) return;
    if (!page.tags.includes(tag)) {
      os.updatePage(page.id, { tags: [...page.tags, tag] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    os.updatePage(page.id, { tags: page.tags.filter((value) => value !== tag) });
  };

  const save = () => {
    const nextTitle = title.trim().length > 0 ? title.trim() : "Untitled note";
    os.updatePage(page.id, { title: nextTitle });
    if (!structured && body !== page.body) {
      os.updatePageBlocks(page.id, [
        { id: page.blocks[0]?.id ?? `blk-${page.id}`, type: "paragraph", content: body },
      ]);
    }
    toast("Note updated");
    onClose();
  };

  const trash = () => {
    if (!confirmTrash) {
      setConfirmTrash(true);
      return;
    }
    os.deletePage(page.id);
    toast("Note moved to trash");
    onTrashed?.(page.id);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit note"
      description={notebook?.title ?? "Notebook"}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={trash}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            {confirmTrash ? "Confirm move to trash" : "Move to trash"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.location.assign(`/notebook/view?book=${page.notebookId}&page=${page.id}`);
              }}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open full editor
            </Button>
            <Button variant="primary" size="sm" onClick={save} data-testid="notebook-editor-save">
              Save changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="notebook-note-title" className="text-xs font-medium text-ink-2">
            Title
          </label>
          <Input
            id="notebook-note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled note"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="notebook-note-body" className="text-xs font-medium text-ink-2">
            Content
          </label>
          {structured ? (
            <>
              <div className="mt-1 rounded-xl border border-dashed border-line p-3 text-[12px] text-ink-3">
                This note uses rich blocks, so its content is edited in the full editor.
              </div>
              <p className="mt-1 line-clamp-3 text-[12px] text-ink-3">{page.body}</p>
            </>
          ) : (
            <textarea
              id="notebook-note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write something…"
              rows={8}
              className="mt-1 w-full resize-y rounded-xl border border-line bg-surface p-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
          )}
        </div>

        <div>
          <span className="text-xs font-medium text-ink-2">Tags</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {page.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: notebookTagColor(tag) }}
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="text-ink-3 hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addTag();
              }}
              placeholder="+ Add tag"
              aria-label="Add tag"
              className="h-7 w-28"
            />
          </div>
        </div>

        <p className="text-[11px] text-ink-3">
          {page.wordCount} words · {page.readingTimeMinutes} min read
        </p>
      </div>
    </Modal>
  );
}
