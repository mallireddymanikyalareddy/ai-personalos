"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  isValidLocale,
  isValidTimeZone,
  type OnboardingState,
  type UserPreferences,
} from "@personalos/api-contract/account";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/ui/logo";
import { accountApi, errorMessage, isNetworkFailure } from "@/lib/api";
import { useAuth } from "@/modules/auth/auth-context";

type Draft = {
  displayName: string;
  timezone: string;
  locale: string;
  lifeAreaNames: string[];
  workingHours: UserPreferences["workingHours"];
  sleepSchedule: UserPreferences["sleepSchedule"];
  planningPreference: UserPreferences["planningPreference"];
  defaultPlanningView: UserPreferences["defaultPlanningView"];
  ai: UserPreferences["ai"];
  notifications: UserPreferences["notifications"];
};

const STEPS = ["About you", "What matters", "Your rhythm", "Preferences"] as const;

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "ja-JP", label: "日本語" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "zh-CN", label: "中文" },
];

function detectedTimezone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}

function detectedLocale(): string | undefined {
  const candidate = typeof navigator !== "undefined" ? navigator.language : undefined;
  return candidate && isValidLocale(candidate) ? candidate : undefined;
}

function draftKey(profileId: string): string {
  return `personalos:onboarding:${profileId}`;
}

function readSavedDraft(profileId: string | undefined): { step: number; draft: Draft } | null {
  if (!profileId) return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step: number; draft: Draft };
    const step = Math.min(Math.max(0, Number(parsed.step) || 0), STEPS.length - 1);
    return parsed.draft && typeof parsed.draft.displayName === "string" ? { step, draft: parsed.draft } : null;
  } catch {
    return null;
  }
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {STEPS.map((label, index) => (
        <span
          key={label}
          className={
            index === step
              ? "h-1.5 w-6 rounded-full bg-accent transition-all"
              : index < step
                ? "h-1.5 w-3 rounded-full bg-accent/40 transition-all"
                : "h-1.5 w-3 rounded-full bg-surface-3 transition-all"
          }
        />
      ))}
    </div>
  );
}

function ChoiceGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-2.5 sm:grid-cols-2"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={
              "rounded-xl border px-4 py-3 text-left transition-all duration-150 " +
              (active
                ? "border-accent bg-accent-soft shadow-card"
                : "border-line bg-surface hover:border-line-strong hover:bg-surface-2")
            }
          >
            <span className="block text-sm font-medium text-ink">{option.label}</span>
            {option.hint && (
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [timezones, setTimezones] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const load = () => {
      attempts += 1;
      accountApi
        .onboardingState()
        .then((next) => {
          if (cancelled) return;
          if (next.completed) {
            router.replace("/today");
            return;
          }
          setState(next);
          setError(null);
          const saved = readSavedDraft(next.profile?.id);
          if (saved) {
            setDraft(saved.draft);
            setStep(saved.step);
            return;
          }
          const pref = next.profile?.preferences;
          const detectedZone = detectedTimezone();
          const detectedLoc = detectedLocale();
          setDraft({
            displayName: next.profile?.displayName ?? "",
            timezone:
              next.profile?.timezone && next.profile.timezone !== "UTC"
                ? next.profile.timezone
                : (detectedZone ?? next.profile?.timezone ?? "UTC"),
            locale:
              next.profile?.locale && next.profile.locale !== "en"
                ? next.profile.locale
                : (detectedLoc ?? next.profile?.locale ?? "en"),
            lifeAreaNames: [],
            workingHours: pref?.workingHours ?? {
              enabled: true,
              days: [1, 2, 3, 4, 5],
              start: "09:00",
              end: "17:00",
            },
            sleepSchedule: pref?.sleepSchedule ?? { bedtime: "23:00", wakeTime: "07:00" },
            planningPreference: pref?.planningPreference ?? "morning",
            defaultPlanningView: pref?.defaultPlanningView ?? "week",
            ai: pref?.ai ?? { tone: "balanced", proactivity: "suggest", model: "default" },
            notifications: pref?.notifications ?? {
              emailDigest: "daily",
              dailyBriefing: true,
              taskReminders: true,
              aiInsights: true,
              quietHours: { enabled: true, start: "22:00", end: "07:00" },
            },
          });
        })
        .catch((caught) => {
          if (cancelled) return;
          setError(caught);
          if (attempts < 2) {
            window.setTimeout(load, 700);
          }
        });
    };
    load();
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      setTimezones(zones);
    } catch {
      setTimezones([]);
    }
    return () => {
      cancelled = true;
    };
  }, [router]);

  const profileId = state?.profile?.id;
  React.useEffect(() => {
    if (!profileId || !draft) return;
    window.sessionStorage.setItem(draftKey(profileId), JSON.stringify({ step, draft }));
  }, [profileId, step, draft]);

  const update = React.useCallback((patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const stepValid =
    draft !== null &&
    (step === 0
      ? draft.displayName.trim().length > 0 &&
        isValidTimeZone(draft.timezone) &&
        isValidLocale(draft.locale)
      : step === 1
        ? draft.lifeAreaNames.length > 0
        : true);

  const submit = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await accountApi.completeOnboarding({
        displayName: draft.displayName.trim(),
        timezone: draft.timezone,
        locale: draft.locale,
        lifeAreaNames: draft.lifeAreaNames,
        preferences: {
          planningPreference: draft.planningPreference,
          defaultPlanningView: draft.defaultPlanningView,
          workingHours: draft.workingHours,
          sleepSchedule: draft.sleepSchedule,
          ai: draft.ai,
          notifications: draft.notifications,
        },
      });
      if (profileId) window.sessionStorage.removeItem(draftKey(profileId));
      await refresh();
      router.replace("/today");
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  if (!state || !draft) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div
          className="size-8 animate-spin rounded-full border-2 border-line border-t-accent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  const toggleLifeArea = (name: string) => {
    update({
      lifeAreaNames: draft.lifeAreaNames.includes(name)
        ? draft.lifeAreaNames.filter((entry) => entry !== name)
        : [...draft.lifeAreaNames, name],
    });
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pb-2 pt-7 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo className="size-6" />
          <span className="text-sm font-semibold tracking-tight text-ink">PersonalOS</span>
        </div>
        <span className="text-xs font-medium text-ink-3">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pb-32 pt-8 sm:px-8">
        <div className="mb-7">
          <div className="mb-3">
            <StepDots step={step} />
          </div>
          <h1 data-testid="onboarding-step-title" className="text-2xl font-semibold tracking-tight text-ink">
            {step === 0 && "Tell the OS about you"}
            {step === 1 && "What matters to you right now?"}
            {step === 2 && "Set your daily rhythm"}
            {step === 3 && "Shape how the OS thinks"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            {step === 0 &&
              "We've detected your timezone and language — adjust anything that looks off."}
            {step === 1 &&
              "Life areas group your tasks, goals, and notes. Pick everything that's relevant — you can change these later."}
            {step === 2 &&
              "Working hours and sleep windows help the OS plan around your real life."}
            {step === 3 &&
              "Planning style, AI tone, and notifications — tune them once, or come back anytime."}
          </p>
        </div>

        {error !== null && (
          <div className="mb-5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <p role="alert">{errorMessage(error)}</p>
            {isNetworkFailure(error) && (
              <button
                type="button"
                className="mt-1 text-xs font-medium underline"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-5">
            <Field label="What should we call you?" htmlFor="ob-name" required>
              <Input
                id="ob-name"
                data-testid="onboarding-name-input"
                value={draft.displayName}
                onChange={(event) => update({ displayName: event.target.value })}
                placeholder="Your name"
                maxLength={64}
                autoFocus
              />
            </Field>
            <Field
              label="Timezone"
              htmlFor="ob-tz"
              required
              hint="Used for scheduling, daily planning, and reminders."
            >
              <Input
                id="ob-tz"
                data-testid="onboarding-timezone-input"
                list="ob-timezones"
                value={draft.timezone}
                onChange={(event) => update({ timezone: event.target.value })}
                placeholder="e.g. Europe/Berlin"
                autoComplete="off"
              />
              <datalist id="ob-timezones">
                {timezones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </Field>
            <Field label="Language" htmlFor="ob-locale" required>
              <Select
                id="ob-locale"
                data-testid="onboarding-locale-select"
                value={
                  LOCALES.some((entry) => entry.value === draft.locale)
                    ? draft.locale
                    : "en"
                }
                onChange={(event) => update({ locale: event.target.value })}
              >
                {!LOCALES.some((entry) => entry.value === draft.locale) && (
                  <option value={draft.locale}>{draft.locale}</option>
                )}
                {LOCALES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.value === draft.locale ? `${entry.label} — selected` : entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {state.lifeAreaCatalog.map((area) => {
              const active = draft.lifeAreaNames.includes(area.name);
              return (
                <button
                  key={area.name}
                  type="button"
                  aria-pressed={active}
                  data-testid={`onboarding-life-area-${area.name.toLowerCase()}`}
                  onClick={() => toggleLifeArea(area.name)}
                  className={
                    "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 " +
                    (active
                      ? "border-accent bg-accent-soft shadow-card"
                      : "border-line bg-surface hover:border-line-strong hover:bg-surface-2")
                  }
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: area.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{area.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                      {area.description}
                    </span>
                  </span>
                  <span
                    className={
                      "ml-auto mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors " +
                      (active ? "border-accent bg-accent" : "border-line-strong")
                    }
                    aria-hidden="true"
                  >
                    {active && (
                      <svg viewBox="0 0 24 24" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
            {draft.lifeAreaNames.length === 0 && (
              <p className="text-xs text-ink-3 sm:col-span-2">
                Choose at least one area to continue.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-7">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Working hours</h2>
                  <p className="text-xs text-ink-3">Focus time lands inside this window.</p>
                </div>
                <Switch
                  label="Working hours"
                  checked={draft.workingHours.enabled}
                  onCheckedChange={(checked) =>
                    update({ workingHours: { ...draft.workingHours, enabled: checked } })
                  }
                />
              </div>
              {draft.workingHours.enabled && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, day) => {
                      const active = draft.workingHours.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Day ${day}`}
                          onClick={() => {
                            const days = active
                              ? draft.workingHours.days.filter((entry) => entry !== day)
                              : [...draft.workingHours.days, day].sort((a, b) => a - b);
                            update({
                              workingHours: {
                                ...draft.workingHours,
                                days: days.length > 0 ? days : draft.workingHours.days,
                              },
                            });
                          }}
                          className={
                            "grid size-9 place-items-center rounded-lg text-xs font-semibold transition-colors " +
                            (active
                              ? "bg-accent text-white"
                              : "bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink")
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start" htmlFor="ob-wh-start">
                      <Input
                        id="ob-wh-start"
                        type="time"
                        value={draft.workingHours.start}
                        onChange={(event) =>
                          update({
                            workingHours: { ...draft.workingHours, start: event.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label="End" htmlFor="ob-wh-end">
                      <Input
                        id="ob-wh-end"
                        type="time"
                        value={draft.workingHours.end}
                        onChange={(event) =>
                          update({
                            workingHours: { ...draft.workingHours, end: event.target.value },
                          })
                        }
                      />
                    </Field>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Sleep schedule</h2>
                <p className="text-xs text-ink-3">
                  Quiet hours and morning planning follow this window.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bedtime" htmlFor="ob-bed">
                  <Input
                    id="ob-bed"
                    type="time"
                    value={draft.sleepSchedule.bedtime}
                    onChange={(event) =>
                      update({
                        sleepSchedule: { ...draft.sleepSchedule, bedtime: event.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Wake up" htmlFor="ob-wake">
                  <Input
                    id="ob-wake"
                    type="time"
                    value={draft.sleepSchedule.wakeTime}
                    onChange={(event) =>
                      update({
                        sleepSchedule: { ...draft.sleepSchedule, wakeTime: event.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-7">
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Planning style</h2>
                <p className="text-xs text-ink-3">When do you like to plan your day?</p>
              </div>
              <ChoiceGrid
                label="Planning style"
                value={draft.planningPreference}
                onChange={(value) => update({ planningPreference: value })}
                options={[
                  { value: "morning", label: "Morning person", hint: "Plan the day first thing." },
                  { value: "evening", label: "Evening planner", hint: "Wind down by organizing tomorrow." },
                  { value: "weekly_review", label: "Weekly reviewer", hint: "Big-picture, once a week." },
                ]}
              />
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Default view</h2>
                <p className="text-xs text-ink-3">Where the planner opens by default.</p>
              </div>
              <ChoiceGrid
                label="Default planning view"
                value={draft.defaultPlanningView}
                onChange={(value) => update({ defaultPlanningView: value })}
                options={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                  { value: "quarter", label: "Quarter" },
                ]}
              />
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">AI personality</h2>
                <p className="text-xs text-ink-3">How the assistant writes and how proactive it gets.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-ink-3">Response tone</span>
                  <ChoiceGrid
                    label="AI tone"
                    value={draft.ai.tone}
                    onChange={(value) => update({ ai: { ...draft.ai, tone: value } })}
                    options={[
                      { value: "concise", label: "Concise", hint: "Short and to the point." },
                      { value: "balanced", label: "Balanced", hint: "Useful detail, no fluff." },
                      { value: "detailed", label: "Detailed", hint: "Full context and reasoning." },
                    ]}
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-ink-3">Proactivity</span>
                  <ChoiceGrid
                    label="AI proactivity"
                    value={draft.ai.proactivity}
                    onChange={(value) => update({ ai: { ...draft.ai, proactivity: value } })}
                    options={[
                      { value: "suggest", label: "Suggest", hint: "Offers ideas when asked." },
                      { value: "plan", label: "Plan", hint: "Drafts plans you approve." },
                      { value: "automate", label: "Automate", hint: "Handles routine steps itself." },
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Notifications</h2>
                <p className="text-xs text-ink-3">Choose what deserves your attention.</p>
              </div>
              <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-ink">Email digest</span>
                  <Select
                    aria-label="Email digest"
                    className="w-36"
                    value={draft.notifications.emailDigest}
                    onChange={(event) =>
                      update({
                        notifications: {
                          ...draft.notifications,
                          emailDigest: event.target.value as "off" | "daily" | "weekly",
                        },
                      })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </Select>
                </div>
                {(
                  [
                    ["dailyBriefing", "Daily briefing"],
                    ["taskReminders", "Task reminders"],
                    ["aiInsights", "AI insights"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-ink">{label}</span>
                    <Switch
                      label={label}
                      checked={draft.notifications[key]}
                      onCheckedChange={(checked) =>
                        update({ notifications: { ...draft.notifications, [key]: checked } })
                      }
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
                  <span className="text-sm text-ink">Quiet hours</span>
                  <Switch
                    label="Quiet hours"
                    checked={draft.notifications.quietHours.enabled}
                    onCheckedChange={(checked) =>
                      update({
                        notifications: {
                          ...draft.notifications,
                          quietHours: { ...draft.notifications.quietHours, enabled: checked },
                        },
                      })
                    }
                  />
                </div>
                {draft.notifications.quietHours.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="From" htmlFor="ob-qh-start">
                      <Input
                        id="ob-qh-start"
                        type="time"
                        value={draft.notifications.quietHours.start}
                        onChange={(event) =>
                          update({
                            notifications: {
                              ...draft.notifications,
                              quietHours: {
                                ...draft.notifications.quietHours,
                                start: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label="Until" htmlFor="ob-qh-end">
                      <Input
                        id="ob-qh-end"
                        type="time"
                        value={draft.notifications.quietHours.end}
                        onChange={(event) =>
                          update({
                            notifications: {
                              ...draft.notifications,
                              quietHours: {
                                ...draft.notifications.quietHours,
                                end: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <Button
              variant="ghost"
              data-testid="onboarding-back-button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || busy}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              {step === STEPS.length - 1 ? (
                <Button
                  variant="primary"
                  size="lg"
                  data-testid="onboarding-finish-button"
                  onClick={submit}
                  loading={busy}
                  disabled={!stepValid}
                >
                  Open my OS
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  data-testid="onboarding-continue-button"
                  onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
                  disabled={!stepValid}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
