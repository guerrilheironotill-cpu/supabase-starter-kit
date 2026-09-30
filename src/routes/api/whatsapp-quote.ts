import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Registers the quote a visitor sends through the WhatsApp quick-quote drawer. This runs
// with the service role because the anonymous browser client cannot write to `orders` (it
// isn't a legacy anon-write table) — that mismatch used to fail silently: the WhatsApp
// message still went through, but nothing showed up in the dashboard's quotes list.

const ATTRIBUTION_CHANNELS = new Set([
  "direto",
  "google_ads",
  "google_organic",
  "bing_organic",
  "instagram",
  "facebook",
  "redes_sociais",
  "referencia",
]);

type Attribution = Record<string, unknown> | null | undefined;

function cleanAttribution(value: Attribution) {
  if (!value || typeof value !== "object") return null;
  const text = (key: string, max = 500) =>
    String((value as Record<string, unknown>)[key] ?? "")
      .trim()
      .slice(0, max);
  const candidate = text("channel", 50).toLowerCase();
  const channel = ATTRIBUTION_CHANNELS.has(candidate) ? candidate : "site";
  return {
    channel,
    source: text("source", 100),
    medium: text("medium", 100),
    campaign: text("campaign", 200),
    term: text("term", 200),
    content: text("content", 200),
    landingPage: text("landingPage", 1000),
    referrer: text("referrer", 1000),
    clickId: text("clickId", 500),
    capturedAt: text("capturedAt", 50),
  };
}

function orderOrigin(channel: string | undefined) {
  // `orders.origin` is a legacy enum in production; only these values are accepted there.
  return channel === "instagram" ? "instagram" : "site";
}

type QuoteItem = {
  id?: string | null;
  name?: string;
  quantity?: number;
  unitPrice?: number | null;
  sizeLabel?: string | null;
  finish?: string | null;
  color?: string | null;
};

export const Route = createFileRoute("/api/whatsapp-quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          console.error("[api/whatsapp-quote] Supabase não configurado no ambiente do servidor.");
          return Response.json({ ok: false, error: "Serviço indisponível." }, { status: 500 });
        }

        let payload: {
          name?: string;
          phone?: string;
          customerType?: "final" | "professional" | "reseller";
          document?: string | null;
          documentType?: "cpf" | "cnpj" | null;
          companyName?: string | null;
          items?: QuoteItem[];
          attribution?: Attribution;
        };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
        }

        const name = String(payload.name ?? "").trim();
        const phone = String(payload.phone ?? "").trim();
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!name || !phone || items.length === 0) {
          return Response.json(
            { ok: false, error: "Nome, telefone e produtos são obrigatórios." },
            { status: 400 },
          );
        }

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const attribution = cleanAttribution(payload.attribution);
        const cleanItems = items.map((item) => ({
          kind: "catalog" as const,
          product_id: item.id ?? null,
          name: item.name ?? "",
          description: null,
          quantity: Math.max(1, Math.min(999, Math.trunc(Number(item.quantity) || 1))),
          price: Number(item.unitPrice) || 0,
          size_id: null,
          size_name: item.sizeLabel ?? null,
          finish: item.finish ?? null,
          color: item.color ?? null,
        }));
        const total = cleanItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const meta = {
          __meta: 1,
          personType: payload.customerType === "final" ? "fisica" : "juridica",
          customerType: payload.customerType ?? "final",
          cpf: payload.documentType === "cpf" ? (payload.document ?? null) : null,
          cnpj: payload.documentType === "cnpj" ? (payload.document ?? null) : null,
          companyName: payload.customerType !== "final" ? (payload.companyName ?? null) : null,
          attribution,
          conversionChannel: "whatsapp",
        };

        const { error: orderError } = await admin.from("orders").insert({
          status: "orcamento",
          origin: orderOrigin(attribution?.channel),
          customer_name: name,
          customer_phone: phone,
          customer_email: null,
          items: cleanItems,
          total: Math.round(total * 100) / 100,
          notes: JSON.stringify(meta),
        });
        if (orderError) {
          console.error("[api/whatsapp-quote] falha ao registrar orçamento", orderError);
        }

        const { error: leadError } = await admin.from("leads").insert({
          name,
          phone,
          items,
          source: "whatsapp",
        });
        if (leadError) {
          console.error("[api/whatsapp-quote] falha ao registrar lead", leadError);
        }

        if (orderError && leadError) {
          return Response.json(
            { ok: false, error: "Não foi possível registrar o orçamento." },
            { status: 500 },
          );
        }
        return Response.json({ ok: true });
      },
    },
  },
});
