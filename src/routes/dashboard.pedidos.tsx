import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { fetchWc, type WcOrder } from "@/lib/wc-api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

const STATUS_OPTIONS = [
  { value: "any", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Processando" },
  { value: "on-hold", label: "Em espera" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
  { value: "failed", label: "Falhou" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-500",
  processing: "bg-blue-500/15 text-blue-500",
  "on-hold": "bg-orange-500/15 text-orange-500",
  completed: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-red-500/15 text-red-500",
  refunded: "bg-purple-500/15 text-purple-500",
  failed: "bg-red-500/15 text-red-500",
};

const OVERRIDES_KEY = "wc-order-overrides-v1";
type Override = { status?: string; customer_note?: string };
function readOverrides(): Record<number, Override> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(OVERRIDES_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeOverrides(v: Record<number, Override>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(v));
}

function formatCurrency(value: string, currency: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("any");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<WcOrder | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, { status?: string; customer_note?: string }>>(() => readOverrides());
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wc-orders", page, status, search],
    queryFn: () =>
      fetchWc<WcOrder>({
        resource: "orders",
        page,
        perPage: 20,
        status: status === "any" ? "" : status,
        search,
      }),
    staleTime: 30_000,
  });

  async function updateOrder(id: number, patch: Record<string, unknown>) {
    setSavingId(id);
    try {
      const next = { ...overrides };
      const cur = { ...(next[id] ?? {}) };
      if (typeof patch.status === "string") cur.status = patch.status;
      if (typeof patch.customer_note === "string") cur.customer_note = patch.customer_note;
      next[id] = cur;
      setOverrides(next);
      writeOverrides(next);
      toast.success("Status atualizado (local, não altera o site)");
      qc.invalidateQueries({ queryKey: ["wc-orders"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const items = data?.items?.map((o) => {
    const ov = overrides[o.id];
    return ov ? { ...o, status: ov.status ?? o.status, customer_note: ov.customer_note ?? o.customer_note } : o;
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos importados do WooCommerce em tempo real.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setPage(1);
          }}
          placeholder="Buscar por número, cliente, email…"
          className="flex-1 min-w-[220px] rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !data?.configured ? (
          <div className="p-6 text-sm text-muted-foreground">
            WooCommerce não configurado. Cadastre <code>site_url</code>, <code>consumer_key</code> e{" "}
            <code>consumer_secret</code> na tabela <code>integrations</code>.
          </div>
        ) : data.error ? (
          <div className="p-6 text-sm text-destructive">{data.error}</div>
        ) : (items?.length ?? 0) === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum pedido encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items!.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">#{o.number}</td>
                    <td className="px-4 py-3">
                      <div>
                        {(o.billing.first_name ?? "") + " " + (o.billing.last_name ?? "")}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.billing.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(o.date_created).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        disabled={savingId === o.id}
                        onChange={(e) => updateOrder(o.id, { status: e.target.value })}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 outline-none focus:ring-2 focus:ring-ring ${
                          STATUS_COLOR[o.status] ?? "bg-muted text-foreground"
                        }`}
                      >
                        {STATUS_OPTIONS.filter((s) => s.value !== "any").map((s) => (
                          <option key={s.value} value={s.value} className="bg-background text-foreground">
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.line_items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(o.total, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(o)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.configured && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {data.total} pedidos • página {page} de {data.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border bg-card px-3 py-1.5 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="rounded-md border border-border bg-card px-3 py-1.5 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {editing && (
        <EditOrderDialog
          order={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateOrder(editing.id, patch);
            setEditing(null);
          }}
          saving={savingId === editing.id}
        />
      )}
    </>
  );
}

function EditOrderDialog({
  order,
  onClose,
  onSave,
  saving,
}: {
  order: WcOrder;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void | Promise<void>;
  saving: boolean;
}) {
  const [firstName, setFirstName] = useState(order.billing.first_name ?? "");
  const [lastName, setLastName] = useState(order.billing.last_name ?? "");
  const [email, setEmail] = useState(order.billing.email ?? "");
  const [phone, setPhone] = useState(order.billing.phone ?? "");
  const [address, setAddress] = useState(order.billing.address_1 ?? "");
  const [city, setCity] = useState(order.billing.city ?? "");
  const [state, setState] = useState(order.billing.state ?? "");
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.customer_note ?? "");

  type LineDraft = {
    key: string;
    id?: number;
    product_id?: number;
    name: string;
    quantity: number;
    total: string;
    removed?: boolean;
  };
  const [items, setItems] = useState<LineDraft[]>(
    order.line_items.map((l) => ({
      key: `l-${l.id}`,
      id: l.id,
      product_id: l.product_id,
      name: l.name,
      quantity: l.quantity,
      total: l.total,
    })),
  );

  type ShipDraft = {
    key: string;
    id?: number;
    method_title: string;
    total: string;
    removed?: boolean;
  };
  const [ships, setShips] = useState<ShipDraft[]>(
    (order.shipping_lines ?? []).map((s) => ({
      key: `s-${s.id}`,
      id: s.id,
      method_title: s.method_title ?? "Frete",
      total: s.total,
    })),
  );

  function updateItem(key: string, patch: Partial<LineDraft>) {
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function updateShip(key: string, patch: Partial<ShipDraft>) {
    setShips((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function buildPatch(): Record<string, unknown> {
    const line_items = items
      .filter((i) => i.id || (!i.removed && (i.product_id || i.name)))
      .map((i) => {
        if (i.id && i.removed) return { id: i.id, quantity: 0 };
        const row: Record<string, unknown> = {};
        if (i.id) row.id = i.id;
        if (i.product_id) row.product_id = i.product_id;
        if (!i.id && i.name) row.name = i.name;
        row.quantity = i.quantity;
        if (i.total) row.total = i.total;
        return row;
      });

    const shipping_lines = ships
      .filter((s) => s.id || (!s.removed && (s.method_title || s.total)))
      .map((s) => {
        if (s.id && s.removed) return { id: s.id, method_id: "" };
        const row: Record<string, unknown> = {};
        if (s.id) row.id = s.id;
        row.method_title = s.method_title || "Frete";
        row.method_id = "flat_rate";
        row.total = s.total || "0";
        return row;
      });

    return {
      status,
      customer_note: note,
      billing: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address_1: address,
        city,
        state,
      },
      line_items,
      shipping_lines,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Editar pedido #{order.number}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Nome" value={firstName} onChange={setFirstName} />
          <Field label="Sobrenome" value={lastName} onChange={setLastName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Telefone" value={phone} onChange={setPhone} />
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Endereço</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <Field label="Cidade" value={city} onChange={setCity} />
          <Field label="Estado" value={state} onChange={setState} />
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {STATUS_OPTIONS.filter((s) => s.value !== "any").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Observação do cliente</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Produtos</h3>
            <button
              type="button"
              onClick={() =>
                setItems((a) => [
                  ...a,
                  { key: `n-${Date.now()}`, name: "", quantity: 1, total: "0" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.key}
                className={`grid grid-cols-12 items-center gap-2 rounded-md border border-border p-2 ${
                  i.removed ? "opacity-40" : ""
                }`}
              >
                {i.id ? (
                  <div className="col-span-5 text-sm">{i.name}</div>
                ) : (
                  <input
                    placeholder="ID do produto"
                    value={i.product_id ?? ""}
                    onChange={(e) =>
                      updateItem(i.key, { product_id: Number(e.target.value) || undefined })
                    }
                    className="col-span-5 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                )}
                <input
                  type="number"
                  min={1}
                  value={i.quantity}
                  onChange={(e) => updateItem(i.key, { quantity: Number(e.target.value) })}
                  className="col-span-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <input
                  placeholder="Total"
                  value={i.total}
                  onChange={(e) => updateItem(i.key, { total: e.target.value })}
                  className="col-span-4 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    i.id
                      ? updateItem(i.key, { removed: !i.removed })
                      : setItems((a) => a.filter((x) => x.key !== i.key))
                  }
                  className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Frete</h3>
            <button
              type="button"
              onClick={() =>
                setShips((a) => [
                  ...a,
                  { key: `n-${Date.now()}`, method_title: "Frete", total: "0" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {ships.map((s) => (
              <div
                key={s.key}
                className={`grid grid-cols-12 items-center gap-2 rounded-md border border-border p-2 ${
                  s.removed ? "opacity-40" : ""
                }`}
              >
                <input
                  value={s.method_title}
                  onChange={(e) => updateShip(s.key, { method_title: e.target.value })}
                  className="col-span-7 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <input
                  value={s.total}
                  onChange={(e) => updateShip(s.key, { total: e.target.value })}
                  className="col-span-4 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    s.id
                      ? updateShip(s.key, { removed: !s.removed })
                      : setShips((a) => a.filter((x) => x.key !== s.key))
                  }
                  className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={() => onSave(buildPatch())}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
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
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
}