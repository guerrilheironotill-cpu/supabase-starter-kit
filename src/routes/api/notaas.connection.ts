import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function requireAdmin(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("SERVER_CONFIG");

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new Error("UNAUTHORIZED");
  const { data: isAdmin, error: roleError } = await client.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) throw new Error("FORBIDDEN");
}

export const Route = createFileRoute("/api/notaas/connection")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdmin(request);
          const apiKey = process.env.NOTAAS_API_KEY;
          if (!apiKey) {
            return Response.json({ ok: false, configured: false }, { status: 503 });
          }

          const response = await fetch(
            "https://platform.notaas.com.br/api/v1/invoices/inv_connection_test/status",
            {
              headers: { "x-api-key": apiKey },
              signal: AbortSignal.timeout(10_000),
            },
          );
          const authenticated = ![401, 403].includes(response.status);
          return Response.json(
            {
              ok: authenticated,
              configured: true,
              authenticated,
              environment: "homologacao",
            },
            { status: authenticated ? 200 : 502 },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "UNKNOWN";
          if (message === "UNAUTHORIZED") {
            return Response.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
          }
          if (message === "FORBIDDEN") {
            return Response.json({ ok: false, error: "Acesso negado." }, { status: 403 });
          }
          return Response.json(
            { ok: false, error: "Não foi possível consultar o Notaas." },
            { status: 502 },
          );
        }
      },
    },
  },
});
