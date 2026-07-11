import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  images: string[];
};

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