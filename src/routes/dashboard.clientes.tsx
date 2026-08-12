import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/clientes")({
  head: () => ({
    meta: [{ title: "Clientes — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: CustomersPage,
});

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_1: string | null;
  city: string | null;
  state: string | null;
  cpf: string | null;
  cnpj: string | null;
  status: string | null;
  origin: string | null;
  created_at: string;
};

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [originFilter, setOriginFilter] = useState("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["local-customers"],
    queryFn: async () => {
      // Try with all optional cols; fallback if some don't exist yet
      let res = await supabase
        .from("customers" as never)
        .select(
          "id, first_name, last_name, email, phone, address_1, city, state, cpf, cnpj, status, origin, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (res.error) {
        res = await supabase
          .from("customers" as never)
          .select("id, first_name, last_name, email, phone, address_1, city, state, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
      }
      if (res.error) throw res.error;
      return (res.data ?? []) as unknown as Row[];
    },
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
      return (
        (statusFilter === "any" || (c.status ?? "active") === statusFilter) &&
        (originFilter === "any" || (c.origin ?? "site") === originFilter) &&
        (!q ||
          name.includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.cpf ?? "").toLowerCase().includes(q) ||
          (c.cnpj ?? "").toLowerCase().includes(q))
      );
    });
  }, [data, originFilter, search, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  async function bulkStatus(status: string) {
    const ids = [...selected];
    const { error } = await supabase
      .from("customers" as never)
      .update({ status } as never)
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["local-customers"] });
    toast.success(`${ids.length} cliente(s) atualizado(s)`);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes cadastrados a partir de orçamentos aprovados.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, telefone, CPF/CNPJ…"
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
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="any">Todas as origens</option>
          <option value="site">Site</option>
          <option value="woocommerce_import">Importados</option>
        </select>
      </div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
          <span>{selected.size} selecionado(s)</span>
          <button
            onClick={() => bulkStatus("active")}
            className="rounded border border-border bg-background px-2 py-1"
          >
            Ativar
          </button>
          <button
            onClick={() => bulkStatus("inactive")}
            className="rounded border border-border bg-background px-2 py-1"
          >
            Inativar
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            {(error as { message?: string }).message ?? "Erro ao carregar"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)))
                      }
                    />
                  </th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">CPF/CNPJ</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 font-medium">
                      {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cpf ?? c.cnpj ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {(c.status ?? "active") === "active" ? "Ativo" : "Inativo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
