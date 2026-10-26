import type { ID, Note } from "@personalos/core";

import { cn } from "@/lib/cn";

export interface NoteCardProps {
  note: Note;
  onOpen: (id: ID) => void;
  className?: string;
}

export function NoteCard({ note, onOpen, className }: NoteCardProps) {
  const snippet = note.body.trim().replace(/\s+/g, " ").slice(0, 140);
  const updated = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    note.updatedAt,
  );
  return (
    <li className={cn("list-none", className)}>
      <button
        type="button"
        onClick={() => onOpen(note.id)}
        className="w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop"
      >
        <span className="block truncate text-sm font-medium text-ink">
          {note.title || "Untitled note"}
        </span>
        {snippet && (
          <span className="mt-1.5 block line-clamp-3 text-sm leading-relaxed text-ink-3">
            {snippet}
          </span>
        )}
        <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <span>{updated}</span>
          {note.pinned && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-ink">pinned</span>}
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-medium">
              #{tag}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}