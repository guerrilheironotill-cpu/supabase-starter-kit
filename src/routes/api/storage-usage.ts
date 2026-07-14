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
        });

        const { data: buckets, error: bErr } = await admin.storage.listBuckets();
        if (bErr) {
          return Response.json({ ok: false, error: bErr.message }, { status: 500 });
        }

        async function sumBucket(bucket: string, prefix = ""): Promise<number> {
          let total = 0;
          let offset = 0;
          const pageSize = 100;
          for (;;) {
            const { data, error } = await admin.storage
              .from(bucket)
              .list(prefix, { limit: pageSize, offset });
            if (error) throw new Error(error.message);
            if (!data || data.length === 0) break;
            for (const item of data) {
              // pastas têm id === null
              if ((item as { id: string | null }).id === null) {
                total += await sumBucket(bucket, prefix ? `${prefix}/${item.name}` : item.name);
              } else {
                const size = Number(
                  (item as { metadata?: { size?: number } }).metadata?.size ?? 0,
                ) || 0;
                total += size;
              }
            }
            if (data.length < pageSize) break;
            offset += pageSize;
          }
          return total;
        }

        const perBucket: Array<{ name: string; bytes: number }> = [];
        let total = 0;
        for (const b of buckets ?? []) {
          const bytes = await sumBucket(b.name);
          perBucket.push({ name: b.name, bytes });
          total += bytes;
        }

        // limite padrão do plano free do Supabase: 1 GB
        const limitBytes = 1024 * 1024 * 1024;

        return Response.json(
          {
            ok: true,
            sizeBytes: total,
            limitBytes,
            buckets: perBucket.sort((a, b) => b.bytes - a.bytes),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});