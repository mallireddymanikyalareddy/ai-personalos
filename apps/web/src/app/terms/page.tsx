import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-accent-ink hover:underline">
        Back to home
      </Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-2">
        These terms describe how you may use PersonalOS. By creating an account you agree to use the service
        lawfully, keep your credentials secure, and understand that your workspace data belongs to you.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        PersonalOS is provided as-is during the early access period. Features may change, and you can export your
        workspace at any time from Settings.
      </p>
    </main>
  );
}
