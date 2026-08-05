const CATALOG_PDF_PENDING_KEY = "arteno:catalog-pdf-update-pending";
const LEGACY_FINISHES_PENDING_KEY = "arteno:finishes-pdf-update-pending";

export function isCatalogPdfPending() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CATALOG_PDF_PENDING_KEY) === "true"
    || localStorage.getItem(LEGACY_FINISHES_PENDING_KEY) === "true";
}

export function markCatalogPdfPending() {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATALOG_PDF_PENDING_KEY, "true");
}

export function clearCatalogPdfPending() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CATALOG_PDF_PENDING_KEY);
  localStorage.removeItem(LEGACY_FINISHES_PENDING_KEY);
}

