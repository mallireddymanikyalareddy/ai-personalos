"use client";

import * as React from "react";

import {
  Bell,
  Check,
  Clock,
  Database,
  Download,
  HardDrive,
  Info,
  Keyboard,
  KeyRound,
  Link2,
  MailCheck,
  Palette,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Smartphone,
  Trash2,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";

import type {
  DeviceInfo,
  SessionInfo,
  UserPreferences,
  UserPreferencesPatch,
} from "@personalos/api-contract/account";
import { AI_PROVIDERS, aiProvider, type ThemeSetting } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FieldLabel, Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { MobileSettingsSection } from "@/components/mobile/mobile-settings-section";
import { accountApi, errorMessage, fieldError } from "@/lib/api";
import { type LocalSettingsPatch } from "@/lib/settings-sync";
import { useAuth } from "@/modules/auth/auth-context";
import { useAppState, useOS } from "@/store/use-os";
import { WeeklyEmailCard } from "@/modules/settings/weekly-email-card";

type TabId =
  | "profile"
  | "appearance"
  | "schedule"
  | "ai"
  | "notifications"
  | "security"
  | "mobile"
  | "data"
  | "shortcuts"
  | "about";

const TAB_META: Record<TabId, { label: string; description: string; icon: LucideIcon }> = {
  profile: {
    label: "Profile",
    description: "How the OS addresses you, your timezone, and how you sign in.",
    icon: User,
  },
  appearance: {
    label: "Appearance",
    description: "Theme, time format, and the week start used across the app.",
    icon: Palette,
  },
  schedule: {
    label: "Schedule",
    description: "Working hours, sleep, and the rhythm your planner follows.",
    icon: Clock,
  },
  ai: {
    label: "AI",
    description: "Choose how the assistant writes, plans, and which model powers it.",
    icon: Sparkles,
  },
  notifications: {
    label: "Notifications",
    description: "Decide what deserves a nudge and when the app stays quiet.",
    icon: Bell,
  },
  security: {
    label: "Security",
    description: "Password, email verification, active sessions, and trusted devices.",
    icon: Shield,
  },
  mobile: {
    label: "Mobile",
    description: "One-handed controls, gestures, reminders, and offline behavior.",
    icon: Smartphone,
  },
  data: {
    label: "Data & backups",
    description: "Export, restore, and understand the data stored on this device.",
    icon: Database,
  },
  shortcuts: {
    label: "Shortcuts",
    description: "Keyboard paths for capture, search, and closing dialogs.",
    icon: Keyboard,
  },
  about: {
    label: "About",
    description: "Version, schema, storage, and what this build includes.",
    icon: Info,
  },
};

const TAB_GROUPS: { label: string; items: TabId[] }[] = [
  { label: "Account", items: ["profile", "appearance", "schedule"] },
  { label: "Assistant", items: ["ai"] },
  { label: "Attention", items: ["notifications", "security"] },
  { label: "Device & data", items: ["mobile", "data"] },
  { label: "Help", items: ["shortcuts", "about"] },
];

const TAB_IDS = Object.keys(TAB_META) as TabId[];

const DAYS = [
  { day: 0, short: "Sun", label: "Sunday" },
  { day: 1, short: "Mon", label: "Monday" },
  { day: 2, short: "Tue", label: "Tuesday" },
  { day: 3, short: "Wed", label: "Wednesday" },
  { day: 4, short: "Thu", label: "Thursday" },
  { day: 5, short: "Fri", label: "Friday" },
  { day: 6, short: "Sat", label: "Saturday" },
];

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

const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function timezoneOptions(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    return supported && supported.length > 0 ? supported : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

function tabFromLocation(): TabId {
  if (typeof window === "undefined") return "profile";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value && TAB_IDS.includes(value as TabId) ? (value as TabId) : "profile";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function minutesOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationBetween(start: string, end: string): string | null {
  const from = minutesOfDay(start);
  const to = minutesOfDay(end);
  if (from == null || to == null) return null;
  const minutes = to > from ? to - from : 1440 - from + to;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest > 0 ? ` ${rest}m` : ""}`;
}

function mergePreferences(current: UserPreferences, patch: UserPreferencesPatch): UserPreferences {
  return {
    ...current,
    ...patch,
    workingHours: patch.workingHours
      ? { ...current.workingHours, ...patch.workingHours }
      : current.workingHours,
    sleepSchedule: patch.sleepSchedule
      ? { ...current.sleepSchedule, ...patch.sleepSchedule }
      : current.sleepSchedule,
    ai: patch.ai ? { ...current.ai, ...patch.ai } : current.ai,
    notifications: patch.notifications
      ? {
          ...current.notifications,
          ...patch.notifications,
          quietHours: {
            ...current.notifications.quietHours,
            ...(patch.notifications.quietHours ?? {}),
          },
        }
      : current.notifications,
  };
}

function Card({
  title,
  description,
  children,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {description && <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SectionIntro({ tab, saving }: { tab: TabId; saving: boolean }) {
  const meta = TAB_META[tab];
  const Icon = meta.icon;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{meta.label}</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{meta.description}</p>
        </div>
      </div>
      {saving ? <Badge tone="outline">Saving…</Badge> : null}
    </div>
  );
}

function SettingsNav({ value, onChange }: { value: TabId; onChange: (tab: TabId) => void }) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <nav
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0"
      >
        {TAB_GROUPS.map((group) => (
          <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col lg:gap-1">
            <p className="hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-3 lg:block">
              {group.label}
            </p>
            {group.items.map((id) => {
              const meta = TAB_META[id];
              const Icon = meta.icon;
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onChange(id)}
                  className={
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-accent-soft text-accent-ink"
                      : "text-ink-3 hover:bg-surface-2 hover:text-ink")
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function SettingsPage() {
  const os = useOS();
  const state = useAppState();
  const { profile, refresh, status } = useAuth();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [tab, setTab] = React.useState<TabId>(() => tabFromLocation());

  const [nameDraft, setNameDraft] = React.useState(profile?.displayName ?? "");
  const [tzDraft, setTzDraft] = React.useState(profile?.timezone ?? "UTC");
  const [localeDraft, setLocaleDraft] = React.useState(profile?.locale ?? "en");
  const [profileError, setProfileError] = React.useState<unknown>(null);
  const [profileBusy, setProfileBusy] = React.useState(false);

  const [prefsDraft, setPrefsDraft] = React.useState<UserPreferences | null>(
    () => profile?.preferences ?? null,
  );
  const prefsRef = React.useRef<UserPreferences | null>(profile?.preferences ?? null);
  const [prefSaving, setPrefSaving] = React.useState(false);
  const [prefError, setPrefError] = React.useState<string | null>(null);
  const prefPending = React.useRef(0);
  const prefQueue = React.useRef<Promise<void>>(Promise.resolve());

  const [pwCurrent, setPwCurrent] = React.useState("");
  const [pwNext, setPwNext] = React.useState("");
  const [pwConfirm, setPwConfirm] = React.useState("");
  const [pwError, setPwError] = React.useState<unknown>(null);
  const [pwBusy, setPwBusy] = React.useState(false);

  const [verifyInfo, setVerifyInfo] = React.useState<{ devToken?: string } | null>(null);
  const [verifyBusy, setVerifyBusy] = React.useState(false);
  const [resetInfo, setResetInfo] = React.useState<{ devToken?: string } | null>(null);
  const [resetBusy, setResetBusy] = React.useState(false);
  const [sessions, setSessions] = React.useState<SessionInfo[] | null>(null);
  const [devices, setDevices] = React.useState<DeviceInfo[] | null>(null);
  const [securityError, setSecurityError] = React.useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = React.useState(false);
  const [securityAction, setSecurityAction] = React.useState<string | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = React.useState(false);

  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  const [modifier, setModifier] = React.useState("Ctrl");
  const timezones = React.useMemo(timezoneOptions, []);

  React.useEffect(() => {
    if (!profile) return;
    setNameDraft(profile.displayName);
    setTzDraft(profile.timezone);
    setLocaleDraft(profile.locale);
    prefsRef.current = profile.preferences;
    setPrefsDraft(profile.preferences);
  }, [profile]);

  React.useEffect(() => {
    const platform = typeof navigator === "undefined" ? "" : navigator.userAgent;
    setModifier(/Mac|iPhone|iPad|iPod/.test(platform) ? "⌘" : "Ctrl");
  }, []);

  const loadSecurity = React.useCallback(async () => {
    setSecurityBusy(true);
    setSecurityError(null);
    try {
      const [sessionList, deviceList] = await Promise.all([
        accountApi.sessions(),
        accountApi.devices(),
      ]);
      setSessions(sessionList.items);
      setDevices(deviceList.items);
    } catch (error) {
      setSecurityError(errorMessage(error));
    } finally {
      setSecurityBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (tab === "security" && sessions === null && !securityBusy && securityError === null) {
      void loadSecurity();
    }
  }, [tab, sessions, securityBusy, securityError, loadSecurity]);

  const changeTab = React.useCallback((next: TabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const savePreferences = React.useCallback(
    (patch: UserPreferencesPatch) => {
      const current = prefsRef.current;
      if (!current) return;
      const previous = current;
      const next = mergePreferences(current, patch);
      prefsRef.current = next;
      setPrefsDraft(next);
      setPrefError(null);
      prefPending.current += 1;
      setPrefSaving(true);

      prefQueue.current = prefQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const updated = await accountApi.patchProfile({ preferences: next });
            if (prefsRef.current === next) {
              prefsRef.current = updated.preferences;
              setPrefsDraft(updated.preferences);
            }
          } catch (error) {
            if (prefsRef.current === next) {
              prefsRef.current = previous;
              setPrefsDraft(previous);
            }
            const message = errorMessage(error);
            setPrefError(message);
            toast(message, { tone: "danger" });
          } finally {
            prefPending.current -= 1;
            if (prefPending.current === 0) {
              setPrefSaving(false);
              void refresh();
            }
          }
        });
    },
    [refresh, toast],
  );

  const setAppearance = (local: LocalSettingsPatch, prefs: UserPreferencesPatch) => {
    os.updateSettings(local);
    savePreferences(prefs);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setProfileBusy(true);
    setProfileError(null);
    const displayName = nameDraft.trim();
    if (!displayName) {
      setProfileError(new Error("Display name is required."));
      setProfileBusy(false);
      return;
    }
    try {
      const updated = await accountApi.patchProfile({
        displayName,
        timezone: tzDraft,
        locale: localeDraft,
      });
      os.updateProfile({
        displayName: updated.displayName,
        timezone: updated.timezone,
        email: updated.email,
      });
      await refresh();
      toast("Profile saved", { tone: "success" });
    } catch (error) {
      setProfileError(error);
    } finally {
      setProfileBusy(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwError(null);
    if (pwNext.length < 10) {
      setPwError(new Error("Use at least 10 characters for the new password."));
      return;
    }
    if (pwNext !== pwConfirm) {
      setPwError(new Error("New passwords do not match."));
      return;
    }
    setPwBusy(true);
    try {
      await accountApi.changePassword({ currentPassword: pwCurrent, password: pwNext });
      setPwCurrent("");
      setPwNext("");
      setPwConfirm("");
      toast("Password updated — other sessions were signed out", { tone: "success" });
      await loadSecurity();
    } catch (error) {
      setPwError(error);
    } finally {
      setPwBusy(false);
    }
  };

  const resendVerification = async () => {
    setVerifyBusy(true);
    setVerifyInfo(null);
    try {
      const result = await accountApi.requestEmailVerification();
      setVerifyInfo(result);
      toast("Verification email queued", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setVerifyBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!profile?.email) {
      toast("Add an email address to your account before requesting a reset.", { tone: "danger" });
      return;
    }
    setResetBusy(true);
    setResetInfo(null);
    try {
      const result = await accountApi.requestPasswordReset(profile.email);
      setResetInfo(result);
      toast("Password reset email queued", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setResetBusy(false);
    }
  };

  const revokeSession = async (id: string) => {
    setSecurityAction(`session:${id}`);
    try {
      await accountApi.revokeSession(id);
      await loadSecurity();
      toast("Session signed out", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setSecurityAction(null);
    }
  };

  const revokeOthers = async () => {
    setConfirmRevokeOthers(false);
    setSecurityAction("others");
    try {
      const result = await accountApi.revokeOtherSessions();
      await loadSecurity();
      toast(`Signed out ${result.revoked} other session${result.revoked === 1 ? "" : "s"}`, {
        tone: "success",
      });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setSecurityAction(null);
    }
  };

  const revokeDevice = async (id: string) => {
    setSecurityAction(`device:${id}`);
    try {
      await accountApi.revokeDevice(id);
      await loadSecurity();
      toast("Device revoked", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setSecurityAction(null);
    }
  };

  const exportData = () => {
    const blob = new Blob([os.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `personalos-backup-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("Backup downloaded", { tone: "success" });
  };

  const importData = async (file: File) => {
    setImportBusy(true);
    try {
      const text = await file.text();
      const result = os.importData(text);
      if (result.ok) {
        toast("Backup restored", { tone: "success" });
        setImportFile(null);
      } else {
        toast(result.error ?? "Import failed", { tone: "danger" });
      }
    } catch {
      toast("This file could not be read", { tone: "danger" });
    } finally {
      setImportBusy(false);
    }
  };

  const clearAll = () => {
    os.clearAll();
    setClearOpen(false);
    toast("All local data cleared from this device");
    void refresh();
  };

  const resetAppearance = () => {
    setAppearance({ theme: "system", timeFormat: 24, weekStart: 1 }, { theme: "system", timeFormat: "24h", weekStart: "monday" });
    toast("Appearance reset to defaults", { tone: "success" });
  };

  const resetNotifications = () => {
    savePreferences({
      notifications: {
        emailDigest: "daily",
        dailyBriefing: true,
        taskReminders: true,
        aiInsights: true,
        quietHours: { enabled: true, start: "22:00", end: "07:00" },
      },
    });
    toast("Notification preferences reset", { tone: "success" });
  };

  const prefs = prefsDraft ?? profile?.preferences ?? null;
  const prefsRequired =
    tab === "appearance" || tab === "schedule" || tab === "ai" || tab === "notifications";
  const profileDirty =
    profile != null &&
    (nameDraft !== profile.displayName ||
      tzDraft !== profile.timezone ||
      localeDraft !== profile.locale);
  const selectedProvider = aiProvider(state.settings.aiProvider);
  const workingHoursWarning =
    prefs?.workingHours.enabled &&
    minutesOfDay(prefs.workingHours.start) != null &&
    minutesOfDay(prefs.workingHours.end) != null &&
    (minutesOfDay(prefs.workingHours.end) as number) <=
      (minutesOfDay(prefs.workingHours.start) as number);
  const backupBytes =
    tab === "data" || tab === "about" ? new Blob([os.exportData()]).size : 0;
  const localStats = [
    { label: "Tasks", value: Object.keys(state.tasks).length },
    { label: "Notes", value: Object.keys(state.notes).length },
    { label: "Events", value: Object.keys(state.events).length },
    { label: "Journal entries", value: Object.keys(state.journalEntries).length },
    { label: "Memories", value: Object.keys(state.lifeMemories).length },
    { label: "Integrations", value: Object.keys(state.integrations).length },
  ];
  const passwordChecks = [
    { label: "At least 10 characters", ok: pwNext.length >= 10 },
    { label: "Passwords match", ok: pwNext.length > 0 && pwNext === pwConfirm },
  ];

  return (
    <>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Account, preferences, security, and the data stored on this device."
        actions={
          <Badge tone={status === "offline" ? "warning" : "outline"}>
            {status === "offline" ? "Offline" : profile?.emailVerified ? "Verified account" : "Account"}
          </Badge>
        }
      />

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <SettingsNav value={tab} onChange={changeTab} />

        <div className="mt-5 min-w-0 space-y-5 lg:mt-0">
          {status === "offline" ? (
            <Alert
              tone="warning"
              title="Working offline"
              action={
                <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Retry
                </Button>
              }
            >
              Account changes need a connection. Local data, theme, and device settings still work.
            </Alert>
          ) : null}

          {prefError ? (
            <Alert tone="danger" title="Preference update failed" dismissible onDismiss={() => setPrefError(null)}>
              {prefError}
            </Alert>
          ) : null}

          <SectionIntro tab={tab} saving={prefSaving} />

          {tab === "profile" && (
            <>
              {!profile ? (
                <Alert
                  tone="warning"
                  title="Account profile unavailable"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                      Retry
                    </Button>
                  }
                >
                  We could not load your account details. Your local data is still available.
                </Alert>
              ) : (
                <Card
                  title="Your details"
                  description="Saved to your account and used across the OS."
                  icon={User}
                  action={
                    <div className="flex items-center gap-2">
                      {profileDirty ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={profileBusy}
                          onClick={() => {
                            setNameDraft(profile.displayName);
                            setTzDraft(profile.timezone);
                            setLocaleDraft(profile.locale);
                            setProfileError(null);
                          }}
                        >
                          Reset
                        </Button>
                      ) : null}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void saveProfile()}
                        loading={profileBusy}
                        disabled={!profileDirty}
                      >
                        Save changes
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {profileError !== null && (
                      <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                        {errorMessage(profileError)}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <Avatar name={nameDraft || profile.handle} className="size-12 text-base" />
                      <div className="min-w-0 flex-1">
                        <Field
                          label="Display name"
                          htmlFor="display-name"
                          error={fieldError(profileError, "displayName")}
                          required
                        >
                          <Input
                            id="display-name"
                            value={nameDraft}
                            onChange={(event) => setNameDraft(event.target.value)}
                            placeholder="Your name"
                            maxLength={64}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Timezone"
                        htmlFor="profile-tz"
                        error={fieldError(profileError, "timezone")}
                        hint="IANA timezone, e.g. Europe/Berlin."
                        required
                      >
                        <Input
                          id="profile-tz"
                          value={tzDraft}
                          onChange={(event) => setTzDraft(event.target.value)}
                          placeholder="e.g. Europe/Berlin"
                          autoComplete="off"
                          list="timezone-options"
                        />
                        <datalist id="timezone-options">
                          {timezones.map((timezone) => (
                            <option key={timezone} value={timezone} />
                          ))}
                        </datalist>
                      </Field>

                      <Field
                        label="Language"
                        htmlFor="profile-locale"
                        error={fieldError(profileError, "locale")}
                        required
                      >
                        <Select
                          id="profile-locale"
                          value={
                            LOCALES.some((entry) => entry.value === localeDraft) ? localeDraft : "en"
                          }
                          onChange={(event) => setLocaleDraft(event.target.value)}
                        >
                          {!LOCALES.some((entry) => entry.value === localeDraft) && (
                            <option value={localeDraft}>{localeDraft}</option>
                          )}
                          {LOCALES.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <dl className="grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-ink-3">Handle</dt>
                        <dd className="text-ink">@{profile.handle}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-ink-3">Email</dt>
                        <dd className="flex min-w-0 items-center gap-2 text-ink">
                          <span className="truncate">{profile.email ?? "Not set"}</span>
                          {profile.email ? (
                            <Badge tone={profile.emailVerified ? "success" : "warning"}>
                              {profile.emailVerified ? "Verified" : "Unverified"}
                            </Badge>
                          ) : null}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-ink-3">Member since</dt>
                        <dd className="text-ink">{formatDate(profile.createdAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <dt className="text-ink-3">Account ID</dt>
                        <dd className="truncate font-mono text-xs text-ink-3">{profile.id}</dd>
                      </div>
                    </dl>
                  </div>
                </Card>
              )}

              <Card
                title="Sign-in & recovery"
                description="Your password, email recovery, and app connections."
                icon={KeyRound}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div>
                      <span className="block text-sm font-medium text-ink">Password</span>
                      <span className="block text-xs text-ink-3">
                        Set during registration or reset via email.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-success">Active</span>
                      <Button size="sm" variant="ghost" onClick={() => changeTab("security")}>
                        Manage
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div>
                      <span className="block text-sm font-medium text-ink">Email recovery</span>
                      <span className="block text-xs text-ink-3">
                        {profile?.email
                          ? profile.emailVerified
                            ? "Verified and ready for password resets."
                            : "Verify your email to enable password resets."
                          : "Add an email address to enable recovery."}
                      </span>
                    </div>
                    {profile?.email ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resetBusy}
                        onClick={() => void requestPasswordReset()}
                      >
                        <MailCheck className="size-3.5" aria-hidden="true" />
                        Send reset link
                      </Button>
                    ) : (
                      <Badge tone="warning">No email</Badge>
                    )}
                  </div>

                  {resetInfo?.devToken ? (
                    <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2">
                      Development mode —{" "}
                      <a
                        href={`/reset-password?token=${encodeURIComponent(resetInfo.devToken)}`}
                        className="font-medium text-accent-ink hover:underline"
                      >
                        open the reset link
                      </a>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div>
                      <span className="block text-sm font-medium text-ink">App connections</span>
                      <span className="block text-xs text-ink-3">
                        Calendars, files, and other tools connected to your OS.
                      </span>
                    </div>
                    <a href="/integrations">
                      <Button size="sm" variant="secondary">
                        <Link2 className="size-3.5" aria-hidden="true" />
                        Manage
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            </>
          )}

          {prefsRequired && !prefs ? (
            <Alert
              tone="warning"
              title="Account preferences unavailable"
              action={
                <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                  Retry
                </Button>
              }
            >
              We could not load your saved preferences. Check your connection and try again.
            </Alert>
          ) : null}

          {tab === "appearance" && prefs && (
            <Card
              title="Theme & formats"
              description="These preferences sync across your devices."
              icon={Palette}
              action={
                <Button size="sm" variant="ghost" onClick={resetAppearance}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Reset
                </Button>
              }
            >
              <div className="space-y-5">
                <div>
                  <FieldLabel className="mb-2">Theme</FieldLabel>
                  <Segmented
                    label="Theme"
                    value={prefs.theme}
                    onChange={(value: ThemeSetting) => setAppearance({ theme: value }, { theme: value })}
                    options={[
                      { value: "system", label: "System" },
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                  <p className="mt-2 text-xs text-ink-3">
                    System follows your device setting. Light and dark apply everywhere.
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <FieldLabel className="mb-2">Time format</FieldLabel>
                    <Segmented
                      label="Time format"
                      value={prefs.timeFormat}
                      onChange={(value) => setAppearance({ timeFormat: value === "12h" ? 12 : 24 }, { timeFormat: value === "12h" ? "12h" : "24h" })}
                      options={[
                        { value: "24h", label: "24-hour" },
                        { value: "12h", label: "12-hour" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel className="mb-2">Week starts</FieldLabel>
                    <Segmented
                      label="Week starts"
                      value={prefs.weekStart}
                      onChange={(value) => setAppearance({ weekStart: value === "sunday" ? 0 : 1 }, { weekStart: value === "sunday" ? "sunday" : "monday" })}
                      options={[
                        { value: "monday", label: "Monday" },
                        { value: "sunday", label: "Sunday" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {tab === "schedule" && prefs && (
            <>
              <Card
                title="Working hours"
                description="Focus time and planning land inside this window."
                icon={Clock}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-sm text-ink">Use working hours</span>
                      <span className="block text-xs text-ink-3">
                        Protect a consistent window for focused work.
                      </span>
                    </div>
                    <Switch
                      label="Working hours"
                      checked={prefs.workingHours.enabled}
                      onCheckedChange={(checked) =>
                        savePreferences({
                          workingHours: { ...prefs.workingHours, enabled: checked },
                        })
                      }
                    />
                  </div>

                  {prefs.workingHours.enabled && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {DAYS.map(({ day, short, label }) => {
                          const active = prefs.workingHours.days.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              aria-pressed={active}
                              aria-label={label}
                              title={label}
                              onClick={() => {
                                const days = active
                                  ? prefs.workingHours.days.filter((entry) => entry !== day)
                                  : [...prefs.workingHours.days, day].sort((a, b) => a - b);
                                if (days.length === 0) return;
                                savePreferences({
                                  workingHours: { ...prefs.workingHours, days },
                                });
                              }}
                              className={
                                "grid h-9 min-w-11 place-items-center rounded-lg px-2 text-xs font-semibold transition-colors " +
                                (active
                                  ? "bg-accent text-white"
                                  : "bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink")
                              }
                            >
                              {short}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            savePreferences({
                              workingHours: { ...prefs.workingHours, days: [1, 2, 3, 4, 5] },
                            })
                          }
                        >
                          Weekdays
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            savePreferences({
                              workingHours: { ...prefs.workingHours, days: [0, 1, 2, 3, 4, 5, 6] },
                            })
                          }
                        >
                          Every day
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Start" htmlFor="wh-start">
                          <Input
                            id="wh-start"
                            type="time"
                            value={prefs.workingHours.start}
                            onChange={(event) =>
                              savePreferences({
                                workingHours: {
                                  ...prefs.workingHours,
                                  start: event.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field
                          label="End"
                          htmlFor="wh-end"
                          hint={durationBetween(prefs.workingHours.start, prefs.workingHours.end) ?? undefined}
                        >
                          <Input
                            id="wh-end"
                            type="time"
                            value={prefs.workingHours.end}
                            onChange={(event) =>
                              savePreferences({
                                workingHours: {
                                  ...prefs.workingHours,
                                  end: event.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      </div>
                      {workingHoursWarning ? (
                        <Alert tone="warning" title="End is before start">
                          This will be treated as an overnight window. Check the times if that is not
                          what you meant.
                        </Alert>
                      ) : null}
                    </>
                  )}
                </div>
              </Card>

              <Card
                title="Sleep schedule"
                description="Quiet hours and morning planning follow this window."
                icon={Clock}
              >
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bedtime" htmlFor="bed">
                    <Input
                      id="bed"
                      type="time"
                      value={prefs.sleepSchedule.bedtime}
                      onChange={(event) =>
                        savePreferences({
                          sleepSchedule: {
                            ...prefs.sleepSchedule,
                            bedtime: event.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Wake up"
                    htmlFor="wake"
                    hint={durationBetween(prefs.sleepSchedule.bedtime, prefs.sleepSchedule.wakeTime) ?? undefined}
                  >
                    <Input
                      id="wake"
                      type="time"
                      value={prefs.sleepSchedule.wakeTime}
                      onChange={(event) =>
                        savePreferences({
                          sleepSchedule: {
                            ...prefs.sleepSchedule,
                            wakeTime: event.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </Card>

              <Card
                title="Planning"
                description="When you plan and where the planner opens."
                icon={Sparkles}
              >
                <div className="space-y-5">
                  <div>
                    <FieldLabel className="mb-2">Planning style</FieldLabel>
                    <Segmented
                      label="Planning style"
                      value={prefs.planningPreference}
                      onChange={(value) => savePreferences({ planningPreference: value })}
                      options={[
                        { value: "morning", label: "Morning" },
                        { value: "evening", label: "Evening" },
                        { value: "weekly_review", label: "Weekly" },
                      ]}
                    />
                    <p className="mt-2 text-xs text-ink-3">
                      Morning plans the day first. Evening organizes tomorrow. Weekly reviews the
                      bigger picture.
                    </p>
                  </div>
                  <div>
                    <FieldLabel className="mb-2">Default view</FieldLabel>
                    <Segmented
                      label="Default view"
                      value={prefs.defaultPlanningView}
                      onChange={(value) => savePreferences({ defaultPlanningView: value })}
                      options={[
                        { value: "day", label: "Day" },
                        { value: "week", label: "Week" },
                        { value: "month", label: "Month" },
                        { value: "quarter", label: "Quarter" },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            </>
          )}

          {tab === "ai" && prefs && (
            <>
              <Card
                title="AI personality"
                description="How the assistant writes and how proactive it gets."
                icon={Sparkles}
              >
                <div className="space-y-5">
                  <div>
                    <FieldLabel className="mb-2">Response tone</FieldLabel>
                    <Segmented
                      label="AI tone"
                      value={prefs.ai.tone}
                      onChange={(value) => savePreferences({ ai: { ...prefs.ai, tone: value } })}
                      options={[
                        { value: "concise", label: "Concise" },
                        { value: "balanced", label: "Balanced" },
                        { value: "detailed", label: "Detailed" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel className="mb-2">Proactivity</FieldLabel>
                    <Segmented
                      label="AI proactivity"
                      value={prefs.ai.proactivity}
                      onChange={(value) =>
                        savePreferences({ ai: { ...prefs.ai, proactivity: value } })
                      }
                      options={[
                        { value: "suggest", label: "Suggest" },
                        { value: "plan", label: "Plan" },
                        { value: "automate", label: "Automate" },
                      ]}
                    />
                    <p className="mt-2 text-xs text-ink-3">
                      Suggest asks first, plan drafts plans you approve, automate handles routine
                      steps itself.
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                title="Model"
                description="The assistant provider used for chat and planning."
                icon={Sparkles}
              >
                <div className="space-y-3">
                  <Field label="AI provider" htmlFor="ai-provider">
                    <Select
                      id="ai-provider"
                      value={state.settings.aiProvider}
                      onChange={(event) => {
                        const next = aiProvider(event.target.value);
                        if (!next.available) {
                          toast(next.reason ?? "This provider is not available yet", {
                            tone: "danger",
                          });
                          return;
                        }
                        os.updateSettings({ aiProvider: next.id });
                        savePreferences({ ai: { ...prefs.ai, model: next.id } });
                        toast(`${next.label} selected`, { tone: "success" });
                      }}
                    >
                      {AI_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id} disabled={!provider.available}>
                          {provider.label}
                          {provider.available ? "" : " (unavailable)"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="text-xs text-ink-3">
                    {selectedProvider.detail}
                    {!selectedProvider.available && selectedProvider.reason
                      ? ` ${selectedProvider.reason}`
                      : ""}
                  </p>
                </div>
              </Card>
            </>
          )}

          {tab === "notifications" && prefs && <WeeklyEmailCard />}

          {tab === "notifications" && prefs && (
            <Card
              title="Notifications"
              description="Choose what deserves your attention."
              icon={Bell}
              action={
                <Button size="sm" variant="ghost" onClick={resetNotifications}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Reset
                </Button>
              }
            >
              <div className="space-y-1.5">
                <Row label="Daily briefing" hint="A morning summary of your day.">
                  <Switch
                    label="Daily briefing"
                    checked={prefs.notifications.dailyBriefing}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        notifications: { ...prefs.notifications, dailyBriefing: checked },
                      })
                    }
                  />
                </Row>
                <Row label="Task reminders" hint="Nudges before due dates.">
                  <Switch
                    label="Task reminders"
                    checked={prefs.notifications.taskReminders}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        notifications: { ...prefs.notifications, taskReminders: checked },
                      })
                    }
                  />
                </Row>
                <Row label="AI insights" hint="Highlights and suggestions from the assistant.">
                  <Switch
                    label="AI insights"
                    checked={prefs.notifications.aiInsights}
                    onCheckedChange={(checked) =>
                      savePreferences({
                        notifications: { ...prefs.notifications, aiInsights: checked },
                      })
                    }
                  />
                </Row>
                <div className="mt-2 border-t border-line pt-3">
                  <Row label="Quiet hours" hint="Nothing ships during this window.">
                    <Switch
                      label="Quiet hours"
                      checked={prefs.notifications.quietHours.enabled}
                      onCheckedChange={(checked) =>
                        savePreferences({
                          notifications: {
                            ...prefs.notifications,
                            quietHours: { ...prefs.notifications.quietHours, enabled: checked },
                          },
                        })
                      }
                    />
                  </Row>
                  {prefs.notifications.quietHours.enabled && (
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <Field label="From" htmlFor="qh-start">
                        <Input
                          id="qh-start"
                          type="time"
                          value={prefs.notifications.quietHours.start}
                          onChange={(event) =>
                            savePreferences({
                              notifications: {
                                ...prefs.notifications,
                                quietHours: {
                                  ...prefs.notifications.quietHours,
                                  start: event.target.value,
                                },
                              },
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Until"
                        htmlFor="qh-end"
                        hint={
                          durationBetween(
                            prefs.notifications.quietHours.start,
                            prefs.notifications.quietHours.end,
                          ) ?? undefined
                        }
                      >
                        <Input
                          id="qh-end"
                          type="time"
                          value={prefs.notifications.quietHours.end}
                          onChange={(event) =>
                            savePreferences({
                              notifications: {
                                ...prefs.notifications,
                                quietHours: {
                                  ...prefs.notifications.quietHours,
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
                <div className="mt-2 border-t border-line pt-3">
                  <Row
                    label="Device reminders"
                    hint="In-app and browser alerts, quiet hours, and reminder types."
                  >
                    <Button size="sm" variant="ghost" onClick={() => changeTab("mobile")}>
                      Open Mobile
                    </Button>
                  </Row>
                </div>
              </div>
            </Card>
          )}

          {tab === "security" && (
            <>
              <Card
                title="Email verification"
                description="Confirm your email for password resets and recovery."
                icon={MailCheck}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-ink">
                      {profile?.email ?? "No email on account"}
                    </span>
                    <span className="text-xs">
                      {profile?.emailVerified ? (
                        <span className="font-medium text-success">Verified</span>
                      ) : (
                        <span className="font-medium text-warning">Not verified</span>
                      )}
                    </span>
                  </div>
                  {profile?.email && !profile.emailVerified && (
                    <Button variant="secondary" loading={verifyBusy} onClick={() => void resendVerification()}>
                      Send verification email
                    </Button>
                  )}
                </div>
                {verifyInfo?.devToken && (
                  <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    Development mode —{" "}
                    <a
                      href={`/verify-email?token=${encodeURIComponent(verifyInfo.devToken)}`}
                      className="font-medium text-accent-ink hover:underline"
                    >
                      open the verification link
                    </a>
                  </p>
                )}
              </Card>

              <Card
                title="Change password"
                description="Changing your password signs out every other session."
                icon={KeyRound}
              >
                <form className="max-w-md space-y-4" onSubmit={submitPassword} noValidate>
                  {pwError !== null && (
                    <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                      {errorMessage(pwError)}
                    </p>
                  )}
                  <Field label="Current password" htmlFor="pw-current" required>
                    <Input
                      id="pw-current"
                      type="password"
                      autoComplete="current-password"
                      value={pwCurrent}
                      onChange={(event) => setPwCurrent(event.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="New password"
                    htmlFor="pw-new"
                    required
                    hint="At least 10 characters."
                  >
                    <Input
                      id="pw-new"
                      type="password"
                      autoComplete="new-password"
                      value={pwNext}
                      onChange={(event) => setPwNext(event.target.value)}
                      minLength={10}
                      required
                    />
                  </Field>
                  <Field label="Confirm new password" htmlFor="pw-confirm" required>
                    <Input
                      id="pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={pwConfirm}
                      onChange={(event) => setPwConfirm(event.target.value)}
                      minLength={10}
                      required
                    />
                  </Field>
                  <ul className="space-y-1 text-xs">
                    {passwordChecks.map((check) => (
                      <li
                        key={check.label}
                        className={check.ok ? "flex items-center gap-1.5 text-success" : "flex items-center gap-1.5 text-ink-3"}
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        {check.label}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="primary" loading={pwBusy}>
                      Update password
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      loading={resetBusy}
                      onClick={() => void requestPasswordReset()}
                    >
                      Send reset link instead
                    </Button>
                  </div>
                </form>
              </Card>

              <Card
                title="Active sessions"
                description="Devices currently signed in to your account."
                icon={Shield}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void loadSecurity()}
                      disabled={securityBusy}
                    >
                      <RefreshCw className={securityBusy ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmRevokeOthers(true)}
                      disabled={securityBusy || securityAction !== null}
                    >
                      Sign out others
                    </Button>
                  </div>
                }
              >
                {securityError ? (
                  <Alert
                    tone="danger"
                    title="Could not load security details"
                    action={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSecurityError(null);
                          void loadSecurity();
                        }}
                      >
                        Retry
                      </Button>
                    }
                  >
                    {securityError}
                  </Alert>
                ) : sessions === null || securityBusy ? (
                  <p className="text-sm text-ink-3">Loading sessions.</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-ink-3">No other active sessions.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {sessions.map((session) => (
                      <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            <span className="truncate">{session.deviceName}</span>
                            {session.current && (
                              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                                This device
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-ink-3">
                            {session.ip ?? "Unknown IP"} · last seen {formatWhen(session.lastSeenAt)}
                          </span>
                        </div>
                        {!session.current && (
                          <Button
                            variant="ghost"
                            loading={securityAction === `session:${session.id}`}
                            disabled={securityAction !== null}
                            onClick={() => void revokeSession(session.id)}
                          >
                            Sign out
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="Devices"
                description="Recognized browsers and where they last signed in."
                icon={Smartphone}
              >
                {securityError ? (
                  <p className="text-sm text-ink-3">Security details are unavailable right now.</p>
                ) : devices === null || securityBusy ? (
                  <p className="text-sm text-ink-3">Loading devices.</p>
                ) : devices.length === 0 ? (
                  <p className="text-sm text-ink-3">No devices recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {devices.map((device) => (
                      <li key={device.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {device.name} · {device.platform}
                          </span>
                          <span className="block text-xs text-ink-3">
                            {device.activeSessions} active session
                            {device.activeSessions === 1 ? "" : "s"} · last seen{" "}
                            {formatWhen(device.lastSeenAt)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          loading={securityAction === `device:${device.id}`}
                          onClick={() => void revokeDevice(device.id)}
                          disabled={device.revokedAt !== null || securityAction !== null}
                        >
                          {device.revokedAt ? "Revoked" : "Revoke"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {tab === "mobile" && <MobileSettingsSection />}

          {tab === "data" && (
            <>
              <Card
                title="Backup & restore"
                description="A complete snapshot of tasks, notes, events, journals, memories, and settings."
                icon={Database}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-xs text-ink-3">Local backup size</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{formatBytes(backupBytes)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-xs text-ink-3">Records stored</p>
                    <p className="mt-1 text-lg font-semibold text-ink">
                      {localStats.reduce((sum, item) => sum + item.value, 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-xs text-ink-3">Schema</p>
                    <p className="mt-1 text-lg font-semibold text-ink">v{state.version}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {localStats.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-xs">
                      <span className="text-ink-3">{item.label}</span>
                      <span className="tnum font-medium text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Button variant="secondary" onClick={exportData}>
                    <Download className="size-4" aria-hidden="true" />
                    Export backup
                  </Button>
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-4" aria-hidden="true" />
                    Import backup
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    aria-label="Choose a backup file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setImportFile(file);
                      event.target.value = "";
                    }}
                  />
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
                  <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Stored in your browser&apos;s localStorage under one key. Clearing site data or using
                  private browsing will remove it — export regularly.
                </p>
              </Card>

              <Card
                title="Danger zone"
                description="These actions affect this browser and cannot be undone."
                icon={Trash2}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-soft/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Clear all local data</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                      Removes tasks, notes, events, settings, and connections from this device. Your
                      account remains active.
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => setClearOpen(true)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Clear all data
                  </Button>
                </div>
              </Card>
            </>
          )}

          {tab === "shortcuts" && (
            <Card title="Keyboard shortcuts" description="Fewer keystrokes, same capture." icon={Keyboard}>
              <ul className="space-y-3 text-sm text-ink-2">
                {[
                  { label: "Open universal capture", keys: [modifier, "Shift", "K"] },
                  { label: "Open command palette", keys: [modifier, "P"] },
                  { label: "Global search", keys: [modifier, "O"] },
                  { label: "Save from capture or add rows", keys: ["Enter"] },
                  { label: "New line while capturing", keys: ["Shift", "Enter"] },
                  { label: "Close any dialog", keys: ["Esc"] },
                ].map((shortcut) => (
                  <li key={shortcut.label} className="flex items-center justify-between gap-4">
                    <span>{shortcut.label}</span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <React.Fragment key={key}>
                          {index > 0 ? <span className="mx-1 text-line-strong">+</span> : null}
                          <Kbd>{key}</Kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
                <Keyboard className="size-3.5" aria-hidden="true" />
                {modifier === "⌘"
                  ? "On Windows or Linux, use Ctrl instead of ⌘."
                  : "On macOS, use ⌘ instead of Ctrl."}
              </p>
            </Card>
          )}

          {tab === "about" && (
            <>
              <Card title="About this build" description="What is running on this device." icon={Info}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Version</dt>
                    <dd className="text-ink">0.1.0 · foundation</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Schema</dt>
                    <dd className="tnum text-ink">v{state.version}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Tasks stored</dt>
                    <dd className="tnum text-ink">{Object.keys(state.tasks).length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Notes stored</dt>
                    <dd className="tnum text-ink">{Object.keys(state.notes).length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Local backup size</dt>
                    <dd className="tnum text-ink">{formatBytes(backupBytes)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-3">Storage</dt>
                    <dd className="text-ink">Browser localStorage</dd>
                  </div>
                </dl>
              </Card>

              <Card title="Privacy" description="Your data stays close." icon={Shield}>
                <p className="text-sm leading-relaxed text-ink-3">
                  Tasks, notes, events, journals, and memories are written locally first. Account
                  preferences and security metadata are stored on the server so they can follow you
                  across devices. Export a backup before clearing browser data.
                </p>
              </Card>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={importFile !== null}
        onClose={() => setImportFile(null)}
        onConfirm={() => {
          if (importFile) void importData(importFile);
        }}
        title="Restore this backup?"
        description={
          <>
            Importing <span className="font-medium text-ink">{importFile?.name}</span> replaces every
            local record and setting on this device. Your account stays signed in.
          </>
        }
        confirmLabel="Restore backup"
        tone="danger"
        busy={importBusy}
      />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearAll}
        title="Clear all local data?"
        description="This removes tasks, notes, events, journals, memories, settings, and connections from this browser. Your account remains active. This cannot be undone."
        confirmLabel="Erase everything"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmRevokeOthers}
        onClose={() => setConfirmRevokeOthers(false)}
        onConfirm={() => void revokeOthers()}
        title="Sign out other sessions?"
        description="Every other browser and device will need to sign in again. This device stays signed in."
        confirmLabel="Sign out others"
        tone="danger"
        busy={securityAction === "others"}
      />
    </>
  );
}
