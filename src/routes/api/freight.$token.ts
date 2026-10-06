import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { FreightQuoteRow } from "@/lib/freight";
import { loadPublicFreight } from "@/lib/freight-server";

const FALLBACK_WHATSAPP = "5548988486279";

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// Quotes still being prepared (waiting on the customer or on the admin) are not public.
const isPublished = (row: FreightQuoteRow) => row.status === "aberta" || row.status === "fechada";

export const Route = createFileRoute("/api/freight/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { quote, error } = await loadPublicFreight(params.token);
        if (error) return Response.json({ ok: false, error: "Serviço indisponível." }, { status: 500 });
        if (!quote) return Response.json({ ok: false, error: "Cotação não encontrada." }, { status: 404 });
        return Response.json({ ok: true, quote });
      },

      POST: async ({ request, params }) => {
        const admin = adminClient();
        if (!admin) return Response.json({ ok: false, error: "Serviço indisponível." }, { status: 500 });

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
        }
        // Hidden field: real people never fill it, bots usually do.
        if (text(body.website, 200)) return Response.json({ ok: true, whatsappUrl: null });

        const name = text(body.name, 120);
        const phone = text(body.phone, 30).replace(/[^\d+()\-\s]/g, "");
        const phoneDigits = phone.replace(/\D/g, "");
        const price = Number(body.price);
        const deadline = body.deadlineDays === "" || body.deadlineDays == null ? null : Number(body.deadlineDays);
        const notes = text(body.notes, 1000);

        if (!name) return Response.json({ ok: false, error: "Informe seu nome." }, { status: 400 });
        if (phoneDigits.length < 10 || phoneDigits.length > 13) {
          return Response.json({ ok: false, error: "Informe um WhatsApp válido com DDD." }, { status: 400 });
        }
        if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
          return Response.json({ ok: false, error: "Informe o valor da cotação." }, { status: 400 });
        }
        if (deadline !== null && (!Number.isInteger(deadline) || deadline < 0 || deadline > 365)) {
          return Response.json({ ok: false, error: "Prazo inválido." }, { status: 400 });
        }

        const { data: quote } = await admin
          .from("freight_quotes")
          .select("*")
          .eq("token", params.token)
          .maybeSingle();
        if (!quote || !isPublished(quote as FreightQuoteRow)) {
          return Response.json({ ok: false, error: "Cotação não encontrada." }, { status: 404 });
        }
        const row = quote as FreightQuoteRow;
        if (row.status !== "aberta") {
          return Response.json({ ok: false, error: "Este frete já foi encerrado." }, { status: 409 });
        }

        // Basic abuse guard: the same phone cannot flood a single quote.
        const { count } = await admin
          .from("freight_proposals")
          .select("id", { count: "exact", head: true })
          .eq("freight_quote_id", row.id)
          .eq("carrier_phone", phone);
        if ((count ?? 0) >= 5) {
          return Response.json({ ok: false, error: "Você já enviou propostas demais para este frete." }, { status: 429 });
        }

        const { error: insertError } = await admin.from("freight_proposals").insert({
          freight_quote_id: row.id,
          carrier_name: name,
          carrier_phone: phone,
          price,
          deadline_days: deadline,
          notes: notes || null,
        });
        if (insertError) {
          console.error("[freight proposal]", insertError.message);
          return Response.json({ ok: false, error: "Não foi possível enviar sua cotação." }, { status: 500 });
        }

        const { data: settings } = await admin.from("site_settings").select("whatsapp_number").limit(1).maybeSingle();
        const number = String((settings as { whatsapp_number?: string } | null)?.whatsapp_number ?? "").replace(/\D/g, "") || FALLBACK_WHATSAPP;
        const money = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const message = [
          `Olá! Envio minha cotação de frete ${row.origin_district ?? row.origin_city} → ${row.dest_district ?? row.dest_city} (ref. ${row.token}).`,
          `Nome: ${name}`,
          `Valor: ${money}`,
          deadline !== null ? `Prazo: ${deadline} dia(s)` : null,
          notes ? `Obs.: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        return Response.json({
          ok: true,
          whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
        });
      },
    },
  },
});
