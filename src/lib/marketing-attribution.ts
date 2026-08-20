export type MarketingAttribution = {
  channel: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  landingPage: string;
  referrer: string;
  clickId: string;
  capturedAt: string;
};

const STORAGE_KEY = "arteno:first-touch-attribution";
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function classify(url: URL, referrer: string) {
  const source = (url.searchParams.get("utm_source") ?? "").toLowerCase();
  const medium = (url.searchParams.get("utm_medium") ?? "").toLowerCase();
  const referrerHost = hostname(referrer);
  if (url.searchParams.has("gclid") || (source.includes("google") && /cpc|paid|ppc/.test(medium)))
    return "google_ads";
  if (source.includes("instagram") || referrerHost.includes("instagram.com")) return "instagram";
  if (
    url.searchParams.has("fbclid") ||
    source.includes("facebook") ||
    source === "fb" ||
    referrerHost.includes("facebook.com")
  )
    return "facebook";
  if (source.includes("google") || referrerHost.includes("google.")) return "google_organic";
  if (source.includes("bing") || referrerHost.includes("bing.com")) return "bing_organic";
  if (/social|social-network|social-media/.test(medium)) return "redes_sociais";
  if (source) return source.replace(/[^a-z0-9_-]+/g, "_").slice(0, 50);
  if (referrerHost && referrerHost !== url.hostname.replace(/^www\./, "").toLowerCase())
    return "referencia";
  return "direto";
}

function readStored(): MarketingAttribution | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as MarketingAttribution;
    const age = Date.now() - Date.parse(parsed?.capturedAt ?? "");
    return parsed?.channel && Number.isFinite(age) && age < MAX_AGE ? parsed : null;
  } catch {
    return null;
  }
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/dashboard")) return;
  if (readStored()) return;
  const url = new URL(window.location.href);
  const attribution: MarketingAttribution = {
    channel: classify(url, document.referrer),
    source: url.searchParams.get("utm_source") ?? "",
    medium: url.searchParams.get("utm_medium") ?? "",
    campaign: url.searchParams.get("utm_campaign") ?? "",
    term: url.searchParams.get("utm_term") ?? "",
    content: url.searchParams.get("utm_content") ?? "",
    landingPage: `${url.pathname}${url.search}`.slice(0, 1000),
    referrer: document.referrer.slice(0, 1000),
    clickId: (url.searchParams.get("gclid") ?? url.searchParams.get("fbclid") ?? "").slice(0, 500),
    capturedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Attribution must never prevent navigation or quote submission.
  }
}

export function getMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") return null;
  captureMarketingAttribution();
  return readStored();
}
