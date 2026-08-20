import type { ProductDetail } from "@/lib/products";

export function isConcreteProduct(
  product: Pick<ProductDetail, "name" | "category" | "product_finishes">,
) {
  const searchable = [
    product.name,
    product.category,
    ...(product.product_finishes ?? []).map((finish) => finish.name),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /concreto|cimento|vaso|jardineira|banco|banqueta|mesa/.test(searchable);
}
