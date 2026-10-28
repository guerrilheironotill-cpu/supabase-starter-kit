import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentPrice, formatBRL } from "@/lib/products";

type SpotlightProduct = {
  slug: string;
  name: string;
  images: string[] | null;
  product_sizes: Array<{ base_price: number; sale_price: number | null }> | null;
};

/**
 * A catalog product featured inside a post. It is found by name at view time, so the photo,
 * price and link always match the catalog; if it is not found, a plain link is shown instead.
 */
export function ProductSpotlight({
  search,
  title,
  text,
  fallbackHref,
  fallbackLabel,
}: {
  search: string;
  title: string;
  text: string;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const { data: product } = useQuery({
    queryKey: ["blog-product-spotlight", search],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("slug, name, images, product_sizes(base_price, sale_price)")
        .eq("active", true)
        .ilike("name", `%${search}%`)
        .limit(1);
      return ((data ?? []) as unknown as SpotlightProduct[])[0] ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const image = product?.images?.find(Boolean);
  const prices = (product?.product_sizes ?? [])
    .filter((size) => Number(size.base_price) > 0)
    .map((size) => currentPrice(size));
  const from = prices.length ? Math.min(...prices) : null;

  return (
    <div className="my-2 overflow-hidden rounded-3xl border border-primary/10 bg-white sm:grid sm:grid-cols-[2fr_3fr]">
      {image ? (
        <img
          src={image}
          alt={product?.name ?? title}
          width={480}
          height={480}
          loading="lazy"
          className="aspect-square h-full w-full object-cover"
        />
      ) : null}
      <div className="flex flex-col justify-center p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/55">
          Na prática
        </p>
        <p className="mt-2 font-display text-2xl leading-tight text-primary">{title}</p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-primary/80">{text}</p>
        {product ? (
          <>
            {from !== null && (
              <p className="mt-3 text-sm font-semibold text-primary">
                A partir de {formatBRL(from)}
              </p>
            )}
            <Link
              to="/produto/$slug"
              params={{ slug: product.slug }}
              search={{ tamanho: undefined }}
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Ver {product.name}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <Link
            to={fallbackHref as never}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {fallbackLabel}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
