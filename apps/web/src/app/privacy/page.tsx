import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-accent-ink hover:underline">
        Back to home
      </Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-2">
        LifeOS stores the workspace data you create so it is available on every device you sign in from. We do
        not sell your data, and we do not use your notes, tasks, or memories to train third-party models.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        You can export your workspace or clear local data at any time from Settings. Account deletion is handled
        by the account owner while LifeOS is in early access.
      </p>
    </main>
  );
}
