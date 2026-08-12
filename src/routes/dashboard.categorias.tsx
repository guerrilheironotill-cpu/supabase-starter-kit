import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { useState } from "react";
import { Loader2, Upload, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCategoryTerms, type CategoryTerm } from "@/lib/dashboard-taxonomies";
import { slugify } from "@/lib/products";
import { toast } from "sonner";
import { schedulePreparedCatalogRefresh } from "@/lib/catalog-refresh";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { uploadOptimizedImage } from "@/lib/vps-media";
import { RowActionsMenu } from "@/components/row-actions-menu";

const UNCATEGORIZED_NAME = "Sem categoria";
const UNCATEGORIZED_SLUG = "sem-categoria";

export const Route = createFileRoute("/dashboard/categorias")({
  head: () => ({
    meta: [{ title: "Categorias — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardCategoriesPage,
});

function DashboardCategoriesPage() {
  const qc = useQueryClient();
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "categorias"],
    queryFn: fetchCategoryTerms,
    staleTime: 30_000,
  });

  const selectedCategories = data.filter((category) => selectedSlugs.has(category.slug));
  const movableProductCount = selectedCategories.reduce(
    (total, category) => total + category.count,
    0,
  );
  const selectableCategories = data.filter((category) => category.slug !== UNCATEGORIZED_SLUG);
  const allSelected =
    selectableCategories.length > 0 &&
    selectableCategories.every((category) => selectedSlugs.has(category.slug));

  function toggleCategory(slug: string) {
    if (slug === UNCATEGORIZED_SLUG) return;
    setSelectedSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAll() {
    setSelectedSlugs(
      allSelected ? new Set() : new Set(selectableCategories.map((category) => category.slug)),
    );
  }

  async function deleteSelectedCategories() {
    if (selectedCategories.length === 0 || deleting) return;
    const ids = selectedCategories.flatMap((category) => (category.id ? [category.id] : []));
    if (ids.length !== selectedCategories.length) {
      toast.error("Uma das categorias não possui um cadastro removível.");
      return;
    }
    setDeleting(true);
    try {
      const { error: defaultCategoryError } = await supabase
        .from("categories")
        .upsert(
          { name: UNCATEGORIZED_NAME, slug: UNCATEGORIZED_SLUG, sort_order: 9999 },
          { onConflict: "slug" },
        );
      if (defaultCategoryError) throw defaultCategoryError;

      const categoryNames = selectedCategories.map((category) => category.name);
      const { error: moveProductsError } = await supabase
        .from("products")
        .update({ category: UNCATEGORIZED_NAME })
        .in("category", categoryNames);
      if (moveProductsError) throw moveProductsError;

      const { error } = await supabase.from("categories").delete().in("id", ids);
      if (error) throw error;
      setSelectedSlugs(new Set());
      setConfirmDelete(false);
      await qc.invalidateQueries({ queryKey: ["dashboard", "categorias"] });
      schedulePreparedCatalogRefresh();
      toast.success(
        `${ids.length} categoria${ids.length === 1 ? " excluída" : "s excluídas"} com sucesso.`,
      );
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível excluir as categorias selecionadas.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Categorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite capa e ícone (SVG) de cada categoria.
        </p>
      </div>

      <CreateCategoryForm
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["dashboard", "categorias"] });
          schedulePreparedCatalogRefresh();
          toast.success("Categoria criada com sucesso!");
        }}
      />

      <DashboardSection title={`Categorias (${data.length})`}>
        {selectedSlugs.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {selectedSlugs.size} categoria
              {selectedSlugs.size === 1 ? " selecionada" : "s selecionadas"}
            </span>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" /> Excluir selecionadas
            </button>
          </div>
        )}
        {!isLoading && data.length > 0 && (
          <label className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-primary"
            />
            Selecionar todas
          </label>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((c) => (
              <div
                key={c.slug}
                className={`relative rounded-2xl ${selectedSlugs.has(c.slug) ? "ring-2 ring-primary/30" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedSlugs.has(c.slug)}
                  onChange={() => toggleCategory(c.slug)}
                  disabled={c.slug === UNCATEGORIZED_SLUG}
                  aria-label={
                    c.slug === UNCATEGORIZED_SLUG
                      ? "Sem categoria é protegida"
                      : `Selecionar ${c.name}`
                  }
                  title={c.slug === UNCATEGORIZED_SLUG ? "Categoria protegida" : undefined}
                  className="absolute right-14 top-5 z-10 h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-35"
                />
                {c.slug !== UNCATEGORIZED_SLUG && (
                  <div className="absolute right-4 top-3 z-20">
                    <RowActionsMenu
                      label={`Ações de ${c.name}`}
                      actions={[
                        {
                          label: "Excluir categoria",
                          icon: Trash2,
                          destructive: true,
                          onClick: () => {
                            setSelectedSlugs(new Set([c.slug]));
                            setConfirmDelete(true);
                          },
                        },
                      ]}
                    />
                  </div>
                )}
                <CategoryEditor
                  row={c}
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ["dashboard", "categorias"] });
                    schedulePreparedCatalogRefresh();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </DashboardSection>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categorias selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCategories.length} categoria
              {selectedCategories.length === 1 ? " será excluída" : "s serão excluídas"}{" "}
              permanentemente.
              {movableProductCount > 0 &&
                ` ${movableProductCount} produto${movableProductCount === 1 ? " será movido" : "s serão movidos"} automaticamente para “Sem categoria”.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedCategories();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir e mover produtos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateCategoryForm({ onCreated }: { onCreated: () => void }) {
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
        .from("categories")
        .upsert({ name: trimmed, slug: slugify(trimmed) }, { onConflict: "slug" });
      if (upErr) throw upErr;
      setName("");
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao criar";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Nome da nova categoria"
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

function CategoryEditor({ row, onSaved }: { row: CategoryTerm; onSaved: () => void }) {
  const [cover, setCover] = useState<string | null>(row.cover_image);
  const [icon, setIcon] = useState<string>(row.icon_svg ?? "");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadCover(file: File) {
    setBusy(true);
    setError(null);
    try {
      setCover(await uploadOptimizedImage(file, "categories"));
      setDirty(true);
      toast.success("Imagem enviada! Clique em Salvar para confirmar.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no upload";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = { cover_image: cover, icon_svg: icon.trim() || null };
      const { error: upErr } = row.id
        ? await supabase.from("categories").update(payload).eq("id", row.id)
        : await supabase
            .from("categories")
            .upsert({ name: row.name, slug: row.slug, ...payload }, { onConflict: "slug" });
      if (upErr) throw upErr;
      setDirty(false);
      onSaved();
      toast.success(`Categoria "${row.name}" salva!`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar";
      setError(msg);
      toast.error(msg);
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
        dangerouslySetInnerHTML={{
          __html: icon || '<span class="text-xs text-muted-foreground">Sem ícone</span>',
        }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            /{row.slug} · {row.count} produto{row.count === 1 ? "" : "s"}
          </p>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">Ícone (SVG)</label>
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
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
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
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    </div>
  );
}
