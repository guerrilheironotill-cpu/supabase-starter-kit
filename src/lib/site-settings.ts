import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_NUMBER as FALLBACK } from "./site-config";

export type SiteSettings = {
  id: string;
  whatsapp_number: string;
};

async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase
    .from("site_settings" as never)
    .select("id, whatsapp_number")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as SiteSettings | null) ?? null;
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60_000,
  });
}

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

export function useWhatsAppNumber(): string {
  const { data } = useSiteSettings();
  return digitsOnly(data?.whatsapp_number || FALLBACK);
}

export function whatsappLinkFrom(number: string, text?: string) {
  const base = `https://web.whatsapp.com/send?phone=${digitsOnly(number)}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}
