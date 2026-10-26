"use client";

import * as React from "react";

import { FileText, Plus, X } from "lucide-react";

import type { NoteBlock, NoteSort } from "@personalos/core";
import { actionItemBlocks, projectPlanBlocks, tidyNoteBlocks } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

import { NoteEditor } from "./note-editor";
import { NoteBacklinks, NoteReminders } from "./notes-rail-extra";
import { exportNoteMarkdown, exportNotePdf } from "./notes-export";
import { NoteList, type NoteListView } from "./note-list";
import { NOTE_FOLDER_PRESETS } from "./notes-meta";
import { FoldersRail } from "./notes-folders-rail";
import {
  EmptyNotePlaceholder,
  NoteAssistant,
  NoteDetails,
  NoteRelated,
  QuickCapture,
} from "./notes-rail";
import { seedSampleNotes } from "./sample-notes";

export function NotesModule() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();

  const [folderFilter, setFolderFilter] = React.useState<string>("all");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<NoteSort>("updated");
  const [view, setView] = React.useState<NoteListView>("list");
  const [query, setQuery] = React.useState("");
  const [pinnedOnly, setPinnedOnly] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [quickText, setQuickText] = React.useState("");
  const [tagDialog, setTagDialog] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [tagValue, setTagValue] = React.useState("");

  const now = Date.now();
  const workspace = os.notesWorkspace(
    {
      folderId: folderFilter as "all" | "archive" | string,
      tag: tagFilter,
      query,
      sort,
      pinnedOnly,
      activeId,
    },
    now,
  );

  const note = workspace.active;

  const openNote = (id: string) => {
    setActiveId(id);
    setAnswer(null);
  };

  const createNote = () => {
    const created = os.addNote({ title: "Untitled note", body: "", source: "manual" });
    setActiveId(created.id);
    setAnswer(null);
    toast("Note created");
  };

  const setBlocks = (blocks: NoteBlock[]) => {
    if (!note) return;
    os.updateNoteBlocks(note.id, blocks);
  };

  const addTag = (tag: string) => {
    if (!note) return;
    const clean = tag.trim().replace(/^#/, "").toLowerCase();
    if (clean.length === 0 || note.tags.includes(clean)) return;
    os.updateNote(note.id, { tags: [...note.tags, clean] });
  };

  const removeTag = (tag: string) => {
    if (!note) return;
    os.updateNote(note.id, { tags: note.tags.filter((value) => value !== tag) });
    if (tagFilter === tag) setTagFilter(null);
  };

  const togglePin = () => {
    if (!note) return;
    os.pinNote(note.id, !note.pinned);
    toast(note.pinned ? "Note unpinned" : "Note pinned");
  };

  const archiveActive = () => {
    if (!note) return;
    const id = note.id;
    os.archiveNote(id);
    setActiveId(null);
    toast("Note archived", {
      action: { label: "Undo", onClick: () => os.restoreNote(id) },
    });
  };

  const deleteActive = () => {
    if (!note) return;
    const wasTrashed = note.status === "trashed";
    os.deleteNote(note.id);
    setActiveId(null);
    toast(wasTrashed ? "Note deleted permanently" : "Note moved to trash");
  };

  const runAssistant = (id: string) => {
    if (!note) return;
    if (id === "summarize") {
      const summary = os.aiSummarizeNote(note.id);
      setAnswer(
        summary
          ? `${summary.summary} (${summary.wordCount} words · ${summary.readingTimeMinutes} min read)`
          : "Add some text and I can summarise it.",
      );
      return;
    }
    if (id === "actions") {
      const next = actionItemBlocks(note.blocks);
      const converted = next.filter((block, index) => block.type !== note.blocks[index]?.type).length;
      os.updateNoteBlocks(note.id, next);
      toast(converted > 0 ? "Lists converted into action items" : "No lists found to convert");
      setAnswer(
        converted > 0
          ? `Converted ${converted} list${converted === 1 ? "" : "s"} into checkboxes you can tick off.`
          : "This note has no bulleted or numbered lists yet.",
      );
      return;
    }
    if (id === "improve") {
      os.updateNoteBlocks(note.id, tidyNoteBlocks(note.blocks));
      toast("Writing tidied");
      setAnswer("Tidied spacing, punctuation and sentence capitalisation.");
      return;
    }
    if (id === "tasks") {
      const created = os.convertNoteToTasks(note.id, now);
      toast(created.length > 0 ? `${created.length} tasks created` : "Nothing to convert");
      setAnswer(
        created.length > 0
          ? `Created ${created.length} task${created.length === 1 ? "" : "s"}: ${created.map((task) => task.title).join(", ")}.`
          : "There are no checklist or list items to convert into tasks.",
      );
      return;
    }
    if (id === "plan") {
      os.updateNoteBlocks(note.id, [...note.blocks, ...projectPlanBlocks()]);
      toast("Project plan added");
      setAnswer("Appended a project plan outline with planning steps.");
      return;
    }
    setAnswer(
      `This note has ${note.wordCount} words, ${note.blocks.length} blocks, ${note.tags.length} tags and ${note.checklist.done}/${note.checklist.total} checklist items done.`,
    );
  };

  const ask = (value: string) => {
    const text = value.trim().toLowerCase();
    if (!note || text.length === 0) {
      setAnswer(null);
      return;
    }
    if (text.includes("how long") || text.includes("reading")) {
      setAnswer(`About ${note.readingTimeMinutes} minute${note.readingTimeMinutes === 1 ? "" : "s"} to read (${note.wordCount} words).`);
      return;
    }
    if (text.includes("tag")) {
      setAnswer(note.tags.length > 0 ? `Tags: ${note.tags.map((tag) => `#${tag}`).join(", ")}.` : "This note has no tags yet.");
      return;
    }
    if (text.includes("checklist") || text.includes("progress")) {
      setAnswer(`${note.checklist.done} of ${note.checklist.total} checklist items are done.`);
      return;
    }
    if (text.includes("summar")) {
      const summary = os.aiSummarizeNote(note.id);
      setAnswer(summary ? summary.summary : "Add some text first.");
      return;
    }
    setAnswer(`"${note.title || "Untitled note"}" — ${note.wordCount} words, ${note.blocks.length} blocks, updated ${new Date(note.updatedAt).toLocaleDateString()}.`);
  };

  const capture = (kind: "note" | "task" | "event" | "idea" | "photo") => {
    const text = quickText.trim();
    if (kind === "task") {
      if (text.length === 0) {
        toast("Type something to add first");
        return;
      }
      os.addTask({ title: text });
      toast("Task added");
    } else if (kind === "event") {
      const startsAt = now + 3_600_000;
      os.addEvent({ title: text.length > 0 ? text : "New event", startsAt, endsAt: startsAt + 3_600_000 });
      toast("Event added");
    } else if (kind === "idea") {
      const created = os.addNote({ title: text.length > 0 ? text : "Idea", tags: ["ideas"], icon: "💡" });
      setActiveId(created.id);
      toast("Idea captured");
    } else if (kind === "photo") {
      photoInputRef.current?.click();
      return;
    } else {
      const created = os.addNote({ title: text.length > 0 ? text : "Quick note" });
      setActiveId(created.id);
      toast("Note captured");
    }
    setQuickText("");
  };

  const newFolder = (name: string) => {
    const preset = NOTE_FOLDER_PRESETS.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const folder = os.addFolder({ name, color: preset?.color ?? null });
    setFolderFilter(folder.id);
    toast(`Folder “${name}” created`);
  };

  const moveNote = (folderId: string, noteId: string) => {
    if (folderId === "all") {
      os.moveNoteToFolder(noteId, null);
      toast("Note moved to All Notes");
      return;
    }
    if (folderId === "archive") {
      os.archiveNote(noteId);
      toast("Note archived");
      return;
    }
    if (folderId === "trash") {
      os.deleteNote(noteId);
      toast("Note moved to trash");
      return;
    }
    os.moveNoteToFolder(noteId, folderId);
    const folder = workspace.folders.find((entry) => entry.id === folderId);
    toast(folder ? `Moved to ${folder.name}` : "Note moved");
  };

  const [folderDialog, setFolderDialog] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");

  const closeTagDialog = () => {
    setTagDialog(false);
    setTagValue("");
  };

  const submitTagValue = () => {
    const tag = tagValue.trim().replace(/^#/, "").toLowerCase();
    if (tag.length > 0) addTag(tag);
    closeTagDialog();
  };

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Notes"
        subtitle="Capture ideas, organize knowledge, and turn notes into action."
        actions={
          <>
            <Button variant="primary" onClick={createNote} data-testid="notes-add">
              <Plus className="size-4" aria-hidden="true" />
              New Note
            </Button>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Notes",
                  items: [
                    {
                      label: "Load sample notes",
                      onSelect: () => {
                        const ids = seedSampleNotes(os);
                        toast(`Added ${ids.length} sample notes — edit or delete them any time`);
                      },
                    },
                    { label: "New folder", onSelect: () => setFolderDialog(true) },
                    { label: "Show archive", onSelect: () => setFolderFilter("archive") },
                    { label: "Go to insights", onSelect: () => window.location.assign("/insights") },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Notes page options">
                  <span aria-hidden="true">&#8942;</span>
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[190px_320px_minmax(0,1fr)] 2xl:grid-cols-[200px_330px_minmax(0,1fr)_310px]">
        <aside className="min-w-0" aria-label="Folders and tags">
        <FoldersRail
          folders={workspace.folders}
          tags={workspace.tags}
          folderFilter={folderFilter}
          tagFilter={tagFilter}
          onSelectFolder={(id) => {
            setFolderFilter(id);
            setTagFilter(null);
          }}
          onSelectTag={setTagFilter}
          onNewFolder={() => setFolderDialog(true)}
          onTagActiveNote={() => setTagDialog(true)}
          onDropNote={moveNote}
        />
      </aside>

      <NoteList
        title={
          folderFilter === "all"
            ? tagFilter
              ? `#${tagFilter}`
              : "All Notes"
            : (workspace.folders.find((folder) => folder.id === folderFilter)?.name ?? "Notes")
        }
        rows={workspace.rows}
        activeId={activeId}
        sort={sort}
        view={view}
        query={query}
        pinnedOnly={pinnedOnly}
        onSortChange={setSort}
        onViewChange={setView}
        onQueryChange={setQuery}
        onTogglePinnedOnly={() => setPinnedOnly((value) => !value)}
        onOpen={openNote}
        onPin={(id) => {
          const target = os.getNote(id);
          if (target) os.pinNote(id, !target.pinned);
        }}
        onArchive={(id) => {
          os.archiveNote(id);
          if (activeId === id) setActiveId(null);
          toast("Note archived", {
            action: { label: "Undo", onClick: () => os.restoreNote(id) },
          });
        }}
        onRestore={(id) => {
          os.restoreNote(id);
          toast("Note restored");
        }}
        onDelete={(id) => {
          const wasTrashed = os.getNote(id)?.status === "trashed";
          os.deleteNote(id);
          if (activeId === id) setActiveId(null);
          toast(wasTrashed ? "Note deleted permanently" : "Note moved to trash");
        }}
        onCreate={createNote}
      />

      <div className="min-w-0">
        {note ? (
          <NoteEditor
            noteId={note.id}
            title={note.title}
            blocks={note.blocks}
            tags={note.tags}
            icon={note.icon}
            pinned={note.pinned}
            status={note.status}
            versions={note.versions}
            updatedAt={note.updatedAt}
            onTitleChange={(title) => os.updateNote(note.id, { title })}
            onBlocksChange={setBlocks}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onTogglePin={togglePin}
            onArchive={archiveActive}
            onRestore={() => {
              os.restoreNote(note.id);
              toast("Note restored");
            }}
            onRestoreVersion={(versionId) => {
              os.restoreNoteVersion(note.id, versionId);
              toast("Version restored", {
                action: {
                  label: "Undo",
                  onClick: () => os.restoreNoteVersion(note.id, note.versions[0]?.id ?? ""),
                },
              });
            }}
            onExportMarkdown={() => {
              exportNoteMarkdown(os.getNote(note.id)!);
              toast("Markdown exported");
            }}
            onExportPdf={() => {
              const opened = exportNotePdf(os.getNote(note.id)!);
              toast(opened ? "Opening print view" : "Allow pop-ups to export as PDF");
            }}
            onDelete={deleteActive}
          />
        ) : workspace.counts.all === 0 &&
          workspace.counts.archived === 0 &&
          workspace.counts.trashed === 0 ? (
          <EmptyState
            icon={FileText}
            title="No notes yet"
            description="Capture ideas, meeting notes and references — then turn them into action."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" onClick={createNote}>
                  Write a note
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const ids = seedSampleNotes(os);
                    toast(`Added ${ids.length} sample notes — edit or delete them any time`);
                  }}
                >
                  Load sample notes
                </Button>
              </div>
            }
          />
        ) : (
          <EmptyNotePlaceholder />
        )}
      </div>

      <aside className="space-y-4 xl:col-span-3 2xl:col-span-1" aria-label="Note tools">
        <NoteAssistant
          disabled={!note}
          answer={answer}
          onAction={runAssistant}
          onAsk={ask}
        />
        {note ? (
          <>
            <NoteDetails
              note={note}
              folders={workspace.folders}
              onMoveFolder={(folderId) => os.moveNoteToFolder(note.id, folderId)}
            />
            <NoteRelated items={note.related} tasks={note.tasks} />
            <NoteBacklinks rows={note.backlinks} onOpen={openNote} />
            <NoteReminders
              reminders={os.noteReminders(note.id)}
              onAdd={(at) => {
                os.addNoteReminder(note.id, at);
                toast("Reminder set");
              }}
              onRemove={(id) => {
                os.removeReminder(id);
                toast("Reminder removed");
              }}
              now={now}
            />
          </>
        ) : null}
        <QuickCapture text={quickText} onChange={setQuickText} onCapture={capture} />
      </aside>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Add a photo note"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 2_000_000) {
            toast("That image is over 2 MB — pick a smaller one");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const created = os.addNote({
              title:
                quickText.trim().length > 0
                  ? quickText.trim()
                  : file.name.replace(/\.[^.]+$/, "") || "Photo note",
              icon: "🖼️",
              blocks: [{ id: `img-${Date.now()}`, type: "image", content: String(reader.result) }],
            });
            setActiveId(created.id);
            setQuickText("");
            toast("Photo note added");
          };
          reader.readAsDataURL(file);
        }}
      />

      {folderDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label="New folder">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-pop">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">New folder</h2>
              <button
                type="button"
                onClick={() => setFolderDialog(false)}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              aria-label="Folder name"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NOTE_FOLDER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setFolderName(preset.name)}
                  className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFolderDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (folderName.trim().length === 0) return;
                  newFolder(folderName.trim());
                  setFolderName("");
                  setFolderDialog(false);
                }}
              >
                Create folder
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tagDialog && note ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label="Add tag">
          <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4 shadow-pop">
            <h2 className="mb-3 text-sm font-semibold text-ink">Add tag</h2>
            <Input
              value={tagValue}
              onChange={(event) => setTagValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                submitTagValue();
              }}
              placeholder="e.g. nextjs"
              aria-label="New tag"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeTagDialog}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={submitTagValue}>
                Add tag
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}