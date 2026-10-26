"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Menu, Mic, Plus } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { moreGroups } from "@/lib/ia/routes";
import { useHaptics } from "@/hooks/use-haptics";
import { useAppState } from "@/store/use-os";
import { BOTTOM_NAV_ITEMS, MORE_NAV, isActivePath } from "./nav";
import { selectInboxTasks, selectTodayTasks } from "@personalos/core";

export interface MobileBottomNavProps {
  onCapture: () => void;
  onVoiceCapture: () => void;
  journalTodayLabel: string | null;
}

export function MobileBottomNav({ onCapture, onVoiceCapture, journalTodayLabel }: MobileBottomNavProps) {
  const pathname = usePathname();
  const state = useAppState();
  const haptics = useHaptics();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const todayCount = selectTodayTasks(state, Date.now()).length;
  const inboxCount = selectInboxTasks(state).length;
  const moreActive = MORE_NAV.some((item) => isActivePath(pathname, item.href));

  const items = BOTTOM_NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.badge === "today" && todayCount > 0,
  }));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-stretch px-2">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => haptics.trigger("tap")}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                  active ? "text-accent-ink" : "text-ink-3",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                  {item.badge && (
                    <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden="true" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                haptics.trigger("commit");
                onCapture();
              }}
              aria-label="Quick capture"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-white shadow-float transition-transform active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.trigger("tap");
              setMenuOpen(true);
            }}
            aria-label="More destinations"
            aria-haspopup="dialog"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
              moreActive ? "text-accent-ink" : "text-ink-3",
            )}
          >
            <Menu className="size-5" strokeWidth={moreActive ? 2.2 : 1.8} aria-hidden="true" />
            More
          </button>
        </div>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Go to" size="sm">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onVoiceCapture();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
          >
            <Mic className="size-4" aria-hidden="true" />
            Voice capture
          </button>
          {moreGroups().map((section) => (
            <div key={section.group}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {section.group}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {section.areas.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.slug);
                  const count = item.key === "inbox" ? inboxCount : 0;
                  return (
                    <Link
                      key={item.key}
                      href={item.slug}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-14 items-center gap-2.5 rounded-xl border border-line px-3.5 py-3 text-sm font-medium",
                        active ? "border-accent/40 bg-accent-soft text-accent-ink" : "bg-surface text-ink-2",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 ? (
                        <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <span className="sr-only">
        {BOTTOM_NAV_ITEMS.length} primary destinations
        {journalTodayLabel ? `. ${journalTodayLabel}` : ""}
      </span>
    </>
  );
}
