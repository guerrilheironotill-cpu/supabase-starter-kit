import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = { id: string; name: string; quantity: number; unit_price: number; total: number };
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
  customer: { id: string; first_name: string | null; last_name: string | null } | null;
  items: Item[];
};

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
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["app-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_orders" as never)
        .select(
          "id, number, external_number, status, currency, shipping_total, subtotal, total, customer_note, customer_id, customer_name, customer_email, customer_phone, customer_document, created_at, customer:customers(id,first_name,last_name), items:app_order_items(id,name,quantity,unit_price,total)",
        )
        .eq("id", orderId)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as Order;
    },
  });

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setName(
      order.customer_name ||
        `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim(),
    );
    setEmail(order.customer_email ?? "");
    setPhone(order.customer_phone ?? "");
    setDocument(order.customer_document ?? "");
    setNote(order.customer_note ?? "");
    setShipping(Number(order.shipping_total) || 0);
    setItems(order.items ?? []);
  }, [order]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0),
    [items],
  );
  const total = subtotal + shipping;

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
          customer_note: note || null,
          shipping_total: shipping,
          subtotal,
          total,
        } as never)
        .eq("id", orderId);
      if (error) throw error;
      for (const item of items) {
        const { error: itemError } = await supabase
          .from("app_order_items" as never)
          .update({
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total: Number(item.quantity) * Number(item.unit_price),
          } as never)
          .eq("id", item.id);
        if (itemError) throw itemError;
      }
      await authorizedStatus();
      await qc.invalidateQueries({ queryKey: ["app-orders"] });
      await qc.invalidateQueries({ queryKey: ["local-customers"] });
      toast.success("Pedido salvo e cadastro reconciliado.");
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

  if (isLoading || !order)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/pedidos"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para pedidos
        </Link>
        <button
          onClick={remove}
          className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Excluir pedido
        </button>
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
        <Field label="Telefone" value={phone} onChange={setPhone} />
        <Field label="CPF/CNPJ" value={document} onChange={setDocument} />
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
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-6 py-2 text-sm">{item.name}</div>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  setItems((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, quantity: Number(e.target.value) } : row,
                    ),
                  )
                }
                className="col-span-2 rounded-md border border-border bg-background px-2"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(e) =>
                  setItems((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, unit_price: Number(e.target.value) } : row,
                    ),
                  )
                }
                className="col-span-2 rounded-md border border-border bg-background px-2"
              />
              <div className="col-span-2 py-2 text-right text-sm">
                {money(item.quantity * item.unit_price)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 ml-auto grid max-w-xs gap-2 text-sm">
          <label className="flex items-center justify-between gap-3">
            Frete{" "}
            <input
              type="number"
              value={shipping}
              onChange={(e) => setShipping(Number(e.target.value))}
              className="w-32 rounded-md border border-border bg-background px-2 py-1 text-right"
            />
          </label>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <b>{money(subtotal)}</b>
          </div>
          <div className="flex justify-between text-lg">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
        </div>
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
