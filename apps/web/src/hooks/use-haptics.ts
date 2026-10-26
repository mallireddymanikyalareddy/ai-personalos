"use client";

import * as React from "react";

import { hapticPattern } from "@personalos/core";

import { useAppState, useOS } from "@/store/use-os";

export type HapticKind = "tap" | "success" | "warning" | "destructive" | "commit";

const KIND_TO_INTENSITY: Record<HapticKind, "light" | "medium" | "strong"> = {
  tap: "light",
  success: "medium",
  warning: "strong",
  destructive: "strong",
  commit: "medium",
};

export interface HapticsResult {
  supported: boolean;
  enabled: boolean;
  trigger: (kind?: HapticKind) => void;
}

export function useHaptics(): HapticsResult {
  const os = useOS();
  useAppState();
  const preferences = os.mobilePreferences();

  const supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const trigger = React.useCallback(
    (kind: HapticKind = "tap") => {
      if (!preferences.hapticsEnabled || !supported) return;
      const pattern = hapticPattern(KIND_TO_INTENSITY[kind]);
      try {
        navigator.vibrate(pattern);
      } catch {
        /* haptics are a progressive enhancement */
      }
    },
    [preferences.hapticsEnabled, supported],
  );

  return { supported, enabled: preferences.hapticsEnabled && supported, trigger };
}
