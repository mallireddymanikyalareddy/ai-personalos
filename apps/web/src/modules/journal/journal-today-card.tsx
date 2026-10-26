"use client";

import * as React from "react";

import Link from "next/link";

import { Feather } from "lucide-react";

import { journalPreview } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState, useOS } from "@/store/use-os";

export function JournalTodayCard() {
  const os = useOS();
  useAppState();
  const now = Date.now();

  const todayEntry = os.journalEntryFor(now);
  const streak = os.journalStreak(now);

  if (!todayEntry) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Feather className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-medium">Journal</h2>
        </div>
        <p className="mt-2 text-sm text-ink-2">{"You haven't written today's journal yet."}</p>
        <Link href="/journal">
          <Button variant="primary" size="sm" className="mt-3">
            {"Write today's reflection"}
          </Button>
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Feather className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-medium">Journal</h2>
        </div>
        {streak.current > 0 ? (
          <Badge tone="warning">
            {streak.current} day streak
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-success">{"Today's reflection completed"}</p>
      <p className="mt-1 text-sm text-ink-3">{journalPreview(todayEntry, 120)}</p>
      <Link href="/journal">
        <Button variant="ghost" size="sm" className="mt-2">
          {"Open today's reflection"}
        </Button>
      </Link>
    </section>
  );
}
