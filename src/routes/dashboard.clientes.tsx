import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
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
  created_at: string;
};

function CustomersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["local-customers"],
    queryFn: async () => {
      // Try with all optional cols; fallback if some don't exist yet
      let res = await supabase
        .from("customers" as never)
        .select("id, first_name, last_name, email, phone, address_1, city, state, cpf, cnpj, status, created_at")
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
    if (!q) return data ?? [];
    return (data ?? []).filter((c) => {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.cpf ?? "").toLowerCase().includes(q) ||
        (c.cnpj ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes cadastrados a partir de orçamentos aprovados.
        </p>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, telefone, CPF/CNPJ…"
          className="w-full max-w-md rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

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
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">CPF/CNPJ</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.cpf ?? c.cnpj ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
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