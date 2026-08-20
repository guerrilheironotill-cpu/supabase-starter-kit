import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type QuotePayload = {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items?: unknown[];
  total?: number;
  notes?: string;
  attribution?: Record<string, unknown> | null;
};

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

function cleanAttribution(value: QuotePayload["attribution"]) {
  if (!value || typeof value !== "object") return null;
  const text = (key: string, max = 500) =>
    String(value[key] ?? "")
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

type CatalogItem = {
  kind?: string;
  product_id?: string | null;
  size_id?: string | null;
  name?: string;
  quantity?: number;
  finish?: string | null;
  [key: string]: unknown;
};

export const Route = createFileRoute("/api/quotes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          console.error("[api/quotes] Supabase não configurado no ambiente do servidor.");
          return Response.json(
            { ok: false, error: "O serviço de orçamentos está temporariamente indisponível." },
            { status: 500 },
          );
        }

        let payload: QuotePayload;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Os dados do orçamento são inválidos." },
            { status: 400 },
          );
        }

        const customerName = String(payload.customer_name ?? "").trim();
        const customerPhone = String(payload.customer_phone ?? "").trim();
        const customerEmail = String(payload.customer_email ?? "")
          .trim()
          .toLowerCase();
        if (
          !customerName ||
          !customerPhone ||
          !customerEmail ||
          !Array.isArray(payload.items) ||
          payload.items.length === 0
        ) {
          return Response.json(
            { ok: false, error: "Nome, telefone, e-mail e produtos são obrigatórios." },
            { status: 400 },
          );
        }

        const orderId = crypto.randomUUID();
        const emailNotificationToken = crypto.randomUUID();
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const submittedItems = payload.items as CatalogItem[];
        const sizeIds = submittedItems.map((item) => String(item.size_id ?? "")).filter(Boolean);
        if (sizeIds.length !== submittedItems.length) {
          return Response.json(
            { ok: false, error: "Um ou mais produtos não possuem uma variação válida." },
            { status: 400 },
          );
        }
        const { data: sizeRows, error: sizeError } = await admin
          .from("product_sizes")
          .select("id, product_id, base_price, sale_price")
          .in("id", sizeIds);
        if (sizeError || !sizeRows || sizeRows.length !== new Set(sizeIds).size) {
          return Response.json(
            { ok: false, error: "Não foi possível confirmar os preços atuais dos produtos." },
            { status: 409 },
          );
        }
        const sizeById = new Map(sizeRows.map((row) => [String(row.id), row]));
        const finishNames = Array.from(
          new Set(submittedItems.map((item) => String(item.finish ?? "")).filter(Boolean)),
        );
        const finishExtra = new Map<string, number>();
        if (finishNames.length) {
          const { data: finishes } = await admin
            .from("finish_catalog")
            .select("name, extra_price")
            .in("name", finishNames);
          for (const finish of finishes ?? []) {
            finishExtra.set(String(finish.name), Number(finish.extra_price) || 0);
          }
        }
        const hasMismatchedVariant = submittedItems.some((item) => {
          const size = sizeById.get(String(item.size_id));
          return !size || String(size.product_id) !== String(item.product_id);
        });
        if (hasMismatchedVariant) {
          return Response.json(
            { ok: false, error: "A variação selecionada não pertence ao produto informado." },
            { status: 409 },
          );
        }
        const verifiedItems = submittedItems.map((item) => {
          const size = sizeById.get(String(item.size_id))!;
          const regular = Number(size.base_price);
          const candidateSale = size.sale_price == null ? null : Number(size.sale_price);
          const current =
            candidateSale && candidateSale > 0 && candidateSale < regular ? candidateSale : regular;
          const quantity = Math.max(1, Math.min(999, Math.trunc(Number(item.quantity) || 1)));
          return {
            ...item,
            quantity,
            price:
              Math.round((current + (finishExtra.get(String(item.finish ?? "")) ?? 0)) * 100) / 100,
          };
        });
        const verifiedTotal = verifiedItems.reduce(
          (sum, item) => sum + Number(item.price) * Number(item.quantity),
          0,
        );
        const attribution = cleanAttribution(payload.attribution);
        let notes = String(payload.notes ?? "");
        if (attribution) {
          try {
            const parsed = JSON.parse(notes);
            notes = JSON.stringify({ ...parsed, attribution });
          } catch {
            // Keep legacy plain-text notes intact.
          }
        }
        const { error } = await admin.from("orders").insert({
          id: orderId,
          status: "orcamento",
          origin: attribution?.channel ?? "site",
          email_notification_token: emailNotificationToken,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          items: verifiedItems,
          total: Math.round(verifiedTotal * 100) / 100,
          notes,
        });

        if (error) {
          console.error("[api/quotes] insert failed", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          return Response.json(
            { ok: false, error: "Não foi possível registrar o orçamento. Tente novamente." },
            { status: 500 },
          );
        }
        return Response.json({ ok: true, orderId, emailNotificationToken });
      },
    },
  },
});
