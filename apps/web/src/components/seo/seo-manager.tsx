"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

type SeoConfig = {
  title?: string;
  description?: string;
  keywords?: string;
  indexable?: boolean;
  ogImage?: string;
  siteUrl?: string;
};

const PUBLIC_PATHS = new Set(["/", "/privacy", "/terms"]);

const DEFAULT_CONFIG: SeoConfig = {
  title: "PersonalOS — Your Personal Operating System",
  description:
    "Plan, create, focus and organize your work and life in one personal operating system.",
  indexable: true,
  ogImage: "/landing/hero-devices.png",
};

function normalize(pathname: string | null): string {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function absoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

/**
 * Applies admin-managed SEO settings to the document head at runtime.
 *
 * Private application routes are always noindex. Because the app is a static
 * export, this runs after hydration; crawlers that do not execute JavaScript
 * will only see the build-time metadata in `app/layout.tsx`.
 */
export function SeoManager() {
  const pathname = normalize(usePathname());
  const [config, setConfig] = React.useState<SeoConfig>(DEFAULT_CONFIG);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/seo", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<SeoConfig>) : null))
      .then((data) => {
        if (alive && data) setConfig({ ...DEFAULT_CONFIG, ...data });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const publicRoute = isPublic(pathname);
    const indexable = publicRoute && config.indexable !== false;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const siteUrl = (config.siteUrl || origin).replace(/\/$/, "");
    const ogImage = absoluteUrl(config.ogImage, siteUrl);

    upsertMeta(
      "name",
      "robots",
      indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    );

    if (!publicRoute) return;

    const title = config.title?.trim() || DEFAULT_CONFIG.title!;
    if (pathname === "/") {
      document.title = title;
      upsertMeta("name", "description", config.description ?? DEFAULT_CONFIG.description!);
      upsertMeta("property", "og:title", title);
      upsertMeta("property", "og:description", config.description ?? DEFAULT_CONFIG.description!);
    }

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "PersonalOS");
    upsertMeta("property", "og:url", `${siteUrl}${pathname === "/" ? "" : pathname}`);
    if (ogImage) upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", config.description ?? DEFAULT_CONFIG.description!);
    if (ogImage) upsertMeta("name", "twitter:image", ogImage);

    if (config.keywords) upsertMeta("name", "keywords", config.keywords);

    upsertLink("canonical", `${siteUrl}${pathname === "/" ? "/" : pathname}`);
  }, [pathname, config]);

  return null;
}
