import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { readdir, stat, statfs } from "node:fs/promises";
import { join } from "node:path";

async function directorySize(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) total += await directorySize(child);
    else if (entry.isFile()) total += (await stat(child)).size;
  }
  return total;
}

export const Route = createFileRoute("/api/server-storage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const noStore = { "cache-control": "no-store" };
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!url || !key || !token) {
          return Response.json(
            { ok: false, error: "Configuração ou sessão ausente." },
            { status: 401, headers: noStore },
          );
        }

        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userError } = await client.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json(
            { ok: false, error: "Sessão inválida." },
            { status: 401, headers: noStore },
          );
        }
        const { data: isAdmin, error: roleError } = await client.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (roleError || !isAdmin) {
          return Response.json(
            { ok: false, error: "Acesso restrito." },
            { status: 403, headers: noStore },
          );
        }

        const uploadDir = process.env.UPLOAD_DIR;
        if (!uploadDir) {
          return Response.json(
            { ok: false, error: "UPLOAD_DIR não configurado." },
            { headers: noStore },
          );
        }

        try {
          const [fsInfo, uploadsBytes] = await Promise.all([
            statfs(uploadDir),
            directorySize(uploadDir),
          ]);
          const totalBytes = fsInfo.blocks * fsInfo.bsize;
          const availableBytes = fsInfo.bavail * fsInfo.bsize;
          return Response.json(
            {
              ok: true,
              totalBytes,
              usedBytes: totalBytes - availableBytes,
              availableBytes,
              uploadsBytes,
            },
            { headers: noStore },
          );
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Falha ao medir disco." },
            { headers: noStore },
          );
        }
      },
    },
  },
});
