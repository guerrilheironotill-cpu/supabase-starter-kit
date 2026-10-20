import { supabase } from "@/integrations/supabase/client";

export type FinishColor = {
  finish_name: string;
  color_name: string;
  extra_price: number;
  sort_order: number;
};

export type FinishColorOption = { name: string; extraPrice: number };

/** Finish colors for every finish. A missing table (migration not run yet) means no rules. */
export async function fetchFinishColors(): Promise<FinishColor[]> {
  const { data, error } = await supabase
    .from("finish_colors" as never)
    .select("finish_name, color_name, extra_price, sort_order")
    .order("sort_order");
  if (error) {
    console.warn("[finish-colors] indisponível", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    finish_name: String(row.finish_name),
    color_name: String(row.color_name),
    extra_price: Number(row.extra_price) || 0,
    sort_order: Number(row.sort_order) || 0,
  }));
}

/**
 * Colors a customer can pick for a finish. A finish with colors configured offers only
 * those that the product also has; a finish with none offers every product color at no
 * extra cost, so nothing changes until the finish is configured.
 */
export function colorsForFinish(
  finishName: string | null | undefined,
  productColors: string[],
  finishColors: FinishColor[],
): FinishColorOption[] {
  const configured = finishName ? finishColors.filter((row) => row.finish_name === finishName) : [];
  if (configured.length === 0) {
    return productColors.map((name) => ({ name, extraPrice: 0 }));
  }
  const allowed = new Set(productColors);
  return configured
    .filter((row) => allowed.has(row.color_name))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ name: row.color_name, extraPrice: row.extra_price }));
}

/** Extra price of a color within a finish (0 when none is configured). */
export function finishColorExtra(
  finishName: string | null | undefined,
  colorName: string | null | undefined,
  finishColors: FinishColor[],
): number {
  if (!finishName || !colorName) return 0;
  return (
    finishColors.find((row) => row.finish_name === finishName && row.color_name === colorName)
      ?.extra_price ?? 0
  );
}
