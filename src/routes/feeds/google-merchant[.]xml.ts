import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  slug: string;
  name: string;
  category: string;
  images: string[] | null;
  description: string | null;
  product_sizes: Array<{ name: string; base_price: number; sale_price: number | null }> | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export const Route = createFileRoute("/feeds/google-merchant.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;

        let items = "";
        if (url && key) {
          const supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data } = await supabase
            .from("products")
            .select(
              "id, slug, name, category, images, description, product_sizes(name, base_price, sale_price)",
            )
            .eq("active", true);

          for (const row of (data ?? []) as Row[]) {
            const sizes = row.product_sizes ?? [];
            const cheapest = sizes
              .map((s) => s.sale_price ?? s.base_price)
              .filter((n) => typeof n === "number" && n > 0)
              .sort((a, b) => a - b)[0];
            if (!cheapest) continue;

            const image = row.images?.[0];
            if (!image) continue;

            const desc = stripHtml(row.description || row.name).slice(0, 4900);
            const price = `${cheapest.toFixed(2)} BRL`;
            const link = `${origin}/produto/${row.slug}`;

            const extraImages = (row.images ?? [])
              .slice(1, 11)
              .map((img) => `      <g:additional_image_link>${esc(img)}</g:additional_image_link>`)
              .join("\n");

            items += `
    <item>
      <g:id>${esc(row.id)}</g:id>
      <g:title>${esc(row.name)}</g:title>
      <g:description>${esc(desc)}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(image)}</g:image_link>
${extraImages}
      <g:availability>in stock</g:availability>
      <g:price>${price}</g:price>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${esc(row.category)}</g:product_type>
      <g:google_product_category>Furniture</g:google_product_category>
    </item>`;
          }
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Catálogo de produtos</title>
    <link>${origin}</link>
    <description>Feed Google Merchant Center</description>${items}
  </channel>
</rss>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});