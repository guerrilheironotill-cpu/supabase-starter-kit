import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { fetchWc, type WcOrder } from "@/lib/wc-api";

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
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOR[o.status] ?? "bg-muted text-foreground"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.line_items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(o.total, o.currency)}
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
    </>
  );
}

// keep icon import used
void ExternalLink;