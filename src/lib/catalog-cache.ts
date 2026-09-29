import { supabase } from "@/integrations/supabase/client";
import { buildCatalogPDF, fetchCatalogSnapshot, type CatalogVariant } from "@/lib/pdf-generator";
import {
  CATALOG_BUCKET as BUCKET,
  CATALOG_DIR,
  CATALOG_FILES,
  CATALOG_PATHS as PATHS,
  CATALOG_SLUGS,
} from "@/lib/catalog-paths";
import { absoluteUrl } from "@/lib/site-config";
import { slugify } from "@/lib/products";

let activeRegeneration: Promise<void> | null = null;
let rerunRequested = false;

async function uploadCatalog(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "application/pdf",
    cacheControl: "60",
  });
  if (error) throw error;
}

async function regenerateOnce(onProgress?: (percent: number) => void) {
  const snapshot = await fetchCatalogSnapshot();
  const imageCache = new Map<string, Promise<string | null>>();
  const standard = await buildCatalogPDF(
    snapshot,
    "standard",
    (value) => onProgress?.(Math.round(value / 3)),
    imageCache,
  );
  await uploadCatalog(PATHS.standard, standard);
  const professional = await buildCatalogPDF(
    snapshot,
    "professional",
    (value) => onProgress?.(33 + Math.round(value / 3)),
    imageCache,
  );
  await uploadCatalog(PATHS.professional, professional);
  const reseller = await buildCatalogPDF(
    snapshot,
    "reseller",
    (value) => onProgress?.(66 + Math.round(value / 3)),
    imageCache,
  );
  await uploadCatalog(PATHS.reseller, reseller);
  onProgress?.(100);
}

export function regenerateCatalogCache(onProgress?: (percent: number) => void): Promise<void> {
  if (activeRegeneration) {
    rerunRequested = true;
    return activeRegeneration;
  }
  activeRegeneration = (async () => {
    do {
      rerunRequested = false;
      await regenerateOnce(onProgress);
    } while (rerunRequested);
  })().finally(() => {
    activeRegeneration = null;
  });
  return activeRegeneration;
}

async function downloadBlob(variant: CatalogVariant): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(PATHS[variant]);
  if (error) return null;
  return data;
}

function saveBlob(blob: Blob, variant: CatalogVariant, category?: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const base =
    variant === "reseller"
      ? "catalogo-arteno-revendedor"
      : variant === "professional"
        ? "catalogo-arteno-profissional"
        : "catalogo-arteno";
  anchor.download = `${base}${category ? `-${slugify(category)}` : ""}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadPreparedCatalog(
  variant: CatalogVariant,
  onProgress?: (percent: number) => void,
) {
  let blob = await downloadBlob(variant);
  if (!blob) {
    const snapshot = await fetchCatalogSnapshot();
    blob = await buildCatalogPDF(snapshot, variant, onProgress);
    // An anonymous visitor may not have permission to upload. The download
    // must still work; authenticated dashboard updates will prepare both files.
    void uploadCatalog(PATHS[variant], blob).catch((error) => {
      console.warn("Catálogo gerado localmente, mas não armazenado:", error);
    });
  }
  saveBlob(blob, variant);
}

/**
 * Downloads one smaller PDF per selected category, generated fresh each time (these
 * per-category files are not stored). Returns which categories had no priced products
 * and were skipped, so the caller can warn about them.
 */
export async function downloadCatalogsByCategory(
  variant: CatalogVariant,
  categories: string[],
  onProgress?: (
    percent: number,
    current: { index: number; total: number; category: string },
  ) => void,
): Promise<{ skipped: string[] }> {
  const snapshot = await fetchCatalogSnapshot();
  const imageCache = new Map<string, Promise<string | null>>();
  const skipped: string[] = [];
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    if (!snapshot.categories.includes(category)) {
      skipped.push(category);
      continue;
    }
    const info = { index, total: categories.length, category };
    const blob = await buildCatalogPDF(
      snapshot,
      variant,
      (percent) => onProgress?.(Math.round((index * 100 + percent) / categories.length), info),
      imageCache,
      { category },
    );
    saveBlob(blob, variant, category);
  }
  onProgress?.(100, { index: categories.length, total: categories.length, category: "" });
  return { skipped };
}

export function refreshPreparedCatalogs() {
  return regenerateCatalogCache();
}

async function isCatalogStored(variant: CatalogVariant) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(CATALOG_DIR, { search: CATALOG_FILES[variant] });
  if (error) return false;
  return (data ?? []).some((file) => file.name === CATALOG_FILES[variant]);
}

/**
 * Makes sure the current layout of a catalog is stored and returns its public
 * share link (/catalogo/<slug>). Generating and uploading requires an admin session.
 */
export async function preparedCatalogShareUrl(variant: CatalogVariant) {
  if (!(await isCatalogStored(variant))) {
    const snapshot = await fetchCatalogSnapshot();
    const blob = await buildCatalogPDF(snapshot, variant);
    await uploadCatalog(PATHS[variant], blob);
  }
  return absoluteUrl(`/catalogo/${CATALOG_SLUGS[variant]}`);
}
