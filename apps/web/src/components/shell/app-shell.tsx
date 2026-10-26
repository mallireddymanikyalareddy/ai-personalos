"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { Plus } from "lucide-react";

import { registerServiceWorker } from "@/lib/pwa";
import { useThemeEffect } from "@/lib/theme";
import { cn } from "@/lib/cn";
import { getOS } from "@/store/os";
import { useAppState } from "@/store/use-os";
import { useHaptics } from "@/hooks/use-haptics";

import { CaptureProvider, useCapture } from "@/modules/capture/capture-context";
import { CaptureSheet } from "@/modules/capture/capture-sheet";
import { CommandPalette } from "@/modules/command/command-palette";
import { CommandProvider } from "@/modules/command/command-context";
import { GlobalSearch } from "@/modules/command/global-search";
import { selectInboxTasks } from "@personalos/core";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { OfflineBanner } from "@/components/mobile/offline-banner";
import { QuickCaptureSheet } from "@/components/mobile/quick-capture-sheet";
import { AppSkeleton } from "./app-skeleton";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

function CaptureShortcutListener() {
  const { toggleCapture } = useCapture();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleCapture();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCapture]);

  return null;
}

function MobileChrome({ children }: { children: React.ReactNode }) {
  const os = getOS();
  const haptics = useHaptics();
  useAppState();
  const { openCaptureWith } = useCapture();
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false);

  const now = Date.now();
  const journalToday = os.journalEntryFor(now) != null;

  return (
    <>
      {children}
      <MobileBottomNav
        onCapture={() => {
          haptics.trigger("commit");
          setQuickCaptureOpen(true);
        }}
        onVoiceCapture={() => openCaptureWith("voice")}
        journalTodayLabel={journalToday ? "Today's reflection completed" : null}
      />
      <QuickCaptureSheet open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
    </>
  );
}

function Fab() {
  const { openCapture } = useCapture();
  const state = useAppState();
  const inboxCount = selectInboxTasks(state).length;
  return (
    <button
      type="button"
      onClick={openCapture}
      aria-label="Capture (Ctrl or Cmd + Shift + K)"
      className="fixed bottom-20 right-4 z-40 hidden size-12 place-items-center rounded-full bg-accent text-white shadow-float transition-all duration-150 hover:bg-accent-strong hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:grid"
    >
      <span className="relative grid place-items-center">
        <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
        {inboxCount > 0 && (
          <span
            className="absolute -right-1 -top-1 size-2 rounded-full bg-white ring-2 ring-accent"
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  const pathname = usePathname();
  const preferences = state.settings.mobile;
  const wide =
    pathname === "/today" ||
    pathname === "/goals" ||
    pathname.startsWith("/goals/") ||
    pathname === "/habits" ||
    pathname.startsWith("/habits/") ||
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/notes" ||
    pathname.startsWith("/notes/") ||
    pathname === "/ai" ||
    pathname.startsWith("/ai/") ||
    pathname === "/planner" ||
    pathname.startsWith("/planner/") ||
    pathname === "/meetings" ||
    pathname.startsWith("/meetings/") ||
    pathname === "/paper" ||
    pathname.startsWith("/paper/") ||
    pathname === "/notebook" ||
    pathname.startsWith("/notebook/") ||
    pathname === "/journal" ||
    pathname.startsWith("/journal/") ||
    pathname === "/work" ||
    pathname.startsWith("/work/") ||
    pathname === "/workmode" ||
    pathname.startsWith("/workmode/") ||
    pathname === "/calendar" ||
    pathname.startsWith("/calendar/") ||
    pathname === "/insights" ||
    pathname.startsWith("/insights/") ||
    pathname === "/rewards" ||
    pathname.startsWith("/rewards/") ||
    pathname === "/templates" ||
    pathname.startsWith("/templates/") ||
    pathname === "/focus" ||
    pathname.startsWith("/focus/") ||
    pathname === "/memory" ||
    pathname.startsWith("/memory/");

  React.useEffect(() => {
    getOS().hydrate();
  }, []);

  React.useEffect(() => {
    const next =
      pathname === "/workmode" || pathname.startsWith("/workmode/") || pathname === "/work" || pathname.startsWith("/work/")
        ? "work"
        : pathname === "/today" || pathname.startsWith("/today/")
          ? "personal"
          : null;
    if (next == null) return;
    if (getOS().getState().settings.activeMode !== next) getOS().setActiveMode(next);
  }, [pathname]);

  useThemeEffect(state.settings.theme);

  React.useEffect(() => {
    registerServiceWorker();
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.oneHanded = preferences.oneHanded ? "true" : "false";
    root.dataset.handedness = preferences.handedness;
    root.dataset.touchTargets = preferences.largerTouchTargets ? "large" : "normal";
    root.style.setProperty(
      "--touch-min",
      preferences.largerTouchTargets ? "48px" : "44px",
    );
  }, [preferences.oneHanded, preferences.handedness, preferences.largerTouchTargets]);

  if (!state.hydrated) {
    return <AppSkeleton />;
  }

  return (
    <CaptureProvider>
      <CommandProvider>
        <CaptureShortcutListener />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:border focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-pop"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="md:pl-[var(--sidebar-w,16rem)]">
          <TopBar />
          <div className="md:hidden px-4 pt-3">
            <OfflineBanner pendingCount={0} />
          </div>
          <main
            id="main"
            className={cn(
              "mx-auto w-full px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8",
              wide ? "max-w-[104rem]" : "max-w-4xl",
            )}
          >
            {children}
          </main>
        </div>
        <MobileChrome>
          <span className="sr-only">Mobile shortcuts are active</span>
        </MobileChrome>
        <Fab />
        <CaptureSheet />
        <CommandPalette />
        <GlobalSearch />
      </CommandProvider>
    </CaptureProvider>
  );
}
