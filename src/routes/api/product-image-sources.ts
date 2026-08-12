import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/product-image-sources")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const ANON_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const noStore = { "cache-control": "no-store" };

        if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
          return Response.json(
            { ok: false, configured: false, error: "Configure SUPABASE_SERVICE_ROLE_KEY." },
            { headers: noStore },
          );
        }

        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
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
          const { data, error } = await admin.from("products").select("id, images");
          if (error) throw new Error(error.message);

          const supabaseHost = new URL(SUPABASE_URL).host;
          const siteHost = new URL(process.env.VITE_SITE_URL ?? "https://novo.arteno.com.br").host;
          let totalProducts = 0;
          let productsWithoutImages = 0;
          let productsAllExternal = 0;
          let productsMixed = 0;
          let productsAllHosted = 0;
          let vpsUrls = 0;
          let supabaseUrls = 0;
          let wordpressUrls = 0;
          let otherExternalUrls = 0;

          for (const p of (data ?? []) as { id: string; images: string[] | null }[]) {
            totalProducts++;
            const imgs = p.images ?? [];
            if (imgs.length === 0) {
              productsWithoutImages++;
              continue;
            }
            let ext = 0;
            let hosted = 0;
            for (const url of imgs) {
              try {
                const parsed = new URL(url, `https://${siteHost}`);
                if (parsed.host === siteHost && parsed.pathname.startsWith("/uploads/")) {
                  hosted++;
                  vpsUrls++;
                } else if (parsed.host === supabaseHost) {
                  ext++;
                  supabaseUrls++;
                } else if (parsed.host === "arteno.com.br" || parsed.host === "www.arteno.com.br") {
                  ext++;
                  wordpressUrls++;
                } else {
                  ext++;
                  otherExternalUrls++;
                }
              } catch {
                ext++;
                otherExternalUrls++;
              }
            }
            if (ext > 0 && hosted === 0) productsAllExternal++;
            else if (hosted > 0 && ext === 0) productsAllHosted++;
            else productsMixed++;
          }

          return Response.json(
            {
              ok: true,
              configured: true,
              totalProducts,
              productsWithoutImages,
              productsAllExternal,
              productsMixed,
              productsAllHosted,
              vpsUrls,
              supabaseUrls,
              wordpressUrls,
              otherExternalUrls,
            },
            { headers: noStore },
          );
        } catch (e) {
          console.error("[product-image-sources]", e);
          return Response.json(
            {
              ok: false,
              configured: true,
              error: e instanceof Error ? e.message : "erro desconhecido",
            },
            { headers: noStore },
          );
        }
      },
    },
  },
});
