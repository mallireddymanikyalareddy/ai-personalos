"use client";

import * as React from "react";

import type { CaptureMode } from "@personalos/core";

interface CaptureContextValue {
  open: boolean;
  mode: CaptureMode;
  openCapture: () => void;
  openCaptureWith: (mode: CaptureMode) => void;
  closeCapture: () => void;
  toggleCapture: () => void;
}

const CaptureContext = React.createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<CaptureMode>("ai");

  const value = React.useMemo<CaptureContextValue>(
    () => ({
      open,
      mode,
      openCapture: () => {
        setMode("ai");
        setOpen(true);
      },
      openCaptureWith: (preset) => {
        setMode(preset);
        setOpen(true);
      },
      closeCapture: () => setOpen(false),
      toggleCapture: () => setOpen((current) => !current),
    }),
    [open, mode],
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture(): CaptureContextValue {
  const context = React.useContext(CaptureContext);
  if (!context) throw new Error("useCapture must be used within CaptureProvider");
  return context;
}