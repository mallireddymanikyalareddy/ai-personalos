"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  BadgeIndianRupee,
  BarChart3,
  Coins,
  Gift,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldAlert,
  Tags,
  Users,
  Wallet,
} from "lucide-react";

import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/cn";
import { AdminRoleContext } from "@/modules/admin/live";
import { useAuth } from "@/modules/auth/auth-context";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: Wallet },
  { href: "/admin/plans", label: "Plans & Pricing", icon: BadgeIndianRupee },
  { href: "/admin/credits", label: "Credit Management", icon: Coins },
  { href: "/admin/usage", label: "AI Usage & Costs", icon: BarChart3 },
  { href: "/admin/pricing", label: "AI Action Pricing", icon: Tags },
  { href: "/admin/promotions", label: "Promotions & Grants", icon: Gift },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Platform Settings", icon: Settings2 },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  billing_admin: "Billing Admin",
  support_admin: "Support Admin",
  ai_ops_admin: "AI Operations Admin",
  analyst: "Read-only Analyst",
};

type Access = { state: "loading" } | { state: "denied" } | { state: "ok"; role: string; handle: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = React.useState<Access>({ state: "loading" });

  React.useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/v1/admin/me", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setAccess({ state: "denied" });
        const me = (await res.json()) as { role: string; handle: string };
        setAccess({ state: "ok", role: me.role, handle: me.handle });
      })
      .catch(() => !cancelled && setAccess({ state: "denied" }));
    return () => {
      cancelled = true;
    };
  }, [status, router, pathname]);

  if (access.state === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" role="status" aria-label="Loading" />
      </div>
    );
  }
  if (access.state === "denied") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6" data-testid="admin-access-denied">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto size-8 text-ink-3" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-ink">Admin access required</h1>
          <p className="mt-1 text-sm text-ink-3">Your account doesn&apos;t have an admin role.</p>
          <Link href="/today" className="mt-4 inline-block text-sm font-medium text-accent-ink hover:underline">
            Back to PersonalOS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <BrandMark size="sm" />
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bg">Admin</span>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`admin-nav-${href.split("/")[2] ?? "dashboard"}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 pb-3 text-xs text-ink-3 lg:py-4" data-testid="admin-role">
          Signed in as <span className="font-medium text-ink">{access.handle}</span>
          <br />
          {ROLE_LABELS[access.role] ?? access.role}
          <Link href="/today" className="mt-3 block font-medium text-accent-ink hover:underline">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <AdminRoleContext.Provider value={access.role}>{children}</AdminRoleContext.Provider>
      </main>
    </div>
  );
}
