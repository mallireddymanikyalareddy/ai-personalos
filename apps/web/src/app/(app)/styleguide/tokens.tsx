"use client";

import * as React from "react";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Flag,
  Inbox,
  ListChecks,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { Icon, type IconScale } from "@/components/ui/icon";
import { Block, Pill, Row, Section } from "./section";

function useCssVars(names: string[]) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const name of names) next[name] = styles.getPropertyValue(name).trim();
      setValues(next);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [names]);
  return values;
}

function Swatch({
  name,
  value,
  label,
  textColor,
}: {
  name: string;
  value: string;
  label: string;
  textColor?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-line shadow-card"
        style={{ backgroundColor: value === "transparent" ? "transparent" : value }}
      >
        {textColor != null && <span className="size-2.5 rounded-full" style={{ backgroundColor: textColor }} />}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-xs font-medium text-ink">{label}</p>
        <p className="truncate font-mono text-[11px] text-ink-3">
          {name} · {value || "–"}
        </p>
      </div>
    </div>
  );
}

const SEMANTIC_LABELS: Record<string, string> = {
  "--bg": "App background",
  "--bg-subtle": "Background subtle",
  "--surface": "Surface",
  "--surface-2": "Surface raised",
  "--surface-3": "Surface pressed",
  "--ink": "Primary text",
  "--ink-2": "Secondary text",
  "--ink-3": "Tertiary text / meta",
  "--line": "Hairline border",
  "--line-strong": "Strong border",
  "--accent": "Accent",
  "--accent-strong": "Accent hover / active",
  "--accent-soft": "Accent tint",
  "--accent-ink": "Accent text",
  "--success": "Success",
  "--warning": "Warning",
  "--danger": "Danger",
  "--info": "Information",
};

const EXTENDED_VARS = [
  "--bg",
  "--bg-subtle",
  "--surface",
  "--surface-2",
  "--surface-3",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-strong",
  "--accent-soft",
  "--accent-ink",
  "--success",
  "--success-soft",
  "--danger",
  "--danger-soft",
  "--warning",
  "--warning-soft",
  "--info",
  "--info-soft",
  "--p1",
  "--p2",
  "--p3",
  "--p4",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
  "--radius-xs",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--radius-2xl",
  "--radius-3xl",
  "--shadow-card",
  "--shadow-pop",
  "--shadow-float",
];

const TYPOGRAPHY = [
  { className: "text-2xl font-bold tracking-tight", role: "Page title", sample: "Today" },
  { className: "text-xl font-semibold tracking-tight", role: "Section heading", sample: "Overdue" },
  { className: "text-base font-semibold tracking-tight", role: "Card title", sample: "Ship the design system" },
  { className: "text-sm font-medium", role: "Body / list item", sample: "Turn the wireframe into a living foundation" },
  { className: "text-sm font-normal", role: "Body secondary", sample: "Capture anything, offload everything." },
  { className: "text-xs font-medium", role: "Label / meta", sample: "Progress 64% · updated just now" },
  { className: "text-[11px] font-semibold uppercase tracking-wider", role: "Eyebrow / section label", sample: "Plan · Grow · Flow" },
];

const DEMO_ICONS = [
  Plus, Check, X, Search, Bell, Settings, Flag,
  CalendarDays, ListChecks, FileText, Inbox, Target,
  Repeat, Timer, TrendingUp, Sparkles, ChevronDown, ChevronRight, Download,
];

const SPACING = [4, 8, 12, 16, 24, 32, 48, 64];

