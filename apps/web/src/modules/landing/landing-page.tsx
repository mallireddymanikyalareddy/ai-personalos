"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CheckCheck,
  FileText,
  Layers,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Users,
  Zap,
  Smartphone,
  Star,
  BarChart3,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/shell/top-bar";
import { useAuth } from "@/modules/auth/auth-context";
import { useThemeEffect } from "@/lib/theme";
import { getOS } from "@/store/os";
import { useAppState } from "@/store/use-os";

// Palette sampled from the PersonalOS landing mockup.
const C = {
  navy: "#000034",
  ink: "#1b1b3a",
  purple: "#7050F8",
  purpleDeep: "#4438E1",
  purpleSoft: "#F0E8F8",
  purpleText: "#6848F8",
  gray: "#727193",
  page: "#F8F8F8",
  lavender: "#F0F0F8",
  line: "#E7EBFC",
  star: "#FEAB14",
} as const;

const PRIMARY_BUTTON = {
  background: `linear-gradient(90deg, ${C.purpleDeep} 0%, ${C.purple} 100%)`,
  boxShadow: "0 10px 24px -8px rgba(68, 56, 225, 0.55)",
} as const;

const CTA_BANNER = {
  background: `linear-gradient(90deg, #6850F8 0%, #4752DD 55%, #8668F9 100%)`,
} as const;

const FEATURES: Array<{ title: string; body: string; icon: LucideIcon; tint: string; ink: string }> = [
  { title: "Today", body: "Your daily command center", icon: CalendarCheck, tint: "#E8F0FC", ink: "#2E6FD4" },
  { title: "Calendar", body: "Plan events, meetings and your time", icon: CalendarDays, tint: "#EFEBFD", ink: "#7050F8" },
  { title: "Tasks", body: "Capture, organize and get things done", icon: CheckCircle2, tint: "#E6F7EE", ink: "#16A36A" },
  { title: "Goals", body: "Set goals and track progress", icon: Target, tint: "#FDE9EF", ink: "#E0457B" },
  { title: "Habits", body: "Build positive routines", icon: BarChart3, tint: "#E6F7EE", ink: "#16A36A" },
  { title: "Notes", body: "Quick notes, ideas and knowledge", icon: NotebookPen, tint: "#F1EBFD", ink: "#8A4FE0" },
  { title: "Digital Paper", body: "Create, manage and share documents", icon: FileText, tint: "#EFEBFD", ink: "#7050F8" },
  { title: "Digital Notebook", body: "Handwrite, sketch and annotate", icon: BookOpen, tint: "#E9E9FB", ink: "#4438E1" },
  { title: "Templates", body: "Ready-to-use templates for work and life", icon: Layers, tint: "#E8F0FC", ink: "#2E6FD4" },
  { title: "AI Assistant", body: "Plan, write, summarize and get answers", icon: Sparkles, tint: "#F0EAFD", ink: "#7C3AED" },
  { title: "Focus", body: "Deep work with timers and modes", icon: Timer, tint: "#FFEFE6", ink: "#F0692A" },
  { title: "Rewards", body: "Stay consistent and earn rewards", icon: Trophy, tint: "#FFF3E0", ink: "#F59A1B" },
];

