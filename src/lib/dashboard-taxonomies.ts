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
  video_url: string | null;
  extra_price: number;
  count: number;
  sort_order: number;
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

  const metadata = await supabase.from("categories").select("slug, name, cover_image, icon_svg");
  if (metadata.error && !isOptionalMetadataError(metadata.error)) throw metadata.error;

  const counts = new Map<string, number>();
  for (const product of products ?? []) {
    const name = cleanName((product as { category?: unknown }).category);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const metaBySlug = new Map<string, { cover_image: string | null; icon_svg: string | null }>();
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

  const baseBySlug = new Map<string, { id: string; name: string; sort_order: number }>();
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
    baseBySlug.set(slug, {
      id: item.id,
      name,
      sort_order: item.sort_order ?? 999,
    });
  }

  for (const [name, count] of counts) {
    const slug = slugify(name);
    const base = baseBySlug.get(slug);
    const meta = metaBySlug.get(slug);
    terms.set(slug, {
      id: base?.id ?? null,
      slug,
      name: base?.name ?? name,
      cover_image: meta?.cover_image ?? null,
      icon_svg: meta?.icon_svg ?? null,
      count,
      sort_order: base?.sort_order ?? 999,
    });
  }

  // Include categories that exist in the catalog but have no products yet
  for (const [slug, base] of baseBySlug) {
    if (terms.has(slug)) continue;
    const meta = metaBySlug.get(slug);
    terms.set(slug, {
      id: base.id,
      slug,
      name: base.name,
      cover_image: meta?.cover_image ?? null,
      icon_svg: meta?.icon_svg ?? null,
      count: 0,
      sort_order: base.sort_order,
    });
  }

  return Array.from(terms.values())
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(({ sort_order: _sortOrder, ...term }) => term);
}

export async function fetchProductCategoryOptions(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
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

  let catalog =
    catalogTable === "finish_catalog"
      ? await supabase
          .from("finish_catalog")
          .select("name, image_url, gallery, description, extra_price, sort_order")
      : await supabase
          .from("color_catalog")
          .select("name, image_url, gallery, description, sort_order");
  if (catalog.error && isOptionalMetadataError(catalog.error)) {
    catalog = (
      catalogTable === "finish_catalog"
        ? await supabase
            .from("finish_catalog")
            .select("name, image_url, gallery, description, extra_price")
        : await supabase.from("color_catalog").select("name, image_url, gallery, description")
    ) as typeof catalog;
  }
  if (catalog.error && isOptionalMetadataError(catalog.error)) {
    catalog = (await supabase
      .from(catalogTable)
      .select("name, image_url, description")) as typeof catalog;
  }
  if (catalog.error && !isOptionalMetadataError(catalog.error)) throw catalog.error;

  const counts = new Map<string, number>();
  for (const row of rows.data ?? []) {
    const name = cleanName((row as { name?: unknown }).name);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const meta = new Map<
    string,
    {
      image_url: string | null;
      gallery: string[];
      description: string | null;
      video_url: string | null;
      extra_price: number;
      sort_order: number;
    }
  >();
  if (!catalog.error) {
    for (const row of catalog.data ?? []) {
      const item = row as {
        name?: string | null;
        image_url?: string | null;
        gallery?: string[] | null;
        description?: string | null;
        extra_price?: number | null;
        sort_order?: number | null;
      };
      const name = cleanName(item.name);
      if (!name) continue;
      const rawGallery = item.gallery ?? [];
      const videoEntry = rawGallery.find((entry) => entry.startsWith("__video__:"));
      meta.set(name, {
        image_url: item.image_url ?? null,
        gallery: rawGallery.filter((entry) => !entry.startsWith("__video__:")),
        description: item.description ?? null,
        video_url: videoEntry ? videoEntry.slice("__video__:".length) : null,
        extra_price: Number(item.extra_price) || 0,
        sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 9999,
      });
      if (!counts.has(name)) counts.set(name, 0);
    }
  }

  return Array.from(counts.keys())
    .sort(
      (a, b) =>
        (meta.get(a)?.sort_order ?? 9999) - (meta.get(b)?.sort_order ?? 9999) || a.localeCompare(b),
    )
    .map((name) => {
      const item = meta.get(name);
      return {
        name,
        image_url: item?.image_url ?? null,
        gallery: item?.gallery ?? [],
        description: item?.description ?? null,
        video_url: item?.video_url ?? null,
        extra_price: item?.extra_price ?? 0,
        count: counts.get(name) ?? 0,
        sort_order: item?.sort_order ?? 9999,
      };
    });
}
