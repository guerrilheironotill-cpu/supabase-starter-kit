import { createFileRoute, Link } from "@tanstack/react-router";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogGate } from "@/components/blog/blog-gate";
import { PageHero } from "@/components/page-hero";
import { BLOG_POSTS, blogCategories } from "@/lib/blog";
import { BLOG_PUBLIC } from "@/lib/feature-flags";
import { absoluteUrl } from "@/lib/site-config";

const TITLE = "Blog — Arteno | Concreto, vasos e mobiliário";
const DESCRIPTION =
  "Guias e dicas sobre vasos, jardineiras, mesas, bancos e peças em concreto: materiais, cuidados, tamanhos e ideias para o seu projeto.";

export const Route = createFileRoute("/blog/")({
  validateSearch: (search: Record<string, unknown>) => ({
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      ...(BLOG_PUBLIC ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/blog") },
      {
        property: "og:image",
        content: absoluteUrl(BLOG_POSTS[0]?.cover.src ?? "/images/og-arteno.jpg"),
      },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/blog") }],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { categoria } = Route.useSearch();
  const categories = blogCategories();
  const active = categories.find((category) => category.slug === categoria);
  const posts = active ? BLOG_POSTS.filter((post) => post.category === active.name) : BLOG_POSTS;
  const chip = (isActive: boolean) =>
    `rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-primary/20 text-primary hover:border-primary/50"
    }`;
  return (
    <BlogGate>
      <main className="bg-background text-primary">
        <PageHero
          eyebrow="Blog"
          title="Concreto, vasos e mobiliário"
          crumbs={[{ label: "Home", to: "/" }, { label: "Blog" }]}
        />
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 2xl:max-w-[96rem]">
          <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-primary/75 sm:text-lg">
            Guias práticos sobre materiais, tamanhos, cuidados e ideias para usar peças de concreto
            no seu espaço.
          </p>
          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Categorias">
              <Link to="/blog" search={{ categoria: undefined }} className={chip(!active)}>
                Todos
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  to="/blog"
                  search={{ categoria: category.slug }}
                  className={chip(active?.slug === category.slug)}
                >
                  {category.name} ({category.count})
                </Link>
              ))}
            </div>
          )}
          {posts.length === 0 ? (
            <p className="mt-12 text-center text-primary/60">Em breve, novos posts por aqui.</p>
          ) : (
            <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {posts.map((post, index) => (
                <BlogCard key={post.slug} post={post} priority={index < 3} />
              ))}
            </div>
          )}
        </section>
      </main>
    </BlogGate>
  );
}
