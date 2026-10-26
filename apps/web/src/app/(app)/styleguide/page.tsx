import type { Metadata } from "next";

import { Palette } from "lucide-react";

import { PageHeader } from "@/components/page-header";

import { TokensSection } from "./tokens";
import { ControlsSection } from "./controls";
import { FeedbackSection } from "./feedback";
import { DataSection } from "./data";

export const metadata: Metadata = {
  title: "Design system",
};

const ANCHORS = [
  ["color", "Color"],
  ["typography", "Typography"],
  ["spacing", "Spacing"],
  ["radius", "Radius"],
  ["elevation", "Elevation"],
  ["motion", "Motion"],
  ["icons", "Icons"],
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["select", "Selects"],
  ["tabs", "Tabs"],
  ["checkboxes", "Checkboxes"],
  ["date-time", "Date & time"],
  ["modals", "Modals"],
  ["tooltips", "Tooltips"],
  ["toasts", "Toasts"],
  ["alerts", "Alerts"],
  ["progress", "Progress"],
  ["skeletons", "Skeletons"],
  ["empty", "Empty states"],
  ["errors", "Error states"],
  ["command", "Command palette"],
  ["cards", "Cards"],
  ["badges", "Badges & chips"],
  ["navigation", "Navigation"],
  ["timeline", "Timeline"],
  ["tasks", "Tasks"],
  ["habits", "Habits"],
  ["goals", "Goals"],
  ["notes", "Notes"],
  ["ai", "AI"],
  ["layout", "Layout"],
] as const;

export default function StyleguidePage() {
  return (
    <>
      <PageHeader
        icon={Palette}
        title="Design system"
        subtitle="The visual foundation of PersonalOS — semantic tokens, reusable components, verified in both themes."
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 sm:px-6">
        <nav aria-label="Design system sections" className="flex flex-wrap gap-1.5">
          {ANCHORS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
        <TokensSection />
        <ControlsSection />
        <FeedbackSection />
        <DataSection />
      </div>
    </>
  );
}