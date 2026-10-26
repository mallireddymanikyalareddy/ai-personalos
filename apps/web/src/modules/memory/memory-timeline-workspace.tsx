"use client";

import * as React from "react";

import { Plus, Search } from "lucide-react";

import { useFocusNow } from "@/modules/focus/use-focus-now";

import {
  MEMORY_CATEGORY_LABELS,
  type MemoryAnswer,
  type MemoryCategory,
  type MemoryMoment,
  type MemoryQuickFilter,
} from "@personalos/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

import {
  MemoryCategoryBar,
  MemoryFilterRail,
  MemoryGlanceCard,
  MemoryQuestionBox,
  MemoryQuickActions,
  MemoryTimeline,
} from "./memory-workspace";
import { MemoryMomentDialog, type MemoryMomentDialogSeed } from "./memory-moment-dialog";

function buildSeedTitle(kind: string): string {
  const stamp = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  switch (kind) {
    case "Add Photo":
      return `Photo memory ${stamp}`;
    case "Add Place":
      return `Visit ${stamp}`;
    case "Add People":
      return `Time with someone ${stamp}`;
    case "Add Activity":
      return `Workout ${stamp}`;
    case "Add Food":
      return `Meal ${stamp}`;
    case "Add Book":
      return `Book ${stamp}`;
    case "Add Idea":
      return `Milestone ${stamp}`;
    default:
      return `Memory ${stamp}`;
  }
}

function seedCategory(kind: string): MemoryCategory {
  switch (kind) {
    case "Add Place":
      return "travel";
    case "Add People":
      return "people";
    case "Add Activity":
      return "activities";
    case "Add Food":
      return "food";
    case "Add Book":
      return "learning";
    case "Add Idea":
      return "milestones";
    default:
      return "other";
  }
}

export function MemoryTimelineWorkspace() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const now = useFocusNow(60_000);

  const [category, setCategory] = React.useState<MemoryCategory | null>(null);
  const [quick, setQuick] = React.useState<MemoryQuickFilter>("all");
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState<MemoryAnswer | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MemoryMoment | null>(null);
  const [seed, setSeed] = React.useState<MemoryMomentDialogSeed | undefined>(undefined);
  const [confirmTrashId, setConfirmTrashId] = React.useState<string | null>(null);

  const categoryCounts = os.memoryCategoryCounts();
  const quickCounts = os.memoryQuickFilterCounts(now);
  const moments = os.memoryMoments({ category, quick, query, now });
  const glance = os.memoryGlance(now);
  const places = os.memoryPlaces(8);
  const recurring = os.memoryRecurring(5);

  const photoUrls = React.useCallback(
    (moment: MemoryMoment) =>
      moment.attachmentIds
        .map((id) => state.attachments[id]?.url)
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    [state.attachments],
  );

  const ask = (question: string) => setAnswer(os.memoryAsk(question, now));

  const openNew = (next?: MemoryMomentDialogSeed) => {
    setSeed(next);
    setDialogOpen(true);
  };

  const openEdit = (moment: MemoryMoment) => {
    setSeed(undefined);
    setEditing(moment);
    setDialogOpen(true);
  };

  const quickAdd = (kind: string) => openNew({ title: buildSeedTitle(kind), category: seedCategory(kind) });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-3">
        <MemoryCategoryBar
          counts={categoryCounts}
          active={category}
          onSelect={setCategory}
        />

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your memories"
            aria-label="Search your memories"
            className="pl-9"
          />
        </div>

        <MemoryQuestionBox onAsk={ask} answer={answer} />

        <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <MemoryFilterRail
            quickCounts={quickCounts}
            categoryCounts={categoryCounts}
            quick={quick}
            onQuick={setQuick}
            category={category}
            onCategory={setCategory}
          />
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Recent memories</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-ink-3">{moments.length}</span>
                <Button variant="secondary" size="sm" onClick={() => openNew()}>
                  <Plus className="size-4" />
                  New memory
                </Button>
              </div>
            </div>
            {quick === "trash" ? (
              <ul className="space-y-2" data-testid="memory-trash">
                {moments.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-3">
                    Trash is empty.
                  </li>
                ) : (
                  moments.map((moment) => (
                    <li
                      key={moment.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{moment.title}</span>
                        <span className="block text-[11px] text-ink-3">
                          {new Date(moment.happenedAt).toLocaleDateString()} ·{" "}
                          {MEMORY_CATEGORY_LABELS[moment.category]}
                        </span>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          os.restoreMemoryMoment(moment.id);
                          toast("Memory restored");
                        }}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        data-testid="memory-delete-forever"
                        onClick={() => {
                          if (confirmTrashId !== moment.id) {
                            setConfirmTrashId(moment.id);
                            return;
                          }
                          for (const attachmentId of moment.attachmentIds) {
                            os.deleteAttachment(attachmentId);
                          }
                          os.deleteMemoryMoment(moment.id);
                          setConfirmTrashId(null);
                          toast("Memory deleted forever");
                        }}
                      >
                        {confirmTrashId === moment.id ? "Confirm delete" : "Delete forever"}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <MemoryTimeline
                moments={moments}
                now={now}
                photoUrls={photoUrls}
                onEdit={openEdit}
                onToggleFavorite={(moment) => os.toggleMemoryMomentFavorite(moment.id)}
                onDelete={(moment) => {
                  os.deleteMemoryMoment(moment.id);
                  toast("Memory moved to trash", {
                    tone: "success",
                    action: {
                      label: "Undo",
                      onClick: () => os.restoreMemoryMoment(moment.id),
                    },
                  });
                }}
              />
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-3" aria-label="Memory insights">
        <MemoryGlanceCard glance={glance} places={places} recurring={recurring} now={now} />
        <MemoryQuickActions onAction={quickAdd} />
      </aside>

      <MemoryMomentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setSeed(undefined);
        }}
        editing={editing}
        seed={seed}
      />
    </div>
  );
}