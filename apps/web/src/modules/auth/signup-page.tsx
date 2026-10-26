"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

import { ApiError, errorMessage, fieldError } from "@/lib/api";
import { AUTH, PROVIDERS, useOAuthStart } from "@/modules/auth/auth-visuals";
import { useAuth } from "@/modules/auth/auth-context";

const {
  ink: INK,
  body: BODY,
  muted: MUTED,
  purple: PURPLE,
  violet: VIOLET,
  green: GREEN,
  danger: DANGER,
  submitGradient: SUBMIT_GRADIENT,
  pageGradient: PAGE_GRADIENT,
} = AUTH;

const FEATURES = [
  {
    title: "Plan Your Day",
    body: "Tasks, calendar, meetings and reminders",
    icon: "/auth/feat-plan.png",
  },
  {
    title: "Capture & Organize",
    body: "Notes, documents, notebooks and ideas",
    icon: "/auth/feat-capture.png",
  },
  {
    title: "Achieve Your Goals",
    body: "Set goals, build habits and track progress",
    icon: "/auth/feat-goals.png",
  },
  {
    title: "Get AI Support",
    body: "Plan, write, summarize and get answers",
    icon: "/auth/feat-ai.png",
  },
  {
    title: "Stay Motivated",
    body: "Earn rewards and build consistency",
    icon: "/auth/feat-motivated.png",
  },
];

const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (value: string) => value.length >= 10 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  terms?: string;
}

