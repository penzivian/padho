import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

// Everything behind sign-in is disallowed. Not for secrecy — RLS does that — but because those
// routes are per-user and dynamic, so indexing them wastes crawl budget and can surface a
// student's own dashboard URL in results. Only the marketing surface is crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/teacher/", "/student/", "/profile", "/onboarding", "/auth", "/api/"]
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl()
  };
}
