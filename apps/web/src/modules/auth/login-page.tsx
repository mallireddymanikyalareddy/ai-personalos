"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { errorMessage, fieldError } from "@/lib/api";
import { AUTH, PROVIDERS, useOAuthStart } from "@/modules/auth/auth-visuals";
import { useAuth } from "@/modules/auth/auth-context";

const { ink: INK, body: BODY, muted: MUTED, purple: PURPLE, danger: DANGER } = AUTH;

const HIGHLIGHTS = [
  "Manage your tasks, calendar and goals",
  "Capture ideas, notes and documents",
  "Build better habits and stay focused",
  "Use AI to plan, write and get more done",
];

const REMEMBER_KEY = "personalos.keep-signed-in";

export function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { start: startOAuth } = useOAuthStart();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REMEMBER_KEY);
      if (stored !== null) setRemember(stored === "true");
    } catch {
      // ignore storage failures
    }
  }, []);

  const oauthError = searchParams.get("error");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLocalError(null);

    if (identifier.trim().length === 0) {
      setLocalError("Enter your email address.");
      return;
    }
    if (password.length === 0) {
      setLocalError("Enter your password.");
      return;
    }

    setBusy(true);
    try {
      await login(identifier.trim(), password);
      try {
        window.localStorage.setItem(REMEMBER_KEY, String(remember));
      } catch {
        // ignore storage failures
      }
      router.replace("/today");
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  const alertMessage =
    oauthError !== null
      ? "Sign-in with that provider failed. Please try again."
      : localError !== null
        ? localError
        : error !== null && !fieldError(error, "identifier") && !fieldError(error, "password")
          ? errorMessage(error)
          : null;

  const fieldClass = (invalid?: string) =>
    `h-[62px] w-full rounded-[12px] border bg-white pl-14 pr-3 text-[16px] outline-none transition-colors placeholder:text-[#8A8DB0] focus:ring-4 ${
      invalid
        ? "border-[#E4A5A0] focus:border-[#D92D20] focus:ring-[#D92D20]/10"
        : "border-[#D3D5F5] focus:border-[#7B3FFC] focus:ring-[#7B3FFC]/10"
    }`;

  return (
    <div className="min-h-dvh" style={{ background: AUTH.pageGradient }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col lg:grid lg:grid-cols-[minmax(0,47.5%)_minmax(0,52.5%)]">
        {/* Brand + value panel */}
        <aside className="relative hidden min-h-dvh flex-col overflow-hidden lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[22%] top-[33%] h-[40%] w-[126%] rounded-[50%] bg-white/45 blur-[26px]"
          />

          <div className="relative z-10 flex flex-1 flex-col px-12 pt-10 xl:px-20">
            <div className="flex items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/auth/signup-logo.png" alt="LifeOS" className="h-[56px] w-auto" />
              <span className="h-11 w-px shrink-0" style={{ background: "#C9C7E6" }} aria-hidden="true" />
              <p className="text-[15.5px] leading-[1.25]" style={{ color: "#2F3355" }}>
                Your Personal
                <br />
                Operating System
              </p>
            </div>

            <h1
              className="mt-12 text-[52px] font-extrabold leading-[1.08] tracking-[-0.02em] xl:text-[62px]"
              style={{ color: INK, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
            >
              Welcome Back to
              <br />
              <span
                className="mt-0.5 block w-fit text-[1.24em] leading-[1.02] bg-clip-text text-transparent"
                style={{ backgroundImage: AUTH.headingGradient }}
              >
                LifeOS
              </span>
            </h1>

            <p className="mt-5 text-[19px] leading-snug" style={{ color: BODY }}>
              Plan, organize, focus and grow — all in one place.
            </p>

            <ul className="mt-9 space-y-5">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-4 text-[17.5px]" style={{ color: INK }}>
                  <span
                    aria-hidden="true"
                    className="grid size-[26px] shrink-0 place-items-center rounded-full"
                    style={{ background: "#6706E2" }}
                  >
                    <Check className="size-3.5 text-white" strokeWidth={3.4} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/auth/login-hero.png"
            alt="A sunlit desk with a laptop showing the LifeOS mark, a plant, a mug and stacked notebooks"
            className="relative z-10 mt-auto w-full"
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
            }}
          />
        </aside>

        {/* Form panel */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-14 lg:pl-0 lg:pr-10 xl:pr-16">
          <div className="w-full max-w-[740px]">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/auth/signup-logo.png" alt="LifeOS" className="h-10 w-auto" />
              <span className="text-[13px]" style={{ color: BODY }}>
                Your Personal Operating System
              </span>
            </div>

            <div
              className="rounded-[30px] p-6 sm:p-9 lg:p-14"
              style={{
                background: "#FBFAFE",
                boxShadow: "0 30px 80px -32px rgba(62, 38, 150, 0.28)",
              }}
            >
              <h2
                className="text-[32px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[42px]"
                style={{ color: INK, fontFamily: "var(--font-jakarta), var(--font-inter), system-ui, sans-serif" }}
              >
                Sign In to{" "}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: AUTH.headingGradient }}>
                  LifeOS
                </span>
              </h2>
              <p className="mt-2 text-[17px]" style={{ color: BODY }}>
                Continue your productivity journey.
              </p>

              <form onSubmit={onSubmit} noValidate className="mt-9">
                {alertMessage && (
                  <p
                    role="alert"
                    className="mb-5 rounded-xl px-4 py-3 text-[13.5px]"
                    style={{ background: "#FDECEA", color: DANGER, border: "1px solid #F5C6C1" }}
                  >
                    {alertMessage}
                  </p>
                )}

                <label htmlFor="email" className="text-[16px] font-semibold" style={{ color: "#14163A" }}>
                  Email Address
                </label>
                <div className="relative mt-2.5">
                  <Mail
                    className="pointer-events-none absolute left-5 top-1/2 size-[20px] -translate-y-1/2"
                    style={{ color: "#8A8DB0" }}
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Enter your email address"
                    aria-invalid={Boolean(fieldError(error, "identifier"))}
                    className={fieldClass(fieldError(error, "identifier"))}
                    style={{ color: INK }}
                  />
                </div>
                {fieldError(error, "identifier") && (
                  <p className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                    {fieldError(error, "identifier")}
                  </p>
                )}

                <label htmlFor="password" className="mt-7 block text-[16px] font-semibold" style={{ color: "#14163A" }}>
                  Password
                </label>
                <div className="relative mt-2.5">
                  <Lock
                    className="pointer-events-none absolute left-5 top-1/2 size-[20px] -translate-y-1/2"
                    style={{ color: "#8A8DB0" }}
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(fieldError(error, "password"))}
                    className={`${fieldClass(fieldError(error, "password"))} pr-14`}
                    style={{ color: INK }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg transition-colors hover:bg-[#F2F2FA]"
                    style={{ color: "#8A8DB0" }}
                  >
                    {showPassword ? (
                      <Eye className="size-[20px]" aria-hidden="true" />
                    ) : (
                      <EyeOff className="size-[20px]" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldError(error, "password") && (
                  <p className="mt-1.5 text-[12.5px]" style={{ color: DANGER }}>
                    {fieldError(error, "password")}
                  </p>
                )}

                <div className="mt-4 flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-[15px] font-medium underline"
                    style={{ color: PURPLE }}
                  >
                    Forgot Password?
                  </Link>
                </div>

                <div className="mt-6 flex items-center gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={remember}
                    aria-labelledby="remember-label"
                    onClick={() => setRemember((value) => !value)}
                    className="grid size-[22px] shrink-0 place-items-center rounded-[5px] border transition-colors"
                    style={
                      remember
                        ? { background: "#5E1FFA", borderColor: "#5E1FFA" }
                        : { background: "#FFFFFF", borderColor: "#C9CBE6" }
                    }
                  >
                    {remember && <Check className="size-4 text-white" strokeWidth={3.4} aria-hidden="true" />}
                  </button>
                  <p id="remember-label" className="text-[16px]" style={{ color: INK }}>
                    Keep me signed in
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-7 inline-flex h-[62px] w-full items-center justify-center gap-3 rounded-[12px] text-[19px] font-semibold text-white transition-opacity disabled:opacity-70"
                  style={{ background: AUTH.submitGradient, boxShadow: "0 12px 28px -14px rgba(59, 37, 190, 0.75)" }}
                >
                  {busy ? "Signing in…" : "Sign In"}
                  <ArrowRight className="size-[20px]" aria-hidden="true" />
                </button>
              </form>

              <div className="my-8 flex items-center gap-4" aria-hidden="true">
                <span className="h-px flex-1" style={{ background: "#E3E4F6" }} />
                <span className="text-[15px]" style={{ color: MUTED }}>
                  or continue with
                </span>
                <span className="h-px flex-1" style={{ background: "#E3E4F6" }} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => startOAuth(provider)}
                    className="inline-flex h-[64px] items-center justify-center gap-2.5 rounded-[12px] border bg-white px-3 text-[16px] font-semibold transition-colors hover:bg-[#F8F8FE]"
                    style={{ borderColor: "#D3D6F5", color: INK }}
                  >
                    {provider.mark}
                    {provider.label}
                  </button>
                ))}
              </div>

              <p className="mt-9 text-center text-[16px]" style={{ color: INK }}>
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-medium underline" style={{ color: PURPLE }}>
                  Create an Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
