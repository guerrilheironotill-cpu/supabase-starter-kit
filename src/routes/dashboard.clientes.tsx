import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchWc, type WcCustomer } from "@/lib/wc-api";

export const Route = createFileRoute("/dashboard/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["wc-customers", page, search],
    queryFn: () =>
      fetchWc<WcCustomer>({
        resource: "customers",
        page,
        perPage: 20,
        search,
      }),
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes cadastrados no WooCommerce.
        </p>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setPage(1);
          }}
          placeholder="Buscar por nome, email…"
          className="w-full max-w-md rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !data?.configured ? (
          <div className="p-6 text-sm text-muted-foreground">
            WooCommerce não configurado.
          </div>
        ) : data.error ? (
          <div className="p-6 text-sm text-destructive">{data.error}</div>
        ) : data.items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total gasto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {(c.first_name || c.last_name)
                        ? `${c.first_name} ${c.last_name}`.trim()
                        : c.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.billing.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.billing.city, c.billing.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.date_created).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">{c.orders_count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.total_spent ? Number(c.total_spent).toFixed(2) : "0,00"}
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
            {data.total} clientes • página {page} de {data.totalPages}
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