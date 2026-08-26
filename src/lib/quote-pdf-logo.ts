const QUOTE_LOGO_PATH = "/images/logo-arteno-header-site.svg";

let cachedLogoDataUrl: string | null = null;

export async function getQuoteLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  const response = await fetch(QUOTE_LOGO_PATH);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o logo (${response.status})`);
  }

  const svg = await response.text();
  cachedLogoDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return cachedLogoDataUrl;
}
