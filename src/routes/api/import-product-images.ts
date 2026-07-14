import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const WP_BASE = "https://arteno.com.br/wp-json/wc/store/v1/products";
const BUCKET = "product-images";

type WPImage = { src: string; alt?: string };
type WPProduct = { slug: string; name: string; images: WPImage[] };

function extFromUrl(url: string) {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : "jpg";
}
function ctFor(ext: string) {
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
    } as Record<string, string>
  )[ext] ?? "image/jpeg";
}

export const Route = createFileRoute("/api/import-product-images")({
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

        // ---- verifica usuário autenticado ----
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) {
          return Response.json({ ok: false, error: "Sem token de sessão" }, { status: 401 });
        }
        const anon = createClient(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false },
        });
        const { data: userData, error: userErr } = await anon.auth.getUser(token);
        if (userErr || !userData.user) {
          return Response.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
        }

        // ---- admin client (service role) ----
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });

        try {
          // 1) garante bucket público
          const { data: bucket } = await admin.storage.getBucket(BUCKET);
          if (!bucket) {
            const { error: cErr } = await admin.storage.createBucket(BUCKET, {
              public: true,
            });
            if (cErr) throw new Error(`createBucket: ${cErr.message}`);
          } else if (!bucket.public) {
            await admin.storage.updateBucket(BUCKET, { public: true });
          }

          // 2) produtos do Supabase
          const { data: dbProducts, error: dbErr } = await admin
            .from("products")
            .select("id, slug, images");
          if (dbErr) throw new Error(`select products: ${dbErr.message}`);
          const bySlug = new Map(dbProducts?.map((p) => [p.slug, p]) ?? []);

          // 3) produtos do WP (pagina)
          const wpAll: WPProduct[] = [];
          for (let page = 1; page <= 20; page++) {
            const r = await fetch(`${WP_BASE}?per_page=100&page=${page}`);
            if (!r.ok) throw new Error(`WP page ${page}: ${r.status}`);
            const rows = (await r.json()) as WPProduct[];
            if (!rows.length) break;
            wpAll.push(...rows);
            if (rows.length < 100) break;
          }

          let matched = 0,
            updated = 0,
            skipped = 0,
            imgOk = 0,
            imgFail = 0;
          const errors: string[] = [];

          for (const wp of wpAll) {
            const db = bySlug.get(wp.slug);
            if (!db) continue;
            matched++;
            if (!wp.images?.length) {
              skipped++;
              continue;
            }
            const newUrls: string[] = [];
            for (let i = 0; i < wp.images.length; i++) {
              const src = wp.images[i].src;
              try {
                const r = await fetch(src);
                if (!r.ok) {
                  imgFail++;
                  continue;
                }
                const buf = new Uint8Array(await r.arrayBuffer());
                const ext = extFromUrl(src);
                const path = `${wp.slug}/${i}.${ext}`;
                const { error: upErr } = await admin.storage
                  .from(BUCKET)
                  .upload(path, buf, { contentType: ctFor(ext), upsert: true });
                if (upErr) {
                  imgFail++;
                  continue;
                }
                const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
                newUrls.push(pub.publicUrl);
                imgOk++;
              } catch {
                imgFail++;
              }
            }
            if (!newUrls.length) {
              skipped++;
              continue;
            }
            const { error: uErr } = await admin
              .from("products")
              .update({ images: newUrls })
              .eq("id", db.id);
            if (uErr) {
              errors.push(`${wp.slug}: ${uErr.message}`);
              continue;
            }
            updated++;
          }

          return Response.json({
            ok: true,
            wpTotal: wpAll.length,
            dbTotal: dbProducts?.length ?? 0,
            matched,
            updated,
            skipped,
            imagesUploaded: imgOk,
            imagesFailed: imgFail,
            errors: errors.slice(0, 20),
          });
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