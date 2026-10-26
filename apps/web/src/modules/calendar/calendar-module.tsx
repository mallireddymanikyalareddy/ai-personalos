"use client";

import * as React from "react";

import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";

import {
  addDays,
  detectOverlaps,
  startOfDay,
  type AgendaItem,
  type CalendarEvent,
  type ID,
  type Timestamp,
} from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";

import { AgendaView } from "./agenda-view";
import { EventDetailSheet, type EventSheet } from "./event-detail-sheet";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { CalendarAssistant, MiniMonth, MyCalendars, UpcomingPanel } from "./calendar-rail";
import { CalendarFilterButton, CalendarSettingsButton } from "./calendar-panels";
import { CALENDAR_COLOR_CHOICES, resolveEventColor } from "./event-chip";
import { baseEventId, expandOccurrences, isOccurrence } from "./calendar-occurrences";
import { eventsToIcs, parseIcs } from "./calendar-ics";
import { loadCalendarPrefs, saveCalendarPrefs, type CalendarPrefs } from "./calendar-prefs";
import { seedSampleCalendar } from "./sample-calendar";

type View = "day" | "week" | "month" | "agenda" | "timeline";

const VIEWS: { value: View; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
  { value: "timeline", label: "Timeline" },
];

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function CalendarModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [view, setView] = React.useState<View>("week");
  const [anchor, setAnchor] = React.useState(() => startOfDay(Date.now()));
  const [sheet, setSheet] = React.useState<EventSheet | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [draft, setDraft] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [showAllDay, setShowAllDay] = React.useState(true);
  const [showTimed, setShowTimed] = React.useState(true);
  const [prefs, setPrefs] = React.useState<CalendarPrefs>({ showWeekends: true, defaultCalendarId: null });
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const importRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setPrefs(loadCalendarPrefs());
  }, []);

  const updatePrefs = (patch: Partial<CalendarPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saveCalendarPrefs(next);
      return next;
    });
  };

  const now = Date.now();
  const month = os.getMonthView(anchor, now);
  const day = os.getDayView(anchor, now);

  const agendaFrom = startOfDay(now);
  const agendaTo = addDays(agendaFrom, 14);
  const freeSlots = os.getFreeSlots(agendaFrom, agendaTo, 30);

  const calendars = os.calendars();
  const calendarColors = React.useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const calendar of Object.values(state.calendars)) map[calendar.id] = calendar.color;
    return map;
  }, [state.calendars]);

  const filteredEvents = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return Object.values(state.events)
      .filter((event) => {
        if (event.calendarId && hidden.has(event.calendarId)) return false;
        if (event.allDay && !showAllDay) return false;
        if (!event.allDay && !showTimed) return false;
        if (query.length > 0) {
          const haystack = `${event.title} ${event.location} ${event.notes}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .map((event) => ({ ...event, color: resolveEventColor(event, calendarColors) }));
  }, [state.events, hidden, showAllDay, showTimed, search, calendarColors]);

  const windowFrom = Math.min(month.start, day.date) - 7 * DAY_MS;
  const windowTo = Math.max(month.end, day.date + DAY_MS) + 7 * DAY_MS;

  const expandedEvents = React.useMemo(
    () => expandOccurrences(filteredEvents, windowFrom, windowTo),
    [filteredEvents, windowFrom, windowTo],
  );

  const eventsBetween = React.useCallback(
    (from: Timestamp, to: Timestamp) =>
      expandedEvents.filter((event) => event.startsAt < to && event.endsAt > from),
    [expandedEvents],
  );

  const weekStartsOn = state.settings.weekStart === 0 ? 0 : 1;
  const weekView = React.useMemo(() => {
    const anchorDay = startOfDay(anchor);
    const offset = (new Date(anchorDay).getDay() - weekStartsOn + 7) % 7;
    const start = addDays(anchorDay, -offset);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const base = os.getDayView(date, now);
      return { ...base, events: eventsBetween(date, date + DAY_MS) };
    });
    return { start, end: addDays(start, 7), days };
  }, [anchor, weekStartsOn, now, eventsBetween, os]);

  const monthView = React.useMemo(
    () => ({
      ...month,
      weeks: month.weeks.map((entry) => ({
        ...entry,
        days: entry.days.map((cell) => ({ ...cell, events: eventsBetween(cell.date, cell.date + DAY_MS) })),
      })),
    }),
    [month, eventsBetween],
  );

  const dayView = React.useMemo(
    () => ({ ...day, events: eventsBetween(day.date, day.date + DAY_MS) }),
    [day, eventsBetween],
  );

  const agendaItems = React.useMemo<AgendaItem[]>(
    () =>
      expandedEvents
        .filter((event) => event.startsAt >= agendaFrom && event.startsAt < agendaTo)
        .sort((a, b) => a.startsAt - b.startsAt)
        .map((event) => ({ day: startOfDay(event.startsAt), event })),
    [expandedEvents, agendaFrom, agendaTo],
  );

  const upcoming = React.useMemo(
    () =>
      expandedEvents
        .filter((event) => event.startsAt >= now && event.startsAt < now + 7 * DAY_MS)
        .sort((a, b) => a.startsAt - b.startsAt),
    [expandedEvents, now],
  );

  const eventDays = React.useMemo(
    () => new Set(expandedEvents.map((event) => new Date(event.startsAt).toDateString())),
    [expandedEvents],
  );

  const conflictIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const overlap of detectOverlaps(expandedEvents)) {
      ids.add(overlap.a.id);
      ids.add(overlap.b.id);
    }
    return ids;
  }, [expandedEvents]);

  const weekLabel = `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(weekView.start))} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(weekView.end - 1))}`;
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(month.start),
  );

  const weekEvents = weekView.days.reduce((sum, entry) => sum + entry.events.length, 0);
  const weekMeetings = weekView.days.reduce(
    (sum, entry) => sum + entry.events.filter((event) => event.location.length > 0).length,
    0,
  );
  const weekFocus = os.focusStats(weekView.start, weekView.end, now).totalFocusMin;
  const weekTasksDue = Object.values(state.tasks).filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "cancelled" &&
      task.dueAt != null &&
      task.dueAt >= weekView.start &&
      task.dueAt < weekView.end,
  ).length;

  const jump = (direction: number) => {
    if (view === "month") {
      setAnchor((current) => {
        const date = new Date(current);
        date.setDate(1);
        date.setMonth(date.getMonth() + direction);
        return date.getTime();
      });
      return;
    }
    const amount = view === "week" ? 7 : view === "day" ? 1 : 14;
    setAnchor((current) => addDays(current, amount * direction));
  };

  const openCreate = (startsAt: Timestamp, endsAt: Timestamp) =>
    setSheet({ draft: { startsAt, endsAt, calendarId: prefs.defaultCalendarId } });
  const openEvent = (event: CalendarEvent) => setSheet({ eventId: baseEventId(event.id) });

  const toggleSelect = (event: CalendarEvent) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(event.id)) next.delete(event.id);
      else next.add(event.id);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const deleteSelected = () => {
    const baseIds = new Set([...selectedIds].map(baseEventId));
    for (const id of baseIds) os.deleteEvent(id);
    toast(`Deleted ${baseIds.size} event${baseIds.size === 1 ? "" : "s"}`);
    exitSelection();
  };

  const moveEvent = (eventId: ID, targetDay: Timestamp, hour: number) => {
    const event = state.events[baseEventId(eventId)];
    if (!event) return;
    const duration = Math.max(event.endsAt - event.startsAt, 15 * 60_000);
    const startsAt = startOfDay(targetDay) + hour * HOUR_MS;
    os.updateEvent(event.id, { startsAt, endsAt: startsAt + duration });
    toast(isOccurrence(eventId) ? "Series moved" : "Event moved");
  };

  const addCalendar = () => {
    const name = window.prompt("Calendar name");
    if (name == null || name.trim().length === 0) return;
    const index = calendars.length % CALENDAR_COLOR_CHOICES.length;
    os.addCalendar({ name: name.trim(), color: CALENDAR_COLOR_CHOICES[index] });
  };

  const exportIcs = () => {
    const text = eventsToIcs(Object.values(state.events));
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lifeos-calendar.ics";
    link.click();
    URL.revokeObjectURL(url);
    toast("Calendar exported");
  };

  const importIcs = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseIcs(text);
      if (parsed.length === 0) {
        toast("No events found in that file");
        return;
      }
      for (const entry of parsed) {
        os.addEvent({
          title: entry.title,
          startsAt: entry.startsAt,
          endsAt: entry.endsAt,
          allDay: entry.allDay,
          location: entry.location,
          notes: entry.notes,
          calendarId: prefs.defaultCalendarId,
        });
      }
      toast(`Imported ${parsed.length} event${parsed.length === 1 ? "" : "s"}`);
    };
    reader.readAsText(file);
  };

  const loadDefaults = () => {
    const ids = seedSampleCalendar(os, now);
    toast(`Added ${ids.length} sample events – edit or delete them any time`);
  };

  const activeFilterCount =
    (hidden.size > 0 ? 1 : 0) + (!showAllDay ? 1 : 0) + (!showTimed ? 1 : 0) + (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setHidden(new Set());
    setShowAllDay(true);
    setShowTimed(true);
    setSearch("");
  };

  const runAssistant = (id: string) => {
    if (id === "plan") {
      setAnswer(
        `Your week has ${weekEvents} events and ${weekTasksDue} tasks due. Start with ${upcoming[0]?.title ?? "the first free slot"} and protect 2 hours of focus time.`,
      );
      return;
    }
    if (id === "focus") {
      const slot = freeSlots[0];
      setAnswer(
        slot != null
          ? `First free window: ${new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt))} for ${slot.durationMin} minutes.`
          : "No free slots left this week – try moving something.",
      );
      return;
    }
    if (id === "reschedule") {
      setAnswer(
        conflictIds.size > 0
          ? `${conflictIds.size} event${conflictIds.size === 1 ? "" : "s"} overlap this week – drag one to a free slot to resolve it.`
          : "Nothing in this week overlaps badly enough to reschedule.",
      );
      return;
    }
    if (id === "summarize") {
      setAnswer(
        `Week summary: ${weekEvents} events, ${Math.round(weekMeetings * 10) / 10} meetings, ${Math.round(weekFocus / 6) / 10}h focus time and ${weekTasksDue} tasks due.`,
      );
      return;
    }
    const query = draft.trim();
    if (query.length === 0) {
      setAnswer("Ask me to plan your week, find focus time or summarise the week.");
      return;
    }
    const matches = filteredEvents.filter((event) =>
      `${event.title} ${event.location}`.toLowerCase().includes(query.toLowerCase()),
    );
    setAnswer(
      matches.length > 0
        ? `Found ${matches.length} event${matches.length === 1 ? "" : "s"} matching “${query}”: ${matches
            .slice(0, 3)
            .map((event) => event.title)
            .join(", ")}.`
        : `Nothing on the calendar matches “${query}”.`,
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        testId="calendar-header"
        icon={CalendarDays}
        title="Calendar"
        subtitle="Manage your schedule, meetings, tasks and life in one place."
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => openCreate(now + HOUR_MS, now + 2 * HOUR_MS)}
              data-testid="calendar-new-event"
            >
              <Plus className="size-4" aria-hidden="true" />
              New Event
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const startsAt = Math.ceil(now / (30 * 60_000)) * 30 * 60_000;
                openCreate(startsAt, startsAt + 30 * 60_000);
              }}
            >
              <Video className="size-4" aria-hidden="true" />
              Meet Now
            </Button>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Calendar",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    { label: "Add calendar", onSelect: addCalendar },
                    { label: "Export .ics", onSelect: exportIcs },
                    { label: "Import .ics", onSelect: () => importRef.current?.click() },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Calendar options">
                  <span aria-hidden="true">&#8942;</span>
                </Button>
              }
            />
          </>
        }
      />

      <input
        ref={importRef}
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        aria-label="Import calendar file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importIcs(file);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Calendar view">
          {VIEWS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              data-testid={`calendar-view-${entry.value}`}
              aria-pressed={view === entry.value}
              onClick={() => setView(entry.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                view === entry.value
                  ? "bg-accent text-white"
                  : "border border-line bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events…"
              aria-label="Search events"
              className="h-8 w-40 rounded-lg border border-line bg-surface pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
          </div>

          <button
            type="button"
            onClick={() => jump(-1)}
            aria-label="Previous period"
            className="grid size-7 place-items-center rounded-lg border border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-[9rem] text-center text-[13px] font-semibold text-ink" data-testid="calendar-range">
            {view === "month" ? monthLabel : view === "week" ? weekLabel : view === "day" ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(anchor)) : "Next 14 days"}
          </span>
          <button
            type="button"
            onClick={() => jump(1)}
            aria-label="Next period"
            className="grid size-7 place-items-center rounded-lg border border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(startOfDay(now))}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
          >
            Today
          </button>

          <CalendarFilterButton
            calendars={calendars}
            hidden={hidden}
            onToggleCalendar={(id) =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            showAllDay={showAllDay}
            showTimed={showTimed}
            onToggleAllDay={() => setShowAllDay((value) => !value)}
            onToggleTimed={() => setShowTimed((value) => !value)}
            onReset={resetFilters}
            activeCount={activeFilterCount}
          />

          <CalendarSettingsButton
            weekStart={state.settings.weekStart === 0 ? 0 : 1}
            onWeekStart={(value) => os.updateSettings({ weekStart: value })}
            timeFormat={state.settings.timeFormat === 12 ? 12 : 24}
            onTimeFormat={(value) => os.updateSettings({ timeFormat: value })}
            showWeekends={prefs.showWeekends}
            onToggleWeekends={() => updatePrefs({ showWeekends: !prefs.showWeekends })}
            calendars={calendars}
            defaultCalendarId={prefs.defaultCalendarId}
            onDefaultCalendar={(id) => updatePrefs({ defaultCalendarId: id })}
            onAddCalendar={addCalendar}
            onExportIcs={exportIcs}
            onImportIcs={() => importRef.current?.click()}
          />

          <button
            type="button"
            onClick={() => (selectMode ? exitSelection() : setSelectMode(true))}
            aria-pressed={selectMode}
            aria-label={selectMode ? "Exit selection" : "Select events"}
            className={cn(
              "grid size-8 place-items-center rounded-lg border transition-colors",
              selectMode
                ? "border-accent bg-accent text-white"
                : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <CheckSquare className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
          <span className="text-xs font-medium text-accent-ink">
            {selectedIds.size} selected
          </span>
          <span className="text-[11px] text-accent-ink/70">Click events to add or remove them.</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelection}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {view === "day" ? (
            <div
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
              data-testid="calendar-day"
            >
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }).format(new Date(dayView.date))}
              </h2>
              {dayView.events.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-3">Nothing scheduled today.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayView.events.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => (selectMode ? toggleSelect(event) : openEvent(event))}
                        aria-pressed={selectMode ? selectedIds.has(event.id) : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left hover:bg-surface-2",
                          selectMode && selectedIds.has(event.id) && "border-accent bg-accent-soft/60",
                          conflictIds.has(event.id) && "border-l-2 border-l-danger",
                        )}
                      >
                        <span className="text-[12px] tabular-nums text-ink-3">
                          {event.allDay
                            ? "All day"
                            : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                                new Date(event.startsAt),
                              )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                          {event.title}
                        </span>
                        {event.location ? (
                          <span className="shrink-0 text-[11px] text-ink-3">{event.location}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {view === "week" ? (
            <WeekView
              week={weekView}
              onOpenEvent={openEvent}
              onAddSlot={(dayStart, hour) => openCreate(dayStart + hour * HOUR_MS, dayStart + (hour + 1) * HOUR_MS)}
              onMoveEvent={moveEvent}
              selectable={selectMode}
              selected={selectedIds}
              onToggleSelect={toggleSelect}
              conflictIds={conflictIds}
              showWeekends={prefs.showWeekends}
            />
          ) : null}

          {view === "month" ? (
            <MonthView
              month={monthView}
              onOpenEvent={openEvent}
              onAddDay={(dayStart) => openCreate(dayStart + 9 * HOUR_MS, dayStart + 10 * HOUR_MS)}
              onShowDay={(dayStart) => {
                setAnchor(dayStart);
                setView("week");
              }}
              selectable={selectMode}
              selected={selectedIds}
              onToggleSelect={toggleSelect}
              conflictIds={conflictIds}
              showWeekends={prefs.showWeekends}
            />
          ) : null}

          {view === "agenda" ? (
            agendaItems.length === 0 && freeSlots.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing coming up"
                description="Your next two weeks are wide open. Add an event and it will appear here."
                action={
                  <Button variant="primary" onClick={() => openCreate(now + HOUR_MS, now + 2 * HOUR_MS)}>
                    Add an event
                  </Button>
                }
              />
            ) : (
              <AgendaView
                items={agendaItems}
                now={now}
                freeSlots={freeSlots}
                onOpenEvent={openEvent}
                selectable={selectMode}
                selected={selectedIds}
                onToggleSelect={toggleSelect}
                conflictIds={conflictIds}
              />
            )
          ) : null}

          {view === "timeline" ? (
            <section
              aria-label="Timeline"
              data-testid="calendar-timeline"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <h2 className="mb-3 text-sm font-semibold text-ink">Timeline</h2>
              {upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-3">Nothing scheduled yet.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {upcoming.slice(0, 20).map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[1.32rem] top-1 size-2.5 rounded-full",
                          conflictIds.has(event.id) ? "bg-danger" : "bg-accent",
                        )}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => (selectMode ? toggleSelect(event) : openEvent(event))}
                        aria-pressed={selectMode ? selectedIds.has(event.id) : undefined}
                        className={cn(
                          "w-full rounded-lg border border-line px-3 py-2 text-left hover:bg-surface-2",
                          selectMode && selectedIds.has(event.id) && "border-accent bg-accent-soft/60",
                        )}
                      >
                        <span className="block text-[12px] tabular-nums text-ink-3">
                          {new Intl.DateTimeFormat(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(event.startsAt))}
                        </span>
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {event.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          <section
            aria-label="Week Insights"
            data-testid="calendar-week-insights"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[9rem]">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <CalendarDays className="size-4 text-accent-ink" aria-hidden="true" />
                  Week Insights
                </h2>
                <p className="text-[11px] text-ink-3">{weekLabel}</p>
              </div>
              <InsightTile label="Total Events" value={String(weekEvents)} />
              <InsightTile label="Meetings" value={`${Math.round(weekMeetings * 10) / 10} h`} />
              <InsightTile label="Focus Time" value={`${Math.round(weekFocus / 6) / 10} h`} />
              <InsightTile label="Tasks Due" value={String(weekTasksDue)} />
              <InsightTile label="Conflicts" value={String(conflictIds.size)} />
              <span
                className="ml-auto size-12 shrink-0 rounded-full"
                style={{
                  background: "conic-gradient(var(--chart-5) 0 45%, var(--chart-3) 45% 70%, var(--chart-6) 70% 100%)",
                }}
                aria-hidden="true"
              />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Calendar tools">
          <MiniMonth
            anchor={anchor}
            today={now}
            eventDays={eventDays}
            onShiftMonth={(direction) => {
              setAnchor((current) => {
                const date = new Date(current);
                date.setDate(1);
                date.setMonth(date.getMonth() + direction);
                return date.getTime();
              });
            }}
            onSelectDay={(dayStart) => {
              setAnchor(dayStart);
              setView("week");
            }}
          />
          <MyCalendars
            calendars={calendars}
            hidden={hidden}
            onToggle={(id) =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onAdd={addCalendar}
          />
          <UpcomingPanel
            events={upcoming}
            onOpen={(id) => {
              const event = state.events[baseEventId(id)];
              if (event) openEvent(event);
            }}
            onViewAll={() => setView("agenda")}
          />
          <CalendarAssistant draft={draft} onDraftChange={setDraft} answer={answer} onRun={runAssistant} />
        </aside>
      </div>

      <EventDetailSheet sheet={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function InsightTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6rem] rounded-xl border border-line px-3 py-2">
      <p className="text-base font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[10px] text-ink-3">{label}</p>
    </div>
  );
}
