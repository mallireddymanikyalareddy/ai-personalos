"use client";

import * as React from "react";

import {
  BookOpen,
  Briefcase,
  Camera,
  Coins,
  Dumbbell,
  Flag,
  Heart,
  Lightbulb,
  MapPin,
  MoreVertical,
  Pencil,
  Plane,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  GraduationCap,
  HeartPulse,
} from "lucide-react";

import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  MEMORY_SUGGESTED_QUESTIONS,
  memoryRelative,
  type MemoryAnswer,
  type MemoryCategory,
  type MemoryMoment,
  type MemoryPlaceVisit,
  type MemoryQuickFilter,
  type MemoryRecurring,
} from "@personalos/core";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const MAX_STRIP = 4;

const CATEGORY_BADGE_LABEL: Record<MemoryCategory, string> = {
  travel: "Travel",
  food: "Food",
  family: "Family",
  friends: "Friends",
  work: "Work",
  health: "Health",
  learning: "Learning",
  finance: "Finance",
  activities: "Sports",
  places: "Places",
  people: "People",
  milestones: "Milestones",
  other: "Other",
};

const CATEGORY_BADGE_TONE: Record<MemoryCategory, BadgeTone> = {
  travel: "accent",
  food: "warning",
  family: "accent",
  friends: "accent",
  work: "neutral",
  health: "success",
  learning: "accent",
  finance: "neutral",
  activities: "success",
  places: "neutral",
  people: "accent",
  milestones: "danger",
  other: "neutral",
};

const CATEGORY_COVER_TONE: Record<MemoryCategory, string> = {
  travel: "bg-accent-soft",
  food: "bg-warning-soft",
  family: "bg-accent-soft",
  friends: "bg-accent-soft",
  work: "bg-surface-2",
  health: "bg-success-soft",
  learning: "bg-accent-soft",
  finance: "bg-surface-2",
  activities: "bg-success-soft",
  places: "bg-surface-2",
  people: "bg-accent-soft",
  milestones: "bg-danger-soft",
  other: "bg-surface-2",
};

function formatMomentDate(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(at));
}

export const MEMORY_CATEGORY_ICON: Record<MemoryCategory, React.ComponentType<{ className?: string }>> = {
  travel: Plane,
  food: Utensils,
  family: Users,
  friends: Users,
  work: Briefcase,
  health: HeartPulse,
  learning: GraduationCap,
  finance: Coins,
  activities: Dumbbell,
  places: MapPin,
  people: Users,
  milestones: Flag,
  other: Sparkles,
};

export const QUICK_FILTERS: Array<{ value: MemoryQuickFilter; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "recent", label: "Recent", icon: Search },
  { value: "favorites", label: "Favourites", icon: Heart },
  { value: "with_photos", label: "With Photos", icon: Camera },
  { value: "this_year", label: "This Year", icon: CalendarIcon },
  { value: "last_year", label: "Last Year", icon: CalendarIcon },
  { value: "trash", label: "Trash", icon: Trash2 },
];

function CalendarIcon({ className }: { className?: string }) {
  return <Flag className={className} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Category bar                                                        */
/* ------------------------------------------------------------------ */

export function MemoryCategoryBar({
  counts,
  active,
  onSelect,
}: {
  counts: Array<{ category: MemoryCategory; count: number }>;
  active: MemoryCategory | null;
  onSelect: (category: MemoryCategory | null) => void;
}) {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section aria-label="Memory categories" data-testid="memory-categories">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        <CategoryTile
          label="All Memories"
          count={total}
          icon={Sparkles}
          active={active === null}
          onClick={() => onSelect(null)}
        />
        {MEMORY_CATEGORIES.filter((category) => {
          const entry = counts.find((item) => item.category === category);
          return (entry?.count ?? 0) > 0;
        }).map((category) => {
          const Icon = MEMORY_CATEGORY_ICON[category];
          return (
            <CategoryTile
              key={category}
              label={MEMORY_CATEGORY_LABELS[category]}
              count={counts.find((item) => item.category === category)?.count ?? 0}
              icon={Icon}
              active={active === category}
              onClick={() => onSelect(active === category ? null : category)}
            />
          );
        })}
      </div>
    </section>
  );
}

