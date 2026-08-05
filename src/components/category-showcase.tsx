import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categorySlug } from "@/lib/products";

const CATEGORIES = ["Bancos", "Mesas"] as const;

type CategoryCard = {
  name: string;
  slug: string;
  count: number;
  image: string | null;
};

async function fetchCategoryCards(): Promise<CategoryCard[]> {
  const { data, error } = await supabase
    .from("products")
    .select("category, images")
    .in("category", [...CATEGORIES])
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return CATEGORIES.map((name) => {
    const products = (data ?? []).filter((product) => product.category === name);
    const image = products.find((product) => product.images?.[0])?.images?.[0] ?? null;
    return { name, slug: categorySlug(name), count: products.length, image };
  });
}

export function CategoryShowcase() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["products", "home-category-showcase"],
    queryFn: fetchCategoryCards,
    staleTime: 60_000,
  });

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">
          Outros produtos
        </h2>
        <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6 md:grid-cols-2">
          {isLoading
            ? CATEGORIES.map((name) => <div key={name} className="h-[250px] animate-pulse rounded-2xl bg-primary/5" />)
            : data.map((category) => (
                <Link
                  key={category.slug}
                  to="/categoria/$slug"
                  params={{ slug: category.slug }}
                  className="group relative h-[250px] overflow-hidden rounded-2xl bg-primary"
                >
                  {category.image ? (
                    <img
                      src={category.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-primary/80" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-40 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="absolute bottom-6 left-6 translate-y-6 text-white opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
                    <h3 className="font-display text-3xl font-semibold">{category.name}</h3>
                    <p className="mt-1 text-sm text-white/75">
                      {category.count} {category.count === 1 ? "produto" : "produtos"}
                    </p>
                  </div>
                  <span className="absolute bottom-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
