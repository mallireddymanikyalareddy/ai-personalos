import type { Metadata } from "next";

import { LandingPage } from "@/modules/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "PersonalOS · Your Personal Operating System" },
  description: "PersonalOS: plan, create, focus and organize your work and life in one personal operating system.",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "PersonalOS",
      url: "https://personalos.app",
      description:
        "PersonalOS is an AI-powered personal operating system for planning, focus, notes, goals and habits.",
    },
    {
      "@type": "SoftwareApplication",
      name: "PersonalOS",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description:
        "Plan, create, focus and organize your work and life in one personal operating system.",
      offers: [
        { "@type": "Offer", name: "Basic monthly", price: "199", priceCurrency: "INR" },
        { "@type": "Offer", name: "Basic annual", price: "1788", priceCurrency: "INR" },
        { "@type": "Offer", name: "AI monthly", price: "299", priceCurrency: "INR" },
        { "@type": "Offer", name: "AI annual", price: "2988", priceCurrency: "INR" },
        { "@type": "Offer", name: "AI Pro monthly", price: "399", priceCurrency: "INR" },
        { "@type": "Offer", name: "AI Pro annual", price: "4188", priceCurrency: "INR" },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
