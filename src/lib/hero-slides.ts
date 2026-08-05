import { supabase } from "@/integrations/supabase/client";

export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export const DEFAULT_SLIDES: HeroSlide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Vasos de concreto",
    title: "Vasos que transformam ambientes",
    description:
      "Peças exclusivas em cimento e fibra, feitas à mão para o seu jardim.",
    ctaLabel: "Ver vasos",
    ctaHref: "/",
  },
  {
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Arquitetos e paisagistas",
    title: "Jardineiras sob medida",
    description:
      "Design contemporâneo e acabamento premium para varandas e áreas externas.",
    ctaLabel: "Explorar jardineiras",
    ctaHref: "/",
  },
  {
    image:
      "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Casa & Jardim",
    title: "Mesas, bancos e fontes",
    description:
      "Mobiliário externo que combina natureza, conforto e sofisticação.",
    ctaLabel: "Outros produtos",
    ctaHref: "/",
  },
];

const BUCKET = "catalog-media";
const PATH = "home/hero-slides.json";

function publicUrl(): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(PATH);
  return data.publicUrl;
}

export async function fetchHeroSlides(): Promise<HeroSlide[]> {
  try {
    const r = await fetch(`${publicUrl()}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return DEFAULT_SLIDES;
    const json = (await r.json()) as HeroSlide[];
    if (!Array.isArray(json) || json.length === 0) return DEFAULT_SLIDES;
    return json;
  } catch {
    return DEFAULT_SLIDES;
  }
}

export async function saveHeroSlides(slides: HeroSlide[]): Promise<void> {
  const blob = new Blob([JSON.stringify(slides, null, 2)], {
    type: "application/json",
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(PATH, blob, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

export async function uploadHeroImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `home/hero-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