export function TokensSection() {
  const vars = useCssVars(EXTENDED_VARS);

  const groups: { label: string; names: string[]; textAccent?: (name: string) => string | undefined }[] = [
    { label: "Surfaces", names: ["--bg", "--bg-subtle", "--surface", "--surface-2", "--surface-3"] },
    { label: "Text", names: ["--ink", "--ink-2", "--ink-3"] },
    { label: "Borders", names: ["--line", "--line-strong"] },
    { label: "Accent", names: ["--accent", "--accent-strong", "--accent-soft", "--accent-ink"] },
    { label: "Status", names: ["--success", "--success-soft", "--warning", "--warning-soft", "--danger", "--danger-soft", "--info", "--info-soft"] },
    { label: "Priority", names: ["--p1", "--p2", "--p3", "--p4"] },
    { label: "Charts", names: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6", "--chart-7", "--chart-8"] },
  ];

  return (
    <>
      <Section
        id="color"
        title="Color system"
        blurb="One accent, semantic status colors, four priority levels and a data-viz ramp — every value is a CSS variable, so light and dark resolve from a single token set that future changes flow through."
      >
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {["--bg", "--bg-subtle", "--surface", "--surface-2", "--surface-3", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong", "--accent", "--accent-strong", "--accent-soft", "--accent-ink", "--success", "--warning", "--danger", "--info"].map((name) => (
            <Swatch key={name} name={name} value={vars[name] ?? ""} label={SEMANTIC_LABELS[name] ?? name} />
          ))}
        </div>
        <Block title="Extended ramps">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  {group.label}
                </p>
                {group.names.map((name) => (
                  <Swatch key={name} name={name} value={vars[name] ?? ""} label={name} />
                ))}
              </div>
            ))}
          </div>
        </Block>
        <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-ink-3">
          Status tones expose a soft surface pair (e.g. <Pill>--success-soft</Pill>) for tinted surfaces in alerts,
          badges and icons, while the base token carries true color. Interactive tints use
          <Pill>color-mix(in srgb, …)</Pill> so hover and focus derive from accent without extra tokens.
        </div>
      </Section>

      <Section
        id="typography"
        title="Typography & font hierarchy"
        blurb="Inter is the interface typeface. Hierarchy is built from size and weight only — no new families — which keeps long task lists calm and Scannable."
      >
        <Block title="Scale">
          <div className="divide-y divide-line">
            {TYPOGRAPHY.map((entry) => (
              <div key={entry.className} className="flex flex-col gap-1 py-2.5 first:pt-0 sm:flex-row sm:items-baseline sm:gap-6">
                <div className="w-44 shrink-0">
                  <p className={entry.className}>{entry.sample}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <Pill>{entry.className}</Pill>
                  <p className="mt-0.5 text-xs text-ink-3">{entry.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>
        <Block title="Weights & tabular numbers">
          <Row>
            <p className="text-sm font-normal">Regular 400</p>
            <p className="text-sm font-medium">Medium 500</p>
            <p className="text-sm font-semibold">Semibold 600</p>
            <p className="text-sm font-bold">Bold 700</p>
            <span className="tnum text-sm font-medium">Tabular 0 1 2 3 4 5 6 7 8 9</span>
          </Row>
          <p className="text-xs text-ink-3">
            Use <Pill>.tnum</Pill> (tabular numerals) for counts, dates and metrics so digits don&apos;t jitter when they
            change.
          </p>
        </Block>
      </Section>

      <Section
        id="spacing"
        title="Spacing scale"
        blurb="A 4px base grid keyed to component padding, gaps and section rhythm. Compact inside (rows, chips), generous at the page level."
      >
        <Block>
          <div className="space-y-2.5">
            {SPACING.map((px) => (
              <div key={px} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-right font-mono text-[11px] text-ink-3">{px}px</span>
                <div
                  className={cn("h-3 rounded-full", px >= 48 ? "bg-accent" : "bg-accent/70")}
                  style={{ width: Math.min(px * 2, 128) }}
                />
                <span className="text-xs text-ink-3">
                  {px <= 8 ? "micro gap" : px <= 16 ? "inline gap" : px <= 24 ? "card padding" : "page rhythm"}
                </span>
              </div>
            ))}
          </div>
        </Block>
      </Section>

      <Section
        id="radius"
        title="Border radius"
        blurb="Tight radii read precise (Linear); generous radii read friendly (Stripe). We use 6–24px depending on scale: the bigger the surface, the rounder the corner."
      >
        <Row>
          {[
            ["--radius-xs", "6px"],
            ["--radius-sm", "8px"],
            ["--radius-md", "10px"],
            ["--radius-lg", "10px"],
            ["--radius-xl", "14px"],
            ["--radius-2xl", "18px"],
            ["--radius-3xl", "24px"],
          ].map(([name, fallback]) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <span
                className="grid size-16 place-items-center border border-line bg-surface shadow-card"
                style={{ borderRadius: vars[name] || fallback }}
              >
                <span className="size-2 rounded-full bg-accent" />
              </span>
              <div className="text-center">
                <p className="font-mono text-[10px] text-ink-3">{name}</p>
                <p className="font-mono text-[10px] text-ink-3">{vars[name] || fallback}</p>
              </div>
            </div>
          ))}
        </Row>
        <p className="text-xs text-ink-3">Usage: controls 8–10px · cards 18px · sheets/panels 18–24px · pills 999px.</p>
      </Section>

      <Section
        id="elevation"
        title="Shadows & elevation"
        blurb="Depth is expressed through layered shadows in light mode and, in dark mode, through bordered surfaces — shadows are near-invisible on dark, so the border does the work."
      >
        <Row>
          {[
            ["--shadow-card", "Resting card", "p-6"],
            ["--shadow-pop", "Menus, popovers, modal", "p-6"],
            ["--shadow-float", "Command palette, drawers", "p-6"],
          ].map(([name, label]) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div
                className="grid h-24 w-40 place-items-center rounded-2xl border border-line bg-surface"
                style={{ boxShadow: (vars[name] || "").replace(";", "") }}
              >
                <span className="text-xs font-medium text-ink-3">{label}</span>
              </div>
              <p className="font-mono text-[10px] text-ink-3">{name}</p>
            </div>
          ))}
        </Row>
        <p className="text-xs text-ink-3">
          Layer order: cards <Pill>shadow-card</Pill> → menus <Pill>shadow-pop</Pill> → full-screen overlays{" "}
          <Pill>shadow-float</Pill>. Hover/hover-pop transitions create the only motion on static surfaces.
        </p>
      </Section>

      <Section
        id="motion"
        title="Motion & reduced motion"
        blurb="Micro-motion only: 120–280ms spring-eased. CSS animations declare their easing as tokens, and the global reduced-motion rule collapses every duration to near-zero."
      >
        <Row>
          <Pill>--ease-spring</Pill>
          <Pill>--ease-decelerate</Pill>
          <Pill>--ease-standard</Pill>
          <Pill>--ease-accelerate</Pill>
          <Pill>fade-in 160ms</Pill>
          <Pill>scale-in 160ms</Pill>
          <Pill>sheet-up 240ms</Pill>
          <Pill>toast-in 220ms</Pill>
        </Row>
        <Block title="Animated examples">
          <Row>
            <button type="button" className="grid size-12 place-items-center rounded-xl border border-line bg-surface-2 text-ink-2 transition-transform duration-150 hover:scale-105 hover:bg-surface-2 hover:text-ink animate-soft-pulse">
              <Bell className="size-5" aria-hidden="true" />
            </button>
            <div className="grid size-12 place-items-center rounded-xl border border-line bg-surface shadow-card transition-all duration-150 hover:shadow-pop animate-soft-pulse">
              <Sparkles className="size-5 text-accent" aria-hidden="true" />
            </div>
          </Row>
        </Block>
      </Section>

      <Section
        id="icons"
        title="Icons"
        blurb="Lucide, stroke-based, 14–24px. One stroke family keeps the system weightless; size and weight scale together for optical consistency."
      >
        <Row>
          {DEMO_ICONS.map((IconComponent, index) => (
            <span
              key={index}
              className="grid size-10 place-items-center rounded-lg border border-line bg-surface text-ink-2"
            >
              <Icon icon={IconComponent} scale="md" />
            </span>
          ))}
        </Row>
        <Block title="Scale">
          {(["xs", "sm", "md", "lg", "xl"] as IconScale[]).map((scale) => (
            <Row key={scale} className="gap-4">
              <span className="w-8 text-xs font-medium text-ink-3">{scale}</span>
              {DEMO_ICONS.slice(0, 4).map((IconComponent, index) => (
                <Icon key={index} icon={IconComponent} scale={scale} className="text-ink-2" />
              ))}
            </Row>
          ))}
        </Block>
      </Section>
    </>
  );
}