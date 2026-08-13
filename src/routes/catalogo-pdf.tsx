import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { CatalogDownloadDialog } from "@/components/catalog-download-dialog";

export const Route = createFileRoute("/catalogo-pdf")({
  head: () => ({
    meta: [
      { title: "Catálogo PDF — Arteno Vaso & Decor" },
      {
        name: "description",
        content: "Preencha seus dados para acessar o catálogo completo da Arteno Vaso & Decor.",
      },
    ],
  }),
  component: CatalogPdfPage,
});

function CatalogPdfPage() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <section className="flex min-h-[60vh] items-center justify-center px-4 py-16 text-center">
        <div className="max-w-xl border border-border bg-white p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Arteno Vaso & Decor
          </p>
          <h1 className="mt-3 font-display text-4xl text-primary">Catálogo completo</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Informe seus dados para acessar nosso catálogo de produtos, categorias, cores e
            acabamentos.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-7 inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Acessar catálogo
          </button>
        </div>
      </section>

      <CatalogDownloadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
