import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardGalleryEditor } from "@/components/dashboard-gallery-editor";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";
import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "acabamentos"],
    queryFn: fetchFinishes,
    staleTime: 30_000,
  });

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
            {data.map((f) => (
              <div key={f.name} className="relative">
                <div className="absolute right-4 top-4 z-10">
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
                      const { error: createError } = await supabase
                        .from("finish_catalog")
                        .insert(payload);
                      if (createError) throw createError;

                      const { error: relationError } = await supabase
                        .from("product_finishes")
                        .update({ finish: name })
                        .eq("name", f.name);
                      if (relationError) {
                        await supabase.from("finish_catalog").delete().eq("name", name);
                        throw relationError;
                      }

                      const { error: deleteError } = await supabase
                        .from("finish_catalog")
                        .delete()
                        .eq("name", f.name);
                      if (deleteError) throw deleteError;
                    } else {
                      const { error } = await supabase
                        .from("finish_catalog")
                        .update(payload)
                        .eq("name", f.name);
                      if (error) throw error;
                    }
                    qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] });
                    markPdfPending();
                    toast.success(`Acabamento "${name}" salvo!`);
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
