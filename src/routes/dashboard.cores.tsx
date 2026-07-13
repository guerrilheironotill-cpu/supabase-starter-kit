import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/cores")({
  head: () => ({
    meta: [
      { title: "Cores — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardColorsPage,
});

const fetchColors = (): Promise<AttributeTerm[]> =>
  fetchAttributeTerms("product_colors", "color_catalog");

function DashboardColorsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "cores"],
    queryFn: fetchColors,
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione imagem e descrição a cada cor.
        </p>
      </div>

      <CreateColorForm
        onCreated={() => qc.invalidateQueries({ queryKey: ["dashboard", "cores"] })}
      />

      <DashboardSection title={`Cores (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((c) => (
              <DashboardMediaEditor
                key={c.name}
                label={c.name}
                sublabel={`${c.count} produto${c.count === 1 ? "" : "s"}`}
                imageUrl={c.image_url}
                description={c.description}
                bucketFolder="colors"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("color_catalog")
                    .upsert(
                      {
                        name: c.name,
                        image_url,
                        description: description ?? null,
                      },
                      { onConflict: "name" },
                    );
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ["dashboard", "cores"] });
                }}
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}

function CreateColorForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("color_catalog")
        .upsert({ name: trimmed }, { onConflict: "name" });
      if (upErr) throw upErr;
      setName("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da nova cor"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        onClick={create}
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Criar
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}