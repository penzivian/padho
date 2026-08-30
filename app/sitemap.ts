import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

// Only the public pages. Signed-in routes are disallowed in robots.ts and have no business in a
// sitemap — a sitemap is a list of pages you want crawled, not an inventory of the app.
const PUBLIC_ROUTES = [
  { path: "", priority: 1 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/refund", priority: 0.3 },
  { path: "/contact", priority: 0.5 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: route.priority
  }));
}
