"use client";

import * as React from "react";

import { Check, Download, Filter, Plus, RotateCcw, Settings2, Upload } from "lucide-react";

import type { Calendar } from "@personalos/core";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, useOutsideDismiss } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

import { eventTone } from "./event-chip";

function PanelTrigger({
  label,
  icon,
  active,
  badge,
  onClick,
  refCallback,
  expanded,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  refCallback: (node: HTMLButtonElement | null) => void;
  expanded: boolean;
}) {
  return (
    <button
      ref={refCallback}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className={cn(
        "relative grid size-8 place-items-center rounded-lg border transition-colors",
        active
          ? "border-accent/50 bg-accent-soft text-accent-ink"
          : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon}
      {badge != null && badge > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export interface CalendarFilterProps {
  calendars: Calendar[];
  hidden: Set<string>;
  onToggleCalendar: (id: string) => void;
  showAllDay: boolean;
  showTimed: boolean;
  onToggleAllDay: () => void;
  onToggleTimed: () => void;
  onReset: () => void;
  activeCount: number;
}

export function CalendarFilterButton({
  calendars,
  hidden,
  onToggleCalendar,
  showAllDay,
  showTimed,
  onToggleAllDay,
  onToggleTimed,
  onReset,
  activeCount,
}: CalendarFilterProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useOutsideDismiss(panelRef, () => setOpen(false), open);

  return (
    <>
      <PanelTrigger
        label="Filter events"
        icon={<Filter className="size-3.5" aria-hidden="true" />}
        active={activeCount > 0}
        badge={activeCount}
        onClick={() => setOpen(!open)}
        refCallback={(node) => {
          triggerRef.current = node;
        }}
        expanded={open}
      />
      <Popover open={open} anchor={triggerRef.current} align="end" panelRef={panelRef} className="w-64">
        <div
          role="dialog"
          aria-label="Filter events"
          className="rounded-xl border border-line bg-surface p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Filters</p>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Reset
            </button>
          </div>

          <div className="space-y-1.5">
            <Switch checked={showAllDay} onCheckedChange={onToggleAllDay} label="All-day events" />
            <Switch checked={showTimed} onCheckedChange={onToggleTimed} label="Timed events" />
          </div>

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Calendars
          </p>
          {calendars.length === 0 ? (
            <p className="text-[12px] text-ink-3">No calendars yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {calendars.map((calendar) => {
                const tone = eventTone(calendar.color);
                return (
                  <li key={calendar.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={!hidden.has(calendar.id)}
                      onChange={() => onToggleCalendar(calendar.id)}
                      label={`Show ${calendar.name}`}
                      size="sm"
                    />
                    <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-sm", tone.dot)} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{calendar.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Popover>
    </>
  );
}

export interface CalendarSettingsProps {
  weekStart: 0 | 1;
  onWeekStart: (value: 0 | 1) => void;
  timeFormat: 12 | 24;
  onTimeFormat: (value: 12 | 24) => void;
  showWeekends: boolean;
  onToggleWeekends: () => void;
  calendars: Calendar[];
  defaultCalendarId: string | null;
  onDefaultCalendar: (id: string | null) => void;
  onAddCalendar: () => void;
  onExportIcs: () => void;
  onImportIcs: () => void;
}

export function CalendarSettingsButton({
  weekStart,
  onWeekStart,
  timeFormat,
  onTimeFormat,
  showWeekends,
  onToggleWeekends,
  calendars,
  defaultCalendarId,
  onDefaultCalendar,
  onAddCalendar,
  onExportIcs,
  onImportIcs,
}: CalendarSettingsProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useOutsideDismiss(panelRef, () => setOpen(false), open);

  return (
    <>
      <PanelTrigger
        label="Calendar settings"
        icon={<Settings2 className="size-3.5" aria-hidden="true" />}
        onClick={() => setOpen(!open)}
        refCallback={(node) => {
          triggerRef.current = node;
        }}
        expanded={open}
      />
      <Popover open={open} anchor={triggerRef.current} align="end" panelRef={panelRef} className="w-72">
        <div
          role="dialog"
          aria-label="Calendar settings"
          className="space-y-4 rounded-xl border border-line bg-surface p-3 shadow-pop"
        >
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Week starts on
            </p>
            <div className="flex gap-1.5">
              {[
                { value: 1 as const, label: "Monday" },
                { value: 0 as const, label: "Sunday" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onWeekStart(option.value)}
                  aria-pressed={weekStart === option.value}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                    weekStart === option.value
                      ? "border-accent bg-accent text-white"
                      : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Time format
            </p>
            <div className="flex gap-1.5">
              {[
                { value: 12 as const, label: "12-hour" },
                { value: 24 as const, label: "24-hour" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onTimeFormat(option.value)}
                  aria-pressed={timeFormat === option.value}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                    timeFormat === option.value
                      ? "border-accent bg-accent text-white"
                      : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-ink-2">Show weekends</span>
            <Switch checked={showWeekends} onCheckedChange={onToggleWeekends} label="Show weekends" />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Default calendar
            </p>
            <select
              value={defaultCalendarId ?? ""}
              onChange={(event) => onDefaultCalendar(event.target.value || null)}
              aria-label="Default calendar for new events"
              className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-accent"
            >
              <option value="">None</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <button
              type="button"
              onClick={onAddCalendar}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
            >
              <Plus className="size-4 text-ink-3" aria-hidden="true" />
              Add calendar
            </button>
            <button
              type="button"
              onClick={onExportIcs}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
            >
              <Download className="size-4 text-ink-3" aria-hidden="true" />
              Export .ics
            </button>
            <button
              type="button"
              onClick={onImportIcs}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
            >
              <Upload className="size-4 text-ink-3" aria-hidden="true" />
              Import .ics
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <Check className="size-3" aria-hidden="true" />
            Changes apply instantly.
          </p>
        </div>
      </Popover>
    </>
  );
}
