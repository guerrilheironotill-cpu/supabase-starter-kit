import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/products";

type Props = {
  product: Product;
  priceFrom?: number | null;
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ProductCard({ product, priceFrom }: Props) {
  const img = product.images?.[0];
  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-primary/5" />
        )}
        <span
          aria-label="Ver produto"
          className="pointer-events-none absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 group-hover:bg-primary group-hover:text-primary-foreground"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-primary sm:text-xl">
        {product.name}
      </h3>
      {typeof priceFrom === "number" && (
        <p className="mt-1 text-sm text-primary/70">
          A partir de{" "}
          <span className="font-semibold text-primary">
            {formatBRL(priceFrom)}
          </span>
        </p>
      )}
    </Link>
  );
}