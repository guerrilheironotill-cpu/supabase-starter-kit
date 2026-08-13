export type LeadInterest = "final" | "professional" | "reseller";
export type CustomerType = LeadInterest;
export type CommercialStatus = "pending" | "approved" | "suspended";
export type ProfessionalType =
  "architect" | "landscaper" | "interior_designer" | "gardener" | "other";

export const PROFESSIONAL_DISCOUNT = 0.15;
export const RESELLER_TIERS = [
  { minimum: 3_000, discount: 0.25 },
  { minimum: 5_000, discount: 0.3 },
  { minimum: 10_000, discount: 0.35 },
] as const;

export function normalizeLeadInterest(value: string | null | undefined): LeadInterest {
  if (value === "architect" || value === "professional") return "professional";
  if (value === "reseller") return "reseller";
  return "final";
}

export function discountedPrice(price: number, discount: number) {
  return Math.round(Number(price) * (1 - discount) * 100) / 100;
}

/**
 * Commercial partner discounts always start from the regular product price.
 * A public promotional price must never be combined with a professional or
 * reseller discount.
 */
export function commercialDiscountBase(basePrice: number, finishExtra = 0) {
  return Math.round((Number(basePrice) + Number(finishExtra)) * 100) / 100;
}

export function resellerDiscountForSubtotal(subtotal: number) {
  if (subtotal >= 10_000) return 0.35;
  if (subtotal >= 5_000) return 0.3;
  if (subtotal >= 3_000) return 0.25;
  return 0;
}

export function authorizedCommercialDiscount(
  customerType: CustomerType,
  commercialStatus: CommercialStatus,
  productSubtotal: number,
) {
  if (commercialStatus !== "approved") return 0;
  if (customerType === "professional") return PROFESSIONAL_DISCOUNT;
  if (customerType === "reseller") return resellerDiscountForSubtotal(productSubtotal);
  return 0;
}
