import * as React from "react";

import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="AI PersonalOS home" className="inline-flex">
          <Logo className="size-7" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm leading-relaxed text-ink-3">{subtitle}</p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-ink-3">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
