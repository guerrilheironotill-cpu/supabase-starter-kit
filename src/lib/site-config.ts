// Central place for site-wide config. When we wire the Supabase-backed
// site_settings table, this constant becomes the fallback.
export const WHATSAPP_NUMBER = "5548988486279";

export function whatsappLink(text?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}