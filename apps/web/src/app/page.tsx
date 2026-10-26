import type { Metadata } from "next";

import { LandingPage } from "@/modules/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "PersonalOS · Your Personal Operating System" },
  description: "PersonalOS: plan, create, focus and organize your work and life in one personal operating system.",
};

export default function HomePage() {
  return <LandingPage />;
}
