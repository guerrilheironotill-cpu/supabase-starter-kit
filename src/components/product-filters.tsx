import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductWithSizes } from "@/lib/products";

export type FilterState = {
  sizes: string[];
  maxPrice: number | null;
};

type Props = {
  products: ProductWithSizes[];
  value: FilterState;
  onChange: (next: FilterState) => void;
};

export function ProductFilters({ products, value, onChange }: Props) {
  const { availableSizes, priceMin, priceMax } = useMemo(() => {
    const sizes = new Set<string>();
    let min = Infinity;
    let max = 0;
    for (const p of products) {
      for (const s of p.product_sizes ?? []) {
        sizes.add(s.name);
        const price = s.sale_price ?? s.base_price;
        if (price < min) min = price;
        if (price > max) max = price;
      }
    }
    return {
      availableSizes: Array.from(sizes).sort(),
      priceMin: Number.isFinite(min) ? Math.floor(min) : 0,
      priceMax: Math.ceil(max) || 1000,
    };
  }, [products]);

  const currentMax = value.maxPrice ?? priceMax;
  const hasFilters = value.sizes.length > 0 || value.maxPrice !== null;

  function toggleSize(size: string) {
    const next = value.sizes.includes(size)
      ? value.sizes.filter((s) => s !== size)
      : [...value.sizes, size];
    onChange({ ...value, sizes: next });
  }

  function fmt(n: number) {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }

  if (availableSizes.length === 0 && priceMax === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/10 bg-white/60 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-start gap-6">
        {availableSizes.length > 0 && (
          <div className="min-w-0 flex-1">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
              Tamanho
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((s) => {
                const active = value.sizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/20 bg-white text-primary hover:border-primary/50",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {priceMax > 0 && (
          <div className="w-full sm:w-72">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
              Preço até
            </h3>
            <input
              type="range"
              min={priceMin}
              max={priceMax}
              step={Math.max(50, Math.round((priceMax - priceMin) / 40))}
              value={currentMax}
              onChange={(e) =>
                onChange({ ...value, maxPrice: Number(e.target.value) })
              }
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-primary/70">
              <span>{fmt(priceMin)}</span>
              <span className="font-semibold text-primary">
                {fmt(currentMax)}
              </span>
            </div>
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange({ sizes: [], maxPrice: null })}
            className="inline-flex items-center gap-1 self-end rounded-full border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

export function applyFilters(
  products: ProductWithSizes[],
  filters: FilterState,
): ProductWithSizes[] {
  return products.filter((p) => {
    const sizes = p.product_sizes ?? [];
    if (filters.sizes.length > 0) {
      const has = sizes.some((s) => filters.sizes.includes(s.name));
      if (!has) return false;
    }
    if (filters.maxPrice !== null) {
      const hasFit = sizes.some(
        (s) => (s.sale_price ?? s.base_price) <= filters.maxPrice!,
      );
      if (!hasFit) return false;
    }
    return true;
  });
}

export function priceFromOf(p: ProductWithSizes): number | null {
  const sizes = p.product_sizes ?? [];
  if (sizes.length === 0) return null;
  return Math.min(...sizes.map((s) => s.sale_price ?? s.base_price));
}