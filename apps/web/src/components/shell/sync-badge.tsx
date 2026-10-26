"use client";

import { useSyncExternalStore } from "react";

import { CloudCheck, CloudOff, RefreshCw } from "lucide-react";

import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from "@/lib/account-sync";
import { cn } from "@/lib/cn";

const META: Record<Exclude<SyncStatus, "off">, { label: string; title: string; tone: string }> = {
  syncing: { label: "Syncing…", title: "Saving your changes to your account", tone: "text-ink-3" },
  saved: { label: "Saved", title: "All changes are saved to your account", tone: "text-emerald-600 dark:text-emerald-400" },
  offline: { label: "Offline", title: "You're offline. Changes will sync when you reconnect", tone: "text-amber-600" },
  error: { label: "Not synced", title: "Couldn't reach your account. Retrying shortly", tone: "text-red-600" },
};

export function SyncBadge() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, () => "off" as SyncStatus);
  if (status === "off") return null;
  const meta = META[status];
  const Icon = status === "syncing" ? RefreshCw : status === "saved" ? CloudCheck : CloudOff;
  return (
    <span
      role="status"
      aria-live="polite"
      title={meta.title}
      data-testid="sync-status-badge"
      data-status={status}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] font-medium transition-colors",
        meta.tone,
      )}
    >
      <Icon className={cn("size-3.5", status === "syncing" && "animate-spin")} aria-hidden="true" />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}
