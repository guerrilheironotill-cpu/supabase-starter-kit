import { gfrcVsConcretoComum } from "@/content/blog/gfrc-x-concreto-comum";
import { mobiliarioEmConcretoGfrc } from "@/content/blog/mobiliario-em-concreto-gfrc";
import { comoEscolherOTamanhoDoVaso } from "@/content/blog/como-escolher-o-tamanho-do-vaso";

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
  | { type: "image"; src: string; alt: string; caption?: string };

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
      if (block.type === "image") return [];
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
