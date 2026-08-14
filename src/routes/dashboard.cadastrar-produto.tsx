import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ProductEditorDialog } from "@/components/product-editor-dialog";
import { markCatalogPdfPending } from "@/lib/catalog-pending";

export const Route = createFileRoute("/dashboard/cadastrar-produto")({
  head: () => ({
    meta: [
      { title: "Cadastrar produto — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardCreateProductPage,
});

function DashboardCreateProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goBack = () => navigate({ to: "/dashboard/produtos" });

  return (
    <div>
      <div className="mb-5">
        <Link
          to="/dashboard/produtos"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para produtos
        </Link>
      </div>
      <ProductEditorDialog
        mode="page"
        productId={null}
        onClose={goBack}
        onSaved={(productId) => {
          queryClient.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["attribute-terms"] });
          markCatalogPdfPending();
          void navigate({
            to: "/dashboard/editar-produto/$productId",
            params: { productId },
            replace: true,
          });
        }}
      />
    </div>
  );
}
