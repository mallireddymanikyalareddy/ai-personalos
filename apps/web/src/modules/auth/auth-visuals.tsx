"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";
import { oauthApi } from "@/lib/api";

export const AUTH = {
  ink: "#0A0A33",
  body: "#33375C",
  muted: "#5A5E86",
  purple: "#5B2BE8",
  violet: "#6B1AFC",
  green: "#0D9A61",
  danger: "#D92D20",
  fieldBorder: "#D3D5F5",
  submitGradient: "linear-gradient(90deg, #7B3CFD 0%, #4A2BE0 55%, #2E1FB0 100%)",
  headingGradient: "linear-gradient(90deg, #00A2FF 0%, #3B6BFB 45%, #8B48E9 100%)",
  pageGradient: [
    "radial-gradient(85% 65% at 0% 100%, #F8E5FB 0%, rgba(248,229,251,0) 62%)",
    "radial-gradient(80% 70% at 100% 25%, #C6D6FC 0%, rgba(198,214,252,0) 65%)",
    "linear-gradient(165deg, #F6F3FD 0%, #EFEAFD 52%, #E2DCFC 100%)",
  ].join(", "),
} as const;

export const PROVIDERS = [
  {
    id: "google",
    label: "Google",
    longLabel: "Continue with Google",
    mark: (
      <svg viewBox="0 0 48 48" className="size-[24px]" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C37 36.9 44 32 44 24c0-1.3-.1-2.6-.4-3.9z"
        />
      </svg>
    ),
  },
  {
    id: "microsoft",
    label: "Microsoft",
    longLabel: "Continue with Microsoft",
    mark: (
      <svg viewBox="0 0 23 23" className="size-[22px]" aria-hidden="true">
        <path fill="#F35325" d="M1 1h10v10H1z" />
        <path fill="#81BC06" d="M12 1h10v10H12z" />
        <path fill="#05A6F0" d="M1 12h10v10H1z" />
        <path fill="#FFBA08" d="M12 12h10v10H12z" />
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Apple",
    longLabel: "Continue with Apple",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[23px]" aria-hidden="true">
        <path
          fill="#000000"
          d="M17.05 12.53c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.52.99-1.44 1.4-2.83 1.42-2.9-.03-.01-2.72-1.04-2.75-4.15zM14.5 4.9c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.14 1.14.09 2.3-.58 3.01-1.43z"
        />
      </svg>
    ),
  },
];

export function useOAuthStart() {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    let cancelled = false;
    oauthApi
      .providers()
      .then((response) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const provider of response.items) next[provider.id] = provider.enabled;
        setEnabled(next);
      })
      .catch(() => {
        if (!cancelled) setEnabled({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = React.useCallback(
    (provider: { id: string; label: string }) => {
      if (enabled[provider.id]) {
        window.location.assign(oauthApi.startUrl(provider.id));
        return;
      }
      toast(`${provider.label} sign-in is not configured on this server yet.`, { tone: "danger" });
    },
    [enabled, toast],
  );

  return { enabled, start };
}
