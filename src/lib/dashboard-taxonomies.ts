import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/products";

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
};

export type CategoryTerm = {
  id: string | null;
  slug: string;
  name: string;
  cover_image: string | null;
  icon_svg: string | null;
  count: number;
};

export type AttributeTerm = {
  name: string;
  image_url: string | null;
  gallery: string[];
  description: string | null;
  count: number;
};

function isOptionalMetadataError(error: SupabaseError | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    msg.includes("schema cache") ||
    msg.includes("Could not find") ||
    msg.includes("does not exist")
  );
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 ? name : null;
}

export async function fetchCategoryTerms(): Promise<CategoryTerm[]> {
  const [{ data: products, error: productsError }, { data: baseCategories, error: baseError }] =
    await Promise.all([
      supabase.from("products").select("category"),
      supabase.from("categories").select("id, slug, name, sort_order"),
    ]);

  if (productsError) throw productsError;
  if (baseError && !isOptionalMetadataError(baseError)) throw baseError;

  const metadata = await supabase
    .from("categories")
    .select("slug, name, cover_image, icon_svg");
  if (metadata.error && !isOptionalMetadataError(metadata.error)) throw metadata.error;

  const counts = new Map<string, number>();
  for (const product of products ?? []) {
    const name = cleanName((product as { category?: unknown }).category);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const metaBySlug = new Map<
    string,
    { cover_image: string | null; icon_svg: string | null }
  >();
  if (!metadata.error) {
    for (const row of metadata.data ?? []) {
      const item = row as {
        slug?: string | null;
        name?: string | null;
        cover_image?: string | null;
        icon_svg?: string | null;
      };
      const key = item.slug || (item.name ? slugify(item.name) : null);
      if (!key) continue;
      metaBySlug.set(key, {
        cover_image: item.cover_image ?? null,
        icon_svg: item.icon_svg ?? null,
      });
    }
  }

  const terms = new Map<string, CategoryTerm & { sort_order: number }>();

  for (const row of baseCategories ?? []) {
    const item = row as {
      id: string;
      slug: string | null;
      name: string;
      sort_order: number | null;
    };
    const name = cleanName(item.name);
    if (!name) continue;
    const slug = item.slug || slugify(name);
    const meta = metaBySlug.get(slug);
    terms.set(slug, {
      id: item.id,
      slug,
      name,
      cover_image: meta?.cover_image ?? null,
      icon_svg: meta?.icon_svg ?? null,
      count: counts.get(name) ?? 0,
      sort_order: item.sort_order ?? 999,
    });
  }

  for (const [name, count] of counts) {
    const slug = slugify(name);
    const existing = terms.get(slug);
    const meta = metaBySlug.get(slug);
    terms.set(slug, {
      id: existing?.id ?? null,
      slug,
      name: existing?.name ?? name,
      cover_image: existing?.cover_image ?? meta?.cover_image ?? null,
      icon_svg: existing?.icon_svg ?? meta?.icon_svg ?? null,
      count,
      sort_order: existing?.sort_order ?? 999,
    });
  }

  return Array.from(terms.values())
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(({ sort_order: _sortOrder, ...term }) => term);
}

export async function fetchProductCategoryOptions(): Promise<Array<{ id: string; name: string; slug: string }>> {
  const terms = await fetchCategoryTerms();
  return terms.map((term) => ({
    id: term.id ?? term.slug,
    name: term.name,
    slug: term.slug,
  }));
}

export async function fetchAttributeTerms(
  relationTable: "product_finishes" | "product_colors",
  catalogTable: "finish_catalog" | "color_catalog",
): Promise<AttributeTerm[]> {
  const rows = await supabase.from(relationTable).select("name");
  if (rows.error) throw rows.error;

  const catalog = await supabase
    .from(catalogTable)
    .select("name, image_url, gallery, description");
  if (catalog.error && !isOptionalMetadataError(catalog.error)) throw catalog.error;

  const counts = new Map<string, number>();
  for (const row of rows.data ?? []) {
    const name = cleanName((row as { name?: unknown }).name);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const meta = new Map<
    string,
    { image_url: string | null; gallery: string[]; description: string | null }
  >();
  if (!catalog.error) {
    for (const row of catalog.data ?? []) {
      const item = row as {
        name?: string | null;
        image_url?: string | null;
        gallery?: string[] | null;
        description?: string | null;
      };
      const name = cleanName(item.name);
      if (!name) continue;
      meta.set(name, {
        image_url: item.image_url ?? null,
        gallery: item.gallery ?? [],
        description: item.description ?? null,
      });
    }
  }

  return Array.from(counts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const item = meta.get(name);
      return {
        name,
        image_url: item?.image_url ?? null,
        gallery: item?.gallery ?? [],
        description: item?.description ?? null,
        count: counts.get(name) ?? 0,
      };
    });
}