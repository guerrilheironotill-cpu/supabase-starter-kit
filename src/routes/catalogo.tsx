import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Flower2, Sprout, Armchair, Palette, LayoutGrid } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { priceFromOf } from "@/components/product-filters";
import { fetchProductsWithSizes, slugify } from "@/lib/products";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "catalogo"],
    queryFn: () => fetchProductsWithSizes({}),
    staleTime: 60_000,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category);
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(
    () => (selected ? products.filter((p) => p.category === selected) : products),
    [products, selected],
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
          {categories.length > 0 && (
            <div className="-mt-[30px] flex flex-wrap items-center justify-center gap-3">
              <CategoryChip
                icon={LayoutGrid}
                label="Todas"
                active={selected === null}
                onClick={() => setSelected(null)}
              />
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[slugify(cat)] ?? Flower2;
                return (
                  <CategoryChip
                    key={cat}
                    icon={Icon}
                    label={cat}
                    active={selected === cat}
                    onClick={() => setSelected(cat)}
                  />
                );
              })}
            </div>
          )}
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
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-primary/20 bg-white text-primary hover:border-primary/50 hover:-translate-y-0.5",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
