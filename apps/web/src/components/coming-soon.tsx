import * as React from "react";

import { CheckCircle2, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  stage: string;
  bullets: string[];
  untilThen: React.ReactNode;
}

export function ComingSoon({ icon, title, description, stage, bullets, untilThen }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5 flex items-center gap-2.5">
        <Badge tone="accent">{stage}</Badge>
        <span className="text-xs text-ink-3">Not wired up yet</span>
      </div>
      <EmptyState icon={icon} title={title} description={description} />
      <div className="mt-2 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
          What lands here
        </p>
        <ul className="space-y-2.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-3">
          {untilThen}
        </div>
      </div>
    </div>
  );
}
