"use client";

import * as React from "react";

/**
 * A clock that re-renders on an interval so elapsed-time panels stay live
 * while a focus session is running. Focus sessions only persist their final
 * duration on completion, so anything reading live elapsed time needs a tick.
 */
export function useFocusNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}