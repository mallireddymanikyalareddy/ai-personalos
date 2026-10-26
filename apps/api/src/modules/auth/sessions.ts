import { AppError } from "@personalos/api-contract";
import type { DeviceInfo, SessionInfo } from "@personalos/api-contract/account";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

import type { Db } from "../../db/index";
import { devices, sessions } from "../../db/schema";
import { writeAudit } from "../audit/service";
import { describeUserAgent } from "./device";

export interface SessionRequestContext {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionService {
  listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]>;
  getSessionOwnership(sessionId: string): Promise<{ ownerId: string; revoked: boolean } | undefined>;
  revokeSession(
    userId: string,
    sessionId: string,
    context: SessionRequestContext,
  ): Promise<void>;
  revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    context: SessionRequestContext,
  ): Promise<{ revoked: number }>;
  listDevices(userId: string): Promise<DeviceInfo[]>;
  getDeviceOwnership(deviceId: string): Promise<{ ownerId: string; name: string; revoked: boolean } | undefined>;
  revokeDevice(
    userId: string,
    deviceId: string,
    context: SessionRequestContext,
  ): Promise<void>;
}

export function createSessionService(deps: { db: Db; now?: () => number }): SessionService {
  const { db } = deps;
  const now = deps.now ?? ((): number => Date.now());

  async function listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionInfo[]> {
    const rows = await db
      .select({ session: sessions, device: devices })
      .from(sessions)
      .leftJoin(devices, eq(sessions.deviceId, devices.id))
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          sql`${sessions.expiresAt} > ${new Date(now())}`,
        ),
      )
      .orderBy(desc(sessions.lastSeenAt));

    return rows.map(({ session, device }) => {
      const described = describeUserAgent(session.userAgent);
      return {
        id: session.id,
        ip: session.ip,
        userAgent: session.userAgent,
        deviceName: device?.name ?? described.name,
        platform: device?.platform ?? described.platform,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        current: session.id === currentSessionId,
      };
    });
  }

  async function getSessionOwnership(
    sessionId: string,
  ): Promise<{ ownerId: string; revoked: boolean } | undefined> {
    const rows = await db
      .select({ userId: sessions.userId, revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return { ownerId: row.userId, revoked: row.revokedAt !== null };
  }

  async function revokeSession(
    userId: string,
    sessionId: string,
    context: SessionRequestContext,
  ): Promise<void> {
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date(now()) })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)),
      )
      .returning({ id: sessions.id });
    if (rows.length === 0) {
      throw new AppError("NOT_FOUND", { detail: "Session not found." });
    }
    await writeAudit(db, {
      actorUserId: userId,
      actorKind: "user",
      sessionId,
      action: "auth.session_revoked",
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      metadata: { sessionId },
    });
  }

  async function revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    context: SessionRequestContext,
  ): Promise<{ revoked: number }> {
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date(now()) })
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, currentSessionId),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    if (rows.length > 0) {
      await writeAudit(db, {
        actorUserId: userId,
        actorKind: "user",
        sessionId: currentSessionId,
        action: "auth.sessions_revoked",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { count: rows.length },
      });
    }
    return { revoked: rows.length };
  }

  async function listDevices(userId: string): Promise<DeviceInfo[]> {
    const deviceRows = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(desc(devices.lastSeenAt));
    const activeSessions = await db
      .select({ deviceId: sessions.deviceId, count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          sql`${sessions.expiresAt} > ${new Date(now())}`,
        ),
      )
      .groupBy(sessions.deviceId);
    const counts = new Map(
      activeSessions
        .filter((row) => row.deviceId !== null)
        .map((row) => [row.deviceId, row.count]),
    );
    return deviceRows.map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt.toISOString(),
      revokedAt: device.revokedAt?.toISOString() ?? null,
      activeSessions: counts.get(device.id) ?? 0,
    }));
  }

  async function getDeviceOwnership(
    deviceId: string,
  ): Promise<{ ownerId: string; name: string; revoked: boolean } | undefined> {
    const rows = await db
      .select({ userId: devices.userId, name: devices.name, revokedAt: devices.revokedAt })
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return { ownerId: row.userId, name: row.name, revoked: row.revokedAt !== null };
  }

  async function revokeDevice(
    userId: string,
    deviceId: string,
    context: SessionRequestContext,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(devices)
        .set({ revokedAt: new Date(now()) })
        .where(
          and(eq(devices.id, deviceId), eq(devices.userId, userId), isNull(devices.revokedAt)),
        )
        .returning({ name: devices.name });
      if (rows.length === 0) {
        throw new AppError("NOT_FOUND", { detail: "Device not found." });
      }
      await tx
        .update(sessions)
        .set({ revokedAt: new Date(now()) })
        .where(and(eq(sessions.deviceId, deviceId), isNull(sessions.revokedAt)));
      await writeAudit(tx, {
        actorUserId: userId,
        actorKind: "user",
        action: "auth.device_revoked",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { deviceId, name: rows[0].name },
      });
    });
  }

  return {
    listSessions,
    getSessionOwnership,
    revokeSession,
    revokeOtherSessions,
    listDevices,
    getDeviceOwnership,
    revokeDevice,
  };
}
