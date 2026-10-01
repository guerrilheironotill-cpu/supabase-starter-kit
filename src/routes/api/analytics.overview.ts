import { createFileRoute } from "@tanstack/react-router";
import { getGoogleAccessToken } from "@/lib/google-service-account";

// Pulls real visit counts from the GA4 Data API — the dashboard's own gtag.js already
// sends the data (see analytics-loader.tsx), this just reads it back. Needs the same
// service account as Search Console, with "Viewer" granted on the GA4 property, plus
// GA4_PROPERTY_ID (the numeric property id, not the "G-…" measurement id).
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
// GA4 ignores dates before the property started collecting, so a wide, fixed start is
// safe — no need to track exactly when that was.
const HISTORY_START = "2024-01-01";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type DayRow = { date: string; users: number; sessions: number; views: number };

function dateKeyToIso(key: string) {
  // GA4 returns dates as "YYYYMMDD".
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

export const Route = createFileRoute("/api/analytics/overview")({
  server: {
    handlers: {
      GET: async () => {
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !propertyId) {
          return Response.json({ configured: false });
        }

        try {
          const token = await getGoogleAccessToken(SCOPE);
          const end = new Date();
          const r = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                dateRanges: [{ startDate: HISTORY_START, endDate: fmtDate(end) }],
                dimensions: [{ name: "date" }],
                metrics: [
                  { name: "activeUsers" },
                  { name: "sessions" },
                  { name: "screenPageViews" },
                ],
                limit: 2000,
              }),
            },
          );
          if (!r.ok) throw new Error(`GA4 ${r.status}: ${await r.text()}`);
          const json = (await r.json()) as {
            rows?: Array<{
              dimensionValues: { value: string }[];
              metricValues: { value: string }[];
            }>;
          };

          const daily: DayRow[] = (json.rows ?? [])
            .map((row) => ({
              date: dateKeyToIso(row.dimensionValues[0].value),
              users: Number(row.metricValues[0].value) || 0,
              sessions: Number(row.metricValues[1].value) || 0,
              views: Number(row.metricValues[2].value) || 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          const sum30 = (rows: DayRow[]) => rows.reduce((acc, row) => acc + row.users, 0);
          const last30 = daily.slice(-30);
          const prior30 = daily.slice(-60, -30);
          const users30 = sum30(last30);
          const usersPrior30 = sum30(prior30);
          const deltaUsers = usersPrior30 ? ((users30 - usersPrior30) / usersPrior30) * 100 : 0;
          const sessions30 = last30.reduce((acc, row) => acc + row.sessions, 0);
          const views30 = last30.reduce((acc, row) => acc + row.views, 0);

          type MonthRow = { month: string; users: number; sessions: number; views: number };
          type YearRow = { year: string; users: number; sessions: number; views: number };
          const monthlyMap = new Map<string, MonthRow>();
          const yearlyMap = new Map<string, YearRow>();
          for (const row of daily) {
            const month = row.date.slice(0, 7);
            const mAgg = monthlyMap.get(month) ?? { month, users: 0, sessions: 0, views: 0 };
            mAgg.users += row.users;
            mAgg.sessions += row.sessions;
            mAgg.views += row.views;
            monthlyMap.set(month, mAgg);

            const year = row.date.slice(0, 4);
            const yAgg = yearlyMap.get(year) ?? { year, users: 0, sessions: 0, views: 0 };
            yAgg.users += row.users;
            yAgg.sessions += row.sessions;
            yAgg.views += row.views;
            yearlyMap.set(year, yAgg);
          }

          return Response.json({
            configured: true,
            users30d: users30,
            deltaUsers30d: Number(deltaUsers.toFixed(1)),
            sessions30d: sessions30,
            views30d: views30,
            daily: daily.slice(-90),
            monthly: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
            yearly: Array.from(yearlyMap.values()).sort((a, b) => a.year.localeCompare(b.year)),
          });
        } catch (e) {
          console.error("[analytics/overview]", (e as Error).message);
          return Response.json({ configured: false, error: (e as Error).message });
        }
      },
    },
  },
});
