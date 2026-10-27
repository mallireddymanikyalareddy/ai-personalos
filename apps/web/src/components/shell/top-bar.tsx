"use client";

import Link from "next/link";

import { LogOut, Moon, Plus, Search, Settings, Sparkles, Sun } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Kbd } from "@/components/ui/kbd";
import { Logo } from "@/components/ui/logo";
import { HeaderNotifications } from "@/components/shell/header-notifications";
import { useCommands } from "@/modules/command/command-context";
import { useCapture } from "@/modules/capture/capture-context";
import { ModeSwitcher } from "@/modules/collaboration/mode-switcher";

import { cn } from "@/lib/cn";
import { setSettings } from "@/lib/settings-sync";
import { useAppState } from "@/store/use-os";
import { useAuth } from "@/modules/auth/auth-context";
import { useRouter } from "next/navigation";
import { CreditBadge } from "./credit-badge";
import { SyncBadge } from "./sync-badge";

export function ThemeToggle({ className }: { className?: string }) {
  const state = useAppState();
  const isDark =
    state.settings.theme === "dark" ||
    (state.settings.theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      type="button"
      onClick={() => setSettings({ theme: isDark ? "light" : "dark" })}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  );
}

export function TopBar() {
  const state = useAppState();
  const { openSearch } = useCommands();
  const { openCapture } = useCapture();
  const { profile, logout } = useAuth();
  const router = useRouter();

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-20 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md"
    >
      <div className="grid h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:h-16 lg:px-8">
        <Link
          href="/today"
          aria-label="PersonalOS home"
          className="flex shrink-0 items-center gap-2 rounded-lg py-1"
        >
          <Logo className="size-7 shrink-0" />
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:block">
            PersonalOS
          </span>
          <span aria-hidden="true" className="hidden h-4 w-px shrink-0 bg-line xl:block" />
          <Sparkles className="hidden size-4 shrink-0 text-accent xl:block" aria-hidden="true" />
          <span className="hidden text-xs font-medium text-ink-3 xl:block">
            Your Personal Operating System
          </span>
        </Link>

        <div className="hidden items-center justify-center md:flex">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search anything: tasks, calendar, notes, memories, or ask AI"
            className="flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
          >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search anything…</span>
          <Kbd className="shrink-0">Ctrl K</Kbd>
        </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <SyncBadge />
          <CreditBadge />
          <button
            type="button"
            onClick={() => openCapture()}
            aria-label="Capture (Ctrl or Cmd + Shift + K)"
            title="Capture"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden lg:inline">Capture</span>
          </button>
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search (Ctrl or Cmd + K)"
            className="grid size-9 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <Search className="size-5" aria-hidden="true" />
          </button>
          <HeaderNotifications />
          <ModeSwitcher />
          <ThemeToggle className="hidden md:grid" />
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="ml-0.5 inline-flex items-center gap-2 rounded-full ring-offset-2 ring-offset-bg transition-shadow hover:ring-2 hover:ring-line-strong"
                aria-label={`${state.profile.displayName} — account menu`}
              >
                <Avatar name={state.profile.displayName} />
                <span className="hidden max-w-28 truncate text-xs font-medium text-ink-2 xl:inline">
                  {state.profile.displayName.split(/\s+/)[0]}
                </span>
              </button>
            }
            sections={[
              {
                label: profile?.displayName ?? "Account",
                items: [
                  {
                    label: "Settings",
                    icon: <Settings className="size-4" />,
                    onSelect: () => router.push("/settings"),
                  },
                  {
                    label: "Sign out",
                    icon: <LogOut className="size-4" />,
                    danger: true,
                    onSelect: async () => {
                      await logout();
                      router.replace("/login");
                    },
                  },
                ],
              },
            ]}
            align="end"
          />
        </div>
      </div>
    </header>
  );
}
