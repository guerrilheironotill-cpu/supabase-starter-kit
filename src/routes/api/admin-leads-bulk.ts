import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_STATUSES = ["Novo", "Em contato", "Proposta", "Fechado", "Descartado"];

async function getAdminClients(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) throw new Error("SERVER_CONFIG");

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("UNAUTHORIZED");
  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) throw new Error("FORBIDDEN");

  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "UNAUTHORIZED") return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  if (message === "FORBIDDEN") return Response.json({ ok: false, error: "Acesso restrito a administradores." }, { status: 403 });
  if (message === "SERVER_CONFIG") return Response.json({ ok: false, error: "Configuração segura indisponível." }, { status: 500 });
  return Response.json({ ok: false, error: message }, { status: 500 });
}

export const Route = createFileRoute("/api/admin-leads-bulk")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          const admin = await getAdminClients(request);
          const body = (await request.json()) as { ids?: string[]; status?: string };
          const ids = Array.from(new Set(body.ids ?? [])).filter(Boolean);
          const status = String(body.status ?? "");
          if (!ids.length || !ALLOWED_STATUSES.includes(status)) {
            return Response.json({ ok: false, error: "Seleção ou status inválido." }, { status: 400 });
          }

          const { data: rows, error: readError } = await admin
            .from("leads")
            .select("id, contact_info")
            .in("id", ids);
          if (readError) throw readError;

          for (const row of rows ?? []) {
            let contactInfo: Record<string, unknown> = {};
            if (row.contact_info && typeof row.contact_info === "object" && !Array.isArray(row.contact_info)) {
              contactInfo = row.contact_info as Record<string, unknown>;
            } else if (typeof row.contact_info === "string") {
              try { contactInfo = JSON.parse(row.contact_info); } catch { contactInfo = {}; }
            }
            const { error } = await admin
              .from("leads")
              .update({ contact_info: { ...contactInfo, status } })
              .eq("id", row.id);
            if (error) throw error;
          }

          return Response.json({ ok: true, updated: rows?.length ?? 0 });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const admin = await getAdminClients(request);
          const body = (await request.json()) as { ids?: string[] };
          const ids = Array.from(new Set(body.ids ?? [])).filter(Boolean);
          if (!ids.length) return Response.json({ ok: false, error: "Nenhum lead selecionado." }, { status: 400 });
          const { error, count } = await admin
            .from("leads")
            .delete({ count: "exact" })
            .in("id", ids);
          if (error) throw error;
          return Response.json({ ok: true, deleted: count ?? ids.length });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});