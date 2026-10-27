"use client";

import * as React from "react";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { syncLifeAreas } from "@/lib/apply-profile";
import { getOS } from "@/store/os";

export interface FirstSteps {
  firstGoal: string;
  starterHabits: string[];
  mondayEmail: boolean;
  useGpt: boolean;
}

export const EMPTY_FIRST_STEPS: FirstSteps = { firstGoal: "", starterHabits: [], mondayEmail: false, useGpt: false };

const HABIT_IDEAS = ["Drink 8 glasses of water", "Walk 20 minutes", "Read 10 pages", "Meditate 5 minutes", "Journal before bed", "No phone after 10pm"];
const GOAL_IDEAS: Record<string, string> = {
  Work: "Ship one meaningful project this quarter",
  Health: "Exercise 3 times a week",
  Relationships: "Call a friend or family member every week",
  Money: "Save an emergency fund of 3 months",
  Learning: "Finish one online course",
  Personal: "Pick up a new hobby",
};

export function goalIdeaFor(lifeAreaNames: string[]): string {
  return GOAL_IDEAS[lifeAreaNames[0] ?? ""] ?? "Exercise 3 times a week";
}

export function OnboardingFirstSteps({
  value,
  onChange,
  lifeAreaNames,
  hasEmail,
}: {
  value: FirstSteps;
  onChange: (patch: Partial<FirstSteps>) => void;
  lifeAreaNames: string[];
  hasEmail: boolean;
}) {
  const [custom, setCustom] = React.useState("");
  const full = value.starterHabits.length >= 5;
  const toggleHabit = (habit: string) => {
    if (!value.starterHabits.includes(habit) && full) return;
    onChange({
      starterHabits: value.starterHabits.includes(habit)
        ? value.starterHabits.filter((entry) => entry !== habit)
        : [...value.starterHabits, habit],
    });
  };
  const addCustom = () => {
    const habit = custom.trim();
    if (!habit || full || value.starterHabits.includes(habit)) return;
    onChange({ starterHabits: [...value.starterHabits, habit] });
    setCustom("");
  };
  const ideas = Array.from(new Set([...HABIT_IDEAS, ...value.starterHabits]));

  return (
    <div className="space-y-6" data-testid="onboarding-first-steps">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <label htmlFor="ob-first-goal" className="text-sm font-semibold text-ink">
          Your first goal <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <Input
          id="ob-first-goal"
          data-testid="onboarding-first-goal-input"
          className="mt-2"
          maxLength={120}
          placeholder="e.g. Run a 5k by summer"
          value={value.firstGoal}
          onChange={(event) => onChange({ firstGoal: event.target.value })}
        />
        {!value.firstGoal && (
          <button
            type="button"
            data-testid="onboarding-goal-suggestion"
            className="mt-2 text-xs font-medium text-accent-ink hover:underline"
            onClick={() => onChange({ firstGoal: goalIdeaFor(lifeAreaNames) })}
          >
            Use suggestion: {goalIdeaFor(lifeAreaNames)}
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-ink">
          Starter habits{" "}
          <span className="font-normal text-ink-3" data-testid="onboarding-habit-count">
            ({value.starterHabits.length}/5{full ? " — remove one to add another" : ""})
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ideas.map((habit) => {
            const active = value.starterHabits.includes(habit);
            return (
              <button
                key={habit}
                type="button"
                aria-pressed={active}
                disabled={!active && full}
                data-testid={`onboarding-habit-${habit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => toggleHabit(habit)}
                className={
                  active
                    ? "inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink"
                    : "inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {habit}
                {active && <X className="size-3" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            data-testid="onboarding-custom-habit-input"
            placeholder={full ? "Limit reached" : "Add your own habit"}
            disabled={full}
            maxLength={80}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
          />
          <Button variant="secondary" data-testid="onboarding-custom-habit-add" onClick={addCustom} disabled={full || !custom.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Use GPT 6 Luna for AI answers</p>
            <p className="mt-0.5 text-xs text-ink-3">Smarter briefings and chat. You can switch back to the built-in AI anytime.</p>
          </div>
          <span data-testid="onboarding-use-gpt-toggle">
            <Switch label="Use GPT 6 Luna" checked={value.useGpt} onCheckedChange={(useGpt) => onChange({ useGpt })} />
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Monday briefing email</p>
            <p className="mt-0.5 text-xs text-ink-3">
              {hasEmail ? "Your weekly plan, what's due and goal progress every Monday morning." : "Add an email to your account to turn this on."}
            </p>
          </div>
          <span data-testid="onboarding-monday-email-toggle">
            <Switch
              label="Monday briefing email"
              checked={value.mondayEmail}
              disabled={!hasEmail}
              onCheckedChange={(mondayEmail) => onChange({ mondayEmail })}
            />
          </span>
        </div>
      </section>
    </div>
  );
}

export async function applyFirstSteps(steps: FirstSteps, lifeAreaNames: string[]): Promise<void> {
  const os = getOS();
  syncLifeAreas(lifeAreaNames);
  const area = os.activeLifeAreas()[0] ?? null;
  if (steps.firstGoal.trim()) os.addGoal({ title: steps.firstGoal.trim(), lifeAreaId: area?.id ?? null });
  for (const habit of steps.starterHabits) os.addHabit({ title: habit });
  if (steps.useGpt) os.updateSettings({ aiProvider: "openai" });
  if (steps.mondayEmail) {
    await fetch("/api/v1/digest", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    }).catch(() => undefined);
  }
}
