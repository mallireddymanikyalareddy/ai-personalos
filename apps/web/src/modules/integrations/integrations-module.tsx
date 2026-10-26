"use client";

import * as React from "react";

import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleAlert,
  Clock,
  Cloud,
  FolderOpen,
  GitMerge,
  HardDrive,
  History,
  Link2,
  MessageSquare,
  NotebookPen,
  Pause,
  Play,
  PlugZap,
  RefreshCw,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  buildSyncLog,
  buildSyncPlan,
  finishSyncLog,
  planSummary,
  relativeSyncTime,
  responseTaskInput,
  shouldAutoResolve,
  supportsDirection,
  syncStatusLabel,
  type ExternalChangeSet,
  type LocalEntityRef,
  type ProviderDefinition,
  type SyncLogStatus,
  type SyncPlan,
  type Timestamp,
} from "@personalos/core";
import { INTEGRATION_PROVIDERS, PROVIDER_BY_ID } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { integrationApi, type IntegrationProviderInfo } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOS, useAppState } from "@/store/use-os";

type Range = "7" | "30" | "90";
type Filter = "all" | "connected" | "attention" | "available";

const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const STATUS_TONES: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  connected: "success",
  paused: "warning",
  error: "danger",
  reauthorizing: "warning",
  disconnected: "neutral",
};

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  google_calendar: CalendarDays,
  outlook_calendar: CalendarRange,
  google_drive: HardDrive,
  icloud_calendar: CalendarClock,
  dropbox: FolderOpen,
  onedrive: Cloud,
  notion: NotebookPen,
  slack: MessageSquare,
};

const KIND_TONES: Record<string, string> = {
  calendar: "bg-accent-soft text-accent-ink",
  files: "bg-success-soft text-success",
  notes: "bg-warning-soft text-warning",
  communication: "bg-surface-2 text-ink-2",
};

const CONFLICT_KIND_LABELS: Record<string, string> = {
  event_time: "Time changed",
  event_cancelled: "Event cancelled",
  file_deleted: "File deleted",
  title_mismatch: "Title mismatch",
  duplicate: "Possible duplicate",
};

const LOG_STATUS_TONES: Record<SyncLogStatus, "neutral" | "success" | "warning" | "danger"> = {
  started: "neutral",
  success: "success",
  partial: "warning",
  failed: "danger",
};

const LOG_STATUS_LABELS: Record<SyncLogStatus, string> = {
  started: "Started",
  success: "Success",
  partial: "Partial",
  failed: "Failed",
};

function providerIcon(providerId: string) {
  return PROVIDER_ICONS[providerId] ?? Link2;
}

function directionLabel(direction: string): string {
  return direction === "bidirectional" ? "Two-way" : direction === "outbound" ? "Outbound" : "Inbound only";
}

function stateOf(os: ReturnType<typeof useOS>) {
  return os.getState();
}

function localEntities(os: ReturnType<typeof useOS>, integrationId: string): LocalEntityRef[] {
  const integration = os.getIntegration(integrationId);
  if (!integration) return [];
  const { events, notes } = stateOf(os);
  const refs: LocalEntityRef[] = [];
  for (const [externalId, entityId] of Object.entries(integration.mappings)) {
    const event = events[entityId];
    if (event) {
      refs.push({
        entityType: "event",
        entityId,
        externalId,
        updatedAt: event.updatedAt,
        deletedAt: ("deletedAt" in event ? (event as unknown as { deletedAt?: Timestamp | null }).deletedAt : null) ?? null,
      });
      continue;
    }
    const note = notes[entityId];
    if (note) {
      refs.push({
        entityType: "note",
        entityId,
        externalId,
        updatedAt: note.updatedAt,
        deletedAt: ("deletedAt" in note ? (note as unknown as { deletedAt?: Timestamp | null }).deletedAt : null) ?? null,
      });
    }
  }
  return refs;
}

interface PlanOutcome {
  created: number;
  updated: number;
  removed: number;
  conflicts: number;
}

