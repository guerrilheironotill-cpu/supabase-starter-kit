import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { totalUnits, type FreightQuoteRow } from "@/lib/freight";

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// The customer may fill (or correct) the form until the carrier page is published.
const acceptsAnswers = (row: FreightQuoteRow) =>
  row.status === "aguardando_cliente" || row.status === "respondida";

export const Route = createFileRoute("/api/freight-form/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const admin = adminClient();
        if (!admin) return Response.json({ ok: false, error: "Serviço indisponível." }, { status: 500 });
        const { data } = await admin
          .from("freight_quotes")
          .select("*")
          .eq("form_token", params.token)
          .maybeSingle();
        if (!data) return Response.json({ ok: false, error: "Link não encontrado." }, { status: 404 });
        const row = data as FreightQuoteRow;
        return Response.json({
          ok: true,
          open: acceptsAnswers(row),
          units: totalUnits(Array.isArray(row.items) ? row.items : []),
          customerName: row.customer_label,
          answered: row.status !== "aguardando_cliente",
        });
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
        if (text(body.website, 200)) return Response.json({ ok: true });

        const { data } = await admin
          .from("freight_quotes")
          .select("*")
          .eq("form_token", params.token)
          .maybeSingle();
        if (!data) return Response.json({ ok: false, error: "Link não encontrado." }, { status: 404 });
        const row = data as FreightQuoteRow;
        if (!acceptsAnswers(row)) {
          return Response.json({ ok: false, error: "Este formulário já foi encerrado." }, { status: 409 });
        }

        const cep = text(body.cep, 9).replace(/\D/g, "");
        const city = text(body.city, 80);
        const state = text(body.state, 2).toUpperCase();
        const needsUnloading = body.needsUnloading === true;
        const floor = needsUnloading && body.floor === "superior" ? "superior" : "terreo";
        const street = text(body.street, 120);
        const number = text(body.number, 20);
        const complement = text(body.complement, 80);
        const pickupDate = text(body.pickupDate, 10);
        if (cep.length !== 8) {
          return Response.json({ ok: false, error: "Informe o CEP de entrega." }, { status: 400 });
        }
        if (!street || !number) {
          return Response.json({ ok: false, error: "Informe a rua e o número da entrega." }, { status: 400 });
        }
        if (!city || state.length !== 2) {
          return Response.json({ ok: false, error: "Informe cidade e UF." }, { status: 400 });
        }
        if (pickupDate && !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
          return Response.json({ ok: false, error: "Data inválida." }, { status: 400 });
        }

        const { error } = await admin
          .from("freight_quotes")
          .update({
            dest_cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
            dest_district: text(body.district, 80) || null,
            dest_city: city,
            dest_state: state,
            dest_floor: floor,
            dest_stairs: needsUnloading && body.stairs === true,
            // Private: only the chosen carrier receives the full address.
            dest_address: [`${street}, ${number}`, complement].filter(Boolean).join(" - "),
            loading_included: needsUnloading,
            // The pickup date is the admin's call; the customer's wish goes in the notes.
            access_notes:
              [
                needsUnloading ? text(body.accessNotes, 500) : "",
                pickupDate
                  ? `Cliente quer receber em ${pickupDate.split("-").reverse().slice(0, 2).join("/")}${body.dateFlexible === true ? " ou próxima" : ""}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ") || null,
            status: "respondida",
            customer_answered_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) {
          console.error("[freight form]", error.message);
          return Response.json({ ok: false, error: "Não foi possível salvar. Tente novamente." }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
