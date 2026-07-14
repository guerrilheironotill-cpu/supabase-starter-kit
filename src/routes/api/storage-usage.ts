import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/storage-usage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const ANON_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
          return Response.json(
            { ok: false, error: "env ausente" },
            { status: 500 },
          );
        }

        const token = (request.headers.get("authorization") ?? "").replace(
          /^Bearer\s+/i,
          "",
        );
        if (!token) {
          return Response.json({ ok: false, error: "sem token" }, { status: 401 });
        }
        const anon = createClient(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false },
        });
        const { data: u, error: uErr } = await anon.auth.getUser(token);
        if (uErr || !u.user) {
          return Response.json({ ok: false, error: "sessão inválida" }, { status: 401 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
          db: { schema: "storage" },
        });

        // soma tamanho via metadata->>'size' em storage.objects
        const { data, error } = await admin
          .from("objects")
          .select("bucket_id, metadata");
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const perBucket = new Map<string, number>();
        let total = 0;
        for (const row of (data ?? []) as {
          bucket_id: string;
          metadata: { size?: number } | null;
        }[]) {
          const s = Number(row.metadata?.size ?? 0) || 0;
          total += s;
          perBucket.set(row.bucket_id, (perBucket.get(row.bucket_id) ?? 0) + s);
        }

        // limite padrão do plano free do Supabase: 1 GB
        const limitBytes = 1024 * 1024 * 1024;

        return Response.json(
          {
            ok: true,
            sizeBytes: total,
            limitBytes,
            buckets: Array.from(perBucket.entries())
              .map(([name, bytes]) => ({ name, bytes }))
              .sort((a, b) => b.bytes - a.bytes),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});