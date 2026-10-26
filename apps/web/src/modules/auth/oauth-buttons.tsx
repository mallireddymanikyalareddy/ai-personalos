"use client";

import * as React from "react";

import { oauthApi } from "@/lib/api";

export function OAuthButtons({ redirect }: { redirect?: string }) {
  const [providers, setProviders] = React.useState<
    Array<{ id: string; label: string; enabled: boolean }>
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    oauthApi
      .providers()
      .then((response) => {
        if (!cancelled) setProviders(response.items);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = providers.filter((provider) => provider.enabled);
  if (enabled.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-3">
          or continue with
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid gap-2">
        {enabled.map((provider) => (
          <a
            key={provider.id}
            href={oauthApi.startUrl(provider.id, redirect)}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            {provider.label}
          </a>
        ))}
      </div>
    </div>
  );
}
