import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_SITE_TITLE =
  "Arteno - Vasos de concreto e mobiliário estilo industrial";
export const DEFAULT_SITE_DESCRIPTION =
  "Peças artesanais em concreto e mobiliário estilo industrial com design autoral.";

type SiteSeoState = {
  title: string;
  description: string;
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
};

export const useSiteSeoStore = create<SiteSeoState>()(
  persist(
    (set) => ({
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      setTitle: (title) => set({ title }),
      setDescription: (description) => set({ description }),
    }),
    { name: "arteno-site-seo" },
  ),
);

export function useApplySiteSeo() {
  const title = useSiteSeoStore((s) => s.title);
  const description = useSiteSeoStore((s) => s.description);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (title) document.title = title;
    const setMeta = (selector: string, content: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute("content", content);
    };
    if (description) setMeta('meta[name="description"]', description);
    if (title) {
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[property="og:site_name"]', title.split(" - ")[0] || title);
    }
    if (description) setMeta('meta[property="og:description"]', description);
  }, [title, description]);
}