import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/masks";
import { quoteDiscountAmount } from "@/lib/commercial-rules";
import { currentPrice, sizeDisplayLabel } from "@/lib/products";
import { FreightQuoteActions } from "@/components/freight-quote-dialog";
import type { FreightItem } from "@/lib/freight";

type CatalogProduct = {
  id: string;
  name: string;
  category: string | null;
  product_sizes: Array<{
    id: string;
    name?: string | null;
    size?: string | null;
    base_price: number;
    sale_price: number | null;
    weight_kg?: number | null;
    sort_order: number;
  }>;
};

async function fetchCatalogProducts() {
  const load = (sizeColumns: string) =>
    supabase
      .from("products")
      .select(`id, name, category, product_sizes(${sizeColumns})`)
      .eq("active", true)
      .order("name")
      .limit(500);
  const columns = "id, name, size, base_price, sale_price, sort_order";
  let { data, error } = await load(`${columns}, weight_kg`);
  if (error) ({ data, error } = await load(columns));
  if (error) return [] as CatalogProduct[];
  return (data ?? []) as unknown as CatalogProduct[];
}

const isNewItem = (item: { id: string }) => item.id.startsWith("new-");

type Item = {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  meta: {
    regular_price?: number | null;
    size_name?: string | null;
    finish?: string | null;
    color?: string | null;
    description?: string | null;
    height?: number | null;
    width?: number | null;
    length?: number | null;
  } | null;
};
type QuoteMeta = {
  quoteId: string | null;
  deadline: string;
  payment: string;
  pix: string;
  freightNote: string;
  address: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountReason: string;
  raw: Record<string, unknown>;
};
type StoredOrderEditorMeta = Omit<QuoteMeta, "quoteId" | "raw"> & { note: string };
type Order = {
  id: string;
  number: number;
  external_number: string | null;
  status: string;
  currency: string;
  shipping_total: number;
  subtotal: number;
  total: number;
  customer_note: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  created_at: string;
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    cnpj: string | null;
  } | null;
  items: Item[];
  quoteMeta: QuoteMeta;
};

const emptyQuoteMeta: QuoteMeta = {
  quoteId: null,
  deadline: "",
  payment: "",
  pix: "",
  freightNote: "",
  address: "",
  discountType: "percentage",
  discountValue: 0,
  discountReason: "",
  raw: {},
};

function parseQuoteMeta(raw: string | null | undefined, quoteId: string | null): QuoteMeta {
  if (!raw) return { ...emptyQuoteMeta, quoteId };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.__meta) {
      return {
        quoteId,
        deadline: String(parsed.deadline ?? ""),
        payment: String(parsed.payment ?? ""),
        pix: String(parsed.pix ?? ""),
        freightNote: String(parsed.freightNote ?? ""),
        address: String(parsed.address ?? ""),
        discountType: parsed.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Math.max(0, Number(parsed.discountValue) || 0),
        discountReason: String(parsed.discountReason ?? ""),
        raw: parsed,
      };
    }
  } catch {
    // Pedidos antigos podem ter observações em texto simples.
  }
  return { ...emptyQuoteMeta, quoteId };
}

function parseStoredOrderEditorMeta(raw: string | null | undefined): StoredOrderEditorMeta {
  const empty = { ...emptyQuoteMeta, note: "" };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.__order_editor_meta) {
      return {
        deadline: String(parsed.deadline ?? ""),
        payment: String(parsed.payment ?? ""),
        pix: String(parsed.pix ?? ""),
        freightNote: String(parsed.freightNote ?? ""),
        address: String(parsed.address ?? ""),
        note: String(parsed.note ?? ""),
        discountType: parsed.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Math.max(0, Number(parsed.discountValue) || 0),
        discountReason: String(parsed.discountReason ?? ""),
      };
    }
  } catch {
    // Compatibilidade com observações antigas em texto simples.
  }
  return { ...empty, note: raw };
}

