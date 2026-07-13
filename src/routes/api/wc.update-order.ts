import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type WcConfig = {
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
};

type Body = {
  id: number;
  status?: string;
  customer_note?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    state?: string;
  };
  shipping?: Body["billing"];
  line_items?: Array<{
    id?: number;
    product_id?: number;
    variation_id?: number;
    name?: string;
    quantity?: number;
    subtotal?: string;
    total?: string;
  }>;
  shipping_lines?: Array<{
    id?: number;
    method_id?: string;
    method_title?: string;
    total?: string;
  }>;
  fee_lines?: Array<{
    id?: number;
    name?: string;
    total?: string;
  }>;
};

export const Route = createFileRoute("/api/wc/update-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          return Response.json({ ok: false, error: "WooCommerce não configurado" }, { status: 400 });
        }

        const body = (await request.json()) as Body;
        if (!body.id) return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });

        const base = cfg.site_url.replace(/\/$/, "");
        const auth = btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`);

        const payload: Record<string, unknown> = {};
        if (body.status) payload.status = body.status;
        if (typeof body.customer_note === "string") payload.customer_note = body.customer_note;
        if (body.billing) payload.billing = body.billing;
        if (body.shipping) payload.shipping = body.shipping;
        if (body.line_items) payload.line_items = body.line_items;
        if (body.shipping_lines) payload.shipping_lines = body.shipping_lines;
        if (body.fee_lines) payload.fee_lines = body.fee_lines;

        try {
          const res = await fetch(`${base}/wp-json/wc/v3/orders/${body.id}`, {
            method: "PUT",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          if (!res.ok) {
            console.error("[wc/update-order]", res.status, text);
            return Response.json(
              { ok: false, error: `WooCommerce ${res.status}: ${text.slice(0, 300)}` },
              { status: 200 },
            );
          }
          return Response.json({ ok: true });
        } catch (e) {
          console.error("[wc/update-order]", (e as Error).message);
          return Response.json({ ok: false, error: (e as Error).message });
        }
      },
    },
  },
});