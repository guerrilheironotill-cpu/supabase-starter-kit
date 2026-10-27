import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight, MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogContent, renderInline } from "@/components/blog/blog-content";
import { BlogGate } from "@/components/blog/blog-gate";
import {
  BLOG_POSTS,
  formatPostDate,
  getBlogPost,
  headingId,
  plainText,
  readingMinutes,
  type BlogPost,
} from "@/lib/blog";
import { BLOG_PUBLIC } from "@/lib/feature-flags";
import { SITE_NAME, absoluteUrl, whatsappLink } from "@/lib/site-config";

function articleStructuredData(post: BlogPost) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.metaDescription,
      image: [absoluteUrl(post.cover.src)],
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      keywords: post.keywords.join(", "),
      inLanguage: "pt-BR",
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: { "@type": "ImageObject", url: absoluteUrl("/images/logo-arteno-header-site.svg") },
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (post.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: plainText(item.answer) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};
    const url = absoluteUrl(`/blog/${post.slug}`);
    const title = `${post.title} — Arteno`;
    return {
      meta: [
        { title },
        { name: "description", content: post.metaDescription },
        { name: "keywords", content: post.keywords.join(", ") },
        ...(BLOG_PUBLIC ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: absoluteUrl(post.cover.src) },
        { property: "article:published_time", content: post.publishedAt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.metaDescription },
        { name: "twitter:image", content: absoluteUrl(post.cover.src) },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(articleStructuredData(post)) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-primary">
      <h1 className="font-display text-3xl">Post não encontrado</h1>
      <Link to="/blog" className="mt-6 inline-block font-semibold underline underline-offset-4">
        Ver todos os posts
      </Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const related = BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 3);
  const toc = post.body.filter((block) => block.type === "h2");

  return (
    <BlogGate>
      <main className="bg-background text-primary">
        <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="text-xs text-primary/70">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link to="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <li>
                <Link to="/blog" className="hover:text-primary">
                  Blog
                </Link>
              </li>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <li className="text-primary">{post.category}</li>
            </ol>
          </nav>

          <header className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/60">
              {post.category}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.08] sm:text-5xl">{post.title}</h1>
            <p className="mt-4 text-sm text-primary/60">
              {formatPostDate(post.publishedAt)} · {readingMinutes(post)} min de leitura
            </p>
          </header>

          <img
            src={post.cover.src}
            alt={post.cover.alt}
            width={1200}
            height={800}
            fetchPriority="high"
            className="mt-8 aspect-[3/2] w-full rounded-3xl object-cover"
          />
          {post.cover.credit && (
            <p className="mt-2 text-right text-xs text-primary/50">{post.cover.credit}</p>
          )}

          <p className="mt-8 text-lg leading-relaxed text-primary/85">{post.excerpt}</p>

          {toc.length > 2 && (
            <nav aria-label="Neste artigo" className="mt-8 border border-primary/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/60">
                Neste artigo
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {toc.map((block) => (
                  <li key={block.text}>
                    <a
                      href={`#${headingId(block.text)}`}
                      className="text-primary underline decoration-primary/20 underline-offset-4 hover:decoration-primary"
                    >
                      {block.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="mt-10">
            <BlogContent blocks={post.body} />
          </div>

          <aside className="mt-12 rounded-3xl bg-primary p-8 text-center text-primary-foreground">
            <h2 className="font-display text-2xl sm:text-3xl">
              Quer peças de concreto para o seu projeto?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/80">
              Veja o catálogo e monte seu orçamento, ou fale com a nossa equipe.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/catalogo"
                className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Ver catálogo
              </Link>
              <a
                href={whatsappLink(`Olá! Li o artigo "${post.title}" e gostaria de um orçamento.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            </div>
          </aside>

          {post.faq.length > 0 && (
            <section className="mt-14" aria-labelledby="blog-faq-title">
              <h2 id="blog-faq-title" className="font-display text-2xl sm:text-3xl">
                Dúvidas frequentes
              </h2>
              <Accordion type="single" collapsible className="mt-5 border-t border-primary/15">
                {post.faq.map((item, index) => (
                  <AccordionItem
                    key={item.question}
                    value={`faq-${index}`}
                    className="border-primary/15"
                  >
                    <AccordionTrigger className="py-5 text-left text-base text-primary hover:no-underline sm:text-lg">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 pr-8 text-sm leading-7 text-[#555b57] sm:text-base">
                      {renderInline(item.answer)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
        </article>

        {related.length > 0 && (
          <section className="border-t border-primary/10 bg-[#f5f6f2] py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <h2 className="font-display text-2xl sm:text-3xl">Continue lendo</h2>
              <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <BlogCard key={item.slug} post={item} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </BlogGate>
  );
}
