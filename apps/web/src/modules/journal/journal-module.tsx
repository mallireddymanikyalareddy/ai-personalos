"use client";

import * as React from "react";

import {
  Download,
  Feather,
  Flame,
  Images,
  LineChart,
  List,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import {
  journalDateKey,
  journalEntryTitle,
  journalMoodById,
  journalPreview,
  journalStreakSummary,
  journalTemplateSection,
  type ID,
  type JournalEntry,
  type JournalTemplate,
} from "@personalos/core";
import type { Timestamp } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";
import { downloadText } from "@/modules/notebook/notebook-export";

import { JournalGallery, MAX_FILE_BYTES } from "./journal-gallery";
import { JournalInsights } from "./journal-insights";
import { JournalTimeline } from "./journal-timeline";
import { JournalWorkspace } from "./journal-workspace";

type Tab = "journal" | "timeline" | "insights" | "gallery" | "trash";

const TABS: Array<{ value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "journal", label: "Journal", icon: Feather },
  { value: "timeline", label: "Timeline", icon: List },
  { value: "insights", label: "Insights", icon: LineChart },
  { value: "gallery", label: "Gallery", icon: Images },
  { value: "trash", label: "Trash", icon: Trash2 },
];

const PAGE_SIZE = 12;

function startOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function JournalModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("journal");
  const [selectedDate, setSelectedDate] = React.useState<Timestamp>(() => startOfDay(Date.now()));
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [saveState, setSaveState] = React.useState<"saved" | "saving" | "error">("saved");
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [confirmTrashId, setConfirmTrashId] = React.useState<string | null>(null);

  const entry = os.journalEntryFor(selectedDate);
  const allEntries = React.useMemo(
    () =>
      Object.values(state.journalEntries)
        .filter((candidate) => candidate.status !== "trashed")
        .sort((a, b) => b.entryDate - a.entryDate),
    [state.journalEntries],
  );

  const results =
    query.trim().length > 0 ? os.searchJournal({ query }).map((result) => result.entry) : [];

  const listed = query.trim().length > 0 ? results.slice(0, visible) : allEntries.slice(0, visible);
  const streak = os.journalStreak(Date.now());
  const attachments = entry ? os.journalAttachments(entry.id) : [];
  const templates = os.journalTemplates();
  const trashedEntries = React.useMemo(
    () =>
      Object.values(state.journalEntries)
        .filter((candidate) => candidate.status === "trashed")
        .sort((a, b) => (b.trashedAt ?? b.updatedAt) - (a.trashedAt ?? a.updatedAt)),
    [state],
  );
  const allAttachments = React.useMemo(
    () =>
      Object.values(state.attachments).filter(
        (attachment) => attachment.ownerType === "journal_entry",
      ),
    [state],
  );

  React.useEffect(() => {
    os.seedJournalTemplates();
  }, [os]);

  React.useEffect(() => {
    setSaveState("saved");
  }, [entry?.id]);

  const patch = (next: Partial<JournalEntry>) => {
    if (!entry) return;
    setSaveState("saving");
    try {
      os.updateJournalEntry(entry.id, next);
      if (next.body !== undefined || next.title !== undefined) {
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
      toast("Could not save — your text is still here");
    }
  };

  const applyTemplate = (template: JournalTemplate) => {
    const target = os.openJournalFor(selectedDate);
    const prompts = template.sections
      .map((section) => `## ${section.label}\n${section.prompt}`)
      .join("\n\n");
    os.updateJournalEntry(target.id, {
      body: target.body.trim().length > 0 ? `${target.body.trim()}\n\n${prompts}` : prompts,
      templateId: template.id,
    });
    os.updateJournalTemplate(template.id, { usageCount: template.usageCount + 1 });
    setTemplateOpen(false);
    toast(`Started from the ${template.name} template`);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !entry) return;
    const targetEntry = entry;
    const accepted = Array.from(files).filter((file) => {
      if (file.size > MAX_FILE_BYTES) {
        toast(`${file.name} is too large to attach`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    const createdIds: ID[] = [];
    let remaining = accepted.length;
    const finish = () => {
      if (remaining > 0) return;
      const current = os.getJournalEntry(targetEntry.id) ?? targetEntry;
      const existing = new Set(current.attachmentIds);
      const ids = createdIds.filter((id) => !existing.has(id));
      if (ids.length > 0) {
        os.updateJournalEntry(targetEntry.id, {
          attachmentIds: [...current.attachmentIds, ...ids],
        });
      }
      toast(`${createdIds.length} attachment${createdIds.length === 1 ? "" : "s"} added`);
    };

    for (const file of accepted) {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment = os.addAttachment({
          ownerType: "journal_entry",
          ownerId: targetEntry.id,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          source: "upload",
          url: String(reader.result),
        });
        createdIds.push(attachment.id);
        remaining -= 1;
        finish();
      };
      reader.onerror = () => {
        remaining -= 1;
        finish();
      };
      reader.readAsDataURL(file);
    }
  };

  const trashEntry = (id: ID) => {
    os.deleteJournalEntry(id);
    toast("Entry moved to trash", {
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => os.restoreJournalEntry(id),
      },
    });
  };

  const restoreTrashed = (id: ID) => {
    os.restoreJournalEntry(id);
    setConfirmTrashId(null);
    toast("Entry restored");
  };

  const deleteTrashed = (id: ID) => {
    if (confirmTrashId !== id) {
      setConfirmTrashId(id);
      return;
    }
    os.deleteJournalEntry(id);
    setConfirmTrashId(null);
    toast("Entry deleted forever");
  };

  const emptyTrash = () => {
    const count = os.emptyJournalTrash();
    setConfirmTrashId(null);
    toast(
      count > 0
        ? `Deleted ${count} entr${count === 1 ? "y" : "ies"} forever`
        : "Trash is already empty",
    );
  };

  const exportJournal = () => {
    const targetEntries = tab === "trash" ? trashedEntries : entry ? [entry] : allEntries;
    const lines = ["# Journal", "", `Exported ${new Date().toLocaleString()}`, ""];
    for (const item of targetEntries) {
      lines.push(`## ${journalEntryTitle(item)} — ${journalDateKey(item.entryDate)}`);
      if (item.mood) {
        lines.push(`- Mood: ${journalMoodById(item.mood)?.label ?? item.mood}`);
      }
      if (item.energy != null) lines.push(`- Energy: ${item.energy}/10`);
      if (item.productivity != null) lines.push(`- Productivity: ${item.productivity}/10`);
      if (item.tags.length > 0) lines.push(`- Tags: ${item.tags.join(", ")}`);
      if (item.people.length > 0) {
        lines.push(`- People: ${item.people.map((person) => person.name).join(", ")}`);
      }
      if (item.body.trim()) lines.push("", item.body.trim());
      if (item.highlights.length > 0) {
        lines.push("", "### Highlights", ...item.highlights.map((value) => `- ${value}`));
      }
      if (item.challenges.length > 0) {
        lines.push("", "### Challenges", ...item.challenges.map((value) => `- ${value}`));
      }
      if (item.gratitude.length > 0) {
        lines.push("", "### Gratitude", ...item.gratitude.map((value) => `- ${value}`));
      }
      if (item.lessons.trim()) lines.push("", "### Lessons", item.lessons.trim());
      if (item.improvements.trim()) {
        lines.push("", "### Improvements", item.improvements.trim());
      }
      if (item.tomorrow.priorities.length > 0 || item.tomorrow.reminders.length > 0) {
        lines.push("", "### Tomorrow");
        for (const priority of item.tomorrow.priorities) lines.push(`- Priority: ${priority}`);
        for (const reminder of item.tomorrow.reminders) lines.push(`- Remember: ${reminder}`);
        if (item.tomorrow.intentions.trim()) lines.push(`- Intention: ${item.tomorrow.intentions}`);
      }
      lines.push("");
    }
    downloadText(`journal-${journalDateKey(Date.now())}.md`, lines.join("\n"));
    toast("Journal exported", { tone: "success" });
  };

  const saveAsTemplate = () => {
    if (!entry) {
      toast("Open an entry first");
      return;
    }
    const name = window.prompt("Template name", `Template ${new Date().toLocaleDateString()}`);
    if (!name?.trim()) return;
    const sections = [];
    if (entry.body.trim()) {
      sections.push(
        journalTemplateSection("body", "Entry body", entry.body.trim().slice(0, 200), "body"),
      );
    }
    if (entry.highlights.length > 0) {
      sections.push(
        journalTemplateSection("highlights", "Highlights", "What went well?", "highlights"),
      );
    }
    if (entry.challenges.length > 0) {
      sections.push(
        journalTemplateSection("challenges", "Challenges", "What was difficult?", "challenges"),
      );
    }
    if (entry.gratitude.length > 0) {
      sections.push(
        journalTemplateSection("gratitude", "Gratitude", "What are you grateful for?", "gratitude"),
      );
    }
    if (entry.lessons.trim()) {
      sections.push(
        journalTemplateSection("lessons", "Lessons", entry.lessons.trim().slice(0, 200), "lessons"),
      );
    }
    if (entry.improvements.trim()) {
      sections.push(
        journalTemplateSection(
          "improvements",
          "Improvements",
          entry.improvements.trim().slice(0, 200),
          "improvements",
        ),
      );
    }
    if (entry.tomorrow.intentions.trim() || entry.tomorrow.priorities.length > 0) {
      sections.push(
        journalTemplateSection("tomorrow", "Tomorrow", "What matters tomorrow?", "tomorrow"),
      );
    }
    if (sections.length === 0) {
      toast("Write something first");
      return;
    }
    os.addJournalTemplate({
      name: name.trim(),
      description: "Saved from a journal entry",
      sections,
    });
    setTemplateOpen(false);
    toast("Template saved", { tone: "success" });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <PageHeader
          icon={Feather}
          title="Journal"
          subtitle="Capture your thoughts, reflect on your experiences and create a better life."
          actions={
            <>
              <label className="sr-only" htmlFor="journal-search">
                Search journal
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-3" aria-hidden />
                <input
                  id="journal-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisible(PAGE_SIZE);
                  }}
                  placeholder="Search journal"
                  className="h-9 w-56 rounded-lg border border-line bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
              <label className="sr-only" htmlFor="journal-date">
                Choose a date
              </label>
              <input
                id="journal-date"
                type="date"
                value={journalDateKey(selectedDate)}
                onChange={(event) => {
                  const [year, month, day] = event.target.value.split("-").map(Number);
                  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
                    setSelectedDate(new Date(year, month - 1, day).getTime());
                  }
                }}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedDate(startOfDay(Date.now()));
                  setTab("journal");
                  os.openJournalFor(startOfDay(Date.now()));
                }}
              >
                <Plus className="size-4" aria-hidden />
                New Entry
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={exportJournal}
                data-testid="journal-export"
              >
                <Download className="size-4" aria-hidden />
                Export
              </Button>
              <div className="relative">
                <Button size="sm" variant="ghost" aria-label="More options" onClick={() => setTemplateOpen((open) => !open)}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
                {templateOpen ? (
                  <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-line bg-surface p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs text-ink-3">Start from a template</p>
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                      >
                        {template.name}
                        <span className="block text-xs text-ink-3">{template.description}</span>
                      </button>
                    ))}
                    {templates.length === 0 ? <p className="px-2 py-1 text-xs text-ink-3">No templates yet.</p> : null}
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      onClick={saveAsTemplate}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      Save current entry as template
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={TABS.map((item) => ({ value: item.value, label: item.label }))}
            value={tab}
            onChange={setTab}
            label="Journal view"
          />
          <div className="flex items-center gap-2">
            {streak.current > 0 ? (
              <Badge tone="warning">
                <Flame className="size-3" aria-hidden />
                {journalStreakSummary(streak)}
              </Badge>
            ) : null}
            <Badge tone="outline">
              {streak.totalEntries} entr{streak.totalEntries === 1 ? "y" : "ies"}
            </Badge>
          </div>
        </div>
      </div>

      {query.trim().length > 0 ? (
        <Alert tone="info" title={`${results.length} matching entries`}>
          Search covers words, tags, people, places, activities, dates, and months.
        </Alert>
      ) : null}

      {tab === "journal" ? (
        <JournalWorkspace
          os={os}
          entry={entry}
          entries={listed}
          selectedDate={selectedDate}
          saveState={saveState}
          attachments={attachments}
          onSelectDate={setSelectedDate}
          onPatch={patch}
          onSaveState={setSaveState}
          onAddFiles={handleFiles}
          onShowAll={() => setTab("timeline")}
          onTrash={() => {
            if (entry) trashEntry(entry.id);
          }}
        />
      ) : null}

      {tab === "timeline" ? (
        <JournalTimeline
          os={os}
          entries={listed}
          onSelect={(entryId) => {
            const target = os.getJournalEntry(entryId);
            if (!target) return;
            setSelectedDate(target.entryDate);
            setTab("journal");
          }}
          hasMore={listed.length < (query.trim().length > 0 ? results.length : allEntries.length)}
          onLoadMore={() => setVisible((current) => current + PAGE_SIZE)}
          query={query}
        />
      ) : null}

      {tab === "insights" ? <JournalInsights os={os} now={Date.now()} /> : null}

      {tab === "gallery" ? (
        <div className="space-y-4">
          {allAttachments.length === 0 ? (
            <EmptyState
              icon={Images}
              title="No photos yet"
              description="Attach photos to any entry and they will collect here."
            />
          ) : (
            <JournalGallery
              os={os}
              entryId={entry?.id ?? null}
              attachments={allAttachments}
              onAdd={handleFiles}
            />
          )}
        </div>
      ) : null}

      {tab === "trash" ? (
        <div className="space-y-3" data-testid="journal-trash">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-3">
              {trashedEntries.length} entr{trashedEntries.length === 1 ? "y" : "ies"} in trash
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={emptyTrash}
              disabled={trashedEntries.length === 0}
              data-testid="journal-empty-trash"
            >
              <Trash2 className="size-4" aria-hidden />
              Empty trash
            </Button>
          </div>
          {trashedEntries.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="Trash is empty"
              description="Deleted entries stay here until you delete them forever."
            />
          ) : (
            <ul className="space-y-2">
              {trashedEntries.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {journalEntryTitle(item)}
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      {new Date(item.entryDate).toLocaleDateString()} · {item.wordCount} words
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => restoreTrashed(item.id)}>
                    <RotateCcw className="size-3.5" aria-hidden />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    data-testid="journal-delete-forever"
                    onClick={() => deleteTrashed(item.id)}
                  >
                    {confirmTrashId === item.id ? "Confirm delete" : "Delete forever"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function JournalModulePreview({ entry }: { entry: JournalEntry }) {
  const mood = journalMoodById(entry.mood);
  return (
    <div className="text-sm">
      <p className="font-medium">{journalEntryTitle(entry)}</p>
      <p className="text-ink-3">
        {mood ? (
          <>
            <span aria-hidden>{mood.emoji} </span>
            {mood.label}
          </>
        ) : (
          "No mood recorded"
        )}
      </p>
      <p className="mt-1 text-ink-3">{journalPreview(entry, 120)}</p>
    </div>
  );
}
