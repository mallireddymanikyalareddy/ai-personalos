import type { Metadata } from "next";

import { SignupPage } from "@/modules/auth/signup-page";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create your LifeOS account and get started in less than a minute.",
};

export default function RegisterPage() {
  return <SignupPage />;
}
