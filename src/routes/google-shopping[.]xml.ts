import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site-config";

type SizeRow = {
  id: string;
  name: string;
  size?: string | null;
  base_price: number;
  sale_price: number | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  images: string[] | null;
  product_sizes: SizeRow[] | null;
};

const xml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const text = (value: string | null) =>
  String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const absolute = (path: string) =>
  path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const Route = createFileRoute("/google-shopping.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !key) {
          return new Response("Catálogo temporariamente indisponível.", { status: 503 });
        }

        const client = createClient(supabaseUrl, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client
          .from("products")
          .select(
            "id, slug, name, category, description, images, product_sizes(id, name, size, base_price, sale_price, sort_order)",
          )
          .eq("active", true)
          .order("name");
        if (error) {
          console.error("[google-shopping] catalog query failed", error);
          return new Response("Catálogo temporariamente indisponível.", { status: 503 });
        }

        const items: string[] = [];
        for (const product of (data ?? []) as ProductRow[]) {
          const image = product.images?.find(Boolean);
          if (!image) continue;
          for (const size of product.product_sizes ?? []) {
            const regular = Number(size.base_price);
            const candidateSale = size.sale_price == null ? null : Number(size.sale_price);
            const sale =
              candidateSale && candidateSale > 0 && candidateSale < regular ? candidateSale : null;
            if (!Number.isFinite(regular) || regular <= 0) continue;
            const label = size.name || size.size || "Único";
            const link = `${SITE_URL}/produto/${encodeURIComponent(product.slug)}?tamanho=${encodeURIComponent(size.id)}`;
            items.push(
              [
                "    <item>",
                `      <g:id>${xml(size.id)}</g:id>`,
                `      <g:item_group_id>${xml(product.id)}</g:item_group_id>`,
                `      <title>${xml(`${product.name} - ${label}`)}</title>`,
                `      <description>${xml(text(product.description) || `${product.name} artesanal Arteno.`)}</description>`,
                `      <link>${xml(link)}</link>`,
                `      <g:image_link>${xml(absolute(image))}</g:image_link>`,
                `      <g:brand>Arteno</g:brand>`,
                `      <g:condition>new</g:condition>`,
                `      <g:availability>preorder</g:availability>`,
                `      <g:price>${regular.toFixed(2)} BRL</g:price>`,
                sale ? `      <g:sale_price>${sale.toFixed(2)} BRL</g:sale_price>` : null,
                `      <g:size>${xml(label)}</g:size>`,
                `      <g:product_type>${xml(product.category)}</g:product_type>`,
                "      <g:identifier_exists>no</g:identifier_exists>",
                "    </item>",
              ]
                .filter(Boolean)
                .join("\n"),
            );
          }
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Arteno Vaso &amp; Decor</title>\n    <link>${xml(SITE_URL)}</link>\n    <description>Catálogo de produtos Arteno</description>\n${items.join("\n")}\n  </channel>\n</rss>`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=900, s-maxage=900",
          },
        });
      },
    },
  },
});
