import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  images: string[];
  description?: string | null;
};

export type ProductSize = {
  id: string;
  product_id: string;
  name: string;
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

export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("active", true);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) set.add((r as { category: string }).category);
  return Array.from(set).sort();
}

export type ProductWithSizes = Product & { product_sizes: ProductSize[] };

export async function fetchProductsWithSizes(params: {
  category?: string;
  search?: string;
}): Promise<ProductWithSizes[]> {
  let q = supabase
    .from("products")
    .select(
      "id, slug, name, category, images, description, product_sizes(id, product_id, name, base_price, sale_price, sort_order)",
    )
    .eq("active", true);

  if (params.category) q = q.eq("category", params.category);
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
      "id, slug, name, category, images, description, product_sizes(id, product_id, name, base_price, sale_price, sort_order), product_finishes(id, name, sort_order), product_colors(id, name, sort_order)",
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductDetail | null) ?? null;
}