function applyPlan(
  os: ReturnType<typeof useOS>,
  integrationId: string,
  plan: SyncPlan,
  choices: Record<string, "local" | "remote">,
): PlanOutcome {
  const outcome: PlanOutcome = { created: 0, updated: 0, removed: 0, conflicts: 0 };

  for (const entry of plan.creates) {
    const externalId = entry.create.externalId;
    if (typeof externalId !== "string") continue;
    const payload = { ...entry.create };
    delete payload.externalId;
    const needsResponse = payload.needsResponse === true;
    delete payload.needsResponse;
    const entityId = entry.entityType === "note" ? os.addNote(payload as never).id : os.addEvent(payload as never).id;
    os.registerExternalEntity(integrationId, externalId, entityId);
    if (needsResponse && entry.entityType === "event") {
      os.addTask(
        responseTaskInput({ externalId, etag: null, lastModified: null, deleted: false, payload } as never, Date.now()),
      );
    }
    outcome.created += 1;
  }

  for (const entry of plan.updates) {
    if ((choices[entry.externalId] ?? "remote") === "local") continue;
    if (entry.entityType === "note") os.updateNote(entry.entityId, entry.patch as never);
    else os.updateEvent(entry.entityId, entry.patch as never);
    outcome.updated += 1;
  }

  for (const entry of plan.deletes) {
    if (entry.entityType === "note") os.deleteNote(entry.entityId);
    else os.deleteEvent(entry.entityId);
    outcome.removed += 1;
  }

  for (const conflict of plan.conflicts) {
    const decision = choices[conflict.externalId] ?? "pending";
    if (decision === "remote") {
      if (conflict.entityType === "note") os.updateNote(conflict.entityId, conflict.remoteValue as never);
      else os.updateEvent(conflict.entityId, conflict.remoteValue as never);
      outcome.updated += 1;
      continue;
    }
    os.addSyncConflict(conflict);
    outcome.conflicts += 1;
  }

  return outcome;
}

export const integrationNavigation = {
  go(url: string): void {
    window.location.assign(url);
  },
};

function SummaryTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={cn("grid size-7 place-items-center rounded-lg", tone)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2/50 p-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-2">{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function IntegrationsModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [catalog, setCatalog] = React.useState<IntegrationProviderInfo[] | null>(null);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<Range>("30");
  const [filter, setFilter] = React.useState<Filter>("all");
  const redirectHandled = React.useRef(false);

  const integrations = Object.values(state.integrations);
  const summary = os.integrationSummary();
  const pendingConflicts = Object.values(state.syncConflicts).filter((conflict) => {
    const integration = state.integrations[conflict.integrationId];
    return conflict.status === "pending" && integration != null && integration.status !== "disconnected";
  });

  const definitions: ProviderDefinition[] = React.useMemo(() => {
    const apiStatuses = new Map((catalog ?? []).map((entry) => [entry.id, entry.status]));
    return INTEGRATION_PROVIDERS.map((provider) => ({
      ...provider,
      status: apiStatuses.get(provider.id) ?? (provider.status === "live" ? "preparing" : provider.status),
    }));
  }, [catalog]);

  const availableCount = definitions.filter((provider) => {
    const integration = integrations.find((entry) => entry.provider === provider.id);
    return provider.status === "live" && (!integration || integration.status === "disconnected");
  }).length;

  const filterOptions: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "connected", label: "Connected" },
    { value: "attention", label: "Attention" },
    { value: "available", label: "Available" },
  ];

  const visibleDefinitions = definitions.filter((provider) => {
    const integration = integrations.find((entry) => entry.provider === provider.id);
    const status = integration?.status ?? "disconnected";
    if (filter === "connected") return status === "connected" || status === "paused";
    if (filter === "attention") return status === "error" || status === "reauthorizing";
    if (filter === "available") return !integration || status === "disconnected";
    return true;
  });

  const syncable = integrations.filter((integration) => integration.credentialRef && integration.status !== "paused");

  React.useEffect(() => {
    let cancelled = false;
    integrationApi
      .catalog()
      .then((response) => {
        if (!cancelled) setCatalog(response.items);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (redirectHandled.current) return;
    redirectHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("connection");
    const providerId = params.get("provider");
    const ref = params.get("ref");
    if (!status) return;

    if (status === "connected" && providerId && ref && PROVIDER_BY_ID[providerId]) {
      os.connectIntegration({ provider: providerId, credentialRef: ref });
      toast(`${PROVIDER_BY_ID[providerId]?.label ?? providerId} connected`);
    } else if (status === "failed") {
      toast("We could not finish connecting that provider");
    }

    params.delete("connection");
    params.delete("provider");
    params.delete("ref");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [os, toast]);

  async function connect(providerId: string) {
    try {
      const response = await integrationApi.begin(providerId, "/integrations");
      integrationNavigation.go(response.authorizeUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not start that connection");
    }
  }

  async function disconnect(providerId: string, integrationId: string) {
    const integration = os.getIntegration(integrationId);
    if (integration?.credentialRef) {
      try {
        await integrationApi.disconnect(providerId, integration.credentialRef);
      } catch {
        toast("Disconnected locally, but the provider rejected the revoke");
      }
    }
    os.disconnectIntegration(integrationId);
    toast(`${PROVIDER_BY_ID[providerId]?.label ?? providerId} disconnected`);
  }

  async function sync(providerId: string, integrationId: string) {
    const integration = os.getIntegration(integrationId);
    if (!integration?.credentialRef) return;
    setSyncing(providerId);
    const startedAt = Date.now();
    const finish = (status: "success" | "failed", errorMessage: string | null) => {
      os.addSyncLog(
        finishSyncLog(
          buildSyncLog({
            integrationId,
            direction: integration.direction,
            status,
            created: 0,
            updated: 0,
            removed: 0,
            conflicts: 0,
            errorMessage,
            now: startedAt,
          }),
          Date.now(),
        ),
      );
      if (errorMessage) os.recordIntegrationError(integrationId, errorMessage);
    };

    try {
      const response = await integrationApi.pull(providerId, integration.credentialRef, Number(range));
      const changes: ExternalChangeSet = { items: response.items, nextSyncToken: response.nextSyncToken };
      const provider = PROVIDER_BY_ID[providerId]!;
      const calendars = Object.values(state.calendars);
      const folders = Object.values(state.folders);
      const plan = buildSyncPlan({
        integration,
        changes,
        local: localEntities(os, integrationId),
        calendarId:
          provider.kind === "calendar" ? integration.settings.targetCalendarId ?? calendars[0]?.id ?? null : null,
        folderId:
          provider.kind === "files"
            ? integration.settings.targetFolderId ?? folders[0]?.id ?? null
            : null,
        now: startedAt,
      });

      const locals = localEntities(os, integrationId);
      const choices: Record<string, "local" | "remote"> = {};
      for (const conflict of plan.conflicts) {
        const local = locals.find((entry) => entry.externalId === conflict.externalId);
        const remote = response.items.find((entry) => entry.externalId === conflict.externalId);
        const decision = shouldAutoResolve(
          integration.settings.conflictStrategy,
          local?.updatedAt ?? 0,
          remote?.lastModified ?? null,
        );
        if (decision === "remote_wins") {
          choices[conflict.externalId] = "remote";
        } else if (decision === "local_wins") {
          choices[conflict.externalId] = "local";
        }
      }

      const counts = applyPlan(os, integrationId, plan, choices);
      os.addSyncLog(
        finishSyncLog(
          buildSyncLog({
            integrationId,
            direction: integration.direction,
            status: "success",
            ...counts,
            now: startedAt,
          }),
          Date.now(),
        ),
      );
      os.updateIntegrationSync(integrationId, Date.now(), null);
      toast(planSummary(plan));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      finish("failed", message);
      toast(message);
    } finally {
      setSyncing(null);
    }
  }

  async function syncAll() {
    for (const integration of syncable) {
      await sync(integration.provider, integration.id);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Link2}
        title="Integrations"
        subtitle="Bring calendars and files in when you say so. Secret tokens stay on the server, and nothing is written back to a provider without you."
        actions={
          <Button
            size="sm"
            variant="secondary"
            disabled={syncing !== null || syncable.length === 0}
            onClick={() => void syncAll()}
          >
            <RefreshCw className={cn("size-3.5", syncing !== null && "animate-spin")} aria-hidden />
            Sync all
          </Button>
        }
      />

      {pendingConflicts.length > 0 ? (
        <Alert
          tone="warning"
          title={`${pendingConflicts.length} change${pendingConflicts.length === 1 ? "" : "s"} need a decision`}
        >
          The same record changed here and at the provider. Pick which version wins.
        </Alert>
      ) : null}

      <section aria-label="Integration summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={PlugZap}
          label="Connected"
          value={String(summary.connected)}
          detail={summary.connected === 0 ? "No providers yet" : "Ready to sync"}
          tone="bg-success-soft text-success"
        />
        <SummaryTile
          icon={TriangleAlert}
          label="Needs attention"
          value={String(summary.errors)}
          detail={summary.errors === 0 ? "Everything is healthy" : "Reconnect required"}
          tone={summary.errors > 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-3"}
        />
        <SummaryTile
          icon={GitMerge}
          label="Pending decisions"
          value={String(pendingConflicts.length)}
          detail={pendingConflicts.length === 0 ? "No conflicts to resolve" : "Review changed records"}
          tone={pendingConflicts.length > 0 ? "bg-warning-soft text-warning" : "bg-surface-2 text-ink-3"}
        />
        <SummaryTile
          icon={Clock}
          label="Last sync"
          value={relativeSyncTime(summary.lastSyncAt)}
          detail={summary.lastSyncAt ? "Across all providers" : "Connect a provider to begin"}
          tone="bg-accent-soft text-accent-ink"
        />
      </section>

      <section className="space-y-3" aria-labelledby="providers-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="providers-heading" className="text-sm font-semibold text-ink">
              Providers
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {definitions.length} available · {availableCount} ready to connect
            </p>
          </div>
          <Segmented options={filterOptions} value={filter} onChange={setFilter} label="Filter providers" />
        </div>

        {visibleDefinitions.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface">
            <EmptyState
              icon={Link2}
              title="No providers match this filter"
              description="Try another status filter to see the rest of your connections."
              action={
                <Button size="sm" variant="secondary" onClick={() => setFilter("all")}>
                  Show all providers
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDefinitions.map((provider) => {
              const integration = integrations.find((entry) => entry.provider === provider.id);
              const status = integration?.status ?? "disconnected";
              const live = provider.status === "live";
              const Icon = providerIcon(provider.id);
              const attention = status === "error" || status === "reauthorizing";
              const active = integration != null && status !== "disconnected" ? integration : null;
              const providerConflicts = active
                ? pendingConflicts.filter((conflict) => conflict.integrationId === active.id)
                : [];

              return (
                <section
                  key={provider.id}
                  className={cn(
                    "flex h-full flex-col gap-4 rounded-xl border bg-surface p-4",
                    attention ? "border-danger/30" : "border-line",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          KIND_TONES[provider.kind] ?? "bg-surface-2 text-ink-2",
                        )}
                      >
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-medium leading-tight text-ink">{provider.label}</h2>
                          {provider.status !== "live" ? <Badge tone="outline">Preview</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{provider.detail}</p>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONES[status] ?? "neutral"}>{syncStatusLabel(status)}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {provider.capabilities.map((capability) => (
                      <span
                        key={capability.id}
                        title={capability.detail}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          capability.supported
                            ? "border-success/30 bg-success-soft text-success"
                            : "border-line bg-surface-2 text-muted",
                        )}
                      >
                        {capability.label}
                      </span>
                    ))}
                  </div>

                  {active ? (
                    <>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-muted">Connected as</dt>
                          <dd className="truncate text-ink-2">{active.accountLabel || provider.label}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Last sync</dt>
                          <dd className="inline-flex items-center gap-1 text-ink-2">
                            <Clock className="size-3" aria-hidden />
                            {relativeSyncTime(active.lastSyncAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Direction</dt>
                          <dd className="text-ink-2">{directionLabel(active.direction)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Decisions</dt>
                          <dd className={providerConflicts.length > 0 ? "text-warning" : "text-ink-2"}>
                            {providerConflicts.length > 0 ? `${providerConflicts.length} waiting` : "None"}
                          </dd>
                        </div>
                      </dl>

                      {active.lastError ? (
                        <p className="rounded-lg bg-danger-soft px-2.5 py-2 text-[11px] leading-relaxed text-danger">
                          {active.lastError}
                        </p>
                      ) : null}

                      {status === "paused" ? (
                        <p className="rounded-lg bg-warning-soft px-2.5 py-2 text-[11px] leading-relaxed text-warning">
                          Paused. Automatic and manual sync are off until you resume.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted">
                      {live
                        ? "Not connected yet. You approve each connection before it can read anything."
                        : "In preparation — this connection is not ready to switch on."}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {!active ? (
                      <Button size="sm" variant="primary" disabled={!live} onClick={() => void connect(provider.id)}>
                        <Link2 className="size-3.5" aria-hidden />
                        {live ? "Connect" : "Preparing"}
                      </Button>
                    ) : (
                      <>
                        {attention ? (
                          <Button size="sm" variant="primary" onClick={() => void connect(provider.id)}>
                            <Link2 className="size-3.5" aria-hidden />
                            Reconnect
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={attention ? "secondary" : "primary"}
                          disabled={syncing === provider.id || status === "paused"}
                          onClick={() => void sync(provider.id, active.id)}
                        >
                          <RefreshCw
                            className={cn("size-3.5", syncing === provider.id && "animate-spin")}
                            aria-hidden
                          />
                          {syncing === provider.id ? "Syncing…" : "Sync now"}
                        </Button>
                        {status === "paused" ? (
                          <Button size="sm" variant="ghost" onClick={() => os.resumeIntegration(active.id)}>
                            <Play className="size-3.5" aria-hidden />
                            Resume
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => os.pauseIntegration(active.id)}>
                            <Pause className="size-3.5" aria-hidden />
                            Pause
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => void disconnect(provider.id, active.id)}>
                          <Trash2 className="size-3.5" aria-hidden />
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>

                  {active ? <SyncSettings integrationId={active.id} providerId={provider.id} /> : null}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {integrations.length > 0 ? <SyncActivity range={range} onRangeChange={setRange} /> : null}

      <ConflictSection />
    </div>
  );
}

function SyncSettings({ integrationId, providerId }: { integrationId: string; providerId: string }) {
  const os = useOS();
  const state = useAppState();
  const integration = state.integrations[integrationId];
  const provider = PROVIDER_BY_ID[providerId];
  if (!integration || !provider) return null;

  const outbound = supportsDirection(provider, "outbound");
  const calendars = Object.values(state.calendars);
  const folders = Object.values(state.folders);

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink-2">Sync settings</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {directionLabel(integration.direction)} · {provider.kind === "calendar" ? "Events" : provider.kind === "files" ? "Files" : "Pages"}
          </p>
        </div>
        <Badge tone="outline">{integration.settings.autoSync ? "Auto" : "Manual"}</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] text-muted" htmlFor={`strategy-${integrationId}`}>
          <span>When both change</span>
          <Select
            id={`strategy-${integrationId}`}
            value={integration.settings.conflictStrategy}
            onChange={(event) =>
              os.updateIntegrationSettings(integrationId, {
                conflictStrategy: event.target.value as "manual" | "local_wins" | "remote_wins" | "newer_wins",
              })
            }
          >
            <option value="manual">Ask me</option>
            <option value="newer_wins">Newest wins</option>
            <option value="local_wins">Keep mine</option>
            <option value="remote_wins">Keep theirs</option>
          </Select>
        </label>

        {provider.kind === "calendar" ? (
          <label className="space-y-1 text-[11px] text-muted" htmlFor={`calendar-${integrationId}`}>
            <span>Target calendar</span>
            <Select
              id={`calendar-${integrationId}`}
              value={integration.settings.targetCalendarId ?? ""}
              onChange={(event) =>
                os.updateIntegrationSettings(integrationId, {
                  targetCalendarId: event.target.value || null,
                })
              }
            >
              <option value="">Default calendar</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        {provider.kind === "files" ? (
          <label className="space-y-1 text-[11px] text-muted" htmlFor={`folder-${integrationId}`}>
            <span>Target folder</span>
            <Select
              id={`folder-${integrationId}`}
              value={integration.settings.targetFolderId ?? ""}
              onChange={(event) =>
                os.updateIntegrationSettings(integrationId, {
                  targetFolderId: event.target.value || null,
                })
              }
            >
              <option value="">Default folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      <div className="space-y-2">
        <SwitchRow
          label="Auto-sync"
          description="Pull new changes when the app opens and on a regular schedule."
          checked={integration.settings.autoSync}
          onChange={(checked) => os.updateIntegrationSettings(integrationId, { autoSync: checked })}
        />
        <SwitchRow
          label="Push changes back"
          description={
            outbound
              ? "Write local changes back to the provider after a sync."
              : "Writing back is not available for this provider yet."
          }
          checked={integration.settings.pushBack}
          onChange={(checked) => os.updateIntegrationSettings(integrationId, { pushBack: checked })}
          disabled={!outbound}
        />
      </div>
    </div>
  );
}

function SyncActivity({ range, onRangeChange }: { range: Range; onRangeChange: (value: Range) => void }) {
  const os = useOS();
  const state = useAppState();
  const logs = os.syncLogs(undefined, 12);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Sync activity</h2>
          <p className="mt-0.5 text-xs text-muted">
            Every pull is logged with what changed and how long it took.
          </p>
        </div>
        <Segmented options={RANGES} value={range} onChange={onRangeChange} label="Sync window" />
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No syncs yet"
          description="Run a sync from a connected provider and the history will appear here."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-line">
          {logs.map((log) => {
            const integration = state.integrations[log.integrationId];
            const provider = integration ? PROVIDER_BY_ID[integration.provider] : null;
            const changes = log.itemsCreated + log.itemsUpdated + log.itemsDeleted;
            return (
              <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      log.status === "success"
                        ? "bg-success"
                        : log.status === "partial"
                          ? "bg-warning"
                          : log.status === "failed"
                            ? "bg-danger"
                            : "bg-ink-3",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-ink-2">
                        {provider?.label ?? integration?.provider ?? "Provider"}
                      </p>
                      <Badge tone={LOG_STATUS_TONES[log.status]}>{LOG_STATUS_LABELS[log.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {relativeSyncTime(log.createdAt)} · {changes === 0 ? "No changes" : `${changes} change${changes === 1 ? "" : "s"}`}
                      {log.conflictsFound > 0 ? ` · ${log.conflictsFound} conflict${log.conflictsFound === 1 ? "" : "s"}` : ""}
                    </p>
                    {log.errorMessage ? (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-danger">{log.errorMessage}</p>
                    ) : null}
                  </div>
                </div>
                <span className="text-[11px] text-muted">{(log.durationMs / 1000).toFixed(1)}s</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ConflictSection() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const conflicts = Object.values(state.syncConflicts).filter((conflict) => {
    const integration = state.integrations[conflict.integrationId];
    return conflict.status === "pending" && integration != null && integration.status !== "disconnected";
  });

  if (conflicts.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Changes to resolve</h2>
          <p className="mt-0.5 text-xs text-muted">Choose which version to keep for each changed record.</p>
        </div>
        <Badge tone="warning">{conflicts.length} waiting</Badge>
      </div>

      <div className="space-y-2">
        {conflicts.map((conflict) => {
          const integration = state.integrations[conflict.integrationId];
          const provider = integration ? PROVIDER_BY_ID[integration.provider] : null;
          const title = String(conflict.localValue.title ?? conflict.remoteValue.title ?? "A record");
          return (
            <div
              key={conflict.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
                  <CircleAlert className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{title} changed on both sides</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {provider?.label ?? "Provider"} · {CONFLICT_KIND_LABELS[conflict.kind] ?? conflict.kind}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{conflict.reason}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    os.resolveSyncConflict(conflict.id, "local_wins");
                    toast("Kept your version");
                  }}
                >
                  Keep mine
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    os.resolveSyncConflict(conflict.id, "remote_wins");
                    if (conflict.entityType === "event") {
                      os.updateEvent(conflict.entityId, conflict.remoteValue as never);
                    } else {
                      os.updateNote(conflict.entityId, conflict.remoteValue as never);
                    }
                    toast("Took the provider version");
                  }}
                >
                  Take theirs
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
