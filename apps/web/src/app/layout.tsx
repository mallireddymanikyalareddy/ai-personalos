import type { Metadata, Viewport } from "next";
import type * as React from "react";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import { PERSIST_KEY } from "@personalos/core";

import { AuthProvider } from "@/modules/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { SIDEBAR_INIT_SCRIPT } from "@/lib/sidebar-pref";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "AI PersonalOS",
    template: "%s · AI PersonalOS",
  },
  description:
    "Your personal operating system — capture, plan, schedule, and remember everything in one place.",
  applicationName: "AI PersonalOS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PersonalOS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#101211" },
  ],
};

const themeInitScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PERSIST_KEY)});if(!raw)return;var env=JSON.parse(raw);var pref=(env&&env.state&&env.state.settings&&env.state.settings.theme)||"system";var dark=pref==="dark"||(pref==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;if(dark){root.classList.add("dark");root.style.colorScheme="dark";}else{root.classList.remove("dark");root.style.colorScheme="light";}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
