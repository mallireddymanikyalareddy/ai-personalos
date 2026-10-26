"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Command, PanelLeftClose, PanelLeftOpen, Palette } from "lucide-react";

import { Kbd } from "@/components/ui/kbd";
import { useCapture } from "@/modules/capture/capture-context";
import { selectInboxTasks, selectTodayTasks } from "@personalos/core";

import { useAppState } from "@/store/use-os";
import { cn } from "@/lib/cn";
import {
  SIDEBAR_COLLAPSE_BREAKPOINT,
  applySidebarDensity,
  isSidebarCollapsed,
  persistSidebarDensity,
} from "@/lib/sidebar-pref";
import { DESIGN_NAV, SIDEBAR_SECTIONS, isActivePath, type NavItem } from "./nav";

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto shrink-0 tnum rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({
  item,
  pathname,
  collapsed,
  count,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  count?: number;
}) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  const badgeCount = count ?? 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      data-active={active}
      data-collapsed={collapsed}
      title={item.label}
      className={cn(
        "group relative flex h-9 items-center rounded-lg text-sm transition-colors duration-150",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3",
        active
          ? "bg-accent-soft font-medium text-accent-ink"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent"
          aria-hidden="true"
        />
      ) : null}
      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {collapsed ? (
        <>
          {badgeCount > 0 ? (
            <span
              className="absolute right-2 top-1.5 size-1.5 rounded-full bg-accent ring-2 ring-bg"
              aria-hidden="true"
            />
          ) : null}
          <span className="sr-only">
            {item.label}
            {badgeCount > 0 ? ` (${badgeCount})` : ""}
          </span>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <CountBadge count={badgeCount} />
        </>
      )}
    </Link>
  );
}

function SectionHeading({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="my-2 px-3" aria-hidden="true">
        <div className="border-t border-line" />
      </div>
    );
  }
  return (
    <h2 className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
      {label}
    </h2>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const state = useAppState();
  const { openCapture } = useCapture();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const initial = isSidebarCollapsed();
    setCollapsed(initial);
    applySidebarDensity(initial);
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      persistSidebarDensity(next);
      return next;
    });
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(`(max-width: ${SIDEBAR_COLLAPSE_BREAKPOINT - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => {
      const next = event.matches ? true : isSidebarCollapsed();
      setCollapsed(next);
      applySidebarDensity(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const todayCount = selectTodayTasks(state, Date.now()).length;
  const inboxCount = selectInboxTasks(state).length;

  return (
    <aside
      data-testid="sidebar"
      data-collapsed={collapsed}
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w,16rem)] flex-col border-r border-line bg-bg transition-[width] duration-200 md:flex"
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center lg:h-16",
          collapsed ? "justify-center px-2" : "justify-between gap-2 px-3",
        )}
      >
        {collapsed ? null : (
          <span className="truncate text-sm font-semibold tracking-tight text-ink-2">
            Menu
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          aria-keyshortcuts="Control+B Meta+B"
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          data-testid="sidebar-collapse"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} data-section={section.label}>
            <SectionHeading label={section.label} collapsed={collapsed} />
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  count={item.badge === "today" ? todayCount : item.badge === "inbox" ? inboxCount : 0}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-2 border-t border-line p-2",
          collapsed && "flex flex-col items-center",
        )}
      >
        <button
          type="button"
          onClick={openCapture}
          data-testid="sidebar-capture"
          className={cn(
            "relative flex h-9 w-full items-center rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-strong",
            collapsed ? "justify-center px-0" : "gap-2 px-3",
          )}
          title="Capture (⌘K)"
        >
          <span className="relative grid place-items-center">
            <Command className="size-4" aria-hidden="true" />
            {inboxCount > 0 ? (
              <span
                className="absolute -right-1 -top-1 size-1.5 rounded-full bg-white ring-2 ring-accent"
                aria-hidden="true"
              />
            ) : null}
          </span>
          {collapsed ? null : (
            <>
              <span>Capture</span>
              <Kbd className="ml-auto border-white/25 bg-white/15 text-white/80">⌘K</Kbd>
            </>
          )}
          <span className="sr-only">Capture (Command or Control + Shift + K)</span>
        </button>

        <Link
          href={DESIGN_NAV.href}
          title={DESIGN_NAV.label}
          aria-label={DESIGN_NAV.label}
          className={cn(
            "flex h-9 items-center rounded-lg text-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink",
            collapsed ? "justify-center px-0" : "gap-2.5 px-3",
          )}
        >
          <Palette className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {collapsed ? null : <span className="truncate">{DESIGN_NAV.label}</span>}
        </Link>
      </div>
    </aside>
  );
}