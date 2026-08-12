import { supabase } from "@/integrations/supabase/client";
import { buildCatalogPDF, fetchCatalogSnapshot, type CatalogVariant } from "@/lib/pdf-generator";

const BUCKET = "catalog-media";
const CATALOG_LAYOUT_VERSION = "v5";
const PATHS: Record<CatalogVariant, string> = {
  standard: `generated/${CATALOG_LAYOUT_VERSION}/catalogo-arteno.pdf`,
  professional: `generated/${CATALOG_LAYOUT_VERSION}/catalogo-arteno-profissional.pdf`,
  reseller: `generated/${CATALOG_LAYOUT_VERSION}/catalogo-arteno-revendedor.pdf`,
};

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

function saveBlob(blob: Blob, variant: CatalogVariant) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    variant === "reseller"
      ? "catalogo-arteno-revendedor.pdf"
      : variant === "professional"
        ? "catalogo-arteno-profissional.pdf"
        : "catalogo-arteno.pdf";
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

export function refreshPreparedCatalogs() {
  return regenerateCatalogCache();
}