function CategoryTile({
  label,
  count,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
        active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <Icon className={cn("size-4", active ? "text-accent-ink" : "text-ink-3")} aria-hidden="true" />
      <span className="text-[11px] font-medium leading-tight text-ink">{label}</span>
      <span className="text-[10px] tabular-nums text-ink-3">{count}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export function MemoryQuestionBox({
  onAsk,
  answer,
}: {
  onAsk: (question: string) => void;
  answer: MemoryAnswer | null;
}) {
  const [value, setValue] = React.useState("");

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (trimmed.length === 0) return;
    onAsk(trimmed);
    setValue("");
  };

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Questions"
      data-testid="memory-questions"
    >
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask your life questions"
            aria-label="Ask your life questions"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="primary" size="md" aria-label="Ask">
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {MEMORY_SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => submit(question)}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
          >
            {question}
          </button>
        ))}
      </div>

      {answer ? (
        <div
          role="status"
          data-testid="memory-answer"
          className={cn(
            "mt-2 rounded-lg p-2.5 text-sm",
            answer.matched ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2",
          )}
        >
          {answer.answer}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Filters + types sidebar                                             */
/* ------------------------------------------------------------------ */

export function MemoryFilterRail({
  quickCounts,
  categoryCounts,
  quick,
  onQuick,
  category,
  onCategory,
}: {
  quickCounts: Record<MemoryQuickFilter, number>;
  categoryCounts: Array<{ category: MemoryCategory; count: number }>;
  quick: MemoryQuickFilter;
  onQuick: (value: MemoryQuickFilter) => void;
  category: MemoryCategory | null;
  onCategory: (value: MemoryCategory | null) => void;
}) {
  const populated = categoryCounts.filter((entry) => entry.count > 0);

  return (
    <div className="space-y-4" data-testid="memory-filters">
      <section aria-label="Quick filters">
        <h2 className="mb-1.5 text-sm font-semibold text-ink">Quick filters</h2>
        <ul className="space-y-0.5">
          {QUICK_FILTERS.map((filter) => {
            const Icon = filter.icon;
            const count = quickCounts[filter.value];
            return (
              <li key={filter.value}>
                <button
                  type="button"
                  onClick={() => onQuick(filter.value)}
                  aria-pressed={quick === filter.value}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                    quick === filter.value
                      ? "bg-accent-soft font-medium text-accent-ink"
                      : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{filter.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {populated.length > 0 ? (
        <section aria-label="Memory types">
          <h2 className="mb-1.5 text-sm font-semibold text-ink">Memory types</h2>
          <ul className="space-y-0.5">
            {populated.map((entry) => {
              const Icon = MEMORY_CATEGORY_ICON[entry.category];
              return (
                <li key={entry.category}>
                  <button
                    type="button"
                    onClick={() => onCategory(category === entry.category ? null : entry.category)}
                    aria-pressed={category === entry.category}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      category === entry.category
                        ? "bg-accent-soft font-medium text-accent-ink"
                        : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {MEMORY_CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-3">{entry.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export function MemoryTimeline({
  moments,
  now,
  photoUrls,
  onEdit,
  onToggleFavorite,
  onDelete,
}: {
  moments: MemoryMoment[];
  now: number;
  photoUrls: (moment: MemoryMoment) => string[];
  onEdit?: (moment: MemoryMoment) => void;
  onToggleFavorite: (moment: MemoryMoment) => void;
  onDelete: (moment: MemoryMoment) => void;
}) {
  if (moments.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-line p-10 text-center"
        data-testid="memory-timeline-empty"
      >
        <p className="text-sm font-medium text-ink">No memories match</p>
        <p className="mt-1 text-sm text-ink-3">
          Try a different filter, or add a memory from Quick actions.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2.5" data-testid="memory-timeline">
      {moments.map((moment) => {
        const Icon = MEMORY_CATEGORY_ICON[moment.category];
        const photos = photoUrls(moment);
        const [cover, ...strip] = photos;
        const overflow = Math.max(0, strip.length - MAX_STRIP);
        return (
          <li key={moment.id} className="flex gap-3" data-testid={`memory-moment-${moment.id}`}>
            <div className="flex w-11 shrink-0 flex-col items-center pt-2 text-center">
              <span className="text-[10px] uppercase leading-tight text-ink-3">
                {new Date(moment.happenedAt).toLocaleDateString(undefined, { month: "short" })}
              </span>
              <span className="text-base font-semibold leading-tight tabular-nums text-ink">
                {new Date(moment.happenedAt).getDate()}
              </span>
              <span className="text-[10px] leading-tight text-ink-3">
                {new Date(moment.happenedAt).getFullYear()}
              </span>
            </div>

            <article className="flex min-w-0 flex-1 gap-3 rounded-xl border border-line bg-surface p-2.5">
              <div className="hidden shrink-0 sm:block">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="size-[6.5rem] rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className={cn(
                      "grid size-[6.5rem] place-items-center rounded-lg",
                      CATEGORY_COVER_TONE[moment.category],
                    )}
                  >
                    <Icon className="size-6 opacity-70" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <Badge tone={CATEGORY_BADGE_TONE[moment.category]}>{CATEGORY_BADGE_LABEL[moment.category]}</Badge>
                    {moment.favorite ? (
                      <Heart className="size-3.5 shrink-0 fill-accent text-accent" aria-label="Favourite" />
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <time
                      dateTime={new Date(moment.happenedAt).toISOString()}
                      className="hidden whitespace-nowrap text-[11px] text-ink-3 sm:inline"
                    >
                      {formatMomentDate(moment.happenedAt)}
                    </time>
                    <DropdownMenu
                      align="end"
                      sections={[
                        {
                          items: [
                            {
                              label: moment.favorite ? "Remove from favourites" : "Add to favourites",
                              icon: <Heart className="size-3.5" />,
                              onSelect: () => onToggleFavorite(moment),
                            },
                            ...(onEdit
                              ? [
                                  {
                                    label: "Edit memory",
                                    icon: <Pencil className="size-3.5" />,
                                    onSelect: () => onEdit(moment),
                                  },
                                ]
                              : []),
                          ],
                        },
                        {
                          items: [
                            {
                              label: "Move to trash",
                              icon: <Trash2 className="size-3.5" />,
                              danger: true,
                              onSelect: () => onDelete(moment),
                            },
                          ],
                          separatorBefore: true,
                        },
                      ]}
                      trigger={
                        <button
                          type="button"
                          aria-label={`Actions for ${moment.title}`}
                          className="rounded-md p-0.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          <MoreVertical className="size-4" aria-hidden="true" />
                        </button>
                      }
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold leading-snug text-ink">{moment.title}</h3>

                {moment.place ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-3">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{moment.place.name}</span>
                  </p>
                ) : null}

                {moment.description ? (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                    {moment.description}
                  </p>
                ) : null}

                {strip.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {strip.slice(0, MAX_STRIP).map((url, index) => (
                      <img
                        key={`${moment.id}-photo-${index}`}
                        src={url}
                        alt=""
                        loading="lazy"
                        className="h-11 w-16 rounded-md object-cover"
                      />
                    ))}
                    {overflow > 0 ? (
                      <span className="grid h-11 w-16 place-items-center rounded-md bg-surface-2 text-[11px] font-medium text-ink-3">
                        +{overflow}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-1.5 text-[11px] text-ink-3 sm:hidden">{memoryRelative(moment.happenedAt, now)}</p>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Right rail                                                          */
/* ------------------------------------------------------------------ */

export function MemoryGlanceCard({
  glance,
  places,
  recurring,
  now,
}: {
  glance: { trips: number; newPeople: number; newFoods: number; booksRead: number };
  places: MemoryPlaceVisit[];
  recurring: MemoryRecurring[];
  now: number;
}) {
  return (
    <div className="space-y-3" data-testid="memory-right-rail">
      <section className="rounded-xl border border-line bg-surface p-3" data-testid="memory-glance">
        <h2 className="mb-2 text-sm font-semibold text-ink">Life at a glance</h2>
        <div className="grid grid-cols-2 gap-2">
          <GlanceTile icon={Plane} label="Trips" value={glance.trips} />
          <GlanceTile icon={Users} label="New people" value={glance.newPeople} />
          <GlanceTile icon={Utensils} label="New foods" value={glance.newFoods} />
          <GlanceTile icon={BookOpen} label="Books read" value={glance.booksRead} />
        </div>
      </section>

      <MemoryMap places={places} now={now} />
      <MemoryRecurringCard recurring={recurring} now={now} />
    </div>
  );
}

function GlanceTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-2 text-center">
      <Icon className="mx-auto size-3.5 text-accent" aria-hidden="true" />
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

export function MemoryMap({ places, now }: { places: MemoryPlaceVisit[]; now: number }) {
  const located = places.filter((place) => place.latitude != null && place.longitude != null);

  const toXY = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  });

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Map view"
      data-testid="memory-map"
    >
      <h2 className="mb-2 text-sm font-semibold text-ink">Map view</h2>

      {places.length === 0 ? (
        <p className="text-xs text-ink-3">No places recorded yet. Add a place to a memory to see it here.</p>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-lg border border-line bg-info-soft"
            style={{ aspectRatio: "2 / 1" }}
          >
            <svg viewBox="0 0 100 50" className="absolute inset-0 size-full" aria-hidden="true">
              <rect width="100" height="50" className="fill-[var(--info-soft)]" />
              <path
                d="M0 22 Q 12 16 24 22 T 48 20 T 72 24 T 100 18 L100 0 L0 0 Z"
                className="fill-[var(--surface)] opacity-70"
              />
              <path
                d="M0 34 Q 16 30 30 36 T 60 32 T 100 38 L100 50 L0 50 Z"
                className="fill-[var(--surface)] opacity-70"
              />
            </svg>

            {located.map((place) => {
              const point = toXY(place.latitude!, place.longitude!);
              return (
                <span
                  key={place.name}
                  data-testid={`memory-map-pin-${place.name}`}
                  title={`${place.name} · ${place.count} visit${place.count === 1 ? "" : "s"}`}
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-full rounded-full bg-accent ring-2 ring-white"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                />
              );
            })}

            {located.length === 0 ? (
              <p className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] text-ink-3">
                Add coordinates to a place to plot it on the map.
              </p>
            ) : null}
          </div>

          <ul className="mt-2 space-y-1">
            {places.slice(0, 5).map((place) => (
              <li key={place.name} className="flex items-center gap-1.5 text-xs">
                <MapPin className="size-3 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink-2">{place.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">
                  {place.count} · {memoryRelative(place.lastAt, now)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function MemoryRecurringCard({
  recurring,
  now,
}: {
  recurring: MemoryRecurring[];
  now: number;
}) {
  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Recurring activity tracker"
      data-testid="memory-recurring"
    >
      <h2 className="mb-2 text-sm font-semibold text-ink">Recurring activity</h2>
      {recurring.length === 0 ? (
        <p className="text-xs text-ink-3">
          Nothing repeats yet. Log the same activity twice and it will show up here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {recurring.map((entry) => {
            const Icon = MEMORY_CATEGORY_ICON[entry.category];
            return (
              <li key={entry.label} className="flex items-center gap-2 text-sm">
                <Icon className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink-2">{entry.label}</span>
                <span className="shrink-0 text-[11px] text-ink-3">
                  {entry.count}× · {memoryRelative(entry.lastAt, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MemoryQuickActions({ onAction }: { onAction: (kind: string) => void }) {
  const actions: Array<{ kind: string; label: string; icon: React.ComponentType<{ className?: string }>; category: MemoryCategory }> = [
    { kind: "Add Photo", label: "Add Photo", icon: Camera, category: "other" },
    { kind: "Add Note", label: "Add Note", icon: Lightbulb, category: "other" },
    { kind: "Add Place", label: "Add Place", icon: MapPin, category: "travel" },
    { kind: "Add People", label: "Add People", icon: Users, category: "people" },
    { kind: "Add Activity", label: "Add Activity", icon: Dumbbell, category: "activities" },
    { kind: "Add Food", label: "Add Food", icon: Utensils, category: "food" },
    { kind: "Add Book", label: "Add Book", icon: BookOpen, category: "learning" },
    { kind: "Add Idea", label: "Add Idea", icon: Sparkles, category: "milestones" },
  ];

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Quick actions"
      data-testid="memory-quick-actions"
    >
      <h2 className="mb-2 text-sm font-semibold text-ink">Quick actions</h2>
      <div className="grid grid-cols-4 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.kind}
              type="button"
              onClick={() => onAction(action.kind)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line px-1 py-2 text-center transition-colors hover:border-accent hover:text-accent-ink"
            >
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <span className="text-[10px] leading-tight text-ink-2">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}