import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { BlogCard } from "@/components/blog/blog-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { latestBlogPosts } from "@/lib/blog";
import { useBlogAccess } from "@/lib/use-blog-access";

/** Latest posts on the home page, with a button to the full blog. */
export function HomeLatestPosts() {
  const { visible, adminOnly } = useBlogAccess();
  const posts = latestBlogPosts(3);
  if (!visible || posts.length === 0) return null;

  return (
    <section className="bg-background py-16 sm:py-20">
      <ScrollReveal className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
              Blog
              {adminOnly && (
                <span
                  title="Visível só para administradores até ser publicado"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-950"
                >
                  <Lock className="h-3 w-3" />
                  SÓ ADMIN
                </span>
              )}
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-primary sm:text-4xl">
              Últimos posts
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Ver todos os posts
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
