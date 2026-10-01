import { createFileRoute } from "@tanstack/react-router";
import { getGoogleAccessToken } from "@/lib/google-service-account";

const SITE_URL = "https://arteno.com.br/";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/gsc/overview")({
  server: {
    handlers: {
      GET: async () => {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
          return Response.json({ configured: false });
        }
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 30);

        const encoded = encodeURIComponent(SITE_URL);
        try {
          const token = await getGoogleAccessToken(SCOPE);
          const baseUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
          const query = async (
            startDate: Date,
            endDate: Date,
            dimensions: string[] = [],
            rowLimit = 10,
          ) => {
            const r = await fetch(baseUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                startDate: fmtDate(startDate),
                endDate: fmtDate(endDate),
                dimensions,
                rowLimit: dimensions.length ? rowLimit : 1,
              }),
            });
            if (!r.ok) throw new Error(`GSC ${r.status}: ${await r.text()}`);
            return r.json();
          };

          const yearStart = new Date(end);
          yearStart.setMonth(yearStart.getMonth() - 11, 1);
          const [current, previous, topPages, topQueries, dailyTraffic] = await Promise.all([
            query(start, end),
            query(prevStart, prevEnd),
            query(start, end, ["page"]),
            query(start, end, ["query"]),
            query(yearStart, end, ["date"], 500),
          ]);

          const monthly = new Map<string, { clicks: number; impressions: number }>();
          for (const row of dailyTraffic.rows ?? []) {
            const month = String(row.keys?.[0] ?? "").slice(0, 7);
            if (!month) continue;
            const value = monthly.get(month) ?? { clicks: 0, impressions: 0 };
            value.clicks += Number(row.clicks) || 0;
            value.impressions += Number(row.impressions) || 0;
            monthly.set(month, value);
          }

          const curRow = current.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
          const prevRow = previous.rows?.[0] ?? { clicks: 0, impressions: 0 };
          const deltaClicks = prevRow.clicks
            ? ((curRow.clicks - prevRow.clicks) / prevRow.clicks) * 100
            : 0;
          const deltaImpr = prevRow.impressions
            ? ((curRow.impressions - prevRow.impressions) / prevRow.impressions) * 100
            : 0;

          return Response.json({
            configured: true,
            clicks: Math.round(curRow.clicks || 0),
            impressions: Math.round(curRow.impressions || 0),
            ctr: Number(((curRow.ctr || 0) * 100).toFixed(2)),
            position: Number((curRow.position || 0).toFixed(1)),
            deltaClicks: Number(deltaClicks.toFixed(1)),
            deltaImpressions: Number(deltaImpr.toFixed(1)),
            monthlyTraffic: Array.from(monthly, ([month, value]) => ({
              month,
              clicks: Math.round(value.clicks),
              impressions: Math.round(value.impressions),
            })).sort((a, b) => a.month.localeCompare(b.month)),
            topPages:
              topPages.rows
                ?.slice(0, 6)
                .map((r: { keys: string[]; clicks: number; impressions: number }) => ({
                  url: r.keys[0],
                  clicks: Math.round(r.clicks),
                  impressions: Math.round(r.impressions),
                })) ?? [],
            topQueries:
              topQueries.rows
                ?.slice(0, 10)
                .map(
                  (r: {
                    keys: string[];
                    clicks: number;
                    impressions: number;
                    ctr: number;
                    position: number;
                  }) => ({
                    query: r.keys[0],
                    clicks: Math.round(r.clicks),
                    impressions: Math.round(r.impressions),
                    ctr: Number(((r.ctr || 0) * 100).toFixed(2)),
                    position: Number((r.position || 0).toFixed(1)),
                  }),
                ) ?? [],
          });
        } catch (e) {
          console.error("[gsc/overview]", (e as Error).message);
          return Response.json({ configured: false, error: (e as Error).message });
        }
      },
    },
  },
});
