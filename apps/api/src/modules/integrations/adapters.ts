import {
  PROVIDER_BY_ID,
  buildAuthorizeUrl,
  buildTokenRequestBody,
  buildRefreshedTokenRequestBody,
  parseTokenResponse,
  type ExternalItem,
  type OAuthTokenSet,
  type Timestamp,
  type TokenVaultEntry,
} from "@personalos/core";

import type { FetchLike } from "../auth/oauth";

export const INTEGRATION_PROVIDER_IDS = ["google_calendar", "outlook_calendar", "google_drive"] as const;
export type IntegrationProviderId = (typeof INTEGRATION_PROVIDER_IDS)[number];

const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GRAPH_EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

const CALENDAR_PARSERS = {
  google_calendar: googleEventToExternal,
  outlook_calendar: outlookEventToExternal,
} as const;

export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function cleanTimestamp(value: unknown): Timestamp | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isAllDayMarker(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeMoment(value: string): { at: Timestamp | null; allDay: boolean } {
  if (isAllDayMarker(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return { at: new Date(year, month - 1, day, 9, 0, 0, 0).getTime(), allDay: true };
  }
  const parsed = Date.parse(value);
  return { at: Number.isFinite(parsed) ? parsed : null, allDay: false };
}

function eventBound(payload: Record<string, unknown>, key: "start" | "end"): { at: Timestamp | null; allDay: boolean } {
  const field = pickObject(payload[key]);
  const value = cleanString(field.dateTime) ?? cleanString(field.date);
  if (!value) return { at: null, allDay: false };
  return normalizeMoment(value);
}

function attendeeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = pickObject(entry);
      const address = pickObject(record.emailAddress).address ?? record.email;
      return cleanString(address);
    })
    .filter((email): email is string => email != null);
}

export function googleEventToExternal(raw: Record<string, unknown>): ExternalItem | null {
  const externalId = cleanString(raw.id);
  if (!externalId) return null;
  const start = eventBound(raw, "start");
  const end = eventBound(raw, "end");
  return {
    externalId,
    etag: cleanString(raw.etag),
    lastModified: cleanTimestamp(raw.updated),
    deleted: cleanString(raw.status) === "cancelled",
    payload: {
      title: cleanString(raw.summary) ?? "Untitled event",
      startsAt: start.at,
      endsAt: end.at ?? (start.at != null ? start.at + 30 * 60_000 : null),
      allDay: start.allDay,
      notes: cleanString(raw.description) ?? "",
      location: cleanString(raw.location) ?? "",
      attendees: attendeeEmails(raw.attendees),
    },
  };
}

export function outlookEventToExternal(raw: Record<string, unknown>): ExternalItem | null {
  const externalId = cleanString(raw.id);
  if (!externalId) return null;
  const start = eventBound(raw, "start");
  const end = eventBound(raw, "end");
  const locationField = pickObject(raw.location);
  return {
    externalId,
    etag: cleanString(raw["@odata.etag"]),
    lastModified: cleanTimestamp(raw.lastModifiedDateTime),
    deleted: false,
    payload: {
      title: cleanString(raw.subject) ?? "Untitled event",
      startsAt: start.at,
      endsAt: end.at ?? (start.at != null ? start.at + 30 * 60_000 : null),
      allDay: start.allDay,
      notes: cleanString(pickObject(raw.body).content) ?? "",
      location: cleanString(locationField.displayName) ?? cleanString(raw.location) ?? "",
      attendees: attendeeEmails(raw.attendees),
    },
  };
}

export function driveFileToExternal(raw: Record<string, unknown>): ExternalItem | null {
  const externalId = cleanString(raw.id);
  if (!externalId) return null;
  const name = cleanString(raw.name) ?? "Untitled file";
  return {
    externalId,
    etag: cleanString(raw.md5Checksum),
    lastModified: cleanTimestamp(raw.modifiedTime),
    deleted: cleanString(raw.trashed) === "true",
    payload: {
      title: name,
      notes: "Imported from Google Drive.",
      mimeType: cleanString(raw.mimeType) ?? "application/octet-stream",
      size: typeof raw.size === "number" ? raw.size : null,
      webViewLink: cleanString(raw.webViewLink) ?? "",
      extension: name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : null,
    },
  };
}

