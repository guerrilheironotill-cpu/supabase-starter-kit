import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  images: string[];
  description?: string | null;
};

export function productDescriptionToText(description: string | null | undefined): string {
  if (!description) return "";

  return description
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export type ProductSize = {
  id: string;
  product_id: string;
  name: string;
  /**
   * The original size value imported from WooCommerce CSV.
   * May be identical to `name` but is kept for backward compatibility.
   */
  size?: string;
  base_price: number;
  sale_price: number | null;
  sort_order: number;
};

export type ProductOption = {
  id: string;
  name: string;
  sort_order: number;
};

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Public category URLs may preserve a legacy SEO slug independently of the label. */
export function categorySlug(category: string): string {
  const slug = slugify(category);
  return slug === "vasos" ? "vasos-de-concreto" : slug;
}

export async function fetchProductsByCategory(
  category: string,
  limit = 8,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, category, images")
    .eq("category", category)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, category, images")
    .in("slug", slugs)
    .eq("active", true);
  if (error) throw error;
  const order = new Map(slugs.map((slug, index) => [slug, index]));
  return ((data ?? []) as Product[]).sort(
    (a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999),
  );
}

export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("active", true)
    .not("category", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.category) set.add(r.category);
  }
  return Array.from(set).sort();
}

export type ProductWithSizes = Product & {
  product_sizes: ProductSize[];
  product_finishes?: ProductOption[];
};

async function resolveCategoryBySlug(slugOrName: string): Promise<string | null> {
  const { data } = await supabase
    .from("products")
    .select("category")
    .eq("active", true)
    .not("category", "is", null);
  const normalized = slugify(slugOrName);
  const match = (data ?? [])
    .map((r) => r.category as string)
    .find((c) => c && (slugify(c) === normalized || categorySlug(c) === normalized));
  return match ?? null;
}

export async function fetchProductsWithSizes(params: {
  category?: string;
  search?: string;
}): Promise<ProductWithSizes[]> {
  let q = supabase
    .from("products")
    .select(
      "id, slug, name, category, images, description, product_sizes(id, product_id, name, size, base_price, sale_price, sort_order), product_finishes(id, name, sort_order)",
    )
    .eq("active", true);

  if (params.category) {
    const matchedCategory = await resolveCategoryBySlug(params.category);
    if (!matchedCategory) return [];
    q = q.eq("category", matchedCategory);
  }

  if (params.search) q = q.ilike("name", `%${params.search}%`);

  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data ?? []) as ProductWithSizes[];
}

export type ProductDetail = ProductWithSizes & {
  product_finishes: ProductOption[];
  product_colors: ProductOption[];
};

export async function fetchProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, category, images, description, product_sizes(id, product_id, name, size, base_price, sale_price, sort_order), product_finishes(id, name, sort_order), product_colors(id, name, sort_order)",
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductDetail | null) ?? null;
}

export function parseDims(str: string): {
  altura: string;
  largura: string;
  comprimento: string;
} | null {
  // Exemplo: "30x40x50cm" -> { altura: "30cm", largura: "40cm", comprimento: "50cm" }
  const dims = str.match(/(\d+)\D*(\d+)\D*(\d+)\D*/);
  if (!dims) return null;

  return {
    altura: `${dims[1]}cm`,
    largura: `${dims[2]}cm`,
    comprimento: `${dims[3]}cm`,
  };
}
