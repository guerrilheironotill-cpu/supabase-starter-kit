import { gfrcVsConcretoComum } from "@/content/blog/gfrc-x-concreto-comum";
import { mobiliarioEmConcretoGfrc } from "@/content/blog/mobiliario-em-concreto-gfrc";
import { comoEscolherOTamanhoDoVaso } from "@/content/blog/como-escolher-o-tamanho-do-vaso";
import { piasECubasDeConcreto } from "@/content/blog/pias-e-cubas-de-concreto";
import { concretoEAco } from "@/content/blog/concreto-e-aco";

/**
 * Text of a block. Inline markup: **bold** and [link text](/internal-path).
 */
export type BlogBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; title: string; text: string }
  | { type: "image"; src: string; alt: string; caption?: string; size?: "small" }
  /** Two or more photos side by side. */
  | { type: "gallery"; images: Array<{ src: string; alt: string }>; caption?: string }
  /** A list where each item has a round photo beside it (e.g. the types of a material). */
  | {
      type: "materials";
      items: Array<{ title: string; text: string; image: string; alt: string }>;
      /** Photo credits, shown small under the list. */
      credit?: string;
    }
  /** A catalog product featured in the post, found by (part of) its name. */
  | {
      type: "product";
      search: string;
      title: string;
      text: string;
      fallbackHref: string;
      fallbackLabel: string;
    };

export type BlogPost = {
  slug: string;
  title: string;
  /** Short summary shown on cards and used as the lead of the article. */
  excerpt: string;
  /** Meta description (aim for up to ~160 characters). */
  metaDescription: string;
  keywords: string[];
  category: string;
  /** ISO date (yyyy-mm-dd). */
  publishedAt: string;
  updatedAt?: string;
  cover: { src: string; alt: string; credit?: string };
  body: BlogBlock[];
  faq: Array<{ question: string; answer: string }>;
};

// Newest first; posts of the same day keep the order they are listed in here.
const ALL_POSTS: BlogPost[] = [
  concretoEAco,
  piasECubasDeConcreto,
  gfrcVsConcretoComum,
  mobiliarioEmConcretoGfrc,
  comoEscolherOTamanhoDoVaso,
];

export const BLOG_POSTS: BlogPost[] = [...ALL_POSTS].sort((a, b) =>
  a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0,
);

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

/** Categories in use, with their URL slug and post count. */
export function blogCategories() {
  const counts = new Map<string, number>();
  for (const post of BLOG_POSTS) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, slug: headingId(name), count }));
}

export function latestBlogPosts(limit = 3): BlogPost[] {
  return BLOG_POSTS.slice(0, limit);
}

/** Anchor id of a heading, shared by the table of contents and the article. */
export function headingId(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Links and bold markers removed: for structured data and word counts. */
export function plainText(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function readingMinutes(post: BlogPost) {
  const words = [
    post.excerpt,
    ...post.body.flatMap((block) => {
      if (block.type === "ul" || block.type === "ol") return block.items;
      if (block.type === "callout") return [block.title, block.text];
      if (block.type === "image" || block.type === "gallery") return [];
      if (block.type === "materials") return block.items.flatMap((item) => [item.title, item.text]);
      if (block.type === "product") return [block.title, block.text];
      return [block.text];
    }),
    ...post.faq.flatMap((item) => [item.question, item.answer]),
  ]
    .map(plainText)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatPostDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