const PERSONA_TABS = [
  {
    id: "personal",
    label: "Personal",
    points: [
      "Plan your day and keep life in balance",
      "Track habits, health and personal goals",
      "Capture ideas, notes and important information",
      "Stay focused and build a better you",
    ],
  },
  {
    id: "work",
    label: "Work",
    points: [
      "Run projects, meetings and deadlines from one workspace",
      "Turn meeting notes into action items without retyping",
      "Keep work and personal life in separate modes",
      "Protect deep work with focus timers and a protected calendar",
    ],
  },
  {
    id: "learning",
    label: "Learning",
    points: [
      "Capture lectures, readings and research in linked notebooks",
      "Build study plans and track progress toward every goal",
      "Summarize long material with AI in seconds",
      "Review consistently with habit streaks and reminders",
    ],
  },
  {
    id: "health",
    label: "Health",
    points: [
      "Build routines for sleep, movement and nutrition",
      "Log daily habits and watch your streaks grow",
      "Keep a private journal for mood and reflections",
      "Set health goals and review them week over week",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    points: [
      "Track budgets, bills and savings goals in one view",
      "Plan monthly spending with calendar reminders",
      "Keep receipts, statements and documents organized",
      "Review where your money goes with weekly insights",
    ],
  },
] as const;

const STATS: Array<{ value: string; label: string; icon: LucideIcon; star?: boolean }> = [
  { value: "10K+", label: "Early Users", icon: Users },
  { value: "4.8/5", label: "User Rating", icon: Star, star: true },
  { value: "25+", label: "Productivity Tools", icon: Layers },
  { value: "100+", label: "Ready Templates", icon: Zap },
];

const TESTIMONIALS = [
  {
    quote:
      "PersonalOS brought my work, notes and goals into one place. I'm more organized and much more productive.",
    name: "Ravi Kumar",
    role: "Product Manager",
    avatar: "/landing/avatar-ravi.png",
  },
  {
    quote:
      "The mix of tasks, calendar, notes and AI is fantastic. It feels like a personal operating system for my life.",
    name: "Priya Sharma",
    role: "Entrepreneur",
    avatar: "/landing/avatar-priya.png",
  },
  {
    quote:
      "Templates, focus mode and rewards actually keep me consistent. Highly recommended!",
    name: "Amit Verma",
    role: "Software Engineer",
    avatar: "/landing/avatar-amit.png",
  },
];

const NAV_LINKS: Array<{ label: string; href: string; caret?: boolean; active?: boolean }> = [
  { label: "Home", href: "/", active: true },
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

function Check({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-5 shrink-0 place-items-center rounded-full ${className}`}
      style={{ background: C.purple }}
    >
      <CheckCheck className="size-3 text-white" strokeWidth={3} />
    </span>
  );
}

export function LandingPage() {
  const { profile } = useAuth();
  const state = useAppState();
  const signedIn = profile != null;
  const [persona, setPersona] = React.useState<(typeof PERSONA_TABS)[number]["id"]>("personal");
  const activeTab = PERSONA_TABS.find((tab) => tab.id === persona) ?? PERSONA_TABS[0];

  React.useEffect(() => {
    getOS().hydrate();
  }, []);

  useThemeEffect(state.settings.theme);

  return (
    <div
      className="min-h-dvh overflow-x-hidden font-sans antialiased"
      style={{ background: C.page, color: C.ink, fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      {/* Top navigation */}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" aria-label="PersonalOS home" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/logo.png" alt="PersonalOS" className="h-9 w-auto" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative inline-flex items-center gap-1 py-1 text-[15px] font-medium transition-colors hover:text-[#6848F8]"
              style={{ color: link.active ? C.purpleText : C.navy }}
            >
              {link.label}
              {link.active ? (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: C.purple }}
                />
              ) : null}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <ThemeToggle />
          {signedIn ? (
            <Link
              href="/today"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
              style={PRIMARY_BUTTON}
            >
              Open app
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-10 items-center rounded-xl border bg-white px-5 text-sm font-semibold transition-colors hover:bg-[#F8F8FC] sm:inline-flex"
                style={{ borderColor: "#D9D9EE", color: C.navy }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white sm:px-5"
                style={PRIMARY_BUTTON}
              >
                <span className="hidden sm:inline">Get Started Free</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:pb-20">
        <div className="relative z-10">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: C.purpleSoft, color: C.purpleText }}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Your Personal Operating System
          </span>

          <h1
            className="mt-6 text-[44px] font-extrabold leading-[1.05] tracking-tight sm:text-[52px] lg:text-[50px] xl:text-[56px]"
            style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
          >
            <span className="whitespace-nowrap">Plan. Create. Focus.</span>
            <br />
            Organize.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${C.purpleDeep}, ${C.purple})` }}
            >
              Grow.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed" style={{ color: C.gray }}>
            An all-in-one workspace to manage your tasks, calendar, notes, documents, habits, goals and more — with
            the power of AI to help you do it smarter.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-medium" style={{ color: C.navy }}>
            {["Stay Organized", "Be More Productive", "Build Better Habits"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCheck className="size-4" style={{ color: C.purple }} strokeWidth={2.6} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              href={signedIn ? "/today" : "/register"}
              className="inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white"
              style={PRIMARY_BUTTON}
            >
              {signedIn ? "Open PersonalOS" : "Get Started Free"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center gap-2.5 rounded-xl border bg-white px-6 text-[15px] font-semibold transition-colors hover:bg-[#F8F8FC]"
              style={{ borderColor: "#D9D9EE", color: C.navy }}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              Explore Features
            </a>
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-3 text-sm" style={{ color: C.gray }}>
            <span>No credit card required</span>
            <span aria-hidden="true">•</span>
            <span>Works on desktop and mobile web</span>
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-16 size-[460px] rounded-full opacity-70 blur-2xl"
            style={{ background: C.lavender }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/hero-devices.png"
            alt="PersonalOS dashboard on a laptop and the mobile app showing today's plan"
            className="relative z-10 w-full drop-shadow-[0_30px_50px_rgba(68,56,225,0.18)]"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-16 lg:px-8" style={{ background: "#FBFCFE" }}>
        <div className="text-center">
          <h2
            className="text-[34px] font-extrabold tracking-tight sm:text-[40px]"
            style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
          >
            Everything you need, in{" "}
            <span style={{ color: C.purple }}>one beautiful workspace</span>
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-[17px]" style={{ color: C.gray }}>
            A complete personal and professional productivity suite for your work, learning and life.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <span
                  className="grid size-16 place-items-center rounded-2xl"
                  style={{ background: feature.tint }}
                  aria-hidden="true"
                >
                  <Icon className="size-7" style={{ color: feature.ink }} strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold" style={{ color: C.navy }}>
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-snug" style={{ color: C.gray }}>
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personas */}
      <section id="solutions" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 py-12 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,280px)] lg:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/desk-scene.png"
            alt=""
            aria-hidden="true"
            className="hidden w-full rounded-2xl object-cover lg:block"
          />

          <div>
            <h2
              className="text-center text-[34px] font-extrabold tracking-tight sm:text-[38px] xl:whitespace-nowrap"
              style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
            >
              Designed for every part of <span style={{ color: C.purple }}>your life</span>
            </h2>

            <div role="tablist" aria-label="Life areas" className="mt-7 flex flex-wrap justify-center gap-2.5">
              {PERSONA_TABS.map((tab) => {
                const active = tab.id === persona;
                return (
                  <button
                    key={tab.id}
                    id={`persona-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="persona-panel"
                    onClick={() => setPersona(tab.id)}
                    className="inline-flex h-11 items-center rounded-xl px-5 text-[15px] font-semibold transition-colors"
                    style={
                      active
                        ? { ...PRIMARY_BUTTON, color: "#FFFFFF" }
                        : { background: "#FFFFFF", color: C.navy, border: `1px solid ${C.line}` }
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <ul
              key={persona}
              id="persona-panel"
              role="tabpanel"
              aria-labelledby={`persona-tab-${persona}`}
              aria-live="polite"
              className="mx-auto mt-8 min-h-[140px] max-w-md animate-fade-in space-y-3.5"
            >
              {activeTab.points.map((point) => (
                <li key={point} className="flex items-center gap-3 text-[16px]" style={{ color: C.navy }}>
                  <Check />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/mountain-scene.png"
            alt=""
            aria-hidden="true"
            className="hidden w-full rounded-2xl object-cover lg:block"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-5 lg:px-8">
        <div
          className="grid grid-cols-2 gap-y-6 rounded-2xl border bg-white px-6 py-7 md:grid-cols-5"
          style={{ borderColor: C.line, background: "#FAFBFE" }}
        >
          {STATS.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`flex items-center justify-center gap-3.5 ${index > 0 ? "md:border-l md:border-[#E7EBFC]" : ""}`}
              >
                <Icon className="size-8 shrink-0" style={{ color: stat.star ? C.star : C.purple }} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <p className="text-[26px] font-extrabold leading-none" style={{ color: C.navy }}>
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-sm" style={{ color: C.gray }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-center gap-3.5 md:border-l md:border-[#E7EBFC]">
            <Smartphone className="size-8 shrink-0" style={{ color: C.purple }} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <p className="whitespace-nowrap text-[18px] font-extrabold leading-tight" style={{ color: C.navy }}>
                Web &amp; mobile
              </p>
              <p className="mt-1 text-sm" style={{ color: C.gray }}>
                Access anywhere, anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <h2
          className="text-center text-[34px] font-extrabold tracking-tight sm:text-[40px]"
          style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
        >
          Loved by <span style={{ color: C.purple }}>productivity enthusiasts</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <figure
              key={item.name}
              className="rounded-2xl border bg-white p-7 shadow-[0_6px_24px_rgba(27,27,58,0.04)]"
              style={{ borderColor: C.line }}
            >
              <span className="text-5xl font-extrabold leading-none" style={{ color: C.purple }} aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="mt-2 text-[16px] leading-relaxed" style={{ color: C.navy }}>
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.avatar} alt="" className="size-12 rounded-full object-cover" />
                <div>
                  <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" style={{ color: C.star }} aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-1 text-[15px] font-bold" style={{ color: C.navy }}>
                    {item.name}
                  </p>
                  <p className="text-sm" style={{ color: C.gray }}>
                    {item.role}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="text-center">
          <h2
            className="text-[34px] font-extrabold tracking-tight sm:text-[40px]"
            style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
          >
            Simple pricing, <span style={{ color: C.purple }}>no surprises</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[17px]" style={{ color: C.gray }}>
            PersonalOS is free while the foundation is being built. No credit card, no trial timer.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-7" style={{ borderColor: C.line }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold" style={{ color: C.navy }}>Foundation</h3>
              <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: C.purpleSoft, color: C.purpleText }}>
                Free
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: C.gray }}>
              Everything currently in PersonalOS, available today.
            </p>
            <ul className="mt-5 space-y-2.5 text-[15px]" style={{ color: C.navy }}>
              {["All productivity tools", "Local-first data ownership", "AI assistant and planning", "No credit card required"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCheck className="size-4 shrink-0" style={{ color: C.purple }} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={signedIn ? "/today" : "/register"}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
              style={PRIMARY_BUTTON}
            >
              {signedIn ? "Open PersonalOS" : "Start free"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="rounded-2xl border p-7" style={{ borderColor: C.line, background: "#FAFBFE" }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold" style={{ color: C.navy }}>Team</h3>
              <span className="rounded-full border px-3 py-1 text-sm font-semibold" style={{ borderColor: C.line, color: C.gray }}>
                Coming soon
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: C.gray }}>
              Shared workspaces, approvals and team calendars are in preparation.
            </p>
            <ul className="mt-5 space-y-2.5 text-[15px]" style={{ color: C.navy }}>
              {["Shared projects and tasks", "Team calendar and meetings", "Approvals and time off", "Workspace roles"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="size-4 shrink-0 rounded-full border" style={{ borderColor: C.line }} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="#features"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold"
              style={{ borderColor: "#D9D9EE", color: C.navy }}
            >
              Explore features
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="text-center">
          <h2
            className="text-[34px] font-extrabold tracking-tight sm:text-[40px]"
            style={{ color: C.navy, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
          >
            Resources to <span style={{ color: C.purple }}>get started</span>
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Getting started", body: "Create your account and open your OS.", href: signedIn ? "/today" : "/register" },
            { title: "Feature tour", body: "See what ships inside PersonalOS today.", href: "#features" },
            { title: "Privacy", body: "How your local and account data is handled.", href: "/privacy" },
            { title: "Terms", body: "The rules for using PersonalOS.", href: "/terms" },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-2xl border bg-white p-5 transition-colors hover:bg-[#F8F8FC]"
              style={{ borderColor: C.line }}
            >
              <h3 className="text-[15px] font-bold" style={{ color: C.navy }}>{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: C.gray }}>{item.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: C.purpleText }}>
                Open
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </section>
      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div
          className="relative grid items-center gap-6 overflow-hidden rounded-3xl px-8 py-12 text-white sm:px-12 lg:grid-cols-[1fr_auto]"
          style={CTA_BANNER}
        >
          <div className="relative z-10">
            <h2
              className="text-[34px] font-extrabold tracking-tight sm:text-[42px]"
              style={{ fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
            >
              Start building your PersonalOS today
            </h2>
            <p className="mt-3 max-w-xl text-[17px] text-white/85">
              Organize your work, plan your goals, capture ideas and achieve more — all in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3.5">
              <Link
                href={signedIn ? "/today" : "/register"}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold"
                style={{ color: C.purpleDeep }}
              >
                {signedIn ? "Open PersonalOS" : "Get Started Free"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/70 px-6 text-[15px] font-semibold text-white"
              >
                View Pricing
              </a>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/cta-illustration.png"
            alt=""
            aria-hidden="true"
            className="relative z-10 mx-auto w-64 max-w-full drop-shadow-[0_20px_30px_rgba(20,10,80,0.35)] sm:w-72 lg:w-80"
          />
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: C.line }}>
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/logo.png" alt="PersonalOS" className="h-8 w-auto" />
              <p className="mt-3 text-sm leading-relaxed" style={{ color: C.gray }}>
                Your personal operating system for planning, creating, focusing and growing.
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
              {[
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Resources", href: "#resources" },
                { label: "Templates", href: "/templates" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
              ].map((item) => (
                <a key={item.label} href={item.href} className="font-medium hover:underline" style={{ color: C.navy }}>
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs" style={{ borderColor: C.line, color: C.gray }}>
            <span>© {new Date().getFullYear()} PersonalOS. All rights reserved.</span>
            <span>Local-first by design.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
