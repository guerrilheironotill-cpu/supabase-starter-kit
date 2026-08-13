import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type MouseEvent } from "react";
import type { Product } from "@/lib/products";

type Props = {
  product: Product;
  priceFrom?: number | null;
  index?: number;
  variant?: "default" | "home";
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ProductCard({ product, priceFrom, index = 0, variant = "default" }: Props) {
  const images = (product.images ?? []).filter(Boolean);
  const [imageIndex, setImageIndex] = useState(0);
  const img = images[imageIndex];
  const hasGalleryNavigation = images.length > 2;
  const homeStyle = variant === "home";

  const showGalleryPreview = () => {
    if (images.length > 1 && imageIndex === 0) setImageIndex(1);
  };

  const resetGalleryPreview = () => setImageIndex(0);

  const navigateImage = (event: MouseEvent, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => (current + direction + images.length) % images.length);
  };

  return (
    <article
      className={
        homeStyle
          ? "group block"
          : "group block animate-fade-in opacity-0 [animation-fill-mode:forwards]"
      }
      style={homeStyle ? undefined : { animationDelay: `${Math.min(index, 20) * 70}ms` }}
    >
      <div
        onMouseEnter={showGalleryPreview}
        onMouseLeave={resetGalleryPreview}
        className={
          homeStyle
            ? "relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg"
            : "relative aspect-square overflow-hidden bg-white ring-1 ring-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-sm"
        }
      >
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

        <Link
          to="/produto/$slug"
          params={{ slug: product.slug }}
          aria-label={`Ver produto ${product.name}`}
          className="absolute inset-0 z-10"
        />

        {hasGalleryNavigation && (
          <>
            <button
              type="button"
              aria-label={`Imagem anterior de ${product.name}`}
              onClick={(event) => navigateImage(event, -1)}
              className="absolute left-2 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary opacity-100 shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={`Próxima imagem de ${product.name}`}
              onClick={(event) => navigateImage(event, 1)}
              className="absolute right-2 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary opacity-100 shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {homeStyle ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-[#2a2f2c]/80 via-[#2a2f2c]/25 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-6">
            <span className="pointer-events-auto translate-y-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-lg transition-transform duration-300 group-hover:translate-y-0 sm:text-sm">
              Ver produto
            </span>
          </div>
        ) : (
          <span
            aria-label="Ver produto"
            className="pointer-events-none absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        )}
      </div>
      <Link to="/produto/$slug" params={{ slug: product.slug }} className="block">
        <h3 className="mt-4 font-display text-lg font-semibold text-primary sm:text-xl">
          {product.name}
        </h3>
      </Link>
      {typeof priceFrom === "number" && (
        <p className="mt-1 text-sm text-primary/70">
          A partir de <span className="font-semibold text-primary">{formatBRL(priceFrom)}</span>
        </p>
      )}
    </article>
  );
}