function slugHandle(first: string, last: string, email: string): string {
  const base = `${first} ${last}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fromEmail = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "";
  let handle = (base || fromEmail || "user").slice(0, 28).replace(/^-+|-+$/g, "");
  if (handle.length < 3) handle = `${handle}user`.slice(0, 32);
  return handle;
}

function suffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function SignupPage() {
  const { register } = useAuth();
  const { start: startOAuth } = useOAuthStart();
  const router = useRouter();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const passwordChecks = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) }));

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (firstName.trim().length === 0) next.firstName = "Enter your first name.";
    if (lastName.trim().length === 0) next.lastName = "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!passwordChecks.every((rule) => rule.ok)) next.password = "Your password does not meet all requirements.";
    if (!agreed) next.terms = "Please accept the Terms of Service and Privacy Policy.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    const displayName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ");
    const base = slugHandle(firstName, lastName, email.trim());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const handle = attempt === 0 ? base : `${base.slice(0, 24)}-${suffix()}`;
      try {
        await register({ handle, displayName, password, email: email.trim() });
        router.replace("/onboarding");
        return;
      } catch (caught) {
        const emailIssue = fieldError(caught, "email");
        const conflict =
          fieldError(caught, "handle") !== undefined ||
          (caught instanceof ApiError &&
            (caught.status === 409 || caught.code === "CONFLICT_ALREADY_EXISTS") &&
            emailIssue === undefined);
        if (conflict && attempt < 2) continue;
        if (emailIssue) setErrors((current) => ({ ...current, email: emailIssue }));
        setFormError(errorMessage(caught));
        setBusy(false);
        return;
      }
    }

    setFormError("That name is already taken. Try adding a middle initial or a number.");
    setBusy(false);
  };

  const fieldClass = (invalid?: string) =>
    `h-[50px] w-full rounded-[10px] border bg-white pl-11 pr-3 text-[14.5px] outline-none transition-colors placeholder:text-[#9A9CBB] focus:ring-4 ${
      invalid
        ? "border-[#E4A5A0] focus:border-[#D92D20] focus:ring-[#D92D20]/10"
        : "border-[#D8DAEF] focus:border-[#7B3FFC] focus:ring-[#7B3FFC]/10"
    }`;

  return (
    <div className="min-h-dvh" style={{ background: PAGE_GRADIENT }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col lg:grid lg:grid-cols-[minmax(0,43%)_minmax(0,57%)]">
        {/* Brand + value panel */}
        <aside className="relative hidden min-h-dvh flex-col lg:flex">
          <div className="flex flex-1 flex-col px-12 pt-6 xl:px-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/auth/signup-logo.png" alt="LifeOS" className="h-[56px] w-auto self-start" />
            <p className="mt-2 text-[16px]" style={{ color: "#2F3355" }}>
              Your Personal Operating System
            </p>

            <h1
              className="mt-10 text-[50px] font-extrabold leading-[1.06] tracking-[-0.02em] xl:text-[54px]"
              style={{ color: INK, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
            >
              Create Your
              <br />
              LifeOS Account
            </h1>
            <p className="mt-4 text-[19px] leading-snug" style={{ color: BODY }}>
              Plan, organize, focus and grow — all in one place.
            </p>

            <ul className="mt-8 space-y-3.5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-center gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={feature.icon} alt="" aria-hidden="true" className="size-[54px] shrink-0" />
                  <div>
                    <p className="text-[18.5px] font-bold leading-tight" style={{ color: INK }}>
                      {feature.title}
                    </p>
                    <p className="mt-1 text-[16px] leading-snug" style={{ color: BODY }}>
                      {feature.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/auth/signup-hero.png"
            alt="A hiker watching the sunrise over a mountain range, captioned: trusted by productivity enthusiasts, rated 4.8 out of 5 by over 10,000 users"
            className="mt-auto w-full"
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 12%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 12%)",
            }}
          />
        </aside>

        {/* Form panel */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-12 lg:pl-0 lg:pr-10 xl:pr-12">
          <div className="w-full max-w-[860px]">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/auth/signup-logo.png" alt="LifeOS" className="h-10 w-auto" />
              <span className="text-[13px]" style={{ color: BODY }}>
                Your Personal Operating System
              </span>
            </div>

            <div
              className="rounded-[28px] p-6 sm:p-9 lg:p-12"
              style={{
                background: "#FCFBFE",
                boxShadow: "0 30px 80px -32px rgba(62, 38, 150, 0.32)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[38px]"
                    style={{ color: INK, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
                  >
                    Create Your Account
                  </h2>
                  <p className="mt-2 text-[15.5px]" style={{ color: BODY }}>
                    Get started with LifeOS in less than a minute.
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 pt-1 sm:flex">
                  <span className="text-[13px]" style={{ color: BODY }}>
                    Already have an account?
                  </span>
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold transition-colors"
                    style={{ background: "#F0ECFE", color: PURPLE }}
                  >
                    Sign In
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => startOAuth(provider)}
                    className="inline-flex h-[56px] items-center justify-center gap-2 rounded-xl border bg-white px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#F8F8FE]"
                    style={{ borderColor: "#E2E4F7", color: INK }}
                  >
                    {provider.mark}
                    <span className="whitespace-nowrap">{provider.longLabel}</span>
                  </button>
                ))}
              </div>

              <div className="my-7 flex items-center gap-4" aria-hidden="true">
                <span className="h-px flex-1" style={{ background: "#E6E8F5" }} />
                <span className="text-[13px]" style={{ color: MUTED }}>
                  or sign up with email
                </span>
                <span className="h-px flex-1" style={{ background: "#E6E8F5" }} />
              </div>

              <form onSubmit={onSubmit} noValidate>
                {formError && (
                  <p
                    role="alert"
                    className="mb-5 rounded-xl px-4 py-3 text-[13.5px]"
                    style={{ background: "#FDECEA", color: DANGER, border: "1px solid #F5C6C1" }}
                  >
                    {formError}
                  </p>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first-name" className="text-[13.5px] font-semibold" style={{ color: "#12142E" }}>
                      First Name <span style={{ color: DANGER }}>*</span>
                    </label>
                    <div className="relative mt-2">
                      <User
                        className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
                        style={{ color: "#8A8DB0" }}
                        aria-hidden="true"
                      />
                      <input
                        id="first-name"
                        name="firstName"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="Enter your first name"
                        aria-invalid={Boolean(errors.firstName)}
                        aria-describedby={errors.firstName ? "first-name-error" : undefined}
                        className={fieldClass(errors.firstName)}
                        style={{ color: INK }}
                      />
                    </div>
                    {errors.firstName && (
                      <p id="first-name-error" className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                        {errors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="last-name" className="text-[13.5px] font-semibold" style={{ color: "#12142E" }}>
                      Last Name <span style={{ color: DANGER }}>*</span>
                    </label>
                    <div className="relative mt-2">
                      <User
                        className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
                        style={{ color: "#8A8DB0" }}
                        aria-hidden="true"
                      />
                      <input
                        id="last-name"
                        name="lastName"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Enter your last name"
                        aria-invalid={Boolean(errors.lastName)}
                        aria-describedby={errors.lastName ? "last-name-error" : undefined}
                        className={fieldClass(errors.lastName)}
                        style={{ color: INK }}
                      />
                    </div>
                    {errors.lastName && (
                      <p id="last-name-error" className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="email" className="text-[13.5px] font-semibold" style={{ color: "#12142E" }}>
                    Email Address <span style={{ color: DANGER }}>*</span>
                  </label>
                  <div className="relative mt-2">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
                      style={{ color: "#8A8DB0" }}
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your email address"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className={fieldClass(errors.email)}
                      style={{ color: INK }}
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="mt-5">
                  <label htmlFor="password" className="text-[13.5px] font-semibold" style={{ color: "#12142E" }}>
                    Password <span style={{ color: DANGER }}>*</span>
                  </label>
                  <div className="relative mt-2">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
                      style={{ color: "#8A8DB0" }}
                      aria-hidden="true"
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Create a strong password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby="password-rules"
                      className={`${fieldClass(errors.password)} pr-12`}
                      style={{ color: INK }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg transition-colors hover:bg-[#F2F2FA]"
                      style={{ color: "#8A8DB0" }}
                    >
                      {showPassword ? (
                        <Eye className="size-[18px]" aria-hidden="true" />
                      ) : (
                        <EyeOff className="size-[18px]" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <ul
                    id="password-rules"
                    className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4"
                  >
                    {passwordChecks.map((rule) => (
                      <li
                        key={rule.label}
                        className="flex items-start gap-1.5 text-[12px] leading-snug"
                        style={{ color: rule.ok ? GREEN : MUTED }}
                      >
                        <Check
                          className="mt-0.5 size-3.5 shrink-0"
                          strokeWidth={3}
                          style={{ color: rule.ok ? GREEN : "#B7B9D0" }}
                          aria-hidden="true"
                        />
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                  {errors.password && (
                    <p className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                      {errors.password}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-7 inline-flex h-[58px] w-full items-center justify-center gap-2.5 rounded-xl text-[16.5px] font-semibold text-white transition-opacity disabled:opacity-70"
                  style={{ background: SUBMIT_GRADIENT, boxShadow: "0 12px 28px -14px rgba(59, 37, 190, 0.75)" }}
                >
                  {busy ? "Creating account…" : "Create Account"}
                  <ArrowRight className="size-[18px]" aria-hidden="true" />
                </button>

                <div className="mt-5 flex items-start justify-center gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={agreed}
                    aria-labelledby="terms-label"
                    onClick={() => setAgreed((value) => !value)}
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition-colors"
                    style={
                      agreed
                        ? { background: VIOLET, borderColor: VIOLET }
                        : { background: "#FFFFFF", borderColor: "#C9CBE6" }
                    }
                  >
                    {agreed && <Check className="size-3.5 text-white" strokeWidth={3.5} aria-hidden="true" />}
                  </button>
                  <p id="terms-label" className="text-[13px] leading-relaxed" style={{ color: BODY }}>
                    I agree to the{" "}
                    <Link href="/terms" className="font-medium underline" style={{ color: PURPLE }}>
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-medium underline" style={{ color: PURPLE }}>
                      Privacy Policy
                    </Link>
                  </p>
                </div>
                {errors.terms && (
                  <p className="mt-1.5 text-center text-[12.5px]" style={{ color: DANGER }}>
                    {errors.terms}
                  </p>
                )}
              </form>

              <div
                className="mt-8 grid gap-4 rounded-2xl px-5 py-5 sm:grid-cols-3 sm:gap-0"
                style={{ background: "#F3F5FD" }}
              >
                {[
                  { icon: "/auth/trust-shield.png", line: "Your data is secure and encrypted" },
                  { icon: "/auth/trust-cloud.png", line: "Access on Web, iOS and Android" },
                  { icon: "/auth/trust-infinity.png", line: "Start free and upgrade anytime" },
                ].map((item, index) => (
                  <div
                    key={item.line}
                    className={`flex items-center gap-3 sm:px-4 ${
                      index > 0 ? "sm:border-l sm:border-[#DFE3F6]" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.icon} alt="" aria-hidden="true" className="size-9 shrink-0" />
                    <p className="text-[13px] leading-snug" style={{ color: "#1B1E4B" }}>
                      {item.line}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-center text-[13px] sm:hidden" style={{ color: BODY }}>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold" style={{ color: PURPLE }}>
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
