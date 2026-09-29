import type { CatalogVariant } from "@/lib/pdf-generator";

export const CATALOG_BUCKET = "catalog-media";
// Bump whenever pdf-generator.ts changes the layout, so stale stored PDFs are ignored.
export const CATALOG_LAYOUT_VERSION = "v7";
export const CATALOG_DIR = `generated/${CATALOG_LAYOUT_VERSION}`;
export const CATALOG_FILES: Record<CatalogVariant, string> = {
  standard: "catalogo-arteno.pdf",
  professional: "catalogo-arteno-profissional.pdf",
  reseller: "catalogo-arteno-revendedor.pdf",
};
export const CATALOG_PATHS: Record<CatalogVariant, string> = {
  standard: `${CATALOG_DIR}/${CATALOG_FILES.standard}`,
  professional: `${CATALOG_DIR}/${CATALOG_FILES.professional}`,
  reseller: `${CATALOG_DIR}/${CATALOG_FILES.reseller}`,
};

/** Public share links: /catalogo/<slug> always redirects to the current stored PDF. */
export const CATALOG_SLUGS: Record<CatalogVariant, string> = {
  standard: "cliente-final",
  professional: "profissional",
  reseller: "revendedor",
};

export function catalogVariantFromSlug(slug: string): CatalogVariant | null {
  const entry = Object.entries(CATALOG_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as CatalogVariant) : null;
}
