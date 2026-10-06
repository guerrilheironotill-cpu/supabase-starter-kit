import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { rowToPublic, type FreightQuoteRow, type PublicFreightQuote } from "@/lib/freight";
import { absoluteUrl } from "@/lib/site-config";

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Server only: published freight quote with product photos filled in from the catalog. */
export async function loadPublicFreight(
  token: string,
): Promise<{ quote: PublicFreightQuote | null; error?: boolean }> {
  const admin = adminClient();
  if (!admin) return { quote: null, error: true };
  const { data, error } = await admin
    .from("freight_quotes")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) return { quote: null, error: true };
  const row = data as FreightQuoteRow | null;
  // Quotes still being prepared are not public.
  if (!row || (row.status !== "aberta" && row.status !== "fechada")) return { quote: null };

  const quote = rowToPublic(row);
  const items = Array.isArray(row.items) ? row.items : [];

  // Quotes created before product ids were stored: find the product through its size, then by name.
  const sizeIds = [
    ...new Set(items.filter((i) => !i.product_id && i.size_id).map((i) => i.size_id as string)),
  ];
  const productBySize = new Map<string, string>();
  if (sizeIds.length > 0) {
    const { data: sizes } = await admin.from("product_sizes").select("id, product_id").in("id", sizeIds);
    for (const size of (sizes ?? []) as Array<{ id: string; product_id: string }>) {
      productBySize.set(size.id, size.product_id);
    }
  }
  const unresolvedNames = [
    ...new Set(
      items
        .filter((i) => !i.product_id && !(i.size_id && productBySize.has(i.size_id)) && i.name)
        .map((i) => i.name),
    ),
  ];
  const productByName = new Map<string, string>();
  if (unresolvedNames.length > 0) {
    const { data: named } = await admin.from("products").select("id, name").in("name", unresolvedNames);
    for (const product of (named ?? []) as Array<{ id: string; name: string }>) {
      productByName.set(product.name.trim().toLowerCase(), product.id);
    }
  }
  const productIdOf = (item: (typeof items)[number]) =>
    item.product_id ??
    (item.size_id ? productBySize.get(item.size_id) : undefined) ??
    productByName.get(String(item.name ?? "").trim().toLowerCase()) ??
    null;

  const productIds = [...new Set(items.map(productIdOf).filter((id): id is string => Boolean(id)))];
  if (productIds.length > 0) {
    const { data: products } = await admin.from("products").select("id, images").in("id", productIds);
    const firstImage = new Map(
      ((products ?? []) as Array<{ id: string; images: string[] | null }>).map((product) => {
        const image = (product.images ?? []).find(Boolean);
        return [product.id, image ? absoluteUrl(image) : null] as const;
      }),
    );
    quote.items = quote.items.map((item, index) => ({
      ...item,
      image_url: firstImage.get(productIdOf(items[index]) ?? "") ?? null,
    }));
  }
  return { quote };
}

export const getPublicFreight = createServerFn({ method: "GET" })
  .inputValidator((token: string) => String(token))
  .handler(async ({ data: token }) => loadPublicFreight(token));
