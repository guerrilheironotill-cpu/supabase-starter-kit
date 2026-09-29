import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CLIENT_TYPES = new Set(["final", "professional", "reseller"]);
const PROFESSIONAL_TYPES = new Set([
  "architect",
  "landscaper",
  "interior_designer",
  "gardener",
  "other",
]);

// Registers the lead of a catalog download, reusing an existing lead with the same e-mail.
export const Route = createFileRoute("/api/catalog-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json(
            { ok: false, error: "Configuração segura do Supabase indisponível." },
            { status: 500 },
          );
        }

        let payload: {
          name?: string;
          phone?: string;
          email?: string;
          clientType?: string;
          professionalType?: string;
          cnpj?: string;
        };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
        }

        const name = String(payload.name ?? "")
          .trim()
          .slice(0, 200);
        const phone = String(payload.phone ?? "")
          .trim()
          .slice(0, 40);
        const email = String(payload.email ?? "")
          .trim()
          .toLowerCase()
          .slice(0, 200);
        const clientType = CLIENT_TYPES.has(String(payload.clientType))
          ? String(payload.clientType)
          : "final";
        const professionalType =
          clientType === "professional" && PROFESSIONAL_TYPES.has(String(payload.professionalType))
            ? String(payload.professionalType)
            : null;
        const cnpj = clientType === "reseller" ? String(payload.cnpj ?? "").slice(0, 20) : null;
        if (!name && !phone && !email) {
          return Response.json({ ok: false, error: "Nenhum dado de contato." }, { status: 400 });
        }

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

        if (email) {
          const { data: existing, error } = await admin
            .from("leads")
            .select("id")
            .ilike("email", email.replace(/([%_\\])/g, "\\$1"))
            .limit(1)
            .maybeSingle();
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }
          if (existing) return Response.json({ ok: true, existing: true, id: existing.id });
        }

        const { data, error } = await admin
          .from("leads")
          .insert({
            name,
            phone,
            email,
            destination: "email",
            source: "catalogo-pdf",
            client_type: clientType,
            lead_interest: clientType,
            professional_type: professionalType,
            cnpj,
            categories: ["Todas"],
            items: {
              client_type: clientType,
              professional_type: professionalType,
              catalog: "completo",
            },
          })
          .select("id")
          .single();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, existing: false, id: data.id });
      },
    },
  },
});
