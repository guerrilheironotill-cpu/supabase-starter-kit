import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { ProductEditorDialog } from "@/components/product-editor-dialog";
import { markCatalogPdfPending } from "@/lib/catalog-pending";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export const Route = createFileRoute("/dashboard/editar-produto/$productId")({
  head: () => ({
    meta: [
      { title: "Editar produto — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardEditProductPage,
});

function DashboardEditProductPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: productSummary } = useQuery({
    queryKey: ["dashboard", "produto-resumo", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("slug, name")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const goBack = () => navigate({ to: "/dashboard/produtos" });

  async function deleteProduct() {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
      markCatalogPdfPending();
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Produto excluído com sucesso.");
      void navigate({ to: "/dashboard/produtos" });
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Não foi possível excluir o produto.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/dashboard/produtos" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar para produtos
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 bg-background px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" /> Excluir produto
        </button>
      </div>
      <ProductEditorDialog
        mode="page"
        productId={productId}
        onClose={goBack}
        onSaved={(_, slug) => {
          queryClient.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
          queryClient.invalidateQueries({ queryKey: ["product"] });
          queryClient.invalidateQueries({ queryKey: ["attribute-terms"] });
          markCatalogPdfPending();
          queryClient.setQueryData(["dashboard", "produto-resumo", productId], (current: { slug: string; name: string } | undefined) =>
            current ? { ...current, slug } : { slug, name: "" },
          );
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto será excluído permanentemente, incluindo tamanhos, acabamentos e cores associados. Orçamentos já criados não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteProduct();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