const statuses = [
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];
const labels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  "on-hold": "Em espera",
  completed: "Concluído",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  failed: "Falhou",
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const Route = createFileRoute("/dashboard/editar-pedido/$orderId")({
  head: () => ({
    meta: [{ title: "Editar pedido — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: EditOrderPage,
});

function EditOrderPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [note, setNote] = useState("");
  const [shipping, setShipping] = useState(0);
  const [freightNote, setFreightNote] = useState("");
  const [address, setAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [payment, setPayment] = useState("");
  const [pix, setPix] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [pickSizeId, setPickSizeId] = useState("");
  const { data: catalog = [] } = useQuery({
    queryKey: ["products-for-order-edit"],
    queryFn: fetchCatalogProducts,
    staleTime: 5 * 60_000,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["app-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_orders" as never)
        .select(
          "id, number, external_number, status, currency, shipping_total, subtotal, total, customer_note, customer_id, customer_name, customer_email, customer_phone, customer_document, created_at, customer:customers(id,first_name,last_name,email,phone,cpf,cnpj), items:app_order_items(id,product_id,name,quantity,unit_price,total,meta)",
        )
        .eq("id", orderId)
        .single();
      if (error) throw new Error(error.message);
      const { data: linkedQuotes } = await supabase
        .from("orders" as never)
        .select("id, notes, items")
        .ilike("notes", `%${orderId}%`)
        .order("created_at", { ascending: false })
        .limit(1);
      const linkedQuote = (linkedQuotes?.[0] ?? null) as {
        id: string;
        notes?: string | null;
        items?: unknown;
      } | null;
      const quoteItems = Array.isArray(linkedQuote?.items)
        ? (linkedQuote.items as Array<Record<string, unknown>>)
        : [];
      const appOrder = data as unknown as Omit<Order, "quoteMeta">;
      const storedEditorMeta = parseStoredOrderEditorMeta(appOrder.customer_note);
      const linkedQuoteMeta = parseQuoteMeta(linkedQuote?.notes, linkedQuote?.id ?? null);
      const enrichedItems = (appOrder.items ?? []).map((item, index) => {
        const quoteItem =
          quoteItems.find(
            (candidate) =>
              item.product_id && String(candidate.product_id ?? "") === item.product_id,
          ) ?? quoteItems[index];
        return {
          ...item,
          meta: {
            ...(item.meta ?? {}),
            description: String(quoteItem?.description ?? item.meta?.description ?? "") || null,
          },
        };
      });
      return {
        ...appOrder,
        customer_note: storedEditorMeta.note,
        items: enrichedItems,
        quoteMeta: {
          ...linkedQuoteMeta,
          deadline: linkedQuoteMeta.deadline || storedEditorMeta.deadline,
          payment: linkedQuoteMeta.payment || storedEditorMeta.payment,
          pix: linkedQuoteMeta.pix || storedEditorMeta.pix,
          freightNote: linkedQuoteMeta.freightNote || storedEditorMeta.freightNote,
          address: linkedQuoteMeta.address || storedEditorMeta.address,
          discountType:
            linkedQuoteMeta.discountValue > 0
              ? linkedQuoteMeta.discountType
              : storedEditorMeta.discountType,
          discountValue: linkedQuoteMeta.discountValue || storedEditorMeta.discountValue,
          discountReason: linkedQuoteMeta.discountReason || storedEditorMeta.discountReason,
        },
      };
    },
  });

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setName(
      `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() ||
        order.customer_name ||
        "",
    );
    setEmail(order.customer?.email ?? order.customer_email ?? "");
    setPhone(maskPhoneBR(order.customer?.phone ?? order.customer_phone ?? ""));
    setDocument(
      maskCpfCnpj(order.customer?.cpf ?? order.customer?.cnpj ?? order.customer_document ?? ""),
    );
    setNote(order.customer_note ?? "");
    setShipping(Number(order.shipping_total) || 0);
    setFreightNote(order.quoteMeta.freightNote);
    setAddress(order.quoteMeta.address);
    setDeadline(order.quoteMeta.deadline);
    setPayment(order.quoteMeta.payment);
    setPix(order.quoteMeta.pix);
    setDiscountType(order.quoteMeta.discountType);
    setDiscountValue(order.quoteMeta.discountValue);
    setDiscountReason(order.quoteMeta.discountReason);
    setItems(order.items ?? []);
    setRemovedIds([]);
  }, [order]);

  const pickProduct = catalog.find((p) => p.id === pickProductId);
  const pickSizes = [...(pickProduct?.product_sizes ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  function newItem(patch: Partial<Item>, meta: NonNullable<Item["meta"]>): Item {
    return {
      id: `new-${crypto.randomUUID()}`,
      product_id: null,
      name: "",
      quantity: 1,
      unit_price: 0,
      total: 0,
      meta,
      ...patch,
    };
  }

  function addCatalogItem() {
    if (!pickProduct) return toast.error("Escolha um produto");
    const size =
      pickSizes.find((s) => s.id === pickSizeId) ??
      (pickSizes.length === 1 ? pickSizes[0] : undefined);
    if (pickSizes.length > 0 && !size) return toast.error("Escolha o tamanho");
    const price = size ? currentPrice(size) : 0;
    setItems((rows) => [
      ...rows,
      newItem(
        { product_id: pickProduct.id, name: pickProduct.name, unit_price: price },
        {
          regular_price: price > 0 ? price : null,
          size_name: size
            ? sizeDisplayLabel(size, pickSizes.indexOf(size), pickSizes.length)
            : null,
        },
      ),
    ]);
    setPickProductId("");
    setPickSizeId("");
  }

  function addCustomItem() {
    setItems((rows) => [...rows, newItem({}, {})]);
  }

  function removeItem(item: Item) {
    if (!isNewItem(item)) setRemovedIds((ids) => [...ids, item.id]);
    setItems((rows) => rows.filter((row) => row.id !== item.id));
  }

  // Load for the freight quote: weights come from the catalog size matching each line.
  const freightItems: FreightItem[] = items
    .filter((item) => item.name.trim())
    .map((item) => {
      const product = catalog.find((p) => p.id === item.product_id);
      const sizes = [...(product?.product_sizes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const wanted = (item.meta?.size_name ?? "").trim().toLocaleLowerCase("pt-BR");
      const size =
        sizes.find(
          (s, index) =>
            wanted &&
            ((s.name ?? s.size ?? "").trim().toLocaleLowerCase("pt-BR") === wanted ||
              sizeDisplayLabel(s, index, sizes.length).toLocaleLowerCase("pt-BR") === wanted),
        ) ?? (sizes.length === 1 ? sizes[0] : undefined);
      return {
        product_id: item.product_id,
        name: item.name,
        category: product?.category ?? null,
        quantity: Number(item.quantity) || 1,
        size: item.meta?.size_name ?? null,
        height: Number(item.meta?.height) || null,
        width: Number(item.meta?.width) || null,
        length: Number(item.meta?.length) || null,
        size_id: size?.id ?? null,
        weight_kg: size?.weight_kg ?? null,
        catalog_weight_kg: size?.weight_kg ?? null,
      };
    });

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0),
    [items],
  );
  const discount = quoteDiscountAmount(
    items.map((item) => ({
      price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 0,
      regularPrice: item.meta?.regular_price,
    })),
    discountType,
    discountValue,
  );
  const total = subtotal - discount + shipping;

  function updateItem(
    index: number,
    patch: Partial<Item>,
    metaPatch?: Partial<NonNullable<Item["meta"]>>,
  ) {
    setItems((rows) =>
      rows.map((row, itemIndex) =>
        itemIndex === index
          ? {
              ...row,
              ...patch,
              meta: metaPatch ? { ...(row.meta ?? {}), ...metaPatch } : row.meta,
            }
          : row,
      ),
    );
  }

  async function authorizedStatus() {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/orders/reconcile-person", {
      method: "POST",
      headers: {
        authorization: `Bearer ${data.session?.access_token ?? ""}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId, status }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(result.error || "Não foi possível atualizar o status.");
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_orders" as never)
        .update({
          customer_name: name || null,
          customer_email: email || null,
          customer_phone: phone || null,
          customer_document: document.replace(/\D/g, "") || null,
          customer_note: JSON.stringify({
            __order_editor_meta: 1,
            note,
            freightNote,
            address,
            deadline,
            payment,
            pix,
            discountType,
            discountValue,
            discountReason,
          }),
          shipping_total: shipping,
          subtotal,
          total,
        } as never)
        .eq("id", orderId);
      if (error) throw error;
      if (order.customer_id) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const cleanDocument = document.replace(/\D/g, "");
        const { error: customerError } = await supabase
          .from("customers" as never)
          .update({
            first_name: parts.shift() || "Cliente",
            last_name: parts.join(" "),
            email: email || null,
            phone: phone || null,
            cpf: cleanDocument.length === 11 ? cleanDocument : null,
            cnpj: cleanDocument.length === 14 ? cleanDocument : null,
          } as never)
          .eq("id", order.customer_id);
        if (customerError) throw customerError;
        const { error: syncError } = await supabase
          .from("app_orders" as never)
          .update({
            customer_name: name || null,
            customer_email: email || null,
            customer_phone: phone || null,
            customer_document: cleanDocument || null,
          } as never)
          .eq("customer_id", order.customer_id);
        if (syncError) throw syncError;
      }
      if (removedIds.length > 0) {
        const { error: removeError } = await supabase
          .from("app_order_items" as never)
          .delete()
          .in("id", removedIds);
        if (removeError) throw removeError;
      }
      const addedItems = items.filter(isNewItem);
      if (addedItems.length > 0) {
        const { error: addError } = await supabase.from("app_order_items" as never).insert(
          addedItems.map((item) => ({
            order_id: orderId,
            product_id: item.product_id,
            name: item.name.trim() || "Item",
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
            meta: {
              ...(item.meta ?? {}),
              size_name: item.meta?.size_name || null,
              finish: item.meta?.finish || null,
              color: item.meta?.color || null,
              description: item.meta?.description || null,
              height: Number(item.meta?.height) || null,
              width: Number(item.meta?.width) || null,
              length: Number(item.meta?.length) || null,
            },
          })) as never,
        );
        if (addError) throw addError;
      }
      for (const item of items.filter((row) => !isNewItem(row))) {
        const { error: itemError } = await supabase
          .from("app_order_items" as never)
          .update({
            name: item.name,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total: Number(item.quantity) * Number(item.unit_price),
            meta: {
              ...(item.meta ?? {}),
              size_name: item.meta?.size_name || null,
              finish: item.meta?.finish || null,
              color: item.meta?.color || null,
              description: item.meta?.description || null,
              height: Number(item.meta?.height) || null,
              width: Number(item.meta?.width) || null,
              length: Number(item.meta?.length) || null,
            },
          } as never)
          .eq("id", item.id);
        if (itemError) throw itemError;
      }
      if (order.quoteMeta.quoteId) {
        const quoteItems = items.map((item) => ({
          kind: item.product_id ? "catalog" : "custom",
          product_id: item.product_id,
          name: item.name,
          description: item.meta?.description || null,
          quantity: Number(item.quantity) || 1,
          price: Number(item.unit_price) || 0,
          regular_price:
            Number(item.meta?.regular_price) > 0 ? Number(item.meta?.regular_price) : null,
          size_name: item.meta?.size_name || null,
          finish: item.meta?.finish || null,
          color: item.meta?.color || null,
          height: Number(item.meta?.height) || null,
          width: Number(item.meta?.width) || null,
          length: Number(item.meta?.length) || null,
        }));
        const quoteNotes = JSON.stringify({
          ...order.quoteMeta.raw,
          __meta: 1,
          freight: shipping,
          freightNote,
          address,
          deadline,
          payment,
          pix,
          discountType,
          discountValue,
          discountReason,
          note,
          app_order_id: orderId,
          app_order_number: order.number,
        });
        const { error: quoteError } = await supabase
          .from("orders" as never)
          .update({
            customer_name: name || "Cliente",
            customer_phone: phone || null,
            customer_email: email || null,
            items: quoteItems,
            total,
            notes: quoteNotes,
          } as never)
          .eq("id", order.quoteMeta.quoteId);
        if (quoteError) throw quoteError;
      }
      await authorizedStatus();
      await qc.invalidateQueries({ queryKey: ["app-order", orderId] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["app-orders"] });
      await qc.invalidateQueries({ queryKey: ["local-customers"] });
      toast.success(
        order.quoteMeta.quoteId
          ? "Pedido e orçamento vinculados foram atualizados."
          : "Pedido salvo e cadastro reconciliado.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Excluir este pedido definitivamente?")) return;
    await supabase
      .from("app_order_items" as never)
      .delete()
      .eq("order_id", orderId);
    const { error } = await supabase
      .from("app_orders" as never)
      .delete()
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["app-orders"] });
    void navigate({ to: "/dashboard/pedidos" });
  }

  async function generateQuotePdf() {
    if (!order) return;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      toast.error("O navegador bloqueou a janela do PDF. Permita pop-ups e tente novamente.");
      return;
    }

    pdfWindow.document.write(
      "<!doctype html><html><body style='font-family:sans-serif;padding:24px'>Preparando PDF...</body></html>",
    );
    pdfWindow.document.close();

    let logoSrc = `${window.location.origin}/images/logo-arteno-header-site.svg`;
    try {
      const { getQuoteLogoDataUrl } = await import("@/lib/quote-pdf-logo");
      logoSrc = await getQuoteLogoDataUrl();
    } catch (error) {
      console.warn("Não foi possível embutir o logo no PDF:", error);
    }
    const reference = escapeHtml(order.external_number || order.number);
    const rows = items
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.name)}
            ${item.meta?.description ? `<div class="item-meta">${escapeHtml(item.meta.description)}</div>` : ""}
            ${item.meta?.size_name ? `<div class="item-meta">Tamanho: ${escapeHtml(item.meta.size_name)}</div>` : ""}
            ${item.meta?.finish ? `<div class="item-meta">Acabamento: ${escapeHtml(item.meta.finish)}</div>` : ""}
            ${item.meta?.color ? `<div class="item-meta">Cor: ${escapeHtml(item.meta.color)}</div>` : ""}
            ${item.meta?.height ? `<div class="item-meta">Altura: ${escapeHtml(item.meta.height)} cm</div>` : ""}
            ${item.meta?.width ? `<div class="item-meta">Largura: ${escapeHtml(item.meta.width)} cm</div>` : ""}
            ${item.meta?.length ? `<div class="item-meta">Comprimento: ${escapeHtml(item.meta.length)} cm</div>` : ""}
          </td>
          <td>${Number(item.quantity) || 0}</td>
          <td>${money(Number(item.unit_price) || 0)}</td>
          <td>${money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <title>Orçamento ${reference}</title>
      <style>
        * { box-sizing: border-box; }
        body { max-width: 800px; margin: 0 auto; padding: 44px 32px; color: #171717; background: #fff; font-family: Arial, sans-serif; }
        header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #222; }
        header img { width: 181px; height: auto; }
        .document { text-align: right; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
        .document strong { display: block; margin-top: 6px; color: #171717; font-size: 18px; letter-spacing: .04em; }
        section { margin-top: 22px; border: 1px solid #e5e5e5; border-radius: 10px; padding: 18px 20px; }
        h2 { margin: 0 0 13px; color: #777; font-size: 11px; text-transform: uppercase; letter-spacing: .16em; }
        .row { display: flex; justify-content: space-between; gap: 24px; padding: 5px 0; font-size: 14px; }
        .row span { color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 5px; border-bottom: 1px solid #eee; text-align: left; font-size: 13px; }
        th { color: #777; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
        th:last-child, td:last-child { text-align: right; }
        .item-meta { margin-top: 3px; color: #777; font-size: 11px; }
        .total { margin-top: 8px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 18px; }
        .note { white-space: pre-wrap; font-size: 13px; line-height: 1.55; }
        .print { display: block; margin: 24px auto 0; border: 0; border-radius: 6px; padding: 11px 20px; background: #222; color: #fff; cursor: pointer; }
        @media print { body { padding: 20px; } .print { display: none; } }
      </style></head><body>
      <header>
        <img src="${logoSrc}" alt="Arteno"/>
        <div class="document">Orçamento<strong>#${reference}</strong></div>
      </header>
      <section><h2>Cliente</h2>
        <div class="row"><span>Nome</span><strong>${escapeHtml(name || "Cliente")}</strong></div>
        ${phone ? `<div class="row"><span>Telefone</span><strong>${escapeHtml(phone)}</strong></div>` : ""}
        ${email ? `<div class="row"><span>E-mail</span><strong>${escapeHtml(email)}</strong></div>` : ""}
        <div class="row"><span>Data</span><strong>${new Date().toLocaleDateString("pt-BR")}</strong></div>
      </section>
      <section><h2>Itens</h2><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table></section>
      <section><h2>Valores</h2>
        <div class="row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
        ${shipping ? `<div class="row"><span>Frete${freightNote ? ` (${escapeHtml(freightNote)})` : ""}</span><strong>${money(shipping)}</strong></div>` : ""}
        <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
      </section>
      ${
        deadline || payment || pix
          ? `<section><h2>Condições</h2>
            ${deadline ? `<div class="row"><span>Prazo de produção</span><strong>${escapeHtml(deadline)}</strong></div>` : ""}
            ${payment ? `<div class="row"><span>Forma de pagamento</span><strong>${escapeHtml(payment)}</strong></div>` : ""}
            ${pix ? `<div class="row"><span>Link Pix</span><strong><a href="${escapeHtml(pix)}">${escapeHtml(pix)}</a></strong></div>` : ""}
          </section>`
          : ""
      }
      ${address ? `<section><h2>Entrega</h2><div class="note">${escapeHtml(address)}</div></section>` : ""}
      ${note ? `<section><h2>Observações</h2><div class="note">${escapeHtml(note)}</div></section>` : ""}
      <button class="print" onclick="window.print()">Salvar como PDF</button>
      <script>
        (function () {
          var logo = document.querySelector('header img');
          var logoReady = logo && logo.complete && logo.naturalWidth > 0
            ? Promise.resolve()
            : new Promise(function (resolve) {
                if (!logo) return resolve();
                logo.addEventListener('load', resolve, { once: true });
                logo.addEventListener('error', resolve, { once: true });
              });
          Promise.race([
            logoReady,
            new Promise(function (resolve) { setTimeout(resolve, 3000); })
          ]).then(function () { setTimeout(function () { window.print(); }, 100); });
        })();
      </script>
      </body></html>`;
    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
  }

  if (isLoading || !order)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/dashboard/pedidos"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para pedidos
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateQuotePdf}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <FileDown className="h-4 w-4" /> Gerar PDF do orçamento
          </button>
          <button
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Excluir pedido
          </button>
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Pedido #{order.external_number || order.number}</h1>
        <p className="text-sm text-muted-foreground">
          Criado em {new Date(order.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold">Cliente</h2>
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="E-mail" value={email} onChange={setEmail} />
        <Field label="Telefone" value={phone} onChange={(value) => setPhone(maskPhoneBR(value))} />
        <Field
          label="CPF/CNPJ"
          value={document}
          onChange={(value) => setDocument(maskCpfCnpj(value))}
        />
        {order.customer_id && (
          <Link
            to="/dashboard/editar-cliente/$customerId"
            params={{ customerId: order.customer_id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Abrir cadastro do cliente
          </Link>
        )}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Itens</h2>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-border bg-background p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Produto"
                  value={item.name}
                  onChange={(value) => updateItem(index, { name: value })}
                />
                <Field
                  label="Tamanho"
                  value={item.meta?.size_name ?? ""}
                  onChange={(value) => updateItem(index, {}, { size_name: value })}
                />
                <Field
                  label="Acabamento"
                  value={item.meta?.finish ?? ""}
                  onChange={(value) => updateItem(index, {}, { finish: value })}
                />
                <Field
                  label="Cor"
                  value={item.meta?.color ?? ""}
                  onChange={(value) => updateItem(index, {}, { color: value })}
                />
                <NumberField
                  label="Altura (cm)"
                  value={item.meta?.height}
                  onChange={(value) => updateItem(index, {}, { height: value })}
                />
                <NumberField
                  label="Largura (cm)"
                  value={item.meta?.width}
                  onChange={(value) => updateItem(index, {}, { width: value })}
                />
                <NumberField
                  label="Comprimento (cm)"
                  value={item.meta?.length}
                  onChange={(value) => updateItem(index, {}, { length: value })}
                />
                <NumberField
                  label="Quantidade"
                  value={item.quantity}
                  min={1}
                  onChange={(value) => updateItem(index, { quantity: value || 1 })}
                />
                <NumberField
                  label="Valor unitário (R$)"
                  value={item.unit_price}
                  onChange={(value) =>
                    // A manual price replaces the catalog price, so it becomes the discount base.
                    updateItem(index, { unit_price: value }, { regular_price: null })
                  }
                />
                <label className="grid gap-1 text-sm md:col-span-2 lg:col-span-3">
                  Descrição / detalhes
                  <textarea
                    rows={2}
                    value={item.meta?.description ?? ""}
                    onChange={(event) => updateItem(index, {}, { description: event.target.value })}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className="inline-flex items-center gap-1 text-destructive hover:underline"
                >
                  <X className="h-4 w-4" /> Remover item
                </button>
                <span>
                  Subtotal: <strong>{money(item.quantity * item.unit_price)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <label className="grid gap-1 text-sm">
            Adicionar produto do catálogo
            <select
              value={pickProductId}
              onChange={(event) => {
                setPickProductId(event.target.value);
                setPickSizeId("");
              }}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Escolha o produto…</option>
              {catalog.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Tamanho
            <select
              value={pickSizeId}
              onChange={(event) => setPickSizeId(event.target.value)}
              disabled={pickSizes.length <= 1}
              className="rounded-md border border-border bg-background px-3 py-2 disabled:opacity-60"
            >
              <option value="">{pickSizes.length <= 1 ? "Único" : "Escolha o tamanho…"}</option>
              {pickSizes.map((size, index) => (
                <option key={size.id} value={size.id}>
                  {sizeDisplayLabel(size, index, pickSizes.length)} — {money(currentPrice(size))}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addCatalogItem}
            className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
          <button
            type="button"
            onClick={addCustomItem}
            className="inline-flex items-center justify-center gap-2 self-end rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Item personalizado
          </button>
        </div>
        <div className="mt-5 ml-auto grid max-w-xs gap-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <b>{money(subtotal)}</b>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Desconto{discountType === "percentage" ? ` (${discountValue}%)` : ""}</span>
              <b>-{money(discount)}</b>
            </div>
          )}
          <div className="flex justify-between text-lg">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <h2 className="text-lg font-semibold md:col-span-2">Entrega e condições comerciais</h2>
        <NumberField label="Frete (R$)" value={shipping} onChange={setShipping} />
        <Field label="Observação do frete" value={freightNote} onChange={setFreightNote} />
        <label className="grid gap-1 text-sm md:col-span-2">
          Endereço de entrega
          <textarea
            rows={3}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <Field label="Prazo de produção" value={deadline} onChange={setDeadline} />
        <Field label="Forma de pagamento" value={payment} onChange={setPayment} />
        <label className="grid gap-1 text-sm">
          Tipo de desconto
          <select
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as "percentage" | "fixed")}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="percentage">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
          </select>
        </label>
        <NumberField
          label={discountType === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
          value={discountValue}
          onChange={setDiscountValue}
        />
        <label className="grid gap-1 text-sm md:col-span-2">
          Motivo do desconto
          <input
            value={discountReason}
            onChange={(event) => setDiscountReason(event.target.value)}
            placeholder="Ex: pagamento à vista no boleto"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="grid gap-2 md:col-span-2">
          <span className="text-sm">Cotação de frete com transportadores</span>
          <p className="text-xs text-muted-foreground">
            Usa os itens acima (salve o pedido antes se acabou de adicionar produtos).
          </p>
          <FreightQuoteActions
            items={freightItems}
            orderId={order.quoteMeta.quoteId}
            customerLabel={name}
            customerPhone={phone}
            deadlineText={deadline}
            deliveryAddress={address}
            cargoValueDefault={Math.max(0, subtotal - discount) || null}
          />
        </div>
        <label className="grid gap-1 text-sm md:col-span-2">
          Link ou código Pix
          <textarea
            rows={2}
            value={pix}
            onChange={(event) => setPix(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Observações
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>
      <div className="flex justify-end">
        <button
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Salvar pedido
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        type="number"
        min={min}
        step="0.01"
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
}
