import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type WcConfig = {
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
};

async function countStatus(base: string, auth: string, status: string): Promise<number> {
  const url = `${base}/wp-json/wc/v3/orders?status=${status}&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`WooCommerce ${status} ${res.status}: ${await res.text()}`);
  return Number(res.headers.get("x-wp-total") ?? "0");
}

export const Route = createFileRoute("/api/wc/orders-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data, error } = await supabase
          .from("integrations")
          .select("config")
          .eq("service", "woocommerce")
          .maybeSingle();

        if (error) return new Response(error.message, { status: 403 });
        const cfg = (data?.config as WcConfig | undefined) ?? null;
        if (!cfg?.site_url || !cfg.consumer_key || !cfg.consumer_secret) {
          return Response.json({ configured: false, open: 0, done: 0 });
        }

        const base = cfg.site_url.replace(/\/$/, "");
        const auth = btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`);

        try {
          const [pending, processing, onHold, completed] = await Promise.all([
            countStatus(base, auth, "pending"),
            countStatus(base, auth, "processing"),
            countStatus(base, auth, "on-hold"),
            countStatus(base, auth, "completed"),
          ]);
          return Response.json({
            configured: true,
            open: pending + processing + onHold,
            done: completed,
          });
        } catch (e) {
          return Response.json(
            { configured: true, open: 0, done: 0, error: (e as Error).message },
            { status: 502 },
          );
        }
      },
    },
  },
});