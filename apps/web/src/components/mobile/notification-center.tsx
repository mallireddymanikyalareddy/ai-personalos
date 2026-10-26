"use client";

import * as React from "react";

import { Bell, BellOff, Check, Clock, X } from "lucide-react";

import type { DueReminder, Notification as AppNotification } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useHaptics } from "@/hooks/use-haptics";
import { formatReminderTime } from "@personalos/core";
import { useToast } from "@/components/ui/toast";
import type { BrowserAlertPermission } from "@/lib/browser-notifications";

export interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  reminders: DueReminder[];
  enabled: boolean;
  onEnable: () => void;
  onDismiss?: (reminder: DueReminder["reminder"]) => void;
  onDismissAll?: () => void;
  notifications?: AppNotification[];
  onReadNotification?: (id: string) => void;
  onDismissNotification?: (id: string) => void;
  onMarkAllRead?: () => void;
  browserPermission?: BrowserAlertPermission;
  channel?: "in_app" | "push";
  onEnableBrowser?: () => void;
  onTestBrowser?: () => void;
}

const KIND_LABEL: Record<string, string> = {
  morning_journal: "Journal",
  evening_reflection: "Reflection",
  weekly_review: "Weekly review",
  journal_streak: "Streak",
  habit: "Habit",
  focus_end: "Focus",
  reminder: "Reminder",
  mention: "Mention",
  assignment: "Assignment",
  comment: "Comment",
  achievement: "Achievement",
  ai_insight: "Insight",
  approval: "Approval",
  system: "System",
  shift: "Shift",
  time_off: "Time off",
};

export function NotificationCenter({
  open,
  onClose,
  reminders,
  enabled,
  onEnable,
  onDismiss,
  onDismissAll,
  notifications = [],
  onReadNotification,
  onDismissNotification,
  onMarkAllRead,
  browserPermission,
  channel,
  onEnableBrowser,
  onTestBrowser,
}: NotificationCenterProps) {
  const haptics = useHaptics();
  const { toast } = useToast();

  const allowed = reminders.filter((reminder) => reminder.allowed);
  const blocked = reminders.filter((reminder) => !reminder.allowed);
  const unread = notifications.filter((notification) => notification.readAt == null);

  return (
    <Drawer open={open} onClose={onClose} title="Notifications" side="right">
      <div className="space-y-4">
        {!enabled ? (
          <section className="rounded-xl border border-line bg-surface p-4 text-center">
            <BellOff className="mx-auto size-6 text-ink-3" aria-hidden />
            <h3 className="mt-2 text-sm font-medium">Reminders are off</h3>
            <p className="mt-1 text-xs text-ink-3">
              Nothing will ever interrupt you unless you turn reminders on. You choose which ones.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => {
                haptics.trigger("commit");
                onEnable();
                toast("Reminders on - you can switch any of them off");
              }}
            >
              Turn on reminders
            </Button>
          </section>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-3">
              {allowed.length} ready now, {blocked.length} waiting.
            </p>
            {allowed.length > 1 && onDismissAll ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  haptics.trigger("tap");
                  onDismissAll();
                }}
              >
                Dismiss all
              </Button>
            ) : null}
          </div>
        )}

        {allowed.map((entry) => (
          <article key={entry.reminder.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{entry.reminder.title}</p>
                <p className="mt-0.5 text-xs text-ink-3">{entry.reminder.body}</p>
              </div>
              <Badge tone="outline">{KIND_LABEL[entry.reminder.kind] ?? entry.reminder.kind}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                <Clock className="size-3" aria-hidden />
                {formatReminderTime(entry.reminder.dueAt)}
              </p>
              {onDismiss ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    haptics.trigger("tap");
                    onDismiss(entry.reminder);
                  }}
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
          </article>
        ))}

        {allowed.length === 0 && enabled && notifications.length === 0 ? (
          <section className="rounded-xl border border-dashed border-line p-6 text-center">
            <Bell className="mx-auto size-5 text-ink-3" aria-hidden />
            <p className="mt-2 text-sm text-ink-2">Nothing due right now</p>
            <p className="text-xs text-ink-3">New reminders appear here when they are due.</p>
          </section>
        ) : null}

        {enabled && blocked.length > 0 ? (
          <section className="rounded-xl border border-line bg-surface p-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">Waiting</h3>
            <div className="mt-2 space-y-2">
              {blocked.map((entry) => (
                <div key={entry.reminder.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-2">{entry.reminder.title}</p>
                    <p className="text-[11px] text-ink-3">{entry.reason}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {formatReminderTime(entry.reminder.dueAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {notifications.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">Activity</h3>
              {unread.length > 0 && onMarkAllRead ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    haptics.trigger("tap");
                    onMarkAllRead();
                  }}
                >
                  Mark all read
                </Button>
              ) : null}
            </div>
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={
                  notification.readAt == null
                    ? "rounded-xl border border-accent/40 bg-accent-soft/40 p-3"
                    : "rounded-xl border border-line bg-surface p-3"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.body ? (
                      <p className="mt-0.5 text-xs text-ink-3">{notification.body}</p>
                    ) : null}
                  </div>
                  <Badge tone="outline">{KIND_LABEL[notification.kind] ?? notification.kind}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                    <Clock className="size-3" aria-hidden />
                    {formatReminderTime(notification.fireAt ?? notification.createdAt)}
                  </p>
                  <div className="flex items-center gap-1">
                    {notification.readAt == null && onReadNotification ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          haptics.trigger("tap");
                          onReadNotification(notification.id);
                        }}
                      >
                        <Check className="size-3.5" aria-hidden />
                        Read
                      </Button>
                    ) : null}
                    {onDismissNotification ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          haptics.trigger("tap");
                          onDismissNotification(notification.id);
                        }}
                      >
                        <X className="size-3.5" aria-hidden />
                        Dismiss
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {enabled && onEnableBrowser ? (
          <section className="rounded-xl border border-line bg-surface p-3">
            <h3 className="text-sm font-medium">Browser alerts</h3>
            {browserPermission === "granted" ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">
                  {channel === "push"
                    ? "Browser alerts are on for this device."
                    : "Alerts are allowed on this device."}
                </p>
                <div className="flex items-center gap-1">
                  {channel !== "push" ? (
                    <Button variant="primary" size="sm" onClick={onEnableBrowser}>
                      Use browser alerts
                    </Button>
                  ) : null}
                  {onTestBrowser ? (
                    <Button variant="ghost" size="sm" onClick={onTestBrowser}>
                      Send test
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : browserPermission === "denied" ? (
              <p className="mt-1 text-xs text-ink-3">
                Alerts are blocked. Allow notifications for this site in your browser settings.
              </p>
            ) : browserPermission === "unsupported" ? (
              <p className="mt-1 text-xs text-ink-3">
                This browser does not support system alerts. In-app reminders still work.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">
                  Get reminders on your desktop or phone lock screen while the app is open.
                </p>
                <Button variant="primary" size="sm" onClick={onEnableBrowser}>
                  Enable
                </Button>
              </div>
            )}
          </section>
        ) : null}

        <a
          href="/settings?tab=mobile"
          className="block text-center text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Notification settings
        </a>
      </div>
    </Drawer>
  );
}

export function NotificationBell({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  const haptics = useHaptics();
  return (
    <button
      type="button"
      onClick={() => {
        haptics.trigger("tap");
        onClick();
      }}
      aria-label={count > 0 ? `Notifications, ${count} ready` : "Notifications"}
      className="relative grid size-10 place-items-center rounded-lg text-ink-2 active:bg-surface-2"
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
