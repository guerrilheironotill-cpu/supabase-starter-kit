import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type WcConfig = {
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
};

type Body = {
  customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: Array<{ name: string; quantity: number; price: number }>;
  shipping_total?: number;
  note?: string;
};

export const Route = createFileRoute("/api/wc/create-order")({
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
        const base = cfg.site_url.replace(/\/$/, "");
        const auth = btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`);

        const [first, ...rest] = (body.customer.first_name ?? "").trim().split(" ");
        const billing = {
          first_name: body.customer.first_name ?? first ?? "",
          last_name: body.customer.last_name ?? rest.join(" "),
          email: body.customer.email ?? "",
          phone: body.customer.phone ?? "",
          address_1: body.customer.address ?? "",
        };

        const payload = {
          status: "processing",
          billing,
          shipping: billing,
          line_items: body.items.map((i) => ({
            name: i.name,
            quantity: Number(i.quantity) || 1,
            price: String(i.price),
            total: String((Number(i.price) || 0) * (Number(i.quantity) || 1)),
          })),
          shipping_lines: body.shipping_total
            ? [{ method_id: "flat_rate", method_title: "Frete", total: String(body.shipping_total) }]
            : [],
          customer_note: body.note ?? "",
        };

        try {
          const res = await fetch(`${base}/wp-json/wc/v3/orders`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          if (!res.ok) {
            console.error("[wc/create-order]", res.status, text);
            return Response.json(
              { ok: false, error: `WooCommerce ${res.status}: ${text.slice(0, 300)}` },
              { status: 200 },
            );
          }
          const json = JSON.parse(text) as { id: number; number: string };
          return Response.json({ ok: true, id: json.id, number: json.number });
        } catch (e) {
          console.error("[wc/create-order]", (e as Error).message);
          return Response.json({ ok: false, error: (e as Error).message });
        }
      },
    },
  },
});