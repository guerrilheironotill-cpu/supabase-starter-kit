import { createFileRoute } from "@tanstack/react-router";
import { getGoogleAccessToken } from "@/lib/google-service-account";

// Most viewed product pages, read from the GA4 Data API (same service account and property
// as /api/analytics/overview). Paths with a query string (?tamanho=…) are merged per product.
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export const Route = createFileRoute("/api/analytics/top-products")({
  server: {
    handlers: {
      GET: async () => {
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !propertyId) {
          return Response.json({ configured: false });
        }
        try {
          const token = await getGoogleAccessToken(SCOPE);
          const response = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
                dimensions: [{ name: "pagePath" }],
                metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
                dimensionFilter: {
                  filter: {
                    fieldName: "pagePath",
                    stringFilter: { matchType: "BEGINS_WITH", value: "/produto/" },
                  },
                },
                orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
                limit: 100,
              }),
            },
          );
          if (!response.ok) throw new Error(`GA4 ${response.status}: ${await response.text()}`);
          const json = (await response.json()) as {
            rows?: Array<{
              dimensionValues: { value: string }[];
              metricValues: { value: string }[];
            }>;
          };

          const bySlug = new Map<string, { slug: string; views: number; users: number }>();
          for (const row of json.rows ?? []) {
            const path = row.dimensionValues[0].value.split("?")[0].replace(/\/+$/, "");
            const slug = decodeURIComponent(path.replace(/^\/produto\//, ""));
            if (!slug || slug.includes("/")) continue;
            const entry = bySlug.get(slug) ?? { slug, views: 0, users: 0 };
            entry.views += Number(row.metricValues[0].value) || 0;
            entry.users += Number(row.metricValues[1].value) || 0;
            bySlug.set(slug, entry);
          }
          const products = Array.from(bySlug.values())
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
          return Response.json({ configured: true, products });
        } catch (error) {
          console.error("[analytics/top-products]", (error as Error).message);
          return Response.json({ configured: false, error: (error as Error).message });
        }
      },
    },
  },
});
