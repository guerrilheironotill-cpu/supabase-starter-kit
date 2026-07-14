import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/cleanup-external-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const ANON_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
          return Response.json(
            { ok: false, error: "Servidor sem SUPABASE_URL / SERVICE_ROLE / ANON key" },
            { status: 500 },
          );
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) {
          return Response.json({ ok: false, error: "Sem token" }, { status: 401 });
        }
        const anon = createClient(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false },
        });
        const { data: userData, error: userErr } = await anon.auth.getUser(token);
        if (userErr || !userData.user) {
          return Response.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });

        try {
          const { data: products, error: selErr } = await admin
            .from("products")
            .select("id, slug, images");
          if (selErr) throw new Error(selErr.message);

          const storageHost = new URL(SUPABASE_URL).host;
          let updated = 0;
          let removed = 0;
          let emptied = 0;

          for (const p of (products ?? []) as {
            id: string;
            slug: string;
            images: string[] | null;
          }[]) {
            const imgs = p.images ?? [];
            const kept = imgs.filter((u) => {
              try {
                return new URL(u).host === storageHost;
              } catch {
                return false;
              }
            });
            if (kept.length === imgs.length) continue;
            removed += imgs.length - kept.length;
            if (kept.length === 0) emptied++;
            const { error: uErr } = await admin
              .from("products")
              .update({ images: kept })
              .eq("id", p.id);
            if (!uErr) updated++;
          }

          return Response.json({ ok: true, updated, removed, emptied });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
    },
  },
});