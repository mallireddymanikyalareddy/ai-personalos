"use client";

import * as React from "react";

import Link from "next/link";
import { BookOpen, Notebook as NotebookIcon, Plus, Search, Trash2 } from "lucide-react";

import { notebookSummaries, safeFileName, type Notebook } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import { downloadText } from "./notebook-export";

function NotebookDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; description: string }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New notebook"
      description="A notebook holds long-form pages. Notes stay short; essays live here."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={title.trim().length === 0}
            onClick={() => {
              onCreate({ title: title.trim(), description: description.trim() });
              onClose();
            }}
          >
            Create notebook
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Title</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Research log"
            aria-label="Notebook title"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Description</span>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in here?"
            aria-label="Notebook description"
            rows={3}
          />
        </label>
      </div>
    </Modal>
  );
}

function NotebookCard({ notebook }: { notebook: Notebook }) {
  const os = useOS();
  const stats = os.notebookStats(notebook.id);

  return (
    <Link
      href={`/notebook/view?book=${notebook.id}`}
      data-testid={`notebook-card-${notebook.id}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <NotebookIcon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <h3 className="truncate text-sm font-semibold text-ink">{notebook.title}</h3>
        </div>
        {notebook.status === "archived" ? <Badge tone="warning">Archived</Badge> : null}
      </div>
      {notebook.description.length > 0 ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-3">{notebook.description}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
        <span>{stats.pageCount} pages</span>
        {stats.wordCount > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{stats.wordCount} words</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}

export function NotebookModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Notebook | null>(null);

  const summaries = React.useMemo(() => notebookSummaries(state), [state]);
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return summaries;
    return summaries.filter(({ notebook }) => {
      if (notebook.title.toLowerCase().includes(needle)) return true;
      if (notebook.description.toLowerCase().includes(needle)) return true;
      return notebookPagesMatch(state, notebook.id, needle);
    });
  }, [summaries, query, state]);

  const totals = React.useMemo(
    () => ({
      notebooks: summaries.length,
      pages: summaries.reduce((total, entry) => total + entry.pageCount, 0),
      words: summaries.reduce((total, entry) => total + entry.wordCount, 0),
    }),
    [summaries],
  );

  const createNotebook = (input: { title: string; description: string }) => {
    const created = os.addNotebook(input);
    toast(`Created “${created.title}”`);
  };

  const deleteNotebook = (notebook: Notebook) => {
    os.deleteNotebook(notebook.id);
    setPendingDelete(null);
    toast(notebook.status === "archived" ? "Notebook deleted" : "Notebook archived");
  };

  const exportAll = () => {
    const lines: string[] = ["# PersonalOS notebooks", ""];
    for (const { notebook } of summaries) {
      lines.push(os.notebookToMarkdown(notebook.id), "");
    }
    downloadText(safeFileName("all-notebooks", "notebooks") + ".md", lines.join("\n"));
    toast("Exported every notebook as markdown");
  };

  return (
    <div>
      <PageHeader
        icon={NotebookIcon}
        title="Digital Notebook"
        subtitle={
          totals.pages > 0 ? (
            <span>
              {totals.notebooks} notebooks · {totals.pages} pages · {totals.words} words
            </span>
          ) : (
            "Long-form writing: notebooks of pages built from blocks."
          )
        }
        actions={
          <>
            {summaries.length > 0 ? (
              <>
                <div className="relative hidden sm:block">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search notebooks"
                    aria-label="Search notebooks"
                    className="w-56 pl-8"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={exportAll}>
                  Export all
                </Button>
              </>
            ) : null}
            <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              New notebook
            </Button>
          </>
        }
      />

      {summaries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No notebooks yet"
          description="Notebooks hold the writing that outgrows a note — essays, research, and compiled knowledge."
          action={
            <Button variant="primary" size="md" onClick={() => setDialogOpen(true)}>
              Create a notebook
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`Nothing in your notebooks matches “${query.trim()}”.`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="notebook-grid">
          {filtered.map(({ notebook }) => (
            <NotebookCard key={notebook.id} notebook={notebook} />
          ))}
        </div>
      )}

      {summaries.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-medium text-ink-2">Manage</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {summaries.map(({ notebook, pageCount }) => (
              <li
                key={notebook.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/notebook/view?book=${notebook.id}`}
                    className="truncate text-sm font-medium text-ink hover:underline"
                  >
                    {notebook.title}
                  </Link>
                  <p className="text-xs text-ink-3">
                    {pageCount} pages
                    {notebook.status === "archived" ? " · archived" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${notebook.title}`}
                  onClick={() => setPendingDelete(notebook)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NotebookDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={createNotebook}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.status === "archived" ? "Delete notebook" : "Archive notebook"}
        description={
          pendingDelete?.status === "archived"
            ? `“${pendingDelete.title}” and its pages will be removed for good.`
            : `“${pendingDelete?.title}” moves to archived notebooks. Its pages are kept.`
        }
        confirmLabel={pendingDelete?.status === "archived" ? "Delete" : "Archive"}
        onConfirm={() => {
          if (pendingDelete) deleteNotebook(pendingDelete);
        }}
      />
    </div>
  );
}

function notebookPagesMatch(state: ReturnType<typeof useAppState>, notebookId: string, needle: string): boolean {
  return Object.values(state.pages)
    .filter((page) => page.notebookId === notebookId && page.status !== "trashed")
    .some((page) => page.searchVector.includes(needle) || page.title.toLowerCase().includes(needle));
}