import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type WcConfig = {
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
};

const ALLOWED = new Set(["orders", "customers"]);

export const Route = createFileRoute("/api/wc/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const resource = url.searchParams.get("resource") ?? "";
        if (!ALLOWED.has(resource)) {
          return new Response("Invalid resource", { status: 400 });
        }
        const page = url.searchParams.get("page") ?? "1";
        const perPage = url.searchParams.get("per_page") ?? "20";
        const search = url.searchParams.get("search") ?? "";
        const status = url.searchParams.get("status") ?? "";

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
          return Response.json({ configured: false, items: [], total: 0, totalPages: 0 });
        }

        const base = cfg.site_url.replace(/\/$/, "");
        const auth = btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`);
        const qs = new URLSearchParams({ page, per_page: perPage });
        if (search) qs.set("search", search);
        if (status && resource === "orders") qs.set("status", status);

        try {
          const res = await fetch(`${base}/wp-json/wc/v3/${resource}?${qs.toString()}`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (!res.ok) {
            const text = await res.text();
            console.error(`[wc/${resource}]`, res.status, text);
            return Response.json({
              configured: true,
              items: [],
              total: 0,
              totalPages: 0,
              error: `WooCommerce ${res.status}: ${text.slice(0, 300)}`,
            });
          }
          const total = Number(res.headers.get("x-wp-total") ?? "0");
          const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "0");
          const items = (await res.json()) as unknown[];
          return Response.json({ configured: true, items, total, totalPages });
        } catch (e) {
          console.error(`[wc/${resource}]`, (e as Error).message);
          return Response.json({
            configured: true,
            items: [],
            total: 0,
            totalPages: 0,
            error: (e as Error).message,
          });
        }
      },
    },
  },
});