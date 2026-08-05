import { toast } from "sonner";
import { refreshPreparedCatalogs } from "@/lib/catalog-cache";

let notificationVisible = false;

export function schedulePreparedCatalogRefresh() {
  if (!notificationVisible) {
    notificationVisible = true;
    toast.info("Atualizando os dois catálogos PDF em segundo plano...");
  }
  void refreshPreparedCatalogs()
    .then(() => toast.success("Catálogos PDF atualizados."))
    .catch((error) => {
      console.error("Falha ao atualizar catálogos PDF:", error);
      toast.error("A alteração foi salva, mas os PDFs não puderam ser atualizados.");
    })
    .finally(() => {
      notificationVisible = false;
    });
}
