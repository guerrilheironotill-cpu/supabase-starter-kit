import { supabase } from "@/integrations/supabase/client";

export type WcListResponse<T> = {
  configured: boolean;
  items: T[];
  total: number;
  totalPages: number;
  error?: string;
};

export type WcOrder = {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  payment_method_title?: string;
  billing: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    state?: string;
  };
  shipping?: WcOrder["billing"];
  customer_note?: string;
  line_items: Array<{
    id: number;
    product_id?: number;
    variation_id?: number;
    name: string;
    quantity: number;
    subtotal?: string;
    total: string;
    price?: number;
  }>;
  shipping_lines?: Array<{
    id: number;
    method_id?: string;
    method_title?: string;
    total: string;
  }>;
  fee_lines?: Array<{
    id: number;
    name: string;
    total: string;
  }>;
};

export type WcCustomer = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  date_created: string;
  billing: {
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  orders_count?: number;
  total_spent?: string;
};

export async function fetchWc<T>(params: {
  resource: "orders" | "customers";
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
}): Promise<WcListResponse<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const empty: WcListResponse<T> = { configured: false, items: [], total: 0, totalPages: 0 };
  if (!token) return empty;

  const qs = new URLSearchParams({
    resource: params.resource,
    page: String(params.page ?? 1),
    per_page: String(params.perPage ?? 20),
  });
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);

  const res = await fetch(`/api/wc/list?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return empty;
  const json = (await res.json()) as WcListResponse<T>;
  if (json.error) console.warn(`[wc/${params.resource}]`, json.error);
  return json;
}