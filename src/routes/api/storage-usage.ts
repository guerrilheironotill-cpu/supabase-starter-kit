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

        const noStore = { "cache-control": "no-store" };

        if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
          return Response.json(
            {
              ok: false,
              configured: false,
              error:
                "Configure SUPABASE_SERVICE_ROLE_KEY no Vercel/local para medir o Storage do Supabase.",
            },
            { headers: noStore },
          );
        }

        const token = (request.headers.get("authorization") ?? "").replace(
          /^Bearer\s+/i,
          "",
        );
        if (!token) {
          return Response.json(
            { ok: false, configured: false, error: "sem token" },
            { status: 401, headers: noStore },
          );
        }
        const anon = createClient(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false },
        });
        const { data: u, error: uErr } = await anon.auth.getUser(token);
        if (uErr || !u.user) {
          return Response.json(
            { ok: false, configured: false, error: "sessão inválida" },
            { status: 401, headers: noStore },
          );
        }

        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });

        try {
          const { data: buckets, error: bErr } = await admin.storage.listBuckets();
          if (bErr) {
            return Response.json(
              { ok: false, configured: false, error: `listBuckets: ${bErr.message}` },
              { headers: noStore },
            );
          }

          async function sumBucket(
            bucket: string,
            prefix = "",
            visited = new Set<string>(),
            depth = 0,
          ): Promise<number> {
            const visitKey = `${bucket}:${prefix}`;
            if (visited.has(visitKey) || depth > 24) return 0;
            visited.add(visitKey);

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
                  const childPrefix = prefix ? `${prefix}/${it.name}` : it.name;
                  if (childPrefix && childPrefix !== prefix) {
                    total += await sumBucket(bucket, childPrefix, visited, depth + 1);
                  }
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
              configured: true,
              sizeBytes: total,
              limitBytes,
              buckets: perBucket.sort((a, b) => b.bytes - a.bytes),
            },
            { headers: noStore },
          );
        } catch (e) {
          console.error("[storage-usage]", e);
          return Response.json(
            { ok: false, configured: false, error: (e as Error).message ?? String(e) },
            { headers: noStore },
          );
        }
      },
    },
  },
});