import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/row-actions-menu";

type Order = { id: string; number: number; external_number: string | null };
type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: string;
  origin: string;
  customer_type: string;
  commercial_status: string;
  created_at: string;
  orders: Order[];
};
type SortKey =
  | "name"
  | "email"
  | "phone"
  | "document"
  | "orders"
  | "customer_type"
  | "commercial_status"
  | "created_at";

export const Route = createFileRoute("/dashboard/clientes")({
  head: () => ({
    meta: [{ title: "Clientes — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [typeFilter, setTypeFilter] = useState("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["local-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers" as never)
        .select(
          "id,first_name,last_name,email,phone,cpf,cnpj,city,state,status,origin,customer_type,commercial_status,created_at,orders:app_orders(id,number,external_number)",
        )
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    staleTime: 15000,
  });
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = data.filter((c) => {
      const text =
        `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.cpf ?? c.cnpj ?? ""}`.toLowerCase();
      return (
        (!q || text.includes(q)) &&
        (statusFilter === "any" || c.status === statusFilter) &&
        (typeFilter === "any" || c.customer_type === typeFilter)
      );
    });
    const sign = direction === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const value = (row: Row) =>
        sortKey === "name"
          ? `${row.first_name ?? ""} ${row.last_name ?? ""}`
          : sortKey === "document"
            ? (row.cpf ?? row.cnpj ?? "")
            : sortKey === "orders"
              ? (row.orders?.length ?? 0)
              : row[sortKey];
      return (
        String(value(a) ?? "").localeCompare(String(value(b) ?? ""), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        }) * sign
      );
    });
  }, [data, direction, search, sortKey, statusFilter, typeFilter]);
  const all = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDirection((v) => (v === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDirection("asc");
    }
  };
  async function bulkStatus(status: string) {
    const ids = [...selected];
    const { error } = await supabase
      .from("customers" as never)
      .update({ status } as never)
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["local-customers"] });
  }
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastros, condições comerciais e histórico de pedidos.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, e-mail, telefone ou CPF/CNPJ"
          className="min-w-[260px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todos os tipos</option>
          <option value="final">Cliente final</option>
          <option value="professional">Profissional</option>
          <option value="reseller">Revendedor</option>
        </select>
      </div>
      {selected.size > 0 && (
        <div className="mb-3 flex gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
          <span>{selected.size} selecionado(s)</span>
          <button onClick={() => bulkStatus("active")} className="rounded border px-2">
            Ativar
          </button>
          <button onClick={() => bulkStatus("inactive")} className="rounded border px-2">
            Inativar
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">{(error as Error).message}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={() =>
                      setSelected(all ? new Set() : new Set(filtered.map((c) => c.id)))
                    }
                  />
                </th>
                <Header
                  label="Nome"
                  value="name"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="E-mail"
                  value="email"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="Telefone"
                  value="phone"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="CPF/CNPJ"
                  value="document"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="Pedidos"
                  value="orders"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="Tipo"
                  value="customer_type"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <Header
                  label="Comercial"
                  value="commercial_status"
                  active={sortKey}
                  direction={direction}
                  onSort={toggleSort}
                />
                <th className="px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.cpf || c.cnpj || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.orders ?? []).map((o) => (
                        <Link
                          key={o.id}
                          to="/dashboard/editar-pedido/$orderId"
                          params={{ orderId: o.id }}
                          className="rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted"
                        >
                          #{o.external_number || o.number}
                        </Link>
                      ))}
                      {!c.orders?.length && "—"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {c.customer_type === "professional"
                      ? "Profissional"
                      : c.customer_type === "reseller"
                        ? "Revendedor"
                        : "Final"}
                  </td>
                  <td className="px-3 py-3">
                    {c.customer_type === "final"
                      ? "Não se aplica"
                      : c.commercial_status === "approved"
                        ? "Aprovado"
                        : c.commercial_status === "suspended"
                          ? "Suspenso"
                          : "Pendente"}
                  </td>
                  <td className="px-3 py-3">
                    <RowActionsMenu
                      actions={[
                        {
                          label: "Editar cliente",
                          icon: Pencil,
                          onClick: () =>
                            window.location.assign(`/dashboard/editar-cliente/${c.id}`),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
function Header({
  label,
  value,
  active,
  direction,
  onSort,
}: {
  label: string;
  value: SortKey;
  active: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const Icon = active === value ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-3 py-3">
      <button onClick={() => onSort(value)} className="inline-flex items-center gap-1">
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}
