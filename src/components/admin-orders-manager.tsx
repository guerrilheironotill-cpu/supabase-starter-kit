import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Order = {
  id: string;
  number: number;
  external_number: string | null;
  status: string;
  origin: string;
  total: number;
  currency: string;
  created_at: string;
  customer_id: string | null;
  lead_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  customer: { first_name: string | null; last_name: string | null; email: string | null } | null;
  items: Array<{ id: string }>;
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
const paid = new Set(["processing", "completed", "refunded"]);
const money = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value) || 0);

export function AdminOrdersManager() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("any");
  const [origin, setOrigin] = useState("any");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [working, setWorking] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["app-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_orders" as never)
        .select(
          "id, number, external_number, status, origin, total, currency, created_at, customer_id, lead_id, customer_name, customer_email, customer_phone, customer_document, customer:customers(first_name,last_name,email), items:app_order_items(id)",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Order[];
    },
  });

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const name =
          order.customer_name ||
          `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim();
        const haystack =
          `${order.number} ${order.external_number ?? ""} ${name} ${order.customer_email ?? order.customer?.email ?? ""}`.toLowerCase();
        const date = order.created_at.slice(0, 10);
        return (
          (status === "any" || order.status === status) &&
          (origin === "any" || order.origin === origin) &&
          (!search || haystack.includes(search.toLowerCase())) &&
          (!from || date >= from) &&
          (!to || date <= to) &&
          (!min || Number(order.total) >= Number(min)) &&
          (!max || Number(order.total) <= Number(max))
        );
      }),
    [orders, status, origin, search, from, to, min, max],
  );

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((o) => o.id)));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function changeStatus(ids: string[], nextStatus: string) {
    if (!ids.length) return;
    setWorking(true);
    try {
      await Promise.all(
        ids.map((orderId) =>
          authorizedPost("/api/orders/reconcile-person", { orderId, status: nextStatus }),
        ),
      );
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["app-orders"] });
      await qc.invalidateQueries({ queryKey: ["local-customers"] });
      toast.success(`${ids.length} pedido(s) atualizado(s)`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function removeSelected() {
    const ids = [...selected];
    if (
      !ids.length ||
      !window.confirm(`Excluir ${ids.length} pedido(s)? Esta ação não pode ser desfeita.`)
    )
      return;
    const { error: itemError } = await supabase
      .from("app_order_items" as never)
      .delete()
      .in("order_id", ids);
    if (itemError) return toast.error(itemError.message);
    const { error } = await supabase
      .from("app_orders" as never)
      .delete()
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["app-orders"] });
    toast.success("Pedidos excluídos");
  }

  async function authorizedPost(path: string, body?: unknown) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "Operação não concluída.");
    return json;
  }

  async function reconcile(orderId: string) {
    setWorking(true);
    try {
      const result = await authorizedPost("/api/orders/reconcile-person", { orderId });
      toast.success(
        result.kind === "customer" ? "Cliente vinculado ao pedido." : "Lead vinculado ao pedido.",
      );
      await qc.invalidateQueries({ queryKey: ["app-orders"] });
      await qc.invalidateQueries({ queryKey: ["local-customers"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos locais autônomos. A origem é apenas informativa.
          </p>
        </div>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pedido, cliente ou e-mail"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todos os status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todas as origens</option>
          <option value="site">Site</option>
          <option value="woocommerce_import">Pedidos históricos</option>
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-2 text-xs"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-2 text-xs"
          />
        </div>
        <input
          type="number"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Preço mínimo"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Preço máximo"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
          <span>{selected.size} selecionado(s)</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) void changeStatus([...selected], e.target.value);
              e.currentTarget.value = "";
            }}
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="" disabled>
              Mudar status…
            </option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
          <button
            onClick={removeSelected}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-3 py-3">Pedido</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Origem</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => {
                const approved = paid.has(order.status);
                const missingPerson = approved ? !order.customer_id : !order.lead_id;
                const name =
                  order.customer_name ||
                  `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() ||
                  "Cliente não identificado";
                return (
                  <tr key={order.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggle(order.id)}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium">
                      #{order.external_number || order.number}
                    </td>
                    <td className="px-3 py-3">
                      <div>{name}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.customer_email || order.customer?.email}
                      </div>
                      {missingPerson && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{approved ? "Cliente não cadastrado" : "Lead não cadastrado"}</span>
                          <button
                            disabled={working}
                            onClick={() => reconcile(order.id)}
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-1.5 py-0.5 hover:bg-amber-500/10"
                          >
                            <RefreshCw className="h-3 w-3" /> Atualizar cadastro
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => changeStatus([order.id], e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {labels[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {order.origin === "woocommerce_import" ? "Histórico" : "Site"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {money(order.total, order.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to="/dashboard/editar-pedido/$orderId"
                        params={{ orderId: order.id }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum pedido encontrado.
          </div>
        )}
      </div>
    </>
  );
}
