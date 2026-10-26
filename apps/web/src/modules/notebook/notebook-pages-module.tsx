"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowLeft, FileText, Plus, Search } from "lucide-react";

import { safeFileName, type Page } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import { downloadText } from "./notebook-export";

function relative(at: number): string {
  if (!Number.isFinite(at)) return "";
  const diff = Date.now() - at;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(at).toLocaleDateString();
}

export function NotebookPagesModule({ notebookId }: { notebookId: string }) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);

  const notebook = state.notebooks[notebookId] ?? null;
  const pages = os.notebookPages(notebookId);
  const stats = os.notebookStats(notebookId);

  const tags = (() => {
    const set = new Set<string>();
    for (const page of pages) for (const tag of page.tags) set.add(tag);
    return [...set].sort((a, b) => a.localeCompare(b));
  })();

  const filtered = pages.filter((page) => {
    const needle = query.trim().toLowerCase();
    if (activeTag !== null && !page.tags.includes(activeTag)) return false;
    if (needle.length === 0) return true;
    return (
      page.title.toLowerCase().includes(needle) ||
      page.searchVector.includes(needle) ||
      page.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });

  if (!notebook) {
    return (
      <EmptyState
        icon={FileText}
        title="Notebook not found"
        description="It may have been deleted."
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

  const createPage = () => {
    const page = os.addPage({ notebookId, title: "Untitled page" });
    toast(`Created “${page.title}”`);
  };

  const exportNotebook = () => {
    const markdown = os.notebookToMarkdown(notebookId);
    downloadText(`${safeFileName(notebook.title, "notebook")}.md`, markdown);
    toast("Exported notebook as markdown");
  };

  const move = (page: Page, direction: -1 | 1) => {
    const order = pages.map((entry) => entry.id);
    const index = order.indexOf(page.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    os.reorderPages(notebookId, next);
  };

  return (
    <div>
      <Link
        href="/notebook"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All notebooks
      </Link>

      <PageHeader
        icon={FileText}
        title={notebook.title}
        subtitle={
          notebook.description.length > 0 ? (
            notebook.description
          ) : (
            <span>
              {stats.pageCount} pages · {stats.wordCount} words · {stats.readingTimeMinutes} min read
            </span>
          )
        }
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages"
                aria-label="Search pages"
                className="w-52 pl-8"
              />
            </div>
            {pages.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={exportNotebook}>
                Export
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={createPage}>
              <Plus className="size-3.5" />
              New page
            </Button>
          </>
        }
      />

      {tags.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Chip
            active={activeTag === null}
            onClick={() => setActiveTag(null)}
            role="button"
            tabIndex={0}
          >
            All
          </Chip>
          {tags.map((tag) => (
            <Chip
              key={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              role="button"
              tabIndex={0}
            >
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}

      {pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No pages yet"
          description="Pages hold the long-form writing. Start with one and build it from blocks."
          action={
            <Button variant="primary" size="md" onClick={createPage}>
              Create the first page
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching pages" description="Try a different search or tag." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {filtered.map((page) => (
            <li key={page.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/notebook/view?book=${notebookId}&page=${page.id}`}
                  className="block truncate text-sm font-medium text-ink hover:underline"
                >
                  {page.title.trim().length > 0 ? page.title : "Untitled page"}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                  <span>{page.wordCount} words</span>
                  <span aria-hidden="true">·</span>
                  <span>{page.readingTimeMinutes} min</span>
                  {page.lastEditedAt > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{relative(page.lastEditedAt)}</span>
                    </>
                  ) : null}
                  {page.tags.map((tag) => (
                    <span key={tag} className="rounded bg-surface-2 px-1.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${page.title} up`}
                  disabled={pages.findIndex((entry) => entry.id === page.id) === 0}
                  onClick={() => move(page, -1)}
                >
                  Up
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${page.title} down`}
                  disabled={pages.findIndex((entry) => entry.id === page.id) === pages.length - 1}
                  onClick={() => move(page, 1)}
                >
                  Down
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}