"use client";

import * as React from "react";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function snapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export interface OnlineState {
  online: boolean;
  wasOffline: boolean;
  lastOnlineAt: number | null;
}

export function useOnline(): OnlineState {
  const online = useSyncExternalStore(subscribe, snapshot, () => true);
  const [lastOnlineAt, setLastOnlineAt] = React.useState<number | null>(() => (online ? Date.now() : null));
  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    if (online) {
      setLastOnlineAt(Date.now());
      setWasOffline(true);
      return;
    }
    setWasOffline(false);
  }, [online]);

  return { online, wasOffline: wasOffline && online, lastOnlineAt };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
