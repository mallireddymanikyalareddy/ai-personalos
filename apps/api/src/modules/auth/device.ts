import { createHash, randomUUID } from "node:crypto";

import type { Db } from "../../db/index";
import { devices } from "../../db/schema";

export interface DeviceDescription {
  name: string;
  platform: string;
  fingerprint: string;
}

export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? "";
  const fingerprint = createHash("sha256").update(ua || "unknown").digest("hex").slice(0, 24);
  if (!ua) {
    return { name: "Unknown browser", platform: "Unknown device", fingerprint };
  }

  let name = "Browser";
  if (/Edg\//.test(ua)) name = "Edge";
  else if (/OPR\/|Opera/.test(ua)) name = "Opera";
  else if (/Firefox\/|FxiOS/.test(ua)) name = "Firefox";
  else if (/CriOS|Chrome\/|Chromium\//.test(ua)) name = "Chrome";
  else if (/Safari\//.test(ua)) name = "Safari";

  let platform = "Unknown device";
  if (/Windows NT/.test(ua)) platform = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) platform = "iOS";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/Mac OS X|Macintosh/.test(ua)) platform = "macOS";
  else if (/CrOS/.test(ua)) platform = "ChromeOS";
  else if (/Linux/.test(ua)) platform = "Linux";

  return { name, platform, fingerprint };
}

export async function upsertDevice(
  target: Pick<Db, "insert">,
  userId: string,
  userAgent: string | null | undefined,
  now: Date,
): Promise<{ id: string }> {
  const description = describeUserAgent(userAgent);
  const rows = await target
    .insert(devices)
    .values({
      id: randomUUID(),
      userId,
      name: description.name,
      platform: description.platform,
      fingerprint: description.fingerprint,
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [devices.userId, devices.fingerprint],
      set: { lastSeenAt: now, revokedAt: null },
    })
    .returning({ id: devices.id });
  return rows[0];
}
