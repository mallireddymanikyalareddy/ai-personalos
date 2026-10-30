import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://personalos.app").replace(/\/$/, "");

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: [
          "/admin",
          "/admin/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/onboarding",
          "/today",
          "/tasks",
          "/calendar",
          "/focus",
          "/goals",
          "/habits",
          "/inbox",
          "/insights",
          "/integrations",
          "/journal",
          "/meetings",
          "/memory",
          "/notebook",
          "/notes",
          "/paper",
          "/planner",
          "/plans",
          "/rewards",
          "/settings",
          "/styleguide",
          "/templates",
          "/work",
          "/workmode",
          "/ai",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
