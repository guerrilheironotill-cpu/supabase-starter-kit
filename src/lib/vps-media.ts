import { supabase } from "@/integrations/supabase/client";

export type MediaFolder = "products" | "categories" | "finishes" | "colors" | "banners" | "pages";

export async function uploadOptimizedImage(file: File, folder: MediaFolder): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão administrativa expirada.");

  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const response = await fetch("/api/upload-media", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const result = (await response.json()) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !result.ok || !result.url) {
    throw new Error(result.error ?? `Falha no upload (HTTP ${response.status}).`);
  }
  return result.url;
}
