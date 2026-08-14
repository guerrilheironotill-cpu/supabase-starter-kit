import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type QuotePayload = {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items?: unknown[];
  total?: number;
  notes?: string;
};

export const Route = createFileRoute("/api/quotes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ ok: false, error: "O serviço de orçamentos está temporariamente indisponível." }, { status: 500 });
        }

        let payload: QuotePayload;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Os dados do orçamento são inválidos." }, { status: 400 });
        }

        const customerName = String(payload.customer_name ?? "").trim();
        const customerPhone = String(payload.customer_phone ?? "").trim();
        const customerEmail = String(payload.customer_email ?? "").trim().toLowerCase();
        if (!customerName || !customerPhone || !customerEmail || !Array.isArray(payload.items) || payload.items.length === 0) {
          return Response.json({ ok: false, error: "Nome, telefone, e-mail e produtos são obrigatórios." }, { status: 400 });
        }

        const orderId = crypto.randomUUID();
        const emailNotificationToken = crypto.randomUUID();
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { error } = await admin.from("orders").insert({
          id: orderId,
          status: "orcamento",
          origin: "site",
          email_notification_token: emailNotificationToken,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          items: payload.items,
          total: Number(payload.total) || 0,
          notes: String(payload.notes ?? ""),
        });

        if (error) {
          console.error("[api/quotes]", error.message);
          return Response.json({ ok: false, error: "Não foi possível registrar o orçamento. Tente novamente." }, { status: 500 });
        }
        return Response.json({ ok: true, orderId, emailNotificationToken });
      },
    },
  },
});
