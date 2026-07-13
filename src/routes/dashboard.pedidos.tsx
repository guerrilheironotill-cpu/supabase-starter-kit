import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
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

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  meta: Record<string, unknown> | null;
};

type AppOrder = {
  id: string;
  number: number;
  status: string;
  currency: string;
  subtotal: number;
  shipping_total: number;
  total: number;
  customer_note: string | null;
  created_at: string;
  customers: Customer | null;
  app_order_items: OrderItem[];
};

const STATUS_OPTIONS = [
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

function fmt(n: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("any");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingStatusById, setPendingStatusById] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["app-orders", status, search],
    queryFn: async () => {
      let q = supabase
        .from("app_orders" as never)
        .select(
          "id, number, status, currency, subtotal, shipping_total, total, customer_note, created_at, customers(id, first_name, last_name, email, phone), app_order_items(id, name, quantity, unit_price, total, meta)",
        )
        .eq("is_quote", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "any") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as unknown as AppOrder[];
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        rows = rows.filter((o) => {
          const c = o.customers;
          const name = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.toLowerCase();
          return (
            name.includes(s) ||
            (c?.email ?? "").toLowerCase().includes(s) ||
            (c?.phone ?? "").toLowerCase().includes(s) ||
            String(o.number).includes(s)
          );
        });
      }
      return rows;
    },
    staleTime: 15_000,
  });

  async function updateStatus(id: string, next: string) {
    setSavingId(id);
    setPendingStatusById((current) => ({ ...current, [id]: next }));
    try {
      const { data: updated, error } = await supabase
        .from("app_orders" as never)
        .update({ status: next } as never)
        .eq("id", id)
        .select("id, status")
        .single();
      if (error) throw error;
      if (!updated) throw new Error("Pedido não encontrado para atualizar.");
      qc.setQueriesData<AppOrder[]>({ queryKey: ["app-orders"] }, (rows) =>
        rows?.map((order) => (order.id === id ? { ...order, status: next } : order)),
      );
      toast.success("Status atualizado");
      void qc.invalidateQueries({ queryKey: ["app-orders"] });
    } catch (e) {
      setPendingStatusById((current) => {
        const nextState = { ...current };
        delete nextState[id];
        return nextState;
      });
      toast.error("Erro ao atualizar status: " + (e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos criados a partir de orçamentos aprovados.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todos</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, cliente, email…"
          className="flex-1 min-w-[220px] rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
        ) : !data || data.length === 0 ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((o) => {
                  const c = o.customers;
                  const currentStatus = pendingStatusById[o.id] ?? o.status;
                  const clientName = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "—";
                  return (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">#{o.number}</td>
                      <td className="px-4 py-3">
                        <div>{clientName}</div>
                        <div className="text-xs text-muted-foreground">
                          {c?.email ?? c?.phone ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={currentStatus}
                          disabled={savingId === o.id}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 outline-none focus:ring-2 focus:ring-ring ${
                            STATUS_COLOR[currentStatus] ?? "bg-muted text-foreground"
                          }`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option
                              key={s.value}
                              value={s.value}
                              className="bg-background text-foreground"
                            >
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.app_order_items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmt(Number(o.total), o.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}