import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Flower2, Sprout, Armchair, Palette } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import {
  fetchCategories,
  fetchProductsWithSizes,
  slugify,
} from "@/lib/products";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/lib/site-config";

const CATEGORY_ICONS: Record<string, typeof Flower2> = {
  vasos: Flower2,
  jardineiras: Sprout,
  "outros-produtos": Armchair,
  mesas: Armchair,
  bancos: Armchair,
  fontes: Sprout,
  cubas: Sprout,
  acabamentos: Palette,
};

const HIDDEN_CATALOG_FILTERS = new Set([
  "outros-produtos",
  "produtos-em-destaque",
]);

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de vasos e peças de concreto — Arteno" },
      {
        name: "description",
        content:
          "Explore o catálogo completo de vasos e peças de concreto autoral.",
      },
      { property: "og:title", content: "Catálogo de vasos e peças de concreto — Arteno" },
      {
        property: "og:description",
        content: "Catálogo completo de vasos e peças de concreto autoral.",
      },
      { property: "og:url", content: absoluteUrl("/catalogo") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/catalogo") }],
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "catalogo"],
    queryFn: () => fetchProductsWithSizes({}),
    staleTime: 60_000,
  });

  const { data: siteCategories = [] } = useQuery({
    queryKey: ["categories", "catalogo"],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });

  const categories = useMemo(
    () =>
      siteCategories
        .filter((category) => !HIDDEN_CATALOG_FILTERS.has(slugify(category)))
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [siteCategories],
  );

  const filtered = useMemo(
    () =>
      selectedCategories.length === 0
        ? products
        : products.filter((product) =>
            selectedCategories.includes(product.category),
          ),
    [products, selectedCategories],
  );

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  const heroImage = products[0]?.images?.[0];

  return (
    <>
      <PageHero
        title="Catálogo"
        eyebrow="Todos os modelos"
        count={filtered.length}
        crumbs={[
          { label: "Home", to: "/" },
          { label: "Catálogo" },
        ]}
        image={heroImage}
      />

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {categories.length > 0 && (
            <div
              className="-mt-[30px] flex flex-wrap items-center justify-center gap-3"
              aria-label="Filtrar produtos por categoria"
            >
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[slugify(category)] ?? Flower2;
                return (
                  <CategoryChip
                    key={category}
                    icon={Icon}
                    label={category}
                    active={selectedCategories.includes(category)}
                    onClick={() => toggleCategory(category)}
                  />
                );
              })}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-primary/60">
            {selectedCategories.length === 0
              ? "Exibindo todos os produtos"
              : `${selectedCategories.length} ${selectedCategories.length === 1 ? "categoria selecionada" : "categorias selecionadas"}`}
          </p>

          {isLoading ? (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse bg-primary/5"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="mt-16 text-center text-primary/70">
              Nenhum produto encontrado nessas categorias.
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-3">
              {filtered.map((product, index) => (
                <ProductCard
                  index={index}
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function CategoryChip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Flower2;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-primary/20 bg-white text-primary hover:border-primary/50",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
