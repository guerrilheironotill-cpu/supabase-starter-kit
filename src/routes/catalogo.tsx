import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import {
  ProductFilters,
  applyFilters,
  priceFromOf,
  DEFAULT_FILTERS,
  type FilterState,
} from "@/components/product-filters";
import { fetchProductsWithSizes } from "@/lib/products";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Casa & Jardim" },
      {
        name: "description",
        content:
          "Explore o catálogo completo de vasos e peças de concreto autoral.",
      },
      { property: "og:title", content: "Catálogo — Casa & Jardim" },
      {
        property: "og:description",
        content: "Catálogo completo de vasos e peças de concreto autoral.",
      },
    ],
  }),
  component: CatalogoPage,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">
        Erro ao carregar catálogo
      </h1>
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

function CatalogoPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "catalogo"],
    queryFn: () => fetchProductsWithSizes({}),
    staleTime: 60_000,
  });

  const filtered = useMemo(
    () => applyFilters(products, filters),
    [products, filters],
  );

  return (
    <>
      <PageHero
        title="Catálogo"
        eyebrow="Todas as peças"
        count={filtered.length}
        crumbs={[
          { label: "Home", to: "/" },
          { label: "Catálogo" },
        ]}
      />
      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <ProductFilters
            products={products}
            value={filters}
            onChange={setFilters}
          />
          {isLoading ? (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-2xl bg-white/60"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="mt-16 text-center text-primary/70">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  priceFrom={priceFromOf(p)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
