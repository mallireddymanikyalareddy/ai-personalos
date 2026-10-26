export interface AIProviderOption {
  id: string;
  label: string;
  detail: string;
  available: boolean;
  reason?: string;
}

export const AI_PROVIDERS: AIProviderOption[] = [
  {
    id: "local",
    label: "LifeOS Local",
    detail: "Deterministic, fully offline, private",
    available: true,
  },
  {
    id: "openai",
    label: "GPT 6 Luna",
    detail: "OpenAI, using your API key",
    available: true,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    detail: "Bring your own API key",
    available: false,
    reason: "Add an Anthropic key in Settings → Integrations to enable this model.",
  },
];

export function aiProvider(id: string | null | undefined): AIProviderOption {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0]!;
}

export function aiProviderLabel(id: string | null | undefined): string {
  return aiProvider(id).label;
}
