import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardGalleryEditor } from "@/components/dashboard-gallery-editor";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { schedulePreparedCatalogRefresh } from "@/lib/catalog-refresh";

export const Route = createFileRoute("/dashboard/cores")({
  head: () => ({
    meta: [{ title: "Cores — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardColorsPage,
});

const fetchColors = (): Promise<AttributeTerm[]> =>
  fetchAttributeTerms("product_colors", "color_catalog");

function DashboardColorsPage() {
  const qc = useQueryClient();
  const [colorToDelete, setColorToDelete] = useState<AttributeTerm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "cores"],
    queryFn: fetchColors,
    staleTime: 30_000,
  });

  async function deleteColor() {
    if (!colorToDelete || deleting) return;
    setDeleting(true);
    try {
      const color = colorToDelete;
      const { error: relationError } = await supabase
        .from("product_colors")
        .delete()
        .eq("name", color.name);
      if (relationError) throw relationError;
      const { error: legacyRelationError } = await supabase
        .from("product_colors")
        .delete()
        .eq("color", color.name);
      if (legacyRelationError) throw legacyRelationError;
      const { error: catalogError } = await supabase
        .from("color_catalog")
        .delete()
        .eq("name", color.name);
      if (catalogError) throw catalogError;

      const urls = [color.image_url, ...color.gallery].filter((url): url is string => Boolean(url));
      const marker = "/storage/v1/object/public/catalog-media/";
      const paths = urls.flatMap((url) => {
        const index = url.indexOf(marker);
        if (index < 0) return [];
        const path = decodeURIComponent(url.slice(index + marker.length));
        return path.startsWith("colors/") ? [path] : [];
      });
      if (paths.length > 0) await supabase.storage.from("catalog-media").remove(paths);

      await qc.invalidateQueries({ queryKey: ["dashboard", "cores"] });
      await qc.invalidateQueries({ queryKey: ["attribute-terms", "product_colors"] });
      schedulePreparedCatalogRefresh();
      toast.success(`Cor "${color.name}" excluído.`);
      setColorToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir cor.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie a imagem principal circular e as imagens da galeria que serão exibidas no lightbox.
        </p>
      </div>

      <CreateAttributeForm
        placeholder="Nome da nova cor"
        table="color_catalog"
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["dashboard", "cores"] });
          schedulePreparedCatalogRefresh();
          toast.success("Cor criada com sucesso!");
        }}
      />

      <DashboardSection title={`Cores (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((f) => (
              <div key={f.name} className="relative">
                <div className="absolute right-4 top-4 z-10">
                  <RowActionsMenu
                    label={`Ações de ${f.name}`}
                    actions={[
                      {
                        label: "Excluir cor",
                        icon: Trash2,
                        destructive: true,
                        onClick: () => setColorToDelete(f),
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
                  showVideo
                  showGallery
                  maxGallery={10}
                  bucketFolder="colors"
                  onSave={async ({ name, image_url, gallery, description, video_url }) => {
                    const payload = {
                      name,
                      image_url,
                      gallery: [
                        ...(gallery ?? []),
                        ...(video_url ? [`__video__:${video_url}`] : []),
                      ],
                      description: description ?? null,
                    };
                    const { error } = await supabase
                      .from("color_catalog")
                      .update(payload)
                      .eq("name", f.name);
                    if (error) throw error;
                    if (name !== f.name) {
                      const { error: relationError } = await supabase
                        .from("product_colors")
                        // `name` is generated from `color` in the current schema.
                        // Updating the source column refreshes it automatically.
                        .update({ color: name })
                        .eq("name", f.name);
                      if (relationError) throw relationError;
                    }
                    qc.invalidateQueries({ queryKey: ["dashboard", "cores"] });
                    schedulePreparedCatalogRefresh();
                    toast.success(`Cor "${name}" salva!`);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
      <AlertDialog
        open={Boolean(colorToDelete)}
        onOpenChange={(open) => !open && !deleting && setColorToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cor?</AlertDialogTitle>
            <AlertDialogDescription>
              {colorToDelete
                ? `A cor "${colorToDelete.name}" será removido do catálogo e de ${colorToDelete.count} produto${colorToDelete.count === 1 ? "" : "s"}. Orçamentos antigos não serão alterados.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteColor();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir cor
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
