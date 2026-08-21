export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_KEY = "arteno-cookie-consent";
export const OPEN_COOKIE_PREFERENCES_EVENT = "arteno:open-cookie-preferences";
export const COOKIE_CONSENT_CHANGE_EVENT = "arteno:cookie-consent-change";

export type CookieConsent = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? "null",
    ) as CookieConsent | null;
    if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function hasCookieConsent(category: "analytics" | "marketing") {
  return readCookieConsent()?.[category] === true;
}

export function saveCookieConsent(
  choices: Pick<CookieConsent, "analytics" | "marketing">,
): CookieConsent {
  const consent: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  applyConsentToLoadedTrackers(consent);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: consent }));
  return consent;
}

function applyConsentToLoadedTrackers(consent: CookieConsent) {
  const trackerWindow = window as Window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  trackerWindow.gtag?.("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
  });
  trackerWindow.fbq?.("consent", consent.marketing ? "grant" : "revoke");
}
