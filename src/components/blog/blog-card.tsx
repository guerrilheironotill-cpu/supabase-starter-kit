import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatPostDate, readingMinutes, type BlogPost } from "@/lib/blog";

/** Post card shared by the home section and the blog index. */
export function BlogCard({ post, priority = false }: { post: BlogPost; priority?: boolean }) {
  return (
    <article className="group">
      <Link to="/blog/$slug" params={{ slug: post.slug }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-white ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-sm">
          <img
            src={post.cover.src}
            alt={post.cover.alt}
            width={800}
            height={600}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {post.category}
          </span>
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-primary sm:text-2xl">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-primary/70">{post.excerpt}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-primary/60">
          <span>
            {formatPostDate(post.publishedAt)} · {readingMinutes(post)} min de leitura
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            Ler artigo <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
