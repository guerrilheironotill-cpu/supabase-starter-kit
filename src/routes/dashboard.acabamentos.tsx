import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardGalleryEditor } from "@/components/dashboard-gallery-editor";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";
import { fetchFinishColors, type FinishColor } from "@/lib/finish-colors";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { refreshPreparedCatalogs } from "@/lib/catalog-cache";
import {
  clearCatalogPdfPending,
  isCatalogPdfPending,
  markCatalogPdfPending,
} from "@/lib/catalog-pending";

export const Route = createFileRoute("/dashboard/acabamentos")({
  head: () => ({
    meta: [{ title: "Acabamentos — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardFinishesPage,
});

const fetchFinishes = (): Promise<AttributeTerm[]> =>
  fetchAttributeTerms("product_finishes", "finish_catalog");

function DashboardFinishesPage() {
  const qc = useQueryClient();
  const [finishToDelete, setFinishToDelete] = useState<AttributeTerm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const [updatingPdf, setUpdatingPdf] = useState(false);
  const [dragHandleName, setDragHandleName] = useState<string | null>(null);
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ name: string; after: boolean } | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "acabamentos"],
    queryFn: fetchFinishes,
    staleTime: 30_000,
  });
  const { data: colorTerms = [] } = useQuery({
    queryKey: ["dashboard", "cores-catalogo"],
    queryFn: () => fetchAttributeTerms("product_colors", "color_catalog"),
    staleTime: 30_000,
  });
  const { data: finishColors = [] } = useQuery({
    queryKey: ["finish-colors"],
    queryFn: fetchFinishColors,
    staleTime: 30_000,
  });

  async function moveFinish(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= data.length) return;
    const current = data[index];
    const target = data[targetIndex];
    const currentOrder = current.sort_order === 9999 ? index : current.sort_order;
    const targetOrder = target.sort_order === 9999 ? targetIndex : target.sort_order;
    const updates = await Promise.all([
      supabase
        .from("finish_catalog")
        .upsert({ name: current.name, sort_order: targetOrder }, { onConflict: "name" }),
      supabase
        .from("finish_catalog")
        .upsert({ name: target.name, sort_order: currentOrder }, { onConflict: "name" }),
    ]);
    const error = updates.find((result) => result.error)?.error;
    if (error) throw error;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] }),
      qc.invalidateQueries({ queryKey: ["attribute-terms", "product_finishes"] }),
    ]);
    markPdfPending();
  }

  // Drag-and-drop reorder: the catalog PDF lists finishes in this exact order, so the
  // whole list (not just adjacent neighbors) can be reshuffled in one drag.
  async function moveFinishTo(draggedName: string, targetName: string, after: boolean) {
    if (draggedName === targetName) return;
    const ordered = [...data];
    const draggedIndex = ordered.findIndex((f) => f.name === draggedName);
    if (draggedIndex < 0) return;
    const [dragged] = ordered.splice(draggedIndex, 1);
    const targetIndex = ordered.findIndex((f) => f.name === targetName);
    if (targetIndex < 0) return;
    ordered.splice(after ? targetIndex + 1 : targetIndex, 0, dragged);
    const originalIndex = new Map(data.map((f, index) => [f.name, index]));
    const changed = ordered
      .map((f, position) => ({ name: f.name, position }))
      .filter(({ name, position }) => originalIndex.get(name) !== position);
    if (changed.length === 0) return;
    const results = await Promise.all(
      changed.map(({ name, position }) =>
        supabase
          .from("finish_catalog")
          .upsert({ name, sort_order: position }, { onConflict: "name" }),
      ),
    );
    const failed = results.find((result) => result.error)?.error;
    if (failed) throw failed;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] }),
      qc.invalidateQueries({ queryKey: ["attribute-terms", "product_finishes"] }),
    ]);
    markPdfPending();
  }

  useEffect(() => {
    setPdfPending(isCatalogPdfPending());
  }, []);

  function markPdfPending() {
    markCatalogPdfPending();
    setPdfPending(true);
  }

  async function updateFinishesInPdf() {
    if (updatingPdf) return;
    setUpdatingPdf(true);
    try {
      await refreshPreparedCatalogs();
      clearCatalogPdfPending();
      setPdfPending(false);
      toast.success("Acabamentos atualizados nos dois catálogos PDF.");
    } catch (error) {
      console.error("Falha ao atualizar os acabamentos nos PDFs:", error);
      toast.error("Não foi possível atualizar os PDFs. A atualização continua pendente.");
    } finally {
      setUpdatingPdf(false);
    }
  }

  async function deleteFinish() {
    if (!finishToDelete || deleting) return;
    setDeleting(true);
    try {
      const finish = finishToDelete;
      const { error: relationError } = await supabase
        .from("product_finishes")
        .delete()
        .eq("name", finish.name);
      if (relationError) throw relationError;
      const { error: finishColorsError } = await supabase
        .from("finish_colors" as never)
        .delete()
        .eq("finish_name", finish.name);
      if (finishColorsError) throw finishColorsError;
      const { error: legacyRelationError } = await supabase
        .from("product_finishes")
        .delete()
        .eq("finish", finish.name);
      if (legacyRelationError) throw legacyRelationError;
      const { error: catalogError } = await supabase
        .from("finish_catalog")
        .delete()
        .eq("name", finish.name);
      if (catalogError) throw catalogError;

      const urls = [finish.image_url, ...finish.gallery].filter((url): url is string =>
        Boolean(url),
      );
      const marker = "/storage/v1/object/public/catalog-media/";
      const paths = urls.flatMap((url) => {
        const index = url.indexOf(marker);
        if (index < 0) return [];
        const path = decodeURIComponent(url.slice(index + marker.length));
        return path.startsWith("finishes/") ? [path] : [];
      });
      if (paths.length > 0) await supabase.storage.from("catalog-media").remove(paths);

      await qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] });
      await qc.invalidateQueries({ queryKey: ["attribute-terms", "product_finishes"] });
      markPdfPending();
      toast.success(`Acabamento "${finish.name}" excluído.`);
      setFinishToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir acabamento.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Acabamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie a imagem principal circular e as imagens da galeria que serão exibidas no
            lightbox.
          </p>
          {pdfPending && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              Atualização dos acabamentos no PDF pendente.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void updateFinishesInPdf()}
          disabled={updatingPdf || !pdfPending}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updatingPdf ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {updatingPdf ? "Atualizando PDFs..." : "Atualizar acabamentos no PDF"}
        </button>
      </div>

      <CreateAttributeForm
        placeholder="Nome do novo acabamento"
        table="finish_catalog"
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] });
          markPdfPending();
          toast.success("Acabamento criado com sucesso!");
        }}
      />

      <DashboardSection title={`Acabamentos (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acabamento cadastrado.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((f, index) => (
              <div
                key={f.name}
                draggable={dragHandleName === f.name}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingName(f.name);
                }}
                onDragOver={(event) => {
                  if (!draggingName || draggingName === f.name) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const after = event.clientY > rect.top + rect.height / 2;
                  if (dropTarget?.name !== f.name || dropTarget.after !== after) {
                    setDropTarget({ name: f.name, after });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingName && dropTarget) {
                    void moveFinishTo(draggingName, dropTarget.name, dropTarget.after).catch(
                      (error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível salvar a ordem.",
                        ),
                    );
                  }
                  setDropTarget(null);
                }}
                onDragEnd={() => {
                  setDraggingName(null);
                  setDropTarget(null);
                  setDragHandleName(null);
                }}
                className={cn(
                  "relative transition-opacity",
                  draggingName === f.name && "opacity-40",
                  dropTarget?.name === f.name &&
                    (dropTarget.after
                      ? "shadow-[inset_0_-2px_0_0_var(--color-primary)]"
                      : "shadow-[inset_0_2px_0_0_var(--color-primary)]"),
                )}
              >
                <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={() => setDragHandleName(f.name)}
                    onMouseUp={() => setDragHandleName(null)}
                    aria-label={`Arraste para reordenar ${f.name}`}
                    title="Arraste para reordenar"
                    className="cursor-grab rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-muted active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      void moveFinish(index, -1).catch((error) => toast.error(error.message))
                    }
                    aria-label={`Mover ${f.name} para cima`}
                    className="rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === data.length - 1}
                    onClick={() =>
                      void moveFinish(index, 1).catch((error) => toast.error(error.message))
                    }
                    aria-label={`Mover ${f.name} para baixo`}
                    className="rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <RowActionsMenu
                    label={`Ações de ${f.name}`}
                    actions={[
                      {
                        label: "Excluir acabamento",
                        icon: Trash2,
                        destructive: true,
                        onClick: () => setFinishToDelete(f),
                      },
                    ]}
                  />
                </div>
                <DashboardGalleryEditor
                  label={f.name}
                  editableLabel
                  sublabel={`${f.count} produto${f.count === 1 ? "" : "s"}`}
                  mainImage={f.image_url}
                  gallery={f.gallery}
                  description={f.description}
                  videoUrl={f.video_url}
                  extraPrice={f.extra_price}
                  showExtraPrice
                  showVideo
                  showGallery
                  maxGallery={10}
                  bucketFolder="finishes"
                  onSave={async ({
                    name,
                    image_url,
                    gallery,
                    description,
                    video_url,
                    extra_price,
                  }) => {
                    const payload = {
                      name,
                      image_url,
                      gallery: [
                        ...(gallery ?? []),
                        ...(video_url ? [`__video__:${video_url}`] : []),
                      ],
                      description: description ?? null,
                      extra_price: Math.max(0, Number(extra_price) || 0),
                    };
                    if (name !== f.name) {
                      const { data: savedCatalog, error: createError } = await supabase
                        .from("finish_catalog")
                        .insert(payload)
                        .select("name, image_url, gallery, extra_price")
                        .single();
                      if (createError) throw createError;
                      if (!savedCatalog)
                        throw new Error("O acabamento não foi confirmado pelo banco de dados.");
                      if (Number(savedCatalog.extra_price) !== payload.extra_price) {
                        throw new Error("O banco não confirmou o acréscimo informado.");
                      }

                      const { error: relationError } = await supabase
                        .from("product_finishes")
                        .update({ finish: name })
                        .eq("name", f.name);
                      if (relationError) {
                        await supabase.from("finish_catalog").delete().eq("name", name);
                        throw relationError;
                      }
                      await supabase
                        .from("finish_colors" as never)
                        .update({ finish_name: name } as never)
                        .eq("finish_name", f.name);

                      const { error: deleteError } = await supabase
                        .from("finish_catalog")
                        .delete()
                        .eq("name", f.name);
                      if (deleteError) throw deleteError;
                    } else {
                      const { data: savedCatalog, error } = await supabase
                        .from("finish_catalog")
                        .upsert(payload, { onConflict: "name" })
                        .select("name, image_url, gallery, extra_price")
                        .single();
                      if (error) throw error;
                      if (!savedCatalog)
                        throw new Error("O acabamento não foi confirmado pelo banco de dados.");
                      if (Number(savedCatalog.extra_price) !== payload.extra_price) {
                        throw new Error("O banco não confirmou o acréscimo informado.");
                      }
                    }
                    await Promise.all([
                      qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] }),
                      qc.invalidateQueries({ queryKey: ["attribute-terms", "product_finishes"] }),
                    ]);
                    await qc.invalidateQueries({ queryKey: ["finish-colors"] });
                    markPdfPending();
                    toast.success(`Acabamento "${name}" salvo!`);
                  }}
                />
                <FinishColorsEditor
                  finishName={f.name}
                  colorNames={colorTerms.map((term) => term.name)}
                  saved={finishColors.filter((row) => row.finish_name === f.name)}
                  onSaved={() => {
                    void qc.invalidateQueries({ queryKey: ["finish-colors"] });
                    markPdfPending();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
      <AlertDialog
        open={Boolean(finishToDelete)}
        onOpenChange={(open) => !open && !deleting && setFinishToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acabamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {finishToDelete
                ? `O acabamento "${finishToDelete.name}" será removido do catálogo e de ${finishToDelete.count} produto${finishToDelete.count === 1 ? "" : "s"}. Orçamentos antigos não serão alterados.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteFinish();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir acabamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateAttributeForm({
  placeholder,
  table,
  onCreated,
}: {
  placeholder: string;
  table: "finish_catalog" | "color_catalog";
  onCreated: () => void;
}) {
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
        .from(table)
        .upsert({ name: trimmed }, { onConflict: "name" });
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
        placeholder={placeholder}
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

/**
 * Colors offered inside one finish. Each color can carry an extra price that is added on
 * top of the finish's own extra. A finish with no color selected offers every product
 * color at no extra cost.
 */
function FinishColorsEditor({
  finishName,
  colorNames,
  saved,
  onSaved,
}: {
  finishName: string;
  colorNames: string[];
  saved: FinishColor[];
  onSaved: () => void;
}) {
  const savedKey = JSON.stringify(saved.map((row) => [row.color_name, row.extra_price]));
  const [selected, setSelected] = useState<Map<string, number>>(
    () => new Map(saved.map((row) => [row.color_name, row.extra_price])),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(new Map(saved.map((row) => [row.color_name, row.extra_price])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dirty =
    JSON.stringify(
      colorNames.filter((name) => selected.has(name)).map((name) => [name, selected.get(name)]),
    ) !== savedKey;

  async function save() {
    setBusy(true);
    try {
      const rows = colorNames
        .filter((name) => selected.has(name))
        .map((name, index) => ({
          finish_name: finishName,
          color_name: name,
          extra_price: Math.max(0, Number(selected.get(name)) || 0),
          sort_order: index,
        }));
      const { error: deleteError } = await supabase
        .from("finish_colors" as never)
        .delete()
        .eq("finish_name", finishName);
      if (deleteError) throw deleteError;
      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("finish_colors" as never)
          .insert(rows as never);
        if (insertError) throw insertError;
      }
      toast.success(`Cores de "${finishName}" salvas!`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar as cores.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="-mt-1 mb-2 rounded-b-2xl border border-t-0 border-border bg-card/60 px-4 pb-4 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Cores deste acabamento</p>
          <p className="text-xs text-muted-foreground">
            O acréscimo da cor soma ao acréscimo do acabamento. Sem nenhuma cor marcada, todas as
            cores do produto ficam disponíveis sem acréscimo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar cores
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {colorNames.map((name) => {
          const checked = selected.has(name);
          return (
            <div
              key={name}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                checked ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = new Map(selected);
                    if (event.target.checked) next.set(name, 0);
                    else next.delete(name);
                    setSelected(next);
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span className="truncate">{name}</span>
              </label>
              {checked && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  + R$
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.get(name) ?? 0}
                    onChange={(event) => {
                      const next = new Map(selected);
                      next.set(name, Number(event.target.value));
                      setSelected(next);
                    }}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
