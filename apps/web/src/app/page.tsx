import type { Metadata } from "next";

import { LandingPage } from "@/modules/landing/landing-page";

export const metadata: Metadata = {
  title: "Home",
  description: "PersonalOS: plan, create, focus and organize your work and life in one personal operating system.",
};

export default function HomePage() {
  return <LandingPage />;
}
