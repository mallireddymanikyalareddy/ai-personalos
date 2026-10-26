"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { useAuth } from "@/modules/auth/auth-context";

function AuthLoading() {
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

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && profile && !profile.onboardingCompleted) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
    }
  }, [status, profile, router, pathname]);

  if (status === "loading") {
    return <AuthLoading />;
  }
  if (status === "anonymous") {
    return <AuthLoading />;
  }
  return <AppShell>{children}</AppShell>;
}
