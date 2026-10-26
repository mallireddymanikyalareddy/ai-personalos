"use client";

import * as React from "react";

import { Smartphone } from "lucide-react";

import {
  createDefaultMobilePreferences,
  MOBILE_WIDGETS,
  QUICK_ACTIONS,
  SWIPE_ACTIONS,
  swipeActionList,
  type MobileWidgetId,
  type QuickActionId,
  type SwipeActionId,
} from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useHaptics } from "@/hooks/use-haptics";
import { useToast } from "@/components/ui/toast";
import {
  browserAlertPermission,
  requestBrowserAlertPermission,
  type BrowserAlertPermission,
} from "@/lib/browser-notifications";
import { useAppState, useOS } from "@/store/use-os";

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));

const REMINDER_TOGGLES = [
  { key: "morningJournal", label: "Morning journal", hint: "A prompt to start the day." },
  { key: "eveningReflection", label: "Evening reflection", hint: "A prompt to close the day." },
  { key: "weeklyReview", label: "Weekly review", hint: "A nudge to review the week." },
  { key: "journalStreak", label: "Journal streak", hint: "A reminder before a streak breaks." },
  { key: "habitReminders", label: "Habit reminders", hint: "Nudges for habits due today." },
  { key: "focusEnd", label: "Focus end", hint: "A signal when a focus block ends." },
] as const;

