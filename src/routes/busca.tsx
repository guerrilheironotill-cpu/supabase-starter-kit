import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { priceFromOf } from "@/components/product-filters";
import { fetchProductsWithSizes } from "@/lib/products";

const searchSchema = z.object({
  q: z.string().catch("").default(""),
});

export const Route = createFileRoute("/busca")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Busca — Casa & Jardim" },
      { name: "description", content: "Encontre produtos por nome." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">Erro na busca</h1>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  ),
  notFoundComponent: () => null,
});

function SearchPage() {
  const { q } = Route.useSearch();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "search", q],
    queryFn: () => fetchProductsWithSizes({ search: q }),
    enabled: q.length > 0,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHero
        eyebrow="Busca"
        count={q ? products.length : undefined}
        crumbs={[
          { label: "Home", to: "/" },
          { label: q ? `Resultados para "${q}"` : "Busca" },
        ]}
      />
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {!q ? (
            <p className="text-center text-primary/70">
              Digite um termo na busca no topo da página.
            </p>
          ) : (
            <>
              {isLoading ? (
                <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-2xl bg-white/60"
                    />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="mt-16 text-center text-primary/70">
                  Nenhum produto encontrado para “{q}”.
                </p>
              ) : (
                <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      priceFrom={priceFromOf(p)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}