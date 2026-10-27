"use client";

import * as React from "react";

import { LIFE_AREA_CATALOG } from "@personalos/api-contract/account";

import { useToast } from "@/components/ui/toast";
import { accountApi, errorMessage } from "@/lib/api";
import { syncLifeAreas } from "@/lib/apply-profile";
import { useAuth } from "@/modules/auth/auth-context";

export function LifeAreasCard() {
  const { profile, refresh } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const selected = profile?.lifeAreas ?? [];

  const toggle = async (name: string) => {
    const next = selected.includes(name) ? selected.filter((entry) => entry !== name) : [...selected, name];
    if (next.length === 0) {
      toast("Keep at least one life area");
      return;
    }
    setSaving(true);
    try {
      await accountApi.patchProfile({ lifeAreaNames: next } as Parameters<typeof accountApi.patchProfile>[0]);
      syncLifeAreas(next);
      await refresh();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section data-testid="life-areas-card" className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h3 className="text-sm font-semibold text-ink">Life areas</h3>
      <p className="mt-1 text-sm text-ink-3">Tag tasks and goals with these, and filter Tasks by area.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {LIFE_AREA_CATALOG.map((area) => {
          const active = selected.includes(area.name);
          return (
            <button
              key={area.name}
              type="button"
              aria-pressed={active}
              disabled={saving}
              data-testid={`settings-life-area-${area.name.toLowerCase()}`}
              onClick={() => void toggle(area.name)}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink"
                  : "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2"
              }
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: area.color }} aria-hidden="true" />
              {area.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
