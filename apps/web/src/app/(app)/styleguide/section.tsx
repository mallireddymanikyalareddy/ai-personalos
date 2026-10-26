import * as React from "react";

import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

export function Section({
  id,
  title,
  blurb,
  children,
}: {
  id?: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {blurb && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-3">{blurb}</p>}
      </div>
      <Card className="p-5">
        <div className="space-y-5">{children}</div>
      </Card>
    </section>
  );
}

export function Block({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{title}</p>
      )}
      {children}
    </div>
  );
}

export function Row({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}