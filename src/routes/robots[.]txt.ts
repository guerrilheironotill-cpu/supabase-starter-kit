import { createFileRoute } from "@tanstack/react-router";

import { IS_STAGING, SITE_URL } from "@/lib/site-config";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const body = IS_STAGING
          ? "User-agent: *\nDisallow: /\n"
          : [
              "User-agent: *",
              "Allow: /",
              "",
              "Disallow: /dashboard",
              "Disallow: /auth",
              "Disallow: /api",
              "Disallow: /health",
              "Disallow: /health-cache",
              "Disallow: /supabase-check",
              "",
              `Sitemap: ${SITE_URL}/sitemap.xml`,
              "",
            ].join("\n");

        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
            ...(IS_STAGING ? { "x-robots-tag": "noindex, nofollow, noarchive" } : {}),
          },
        });
      },
    },
  },
});