export function MobileSettingsSection() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();
  const haptics = useHaptics();
  const preferences = os.mobilePreferences();
  const [alertPermission, setAlertPermission] = React.useState<BrowserAlertPermission>("unsupported");

  React.useEffect(() => {
    setAlertPermission(browserAlertPermission());
  }, []);

  const toggleQuickAction = (id: QuickActionId) => {
    const has = preferences.quickActions.includes(id);
    if (has && preferences.quickActions.length === 1) {
      toast("Keep at least one quick action");
      return;
    }
    const next = has
      ? preferences.quickActions.filter((action) => action !== id)
      : [...preferences.quickActions, id];
    os.setQuickActions(next);
    haptics.trigger("tap");
  };

  const toggleWidget = (id: MobileWidgetId) => {
    const has = preferences.widgets.includes(id);
    if (has && preferences.widgets.length === 1) {
      toast("Keep at least one widget");
      return;
    }
    const next = has
      ? preferences.widgets.filter((widget) => widget !== id)
      : [...preferences.widgets, id];
    os.setMobileWidgets(next);
    haptics.trigger("tap");
  };

  const resetMobile = () => {
    os.updateMobilePreferences(createDefaultMobilePreferences());
    toast("Mobile settings reset", { tone: "success" });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">One-handed use</h2>
            <p className="mt-1 text-xs text-ink-3">
              Keeps the capture button, navigation, and primary actions inside the thumb zone.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={resetMobile}>
            Reset mobile
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">One-handed mode</span>
            <Switch
              checked={preferences.oneHanded}
              onCheckedChange={(checked) => {
                os.setOneHandedMode(checked);
                haptics.trigger("tap");
              }}
              label="One-handed mode"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Handedness</span>
            <Segmented
              options={[
                { value: "right", label: "Right" },
                { value: "left", label: "Left" },
              ]}
              value={preferences.handedness}
              onChange={(value) => os.setOneHandedMode(preferences.oneHanded, value)}
              label="Handedness"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Larger touch targets</span>
            <Switch
              checked={preferences.largerTouchTargets}
              onCheckedChange={(checked) => {
                os.updateMobilePreferences({ largerTouchTargets: checked });
                haptics.trigger("tap");
              }}
              label="Larger touch targets"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Pull-to-capture sheet</span>
            <Switch
              checked={preferences.pullToCapture}
              onCheckedChange={(checked) => os.updateMobilePreferences({ pullToCapture: checked })}
              label="Pull to capture"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Haptics</h2>
        <p className="mt-1 text-xs text-ink-3">A short tap when something lands. Never required.</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Haptic feedback</span>
          <Switch
            checked={preferences.hapticsEnabled}
            onCheckedChange={(checked) => {
              os.setHaptics(checked);
              if (checked) haptics.trigger("success");
            }}
            label="Haptic feedback"
          />
        </div>
        {preferences.hapticsEnabled ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm">Strength</span>
            <Segmented
              options={[
                { value: "light", label: "Light" },
                { value: "medium", label: "Medium" },
                { value: "strong", label: "Strong" },
              ]}
              value={preferences.hapticIntensity}
              onChange={(value) => {
                os.setHaptics(preferences.hapticsEnabled, value);
                haptics.trigger("tap");
                toast("Haptic strength updated");
              }}
              label="Haptic strength"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-3">Turn haptics on to choose a strength.</p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Swipe gestures</h2>
        <p className="mt-1 text-xs text-ink-3">
          Swipe a row to act without opening it. Destructive actions always confirm first.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Enable swipes</span>
          <Switch
            checked={preferences.swipe.enabled}
            onCheckedChange={(checked) => {
              os.setSwipeConfig({ enabled: checked });
              haptics.trigger("tap");
            }}
            label="Enable swipes"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Notes</span>
          <Switch
            checked={preferences.swipeEnabledNotes}
            onCheckedChange={(checked) => {
              os.updateMobilePreferences({ swipeEnabledNotes: checked });
              haptics.trigger("tap");
            }}
            label="Note swipes"
            disabled={!preferences.swipe.enabled}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["task", "journal_entry"] as const).map((entity) => (
            <div key={entity} className="space-y-2">
              <FieldLabel>{entity === "task" ? "Task rows" : "Journal entries"}</FieldLabel>
              <div className="flex items-center gap-2">
                <span className="w-12 text-xs text-ink-3">Right</span>
                <Select
                  value={entity === "task" ? preferences.swipeRightTask : preferences.swipeRightJournal}
                  onChange={(event) =>
                    os.setSwipeActions({ entity, right: event.target.value as SwipeActionId })
                  }
                  aria-label={`Right swipe action for ${entity === "task" ? "tasks" : "journal entries"}`}
                  disabled={!preferences.swipe.enabled}
                >
                  {swipeActionList(entity).map((action) => (
                    <option key={action.id} value={action.id}>
                      {SWIPE_ACTIONS[action.id].label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 text-xs text-ink-3">Left</span>
                <Select
                  value={entity === "task" ? preferences.swipeLeftTask : preferences.swipeLeftJournal}
                  onChange={(event) =>
                    os.setSwipeActions({ entity, left: event.target.value as SwipeActionId })
                  }
                  aria-label={`Left swipe action for ${entity === "task" ? "tasks" : "journal entries"}`}
                  disabled={!preferences.swipe.enabled}
                >
                  {swipeActionList(entity).map((action) => (
                    <option key={action.id} value={action.id}>
                      {SWIPE_ACTIONS[action.id].label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Quick actions</h2>
        <p className="mt-1 text-xs text-ink-3">The shortlist shown in the mobile capture sheet.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(QUICK_ACTIONS) as QuickActionId[]).map((id) => {
            const active = preferences.quickActions.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleQuickAction(id)}
                className={
                  active
                    ? "rounded-full border-2 border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-ink"
                    : "rounded-full border border-line px-3 py-1.5 text-sm text-ink-3"
                }
              >
                {QUICK_ACTIONS[id].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Widgets</h2>
        <p className="mt-1 text-xs text-ink-3">What appears on your Today screen on a phone.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(MOBILE_WIDGETS) as MobileWidgetId[]).map((id) => {
            const active = preferences.widgets.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWidget(id)}
                className={
                  active
                    ? "rounded-full border-2 border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-ink"
                    : "rounded-full border border-line px-3 py-1.5 text-sm text-ink-3"
                }
              >
                {MOBILE_WIDGETS[id].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Device reminders</h2>
        <p className="mt-1 text-xs text-ink-3">
          Nudges for the routines you want to keep. Choose in-app or browser alerts on this device.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-sm">Delivery</span>
            <span className="block text-xs text-ink-3">
              {preferences.notifications.channel === "push"
                ? "Browser alerts are used when allowed."
                : "Reminders stay inside the app."}
            </span>
          </div>
          <Segmented
            label="Reminder delivery"
            value={preferences.notifications.channel}
            options={[
              { value: "in_app", label: "In app" },
              { value: "push", label: "Browser" },
            ]}
            onChange={(value) => {
              if (value === "in_app") {
                os.setNotificationPreferences({ channel: "in_app" });
                return;
              }
              void requestBrowserAlertPermission().then((permission) => {
                setAlertPermission(permission);
                if (permission !== "granted") {
                  toast(
                    permission === "unsupported"
                      ? "This browser does not support system alerts"
                      : "Allow notifications for this site to use browser alerts",
                  );
                  return;
                }
                os.setNotificationPreferences({ channel: "push", enabled: true });
                haptics.trigger("success");
              });
            }}
          />
        </div>
        {preferences.notifications.channel === "push" && alertPermission === "denied" ? (
          <p className="mt-2 text-xs text-danger">
            Browser alerts are blocked in your browser settings.
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Reminder engine</span>
          <Switch
            checked={preferences.notifications.enabled}
            onCheckedChange={(checked) => {
              os.setNotificationPreferences({ enabled: checked });
              haptics.trigger("tap");
            }}
            label="Reminder engine"
          />
        </div>
        <div className="mt-3 space-y-1 border-t border-line pt-3">
          {REMINDER_TOGGLES.map((reminder) => (
            <div key={reminder.key} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <span className="block text-sm text-ink">{reminder.label}</span>
                <span className="block text-xs text-ink-3">{reminder.hint}</span>
              </div>
              <Switch
                checked={preferences.notifications[reminder.key]}
                onCheckedChange={(checked) =>
                  os.setNotificationPreferences({ [reminder.key]: checked })
                }
                label={reminder.label}
                disabled={!preferences.notifications.enabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <label className="space-y-1 text-xs text-ink-3" htmlFor="mobile-quiet-start">
            <span>Quiet from</span>
            <Select
              id="mobile-quiet-start"
              value={String(preferences.notifications.quietHoursStart)}
              onChange={(event) =>
                os.setNotificationPreferences({ quietHoursStart: Number(event.target.value) })
              }
              disabled={!preferences.notifications.enabled}
            >
              {HOURS.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs text-ink-3" htmlFor="mobile-quiet-end">
            <span>Quiet until</span>
            <Select
              id="mobile-quiet-end"
              value={String(preferences.notifications.quietHoursEnd)}
              onChange={(event) =>
                os.setNotificationPreferences({ quietHoursEnd: Number(event.target.value) })
              }
              disabled={!preferences.notifications.enabled}
            >
              {HOURS.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">
          <Smartphone className="mr-1 inline size-4" aria-hidden />
          Offline
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          Everything is written locally first, so the app keeps working without a connection.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">Local-first writing</span>
          <Switch
            checked={preferences.offlineFirst}
            onCheckedChange={(checked) => os.updateMobilePreferences({ offlineFirst: checked })}
            label="Local-first writing"
          />
        </div>
      </section>
    </div>
  );
}
