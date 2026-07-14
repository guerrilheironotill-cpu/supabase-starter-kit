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

        try {
          const { data: buckets, error: bErr } = await admin.storage.listBuckets();
          if (bErr) {
            return Response.json(
              { ok: false, error: `listBuckets: ${bErr.message}` },
              { status: 500 },
            );
          }

          async function sumBucket(bucket: string, prefix = ""): Promise<number> {
            let total = 0;
            let offset = 0;
            const pageSize = 100;
            for (;;) {
              const { data, error } = await admin.storage
                .from(bucket)
                .list(prefix, { limit: pageSize, offset });
              if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
              if (!data || data.length === 0) break;
              for (const item of data) {
                const it = item as {
                  id: string | null;
                  name: string;
                  metadata?: { size?: number } | null;
                };
                const hasSize = typeof it.metadata?.size === "number";
                if (it.id === null && !hasSize) {
                  total += await sumBucket(
                    bucket,
                    prefix ? `${prefix}/${it.name}` : it.name,
                  );
                } else {
                  total += Number(it.metadata?.size ?? 0) || 0;
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
        } catch (e) {
          console.error("[storage-usage]", e);
          return Response.json(
            { ok: false, error: (e as Error).message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});