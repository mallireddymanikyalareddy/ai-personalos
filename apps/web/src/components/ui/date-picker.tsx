"use client";

import * as React from "react";

import { CalendarDays, X } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";
import type { MonthCalendarProps } from "@/components/ui/calendar";
import { MonthCalendar } from "@/components/ui/calendar";
import { Popover, useOutsideDismiss } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";

export interface DatePickerProps {
  value: Timestamp | null;
  onValueChange: (ts: Timestamp | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  min?: Timestamp | null;
  max?: Timestamp | null;
  weekendStartOn?: MonthCalendarProps["weekStartsOn"];
  className?: string;
}

const formatDate = (ts: Timestamp) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));

export function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  ariaLabel = "Pick a date",
  disabled = false,
  id,
  min,
  max,
  weekendStartOn = 1,
  className,
}: DatePickerProps) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);

  const close = React.useCallback(() => setOpen(false), []);
  useOutsideDismiss(popoverRef, close, open);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink transition-colors",
          "hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-accent/20",
          open && "border-accent ring-2 ring-accent/20",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <CalendarDays
          className="size-4 shrink-0 text-ink-3"
          aria-hidden="true"
        />
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-ink-3")}>
          {value ? formatDate(value) : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(event) => {
              event.stopPropagation();
              onValueChange(null);
            }}
            className="grid size-5 shrink-0 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </button>
      <Popover
        open={open}
        anchor={triggerRef.current}
        onClose={close}
        panelRef={popoverRef}
        side="bottom"
        align="start"
        className="w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
      >
        <MonthCalendar
          value={value}
          onValueChange={(ts) => {
            onValueChange(ts);
            close();
          }}
          min={min}
          max={max}
          weekStartsOn={weekendStartOn}
          className="border-none shadow-none"
        />
        <div className="px-3 pb-3">
          <Divider className="mb-2.5" />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                onValueChange(now.getTime());
                close();
              }}
              disabled={value === toDayStartTs()}
            >
              Today
            </Button>
            {value != null && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onValueChange(null);
                  close();
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}

function toDayStartTs(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
