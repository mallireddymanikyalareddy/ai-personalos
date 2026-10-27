"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { unregisterServiceWorker } from "@/lib/pwa";
import { useAuth } from "@/modules/auth/auth-context";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
// Pages that must stay put for signed-in users too (an emailed link opened while logged in).
const STAY_WHEN_SIGNED_IN = ["/verify-email", "/reset-password"];

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  const { status, profile, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const route = pathname.replace(/\/+$/, "").replace(/\.html$/, "") || "/";
  const isPublic = PUBLIC_PATHS.includes(route);
  const isOnboarding = route === "/onboarding";

  React.useEffect(() => {
    if (status === "loading" || status === "offline") return;
    if (status === "anonymous" && isOnboarding) {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && isPublic && profile && !STAY_WHEN_SIGNED_IN.includes(route)) {
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && /^\/[a-z0-9/_-]*$/i.test(next) && !next.startsWith("//") ? next : null;
      const target = profile.onboardingCompleted ? (safeNext ?? "/today") : "/onboarding";
      if (route !== target) {
        router.replace(target);
      }
    }
  }, [status, profile, isOnboarding, isPublic, router, pathname, route]);

  if (status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div
          className="size-8 animate-spin rounded-full border-2 border-line border-t-accent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
          <h1 className="text-base font-semibold text-ink">You are offline</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            PersonalOS could not reach the server. Your data is safe on this device - reconnect and we
            will pick up where you left off.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              Try again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void unregisterServiceWorker().then(() => window.location.reload());
              }}
            >
              Reset offline cache
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "anonymous" && isOnboarding) return null;
  if (status === "authenticated" && isPublic && !STAY_WHEN_SIGNED_IN.includes(route)) return null;

  return <>{children}</>;
}
