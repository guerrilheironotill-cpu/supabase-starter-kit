import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site-config";

type Entry = { path: string; changefreq?: string; priority?: string; lastmod?: string };

function isIndexableProduct(product: { slug: string; name: string; category: string }) {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) &&
    product.name.trim().toLowerCase() !== "modelo sem nome"
  );
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/catalogo", changefreq: "weekly", priority: "0.9" },
          { path: "/pias-e-cubas-de-concreto", changefreq: "monthly", priority: "0.8" },
          { path: "/caracteristicas-do-concreto", changefreq: "yearly", priority: "0.7" },
          { path: "/vasos-para-empresas", changefreq: "monthly", priority: "0.8" },
          { path: "/mobiliario-urbano", changefreq: "monthly", priority: "0.8" },
          { path: "/projetos-personalizados", changefreq: "monthly", priority: "0.8" },
          { path: "/politica-de-cookies", changefreq: "yearly", priority: "0.2" },
        ];

        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const supabase = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data: products, error: productsError } = await supabase
              .from("products")
              .select("slug, name, category, created_at")
              .eq("active", true);
            if (productsError) throw productsError;
            const cats = new Set<string>();
            for (const p of products ?? []) {
              const row = p as {
                slug: string;
                name: string;
                category: string;
                created_at: string | null;
              };
              if (!isIndexableProduct(row)) continue;
              entries.push({
                path: `/produto/${row.slug}`,
                changefreq: "monthly",
                priority: "0.7",
                lastmod: row.created_at?.slice(0, 10),
              });
              if (row.category.trim().toLowerCase() !== "sem categoria") {
                cats.add(row.category);
              }
            }
            for (const c of cats) {
              entries.push({
                path: `/categoria/${categorySlug(c)}`,
                changefreq: "weekly",
                priority: "0.8",
              });
            }
          }
        } catch (error) {
          console.error("[sitemap] Failed to load catalog entries", error);
        }

        const uniqueEntries = Array.from(
          new Map(entries.map((entry) => [entry.path, entry])).values(),
        );
        const urls = uniqueEntries
          .map((e) =>
            [
              `  <url>`,
              `    <loc>${SITE_URL}${e.path}</loc>`,
              e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});

function categorySlug(s: string): string {
  const slug = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug === "vasos" ? "vasos-de-concreto" : slug;
}
