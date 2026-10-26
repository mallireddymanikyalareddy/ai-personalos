"use client";

import * as React from "react";

import { Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

interface DigestPref {
  enabled: boolean;
  lastSentWeek: string | null;
  email: string | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail ?? "Request failed");
  return data as T;
}

export function WeeklyEmailCard() {
  const { toast } = useToast();
  const [pref, setPref] = React.useState<DigestPref | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    void call<DigestPref>("/api/v1/digest").then(setPref).catch(() => setPref(null));
  }, []);

  const toggle = async (enabled: boolean) => {
    try {
      const next = await call<DigestPref>("/api/v1/digest", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setPref(next);
      toast(enabled ? "Monday briefing email turned on" : "Monday briefing email turned off");
    } catch (error) {
      toast((error as Error).message);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await call<{ to: string }>("/api/digest/send-now", { method: "POST" });
      toast(`Preview sent to ${res.to}`);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!pref) return null;
  return (
    <section data-testid="weekly-email-card" className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Monday briefing email</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-3">
              Every Monday morning (your time zone), get your GPT 6 Luna weekly plan, what&apos;s due and your goal progress.
            </p>
            <p className="mt-1 text-xs text-ink-3" data-testid="weekly-email-address">
              {pref.email ? `Sends to ${pref.email}` : "Add an email address to your account to turn this on."}
            </p>
          </div>
        </div>
        <span data-testid="weekly-email-toggle">
          <Switch
            label="Monday briefing email"
            checked={pref.enabled}
            disabled={!pref.email}
            onCheckedChange={(checked) => void toggle(checked)}
          />
        </span>
      </div>
      <div className="mt-4">
        <Button
          size="sm"
          variant="secondary"
          data-testid="weekly-email-send-now"
          disabled={!pref.email || sending}
          onClick={() => void sendNow()}
        >
          <Send className="size-3.5" aria-hidden="true" />
          {sending ? "Sending…" : "Send me a preview now"}
        </Button>
      </div>
    </section>
  );
}
