import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { AdminEditBar } from "@/components/admin-edit-bar";
import {
  ProductFilters,
  applyFilters,
  priceFromOf,
  type FilterState,
  DEFAULT_FILTERS,
} from "@/components/product-filters";
import {
  fetchCategories,
  fetchProductsWithSizes,
  categorySlug,
} from "@/lib/products";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const categories = await fetchCategories();
    const category = categories.find((c) => categorySlug(c) === params.slug);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.category} — Arteno`
          : "Categoria — Arteno",
      },
      {
        name: "description",
        content: loaderData
          ? `Confira nossa seleção de ${loaderData.category.toLowerCase()} com design contemporâneo.`
          : "Categoria não encontrada.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.category} — Arteno` : "Categoria — Arteno",
      },
      ...(loaderData
        ? [{ property: "og:url", content: absoluteUrl(`/categoria/${categorySlug(loaderData.category)}`) }]
        : []),
    ],
    links: loaderData
      ? [{ rel: "canonical", href: absoluteUrl(`/categoria/${categorySlug(loaderData.category)}`) }]
      : [],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">
        Categoria não encontrada
      </h1>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">
        Erro ao carregar produtos
      </h1>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "by-category-full", category],
    queryFn: () => fetchProductsWithSizes({ category }),
    staleTime: 60_000,
  });

  const filtered = useMemo(
    () => applyFilters(products, filters),
    [products, filters],
  );

  const heroImage = products[0]?.images?.[0];

  return (
    <>
      <AdminEditBar label="Editar categorias" to="/dashboard/categorias" />
      <PageHero
        title={category}
        eyebrow="Categoria"
        count={filtered.length}
        crumbs={[
          { label: "Home", to: "/" },
          { label: category },
        ]}
        image={heroImage}
      />
      <section className="bg-white py-12 sm:py-16">
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
              Nenhum produto encontrado com esses filtros.
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-3">
              {filtered.map((p, i) => (
                <ProductCard index={i}
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
