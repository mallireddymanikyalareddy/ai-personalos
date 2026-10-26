"use client";

import * as React from "react";

import { Wifi } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { useOnline } from "@/hooks/use-online";

export interface OfflineBannerProps {
  pendingCount: number;
  onSync?: () => void;
}

export function OfflineBanner({ pendingCount, onSync }: OfflineBannerProps) {
  const { online, wasOffline } = useOnline();
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    if (!online || !wasOffline) return;
    setSyncing(true);
    const done = window.setTimeout(() => setSyncing(false), 900);
    return () => window.clearTimeout(done);
  }, [online, wasOffline]);

  if (online && !syncing) return null;

  if (!online) {
    return (
      <Alert tone="warning" title="Offline - changes saved locally">
        {pendingCount > 0
          ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`
          : "Your work is kept on this device."}
      </Alert>
    );
  }

  return (
    <Alert tone="accent" title="Syncing...">
      <button
        type="button"
        onClick={onSync}
        className="inline-flex items-center gap-1 text-xs font-medium underline"
      >
        <Wifi className="size-3" aria-hidden />
        Back online - sync now
      </button>
    </Alert>
  );
}
