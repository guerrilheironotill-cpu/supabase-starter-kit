import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchProductsByCategory, type Product } from "@/lib/products";

type ProductGridProps = {
  title: string;
  category: string;
  limit?: number;
};

export function ProductGrid({ title, category, limit = 8 }: ProductGridProps) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "by-category", category, limit],
    queryFn: () => fetchProductsByCategory(category, limit),
    staleTime: 60_000,
  });

  return (
    <section className="bg-[#eaf3dd] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">
          {title}
        </h2>
        {isLoading ? (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: limit }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-2xl bg-white/60"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="mt-10 text-center text-primary/70">
            Nenhum produto encontrado.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-3">
            {products.map((p: Product) => (
            <Link
              key={p.id}
              to="/produto/$slug"
              params={{ slug: p.slug }}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-primary/5" />
                )}
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-primary/70 via-primary/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-6">
                  <span className="pointer-events-auto translate-y-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-lg transition-transform duration-300 group-hover:translate-y-0 sm:text-sm">
                    Ver produto
                  </span>
                </div>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-primary sm:text-xl">
                {p.name}
              </h3>
            </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}