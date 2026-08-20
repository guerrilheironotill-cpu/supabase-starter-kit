// Central place for site-wide config. When we wire the Supabase-backed
// site_settings table, this constant becomes the fallback.
export const WHATSAPP_NUMBER = "5548988486279";
export const APP_ENV = import.meta.env.VITE_APP_ENV || "local";
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
export const SITE_NAME = "Arteno";
export const IS_STAGING = APP_ENV === "staging";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function whatsappLink(text?: string) {
  const base = `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}
