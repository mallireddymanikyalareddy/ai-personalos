import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserAlertPermission,
  browserAlertsSupported,
  requestBrowserAlertPermission,
  showBrowserAlert,
} from "./browser-notifications";

const calls: { title: string; options?: NotificationOptions }[] = [];

class FakeNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(async () => "granted" as NotificationPermission);

  constructor(title: string, options?: NotificationOptions) {
    calls.push({ title, options });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
  FakeNotification.permission = "default";
  FakeNotification.requestPermission.mockClear();
});

describe("browser notifications", () => {
  it("reports unsupported when the API is absent", () => {
    expect(browserAlertsSupported()).toBe(false);
    expect(browserAlertPermission()).toBe("unsupported");
  });

  it("requests permission only when it is still undecided", async () => {
    vi.stubGlobal("Notification", FakeNotification);
    expect(await requestBrowserAlertPermission()).toBe("granted");
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);

    FakeNotification.permission = "denied";
    expect(await requestBrowserAlertPermission()).toBe("denied");
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("shows an alert only when permission is granted", async () => {
    vi.stubGlobal("Notification", FakeNotification);
    FakeNotification.permission = "granted";

    expect(await showBrowserAlert("Focus finished", { body: "Take a break" })).toBe(true);
    expect(calls[0]?.title).toBe("Focus finished");
    expect(calls[0]?.options?.body).toBe("Take a break");

    FakeNotification.permission = "denied";
    expect(await showBrowserAlert("Nope")).toBe(false);
  });
});
