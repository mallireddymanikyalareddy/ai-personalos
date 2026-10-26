import { useSyncExternalStore } from "react";

import type { AppState, PersonalOS } from "@personalos/core";

import { getOS } from "./os";

export function useOS(): PersonalOS {
  return getOS();
}

export function useAppState(): AppState {
  const os = getOS();
  return useSyncExternalStore(os.subscribe, os.getState, os.getState);
}
