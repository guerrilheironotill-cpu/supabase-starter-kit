import { supabase } from "@/integrations/supabase/client";
import { uploadOptimizedImage } from "@/lib/vps-media";

export type HomeProject = {
  id: string;
  image: string;
  alt: string;
  sortOrder: number;
  active: boolean;
  productName?: string;
  productUrl?: string;
  location?: string;
  category?: string;
  professional?: string;
  description?: string;
};

const BUCKET = "catalog-media";
const PATH = "home/projects-gallery.json";

function publicUrl() {
  return supabase.storage.from(BUCKET).getPublicUrl(PATH).data.publicUrl;
}

export async function fetchHomeProjects(includeInactive = false): Promise<HomeProject[]> {
  try {
    const response = await fetch(`${publicUrl()}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const value = (await response.json()) as HomeProject[];
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item?.id && item?.image && item?.alt && (includeInactive || item.active))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

export async function saveHomeProjects(items: HomeProject[]) {
  const normalized = items.map((item, index) => ({ ...item, sortOrder: index }));
  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(PATH, blob, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

export function uploadHomeProjectImage(file: File) {
  return uploadOptimizedImage(file, "projects", "story");
}
