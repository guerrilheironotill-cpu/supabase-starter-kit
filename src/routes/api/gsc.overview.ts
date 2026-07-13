import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITE_URL = "https://arteno.com.br/";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": process.env.GOOGLE_SEARCH_CONSOLE_API_KEY ?? "",
    "Content-Type": "application/json",
  };
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/gsc/overview")({
  server: {
    handlers: {
      GET: async () => {
        if (!process.env.GOOGLE_SEARCH_CONSOLE_API_KEY) {
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
        const baseUrl = `${GATEWAY}/webmasters/v3/sites/${encoded}/searchAnalytics/query`;

        async function query(startDate: Date, endDate: Date, dimensions: string[] = []) {
          const r = await fetch(baseUrl, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              startDate: fmtDate(startDate),
              endDate: fmtDate(endDate),
              dimensions,
              rowLimit: dimensions.length ? 10 : 1,
            }),
          });
          if (!r.ok) throw new Error(`GSC ${r.status}: ${await r.text()}`);
          return r.json();
        }

        try {
          const [current, previous, topPages] = await Promise.all([
            query(start, end),
            query(prevStart, prevEnd),
            query(start, end, ["page"]),
          ]);

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
            topPages:
              topPages.rows?.slice(0, 6).map((r: { keys: string[]; clicks: number; impressions: number }) => ({
                url: r.keys[0],
                clicks: Math.round(r.clicks),
                impressions: Math.round(r.impressions),
              })) ?? [],
          });
        } catch (e) {
          console.error("[gsc/overview]", (e as Error).message);
          return Response.json({ configured: false, error: (e as Error).message });
        }
      },
    },
  },
});
