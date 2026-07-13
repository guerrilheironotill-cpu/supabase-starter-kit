import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardCategoriesPage,
});

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  cover_image: string | null;
  icon_svg: string | null;
};

async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, cover_image, icon_svg")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

function DashboardCategoriesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "categorias"],
    queryFn: fetchCategories,
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite capa e ícone (SVG) de cada categoria.
        </p>
      </div>

      <DashboardSection title={`Categorias (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((c) => (
              <CategoryEditor
                key={c.slug}
                row={c}
                onSaved={() =>
                  qc.invalidateQueries({ queryKey: ["dashboard", "categorias"] })
                }
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}

function CategoryEditor({ row, onSaved }: { row: CategoryRow; onSaved: () => void }) {
  const [cover, setCover] = useState<string | null>(row.cover_image);
  const [icon, setIcon] = useState<string>(row.icon_svg ?? "");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadCover(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `categories/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("catalog-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("catalog-media").getPublicUrl(path);
      setCover(data.publicUrl);
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("categories")
        .update({ cover_image: cover, icon_svg: icon.trim() || null })
        .eq("id", row.id);
      if (upErr) throw upErr;
      setDirty(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-start">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
        {cover ? (
          <img src={cover} alt={row.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Sem capa
          </div>
        )}
      </div>
      <div
        className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background p-3 text-foreground [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: icon || '<span class="text-xs text-muted-foreground">Sem ícone</span>' }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">/{row.slug}</p>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">
          Ícone (SVG)
        </label>
        <textarea
          value={icon}
          onChange={(e) => {
            setIcon(e.target.value);
            setDirty(true);
          }}
          placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Enviar capa
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
                e.target.value = "";
              }}
            />
          </label>
          {cover && (
            <button
              type="button"
              onClick={() => {
                setCover(null);
                setDirty(true);
              }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Remover capa
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              dirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            Salvar
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    </div>
  );
}