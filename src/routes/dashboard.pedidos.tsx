import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { fetchWc, type WcOrder } from "@/lib/wc-api";
import { supabase } from "@/integrations/supabase/client";
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
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Sem sessão");
      const res = await fetch("/api/wc/update-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...patch }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erro ao atualizar");
      toast.success("Pedido atualizado");
      qc.invalidateQueries({ queryKey: ["wc-orders"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

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
        ) : data.items.length === 0 ? (
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
                {data.items.map((o) => (
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
  const [city, setCity] = useState(order.billing.city ?? "");
  const [state, setState] = useState(order.billing.state ?? "");
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Editar pedido #{order.number}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Nome" value={firstName} onChange={setFirstName} />
          <Field label="Sobrenome" value={lastName} onChange={setLastName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Telefone" value={phone} onChange={setPhone} />
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
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={() =>
              onSave({
                status,
                customer_note: note || undefined,
                billing: {
                  first_name: firstName,
                  last_name: lastName,
                  email,
                  phone,
                  city,
                  state,
                },
              })
            }
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