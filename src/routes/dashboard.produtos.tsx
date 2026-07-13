import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { ProductEditorDialog } from "@/components/product-editor-dialog";

export const Route = createFileRoute("/dashboard/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardProductsPage,
});

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, active, images")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

function DashboardProductsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "produtos"],
    queryFn: fetchProducts,
    staleTime: 60_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Produtos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produtos cadastrados no catálogo.
        </p>
      </div>

      <DashboardSection title={`Cadastros (${data.length})`}>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              ) : (
                data.map((p) => {
                  const row = p as {
                    id: string;
                    name: string;
                    category: string;
                    active: boolean;
                    images: string[] | null;
                  };
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {row.images?.[0] && (
                              <img
                                src={row.images[0]}
                                alt={row.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <span className="font-medium text-foreground">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.active
                              ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {row.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <ProductEditorDialog
        productId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["dashboard", "produtos"] })}
      />
    </>
  );
}