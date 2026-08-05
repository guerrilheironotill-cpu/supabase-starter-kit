import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin-leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !serviceKey || !anonKey) {
          return Response.json({ ok: false, error: "Configuração segura do Supabase indisponível." }, { status: 500 });
        }

        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ ok: false, error: "Sessão não informada." }, { status: 401 });

        const userClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await userClient.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
        }

        const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (roleError || !isAdmin) {
          return Response.json({ ok: false, error: "Apenas administradores podem criar leads." }, { status: 403 });
        }

        let payload: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          cpf?: string | null;
          cnpj?: string | null;
          items?: unknown[];
          source?: string;
        };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Dados do lead inválidos." }, { status: 400 });
        }

        const name = String(payload.name ?? "").trim();
        const cpf = String(payload.cpf ?? "").replace(/\D/g, "");
        const cnpj = String(payload.cnpj ?? "").replace(/\D/g, "");
        const document = cpf || cnpj;
        const documentType = cpf ? "cpf" : cnpj ? "cnpj" : null;
        const phoneDigits = String(payload.phone ?? "").replace(/\D/g, "");
        const email = String(payload.email ?? "").trim().toLowerCase();

        if (!name || !Array.isArray(payload.items)) {
          return Response.json({ ok: false, error: "Nome e itens do lead são obrigatórios." }, { status: 400 });
        }
        if (!document || (cpf && cpf.length !== 11) || (cnpj && cnpj.length !== 14)) {
          return Response.json({ ok: false, error: "CPF ou CNPJ válido é obrigatório para identificar o lead." }, { status: 400 });
        }

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { data: candidates, error: findError } = await admin
          .from("leads")
          .select("id, phone, email, contact_info")
          .limit(5000);
        if (findError) return Response.json({ ok: false, error: findError.message }, { status: 500 });

        const existing = (candidates ?? []).find((lead) => {
          const info = lead.contact_info && typeof lead.contact_info === "object" && !Array.isArray(lead.contact_info)
            ? lead.contact_info as Record<string, unknown>
            : {};
          const savedDocument = String(info.document ?? info.cpf ?? info.cnpj ?? "").replace(/\D/g, "");
          if (savedDocument) return savedDocument === document;
          const savedPhone = String(lead.phone ?? "").replace(/\D/g, "");
          const savedEmail = String(lead.email ?? "").trim().toLowerCase();
          return Boolean((phoneDigits && savedPhone === phoneDigits) || (email && savedEmail === email));
        });

        if (existing) {
          const currentInfo = existing.contact_info && typeof existing.contact_info === "object" && !Array.isArray(existing.contact_info)
            ? existing.contact_info as Record<string, unknown>
            : {};
          const { error: updateError } = await admin
            .from("leads")
            .update({ contact_info: { ...currentInfo, document, document_type: documentType } })
            .eq("id", existing.id);
          if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });
          return Response.json({ ok: true, id: existing.id, existing: true });
        }

        const { data, error } = await admin
          .from("leads")
          .insert({
            name,
            phone: payload.phone || null,
            email: payload.email || null,
            destination: payload.phone ? "whatsapp" : "email",
            items: payload.items,
            source: payload.source || "manual",
            contact_info: { document, document_type: documentType },
          })
          .select("id")
          .single();

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, id: data.id, existing: false });
      },
    },
  },
});