export function parseProviderPayload(
  providerId: IntegrationProviderId,
  payload: Record<string, unknown>,
): ExternalItem[] {
  if (providerId === "google_drive") {
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files
      .map((raw) => driveFileToExternal(pickObject(raw)))
      .filter((item): item is ExternalItem => item != null);
  }
  const itemsKey = providerId === "google_calendar" ? "items" : "value";
  const rawItems = Array.isArray(payload[itemsKey]) ? (payload[itemsKey] as unknown[]) : [];
  const parser = CALENDAR_PARSERS[providerId];
  return rawItems
    .map((raw) => parser(pickObject(raw)))
    .filter((item): item is ExternalItem => item != null);
}

export function pullWindow(now: Timestamp, importRangeDays: number): { timeMin: string; timeMax: string } {
  const from = new Date(now - importRangeDays * 86_400_000);
  const to = new Date(now + importRangeDays * 86_400_000);
  return { timeMin: from.toISOString(), timeMax: to.toISOString() };
}

export function calendarPullUrl(
  providerId: "google_calendar" | "outlook_calendar",
  window: { timeMin: string; timeMax: string },
): string {
  const url = new URL(providerId === "google_calendar" ? GOOGLE_EVENTS_URL : GRAPH_EVENTS_URL);
  if (providerId === "google_calendar") {
    url.searchParams.set("timeMin", window.timeMin);
    url.searchParams.set("timeMax", window.timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
  } else {
    url.searchParams.set("startDateTime", window.timeMin);
    url.searchParams.set("endDateTime", window.timeMax);
    url.searchParams.set("$top", "250");
  }
  return url.toString();
}

export function drivePullUrl(): string {
  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime,md5Checksum,webViewLink,trashed)");
  url.searchParams.set("pageSize", "200");
  return url.toString();
}

export function authorizeUrlFor(options: {
  providerId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeVerifier: string;
}): string {
  const provider = PROVIDER_BY_ID[options.providerId];
  if (!provider?.oauth) throw new Error(`Provider ${options.providerId} has no OAuth configuration.`);
  const url = new URL(
    buildAuthorizeUrl({
      provider,
      redirectUri: options.redirectUri,
      state: options.state,
      codeChallenge: options.codeChallenge,
      codeVerifier: options.codeVerifier,
    }),
  );
  url.searchParams.set("client_id", options.clientId);
  return url.toString();
}

export function tokenRequestBodyFor(options: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): string {
  return buildTokenRequestBody(
    { code: options.code, codeVerifier: options.codeVerifier, redirectUri: options.redirectUri },
    { clientId: options.clientId, clientSecret: options.clientSecret },
  );
}

export function refreshRequestBodyFor(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): string {
  return buildRefreshedTokenRequestBody(options.refreshToken, {
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  });
}

export async function exchangeCode(
  providerId: string,
  fetchFn: FetchLike,
  request: { body: string },
  now: Timestamp = Date.now(),
): Promise<OAuthTokenSet> {
  const provider = PROVIDER_BY_ID[providerId];
  if (!provider?.oauth) throw new Error(`Provider ${providerId} has no OAuth configuration.`);
  const response = await fetchFn(provider.oauth.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: request.body,
  });
  if (!response.ok) throw new Error(`Token exchange failed with status ${response.status}.`);
  return parseTokenResponse((await response.json()) as Record<string, unknown>, now);
}

export function toVaultEntry(tokens: OAuthTokenSet, externalAccountId: string | null): TokenVaultEntry {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    tokenType: tokens.tokenType,
    externalAccountId,
  };
}

