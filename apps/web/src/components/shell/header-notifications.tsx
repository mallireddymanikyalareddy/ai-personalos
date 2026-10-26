"use client";

import * as React from "react";

import { NotificationBell, NotificationCenter } from "@/components/mobile/notification-center";
import { useToast } from "@/components/ui/toast";
import { useHaptics } from "@/hooks/use-haptics";
import {
  browserAlertPermission,
  requestBrowserAlertPermission,
  showBrowserAlert,
  type BrowserAlertPermission,
} from "@/lib/browser-notifications";
import { getOS } from "@/store/os";
import { useAppState } from "@/store/use-os";

export function HeaderNotifications() {
  const os = getOS();
  const haptics = useHaptics();
  const { toast } = useToast();
  useAppState();
  const [open, setOpen] = React.useState(false);
  const [now, setNow] = React.useState(0);
  const [permission, setPermission] = React.useState<BrowserAlertPermission>("unsupported");
  const shownAlerts = React.useRef(new Set<string>());

  React.useEffect(() => {
    setPermission(browserAlertPermission());
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 30_000);
    const onVisibility = () => {
      if (!document.hidden) {
        setPermission(browserAlertPermission());
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const reminders = os.dueReminders(now);
  const allowed = reminders.filter((reminder) => reminder.allowed);
  const notifications = os.notifications();
  const unreadCount = notifications.filter((notification) => notification.readAt == null).length;
  const readyCount = allowed.length + unreadCount;
  const preferences = os.mobilePreferences().notifications;
  const enabled = preferences.enabled;
  const alertKey = allowed.map((entry) => `${entry.reminder.id}:${entry.reminder.dueAt}`).join("|");
  const allowedRef = React.useRef(allowed);
  allowedRef.current = allowed;

  React.useEffect(() => {
    if (!enabled || preferences.channel !== "push" || permission !== "granted") return;
    if (allowedRef.current.length === 0) return;
    const dayKey = new Date(now).toDateString();
    for (const entry of allowedRef.current) {
      const key = `personalos:alert:${entry.reminder.id}:${dayKey}`;
      if (shownAlerts.current.has(key)) continue;
      shownAlerts.current.add(key);
      try {
        if (window.localStorage.getItem(key)) continue;
        window.localStorage.setItem(key, "1");
      } catch {
      }
      void showBrowserAlert(entry.reminder.title, {
        body: entry.reminder.body,
        tag: key,
        url: "/today",
      });
    }
  }, [alertKey, allowed.length, enabled, now, permission, preferences.channel]);

  const enableBrowserAlerts = async () => {
    const next = await requestBrowserAlertPermission();
    setPermission(next);
    if (next === "granted") {
      os.setNotificationPreferences({ enabled: true, channel: "push" });
      haptics.trigger("success");
      toast("Browser alerts on for this device");
      return;
    }
    if (next === "unsupported") {
      toast("This browser does not support system alerts");
      return;
    }
    toast("Browser alerts were not allowed");
  };

  const sendTestAlert = async () => {
    const shown = await showBrowserAlert("PersonalOS", {
      body: "Browser alerts are working on this device.",
      tag: "personalos:test",
      url: "/today",
    });
    toast(shown ? "Test alert sent" : "Could not send a browser alert");
  };

  return (
    <>
      <NotificationBell count={readyCount} onClick={() => setOpen(true)} />
      <NotificationCenter
        open={open}
        onClose={() => setOpen(false)}
        reminders={reminders}
        enabled={enabled}
        notifications={notifications}
        browserPermission={permission}
        channel={preferences.channel}
        onEnable={() => {
          os.setNotificationPreferences({ enabled: true });
          haptics.trigger("success");
        }}
        onEnableBrowser={() => {
          void enableBrowserAlerts();
        }}
        onTestBrowser={() => {
          void sendTestAlert();
        }}
        onDismiss={(reminder) => {
          os.dismissScheduledReminder(reminder);
          haptics.trigger("tap");
        }}
        onDismissAll={() => {
          const count = os.dismissDueReminders();
          haptics.trigger("commit");
          toast(count > 0 ? `${count} reminders dismissed` : "Nothing to dismiss");
        }}
        onReadNotification={(id) => {
          os.markNotificationRead(id);
          haptics.trigger("tap");
        }}
        onDismissNotification={(id) => {
          os.dismissNotification(id);
          haptics.trigger("tap");
        }}
        onMarkAllRead={() => {
          const count = os.markAllNotificationsRead();
          haptics.trigger("commit");
          toast(count > 0 ? `${count} notifications marked read` : "Nothing to mark read");
        }}
      />
    </>
  );
}
