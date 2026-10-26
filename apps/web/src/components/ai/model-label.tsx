"use client";

import { aiProvider } from "@personalos/core";

import { useAppState } from "@/store/use-os";

export function ModelLabel() {
  const state = useAppState();
  return <span data-testid="ai-model-label">{aiProvider(state.settings.aiProvider).label}</span>;
}
