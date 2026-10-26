"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowLeft, Clock, Download, FileText, Link2, ListTree, Trash2 } from "lucide-react";

import {
  normalizeBlocks,
  pageToc,
  pageToMarkdown,
  pagesLinkingTo,
  safeFileName,
  type NoteBlock,
  type PageRef,
} from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import { BlockEditor } from "./block-editor";
import { NotebookAiPanel } from "./notebook-ai-panel";
import { downloadText } from "./notebook-export";

export function NotebookEditorModule({
  notebookId,
  pageId,
}: {
  notebookId: string;
  pageId: string;
}) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<NoteBlock[] | null>(null);
  const [tagInput, setTagInput] = React.useState("");
  const [showToc, setShowToc] = React.useState(true);
  const [confirmTrash, setConfirmTrash] = React.useState(false);

  const notebook = state.notebooks[notebookId] ?? null;
  const page = state.pages[pageId] ?? null;

  React.useEffect(() => {
    setDraft(null);
  }, [pageId]);

  const backlinks = React.useMemo(
    () => (page ? pagesLinkingTo(state, { type: "page", id: page.id }) : []),
    [state, page],
  );

  if (!notebook || !page) {
    return (
      <EmptyState
        icon={Trash2}
        title="Page not found"
        description="It may have been moved to trash or deleted."
        action={
          <Link href="/notebook">
            <Button variant="primary" size="md">
              Back to notebooks
            </Button>
          </Link>
        }
      />
    );
  }

  const blocks = draft ?? page.blocks;
  const toc = pageToc(blocks);
  const outgoing = page.refs ?? [];

  const commit = (next: NoteBlock[]) => {
    setDraft(next);
    os.updatePageBlocks(page.id, next);
  };

  const setTitle = (title: string) => {
    os.updatePage(page.id, { title });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag.length === 0) return;
    if (!page.tags.includes(tag)) {
      os.updatePage(page.id, { tags: [...page.tags, tag] });
    }
    setTagInput("");
  };

  const exportPage = () => {
    const markdown = pageToMarkdown({ ...page, blocks }, { toc: toc.length >= 2 });
    downloadText(`${safeFileName(page.title, "page")}.md`, markdown);
    toast("Exported page as markdown");
  };

  const applyAiBlocks = (next: NoteBlock[], message: string) => {
    commit([...blocks, ...normalizeBlocks(next)]);
    toast(message);
  };

  const addRef = (ref: PageRef, message: string) => {
    os.addPageRef(page.id, ref);
    toast(message);
  };

  return (
    <div>
      <Link
        href={`/notebook/view?book=${notebookId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {notebook.title}
      </Link>

      <PageHeader
        icon={FileText}
        title={page.title.trim().length > 0 ? page.title : "Untitled page"}
        subtitle={`${notebook.title} · ${page.wordCount} words`}
        actions={
          <>
            {toc.length >= 2 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowToc((value) => !value)}
                aria-pressed={showToc}
              >
                <ListTree className="size-3.5" />
                Contents
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={exportPage}>
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmTrash(true)}
              aria-label="Move page to trash"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <input
            value={page.title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled page"
            aria-label="Page title"
            className="mb-1 w-full bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" />
              {page.wordCount} words · {page.readingTimeMinutes} min read
            </span>
            {page.tags.length > 0 ? <span>· {page.tags.join(", ")}</span> : null}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {page.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  os.updatePage(page.id, { tags: page.tags.filter((entry) => entry !== tag) })
                }
                aria-label={`Remove tag ${tag}`}
                className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-2 hover:bg-danger-soft hover:text-danger"
              >
                {tag} ×
              </button>
            ))}
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Add tag"
              aria-label="Add tag"
              className="w-24 bg-transparent text-xs text-ink outline-none placeholder:text-ink-3"
            />
          </div>

          <BlockEditor blocks={blocks} onChange={commit} />

          <div className="mt-8 space-y-4">
            <NotebookAiPanel page={page} onApplyBlocks={applyAiBlocks} onAddRef={addRef} />

            <section
              aria-label="Links"
              className="rounded-xl border border-line bg-surface p-4"
              data-testid="notebook-links"
            >
              <h2 className="mb-2 text-sm font-semibold text-ink">Links</h2>
              {outgoing.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Nothing linked yet. Use the assistant to connect pages.
                </p>
              ) : (
                <ul className="space-y-1">
                  {outgoing.map((ref) => (
                    <li key={`${ref.type}:${ref.id}`} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                        <Link2 className="size-3.5 text-ink-3" aria-hidden="true" />
                        {ref.label.length > 0 ? ref.label : ref.id}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Unlink ${ref.label || ref.id}`}
                        onClick={() => os.removePageRef(page.id, ref)}
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {backlinks.length > 0 ? (
                <div className="mt-4 border-t border-line pt-3">
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                    Linked from
                  </h3>
                  <ul className="space-y-1">
                    {backlinks.map((source) => (
                      <li key={source.id}>
                        <Link
                          href={`/notebook/view?book=${source.notebookId}&page=${source.id}`}
                          className="text-sm text-accent-ink hover:underline"
                        >
                          {source.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {showToc && toc.length >= 2 ? (
          <aside className="hidden w-56 shrink-0 lg:block" aria-label="Table of contents">
            <div className="sticky top-24">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Contents</h2>
              <ul className="space-y-1 border-l border-line">
                {toc.map((entry) => (
                  <li key={entry.blockId}>
                    <button
                      type="button"
                      onClick={() => {
                        const node = document.querySelector(`[data-block-id="${entry.blockId}"]`);
                        node?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="block w-full truncate py-0.5 text-left text-sm text-ink-2 hover:text-ink"
                      style={{ paddingLeft: `${(entry.level - 1) * 10 + 10}px` }}
                    >
                      {entry.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        title="Move page to trash"
        description={`“${page.title || "Untitled page"}” moves to trash.`}
        confirmLabel="Move to trash"
        onConfirm={() => {
          os.deletePage(page.id);
          setConfirmTrash(false);
          toast("Page moved to trash");
        }}
      />
    </div>
  );
}