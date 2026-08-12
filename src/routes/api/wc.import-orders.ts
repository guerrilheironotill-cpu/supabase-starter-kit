import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type WcConfig = { site_url?: string; consumer_key?: string; consumer_secret?: string };
type WcMeta = { key?: string; value?: unknown };
type WcOrder = {
  id: number;
  number: string;
  status: string;
  currency?: string;
  date_created: string;
  subtotal?: string;
  discount_total?: string;
  shipping_total?: string;
  total?: string;
  customer_note?: string;
  billing?: Record<string, string>;
  meta_data?: WcMeta[];
  line_items?: Array<Record<string, unknown>>;
  fee_lines?: Array<Record<string, unknown>>;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const emailKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const paidStatuses = new Set(["processing", "completed", "refunded"]);

function documentFrom(order: WcOrder) {
  const billing = order.billing ?? {};
  const values = [
    billing.cpf,
    billing.cnpj,
    ...(order.meta_data ?? [])
      .filter((m) => /(^|_)(billing_)?(cpf|cnpj)$/i.test(String(m.key ?? "")))
      .map((m) => m.value),
  ];
  return values.map(digits).find((v) => v.length === 11 || v.length === 14) ?? null;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts.shift() || "Cliente", last_name: parts.join(" ") };
}

async function ensurePerson(admin: SupabaseClient, order: WcOrder, approved: boolean) {
  const billing = order.billing ?? {};
  const name =
    `${billing.first_name ?? ""} ${billing.last_name ?? ""}`.trim() || `Cliente ${order.number}`;
  const email = emailKey(billing.email) || null;
  const phone = String(billing.phone ?? "").trim() || null;
  const phoneDigits = digits(phone);
  const document = documentFrom(order);

  if (approved) {
    const { data: rows, error } = await admin
      .from("customers")
      .select("id, cpf, cnpj, email, phone")
      .limit(5000);
    if (error) throw error;
    const found = (rows ?? []).find((row) => {
      const savedDocument = digits(row.cpf || row.cnpj);
      return Boolean(
        (document && savedDocument === document) ||
        (email && emailKey(row.email) === email) ||
        (phoneDigits && digits(row.phone) === phoneDigits),
      );
    });
    if (found) return { customerId: found.id as string, leadId: null };

    const names = splitName(name);
    const { data, error: insertError } = await admin
      .from("customers")
      .insert({
        ...names,
        email,
        phone,
        cpf: document?.length === 11 ? document : null,
        cnpj: document?.length === 14 ? document : null,
        status: "active",
        origin: "woocommerce_import",
        wc_id: order.id,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    return { customerId: data.id as string, leadId: null };
  }

  const { data: leads, error } = await admin
    .from("leads")
    .select("id, email, phone, contact_info")
    .limit(5000);
  if (error) throw error;
  const found = (leads ?? []).find((lead) => {
    const info = (
      lead.contact_info && typeof lead.contact_info === "object" ? lead.contact_info : {}
    ) as Record<string, unknown>;
    const savedDocument = digits(info.document ?? info.cpf ?? info.cnpj);
    return Boolean(
      (document && savedDocument === document) ||
      (email && emailKey(lead.email) === email) ||
      (phoneDigits && digits(lead.phone) === phoneDigits),
    );
  });
  if (found) return { customerId: null, leadId: found.id as string };

  const { data, error: insertError } = await admin
    .from("leads")
    .insert({
      name,
      email,
      phone,
      source: "woocommerce_import",
      items: order.line_items ?? [],
      contact_info: {
        document,
        document_type: document?.length === 11 ? "cpf" : document?.length === 14 ? "cnpj" : null,
        wc_order_id: order.id,
      },
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return { customerId: null, leadId: data.id as string };
}

export const Route = createFileRoute("/api/wc/import-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !serviceKey || !anonKey) {
          return Response.json(
            { ok: false, error: "Configuração segura indisponível." },
            { status: 500 },
          );
        }

        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const userClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await userClient.auth.getUser(token);
        if (!userData.user)
          return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
        const { data: isAdmin } = await userClient.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (!isAdmin)
          return Response.json(
            { ok: false, error: "Apenas administradores podem importar." },
            { status: 403 },
          );

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { data: integration, error: configError } = await admin
          .from("integrations")
          .select("config")
          .eq("service", "woocommerce")
          .maybeSingle();
        if (configError)
          return Response.json({ ok: false, error: configError.message }, { status: 500 });
        const cfg = integration?.config as WcConfig | undefined;
        if (!cfg?.site_url || !cfg.consumer_key || !cfg.consumer_secret) {
          return Response.json(
            { ok: false, error: "WooCommerce não configurado para a importação final." },
            { status: 400 },
          );
        }

        const base = cfg.site_url.replace(/\/$/, "");
        const authorization = `Basic ${btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`)}`;
        let page = 1;
        let imported = 0;
        let updated = 0;
        let totalPages = 1;

        do {
          const response = await fetch(
            `${base}/wp-json/wc/v3/orders?page=${page}&per_page=100&orderby=date&order=asc`,
            {
              headers: { Authorization: authorization },
            },
          );
          if (!response.ok)
            throw new Error(
              `WooCommerce ${response.status}: ${(await response.text()).slice(0, 250)}`,
            );
          totalPages = Number(response.headers.get("x-wp-totalpages") ?? "1") || 1;
          const orders = (await response.json()) as WcOrder[];

          for (const order of orders) {
            const billing = order.billing ?? {};
            const customerName =
              `${billing.first_name ?? ""} ${billing.last_name ?? ""}`.trim() ||
              `Cliente ${order.number}`;
            const approved = paidStatuses.has(order.status);
            const person = await ensurePerson(admin, order, approved);
            const document = documentFrom(order);
            const subtotal = Number(order.subtotal ?? order.total ?? 0);
            const shipping = Number(order.shipping_total ?? 0);
            const discount = Number(order.discount_total ?? 0);
            const payload = {
              customer_id: person.customerId,
              lead_id: person.leadId,
              status: order.status,
              currency: order.currency || "BRL",
              subtotal,
              shipping_total: shipping,
              discount_total: discount,
              total: Number(order.total ?? subtotal + shipping - discount),
              customer_note: order.customer_note || null,
              is_quote: false,
              approved_at: approved ? order.date_created : null,
              wc_id: order.id,
              origin: "woocommerce_import",
              external_number: order.number,
              customer_name: customerName,
              customer_email: emailKey(billing.email) || null,
              customer_phone: String(billing.phone ?? "").trim() || null,
              customer_document: document,
              legacy_payload: {
                payment_method_title:
                  (order as Record<string, unknown>).payment_method_title ?? null,
              },
              created_at: order.date_created,
            };

            const { data: existing } = await admin
              .from("app_orders")
              .select("id")
              .eq("wc_id", order.id)
              .maybeSingle();
            let orderId: string;
            if (existing) {
              const { error } = await admin
                .from("app_orders")
                .update(payload)
                .eq("id", existing.id);
              if (error) throw error;
              orderId = existing.id;
              await admin.from("app_order_items").delete().eq("order_id", orderId);
              updated += 1;
            } else {
              const { data, error } = await admin
                .from("app_orders")
                .insert(payload)
                .select("id")
                .single();
              if (error) throw error;
              orderId = data.id;
              imported += 1;
            }

            const items = [...(order.line_items ?? []), ...(order.fee_lines ?? [])].map((item) => {
              const quantity = Number(item.quantity ?? 1) || 1;
              const total = Number(item.total ?? 0);
              return {
                order_id: orderId,
                product_id: null,
                name: String(item.name ?? "Item importado"),
                sku: String(item.sku ?? "") || null,
                quantity,
                unit_price: Number(item.price ?? total / quantity) || 0,
                total,
                meta: { wc_product_id: item.product_id ?? null, wc_item_id: item.id ?? null },
              };
            });
            if (items.length) {
              const { error } = await admin.from("app_order_items").insert(items);
              if (error) throw error;
            }
          }
          page += 1;
        } while (page <= totalPages);

        return Response.json({ ok: true, imported, updated, total: imported + updated });
      },
    },
  },
});
