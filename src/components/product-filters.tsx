import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductWithSizes, ProductSize } from "@/lib/products";

export type DimensionAxis = "altura" | "largura";

export type FilterState = {
  axis: DimensionAxis;
  ranges: string[]; // range ids from RANGES
  maxPrice: number | null;
};

type Range = { id: string; label: string; min: number; max: number };

const RANGES: Range[] = [
  { id: "0-30", label: "até 30 cm", min: 0, max: 30 },
  { id: "30-40", label: "30 – 40 cm", min: 30, max: 40 },
  { id: "40-50", label: "40 – 50 cm", min: 40, max: 50 },
  { id: "50-60", label: "50 – 60 cm", min: 50, max: 60 },
  { id: "60-70", label: "60 – 70 cm", min: 60, max: 70 },
  { id: "70-80", label: "70 – 80 cm", min: 70, max: 80 },
  { id: "80-100", label: "80 cm – 1 m", min: 80, max: 100 },
  { id: "100+", label: "acima de 1 m", min: 100, max: Infinity },
];

export const DEFAULT_FILTERS: FilterState = {
  axis: "altura",
  ranges: [],
  maxPrice: null,
};

/**
 * Parse a size string like "80 cm × 120 cm × 10 cm".
 * The function now accepts either the `name` field (canonical) or the raw `size`
 * field when `name` is empty, ensuring dimensions are extracted even if the
 * import populated only the `size` column.
 */
function parseSize(name: string): { altura: number; largura: number } | null {
  const m = name.match(/(\d+)\s*cm\s*[×x]\s*(\d+)\s*cm\s*[×x]\s*(\d+)\s*cm/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  return { altura: a, largura: Math.max(b, c) };
}

function sizeValue(size: ProductSize, axis: DimensionAxis): number | null {
  // Prefer the canonical `name`; fall back to the raw `size` column if needed.
  const parsed = parseSize(size.name ?? (size as any).size ?? "");
  if (!parsed) return null;
  return axis === "altura" ? parsed.altura : parsed.largura;
}

function inRange(value: number, r: Range): boolean {
  return value >= r.min && value < r.max;
}

type Props = {
  products: ProductWithSizes[];
  value: FilterState;
  onChange: (next: FilterState) => void;
};

export function ProductFilters({ products, value, onChange }: Props) {
  const { availableRanges, priceMin, priceMax, hasDimensions } = useMemo(() => {
    let min = Infinity;
    let max = 0;
    const availA = new Set<string>();
    const availL = new Set<string>();
    let hasDim = false;
    for (const p of products) {
      for (const s of p.product_sizes ?? []) {
        const price = s.sale_price ?? s.base_price;
        if (price < min) min = price;
        if (price > max) max = price;
        const parsed = parseSize(s.name);
        if (!parsed) continue;
        hasDim = true;
        for (const r of RANGES) {
          if (inRange(parsed.altura, r)) availA.add(r.id);
          if (inRange(parsed.largura, r)) availL.add(r.id);
        }
      }
    }
    return {
      availableRanges: value.axis === "altura" ? availA : availL,
      priceMin: Number.isFinite(min) ? Math.floor(min) : 0,
      priceMax: Math.ceil(max) || 1000,
      hasDimensions: hasDim,
    };
  }, [products, value.axis]);

  const currentMax = value.maxPrice ?? priceMax;
  const hasFilters = value.ranges.length > 0 || value.maxPrice !== null;

  function toggleRange(id: string) {
    const next = value.ranges.includes(id)
      ? value.ranges.filter((r) => r !== id)
      : [...value.ranges, id];
    onChange({ ...value, ranges: next });
  }

  function setAxis(axis: DimensionAxis) {
    if (axis === value.axis) return;
    onChange({ ...value, axis, ranges: [] });
  }

  function fmt(n: number) {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }

  if (!hasDimensions && priceMax === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/10 bg-white/60 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-start gap-6">
        {hasDimensions && (
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
                Tamanho
              </p>
              <div className="inline-flex rounded-full border border-primary/20 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAxis("altura")}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium transition-colors",
                    value.axis === "altura"
                      ? "bg-primary text-primary-foreground"
                      : "text-primary hover:bg-primary/5",
                  )}
                >
                  Altura
                </button>
                <button
                  type="button"
                  onClick={() => setAxis("largura")}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium transition-colors",
                    value.axis === "largura"
                      ? "bg-primary text-primary-foreground"
                      : "text-primary hover:bg-primary/5",
                  )}
                >
                  Comprimento / Diâmetro
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {RANGES.filter((r) => availableRanges.has(r.id)).map((r) => {
                const active = value.ranges.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/20 bg-white text-primary hover:border-primary/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleRange(r.id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {r.label}
                  </label>
                );
              })}
              {availableRanges.size === 0 && (
                <p className="text-xs text-primary/60">
                  Sem opções nesta dimensão.
                </p>
              )}
            </div>
          </div>
        )}

        {priceMax > 0 && (
          <div className="w-full sm:w-72">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
              Preço até
            </p>
            <input
              aria-label="Preço máximo"
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
            onClick={() => onChange({ ...value, ranges: [], maxPrice: null })}
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
  const selected = RANGES.filter((r) => filters.ranges.includes(r.id));
  return products.filter((p) => {
    const sizes = p.product_sizes ?? [];
    if (selected.length > 0) {
      const has = sizes.some((s) => {
        const v = sizeValue(s, filters.axis);
        if (v === null) return false;
        return selected.some((r) => inRange(v, r));
      });
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
