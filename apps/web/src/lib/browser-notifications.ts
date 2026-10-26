export type BrowserAlertPermission = "default" | "granted" | "denied" | "unsupported";

export function browserAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function browserAlertPermission(): BrowserAlertPermission {
  if (!browserAlertsSupported()) return "unsupported";
  return window.Notification.permission;
}

export async function requestBrowserAlertPermission(): Promise<BrowserAlertPermission> {
  if (!browserAlertsSupported()) return "unsupported";
  if (window.Notification.permission !== "default") return window.Notification.permission;
  try {
    return await window.Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function showBrowserAlert(
  title: string,
  options: { body?: string; tag?: string; url?: string } = {},
): Promise<boolean> {
  if (!browserAlertsSupported() || window.Notification.permission !== "granted") return false;
  const notificationOptions: NotificationOptions = {
    body: options.body,
    tag: options.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: options.url ?? "/today" },
  };
  try {
    const registration =
      "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) {
      await registration.showNotification(title, notificationOptions);
      return true;
    }
    new window.Notification(title, notificationOptions);
    return true;
  } catch {
    return false;
  }
}
