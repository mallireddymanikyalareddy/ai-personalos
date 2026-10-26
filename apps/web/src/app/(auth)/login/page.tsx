import type { Metadata } from "next";
import * as React from "react";

import { LoginPage } from "@/modules/auth/login-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to PersonalOS and continue your productivity journey.",
};

export default function LoginRoute() {
  return (
    <React.Suspense>
      <LoginPage />
    </React.Suspense>
  );
}
