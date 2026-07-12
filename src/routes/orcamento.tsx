import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, FileText } from "lucide-react";
import { useQuoteStore } from "@/lib/quote-store";

export const Route = createFileRoute("/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento — Casa & Jardim" },
      {
        name: "description",
        content:
          "Revise os produtos selecionados e solicite seu orçamento personalizado.",
      },
      { property: "og:title", content: "Orçamento — Casa & Jardim" },
      {
        property: "og:description",
        content:
          "Revise os produtos selecionados e solicite seu orçamento personalizado.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrcamentoPage,
});

function OrcamentoPage() {
  const items = useQuoteStore((s) => s.items);
  const removeItem = useQuoteStore((s) => s.removeItem);
  const updateQuantity = useQuoteStore((s) => s.updateQuantity);
  const clear = useQuoteStore((s) => s.clear);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Seu orçamento
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            Nenhum produto adicionado ao orçamento ainda.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 p-4 animate-fade-in"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {item.name}
                  </p>
                  {(item.sizeLabel || item.dimensions) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Tamanho{" "}
                      {[item.sizeLabel, item.dimensions]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {(item.finish || item.color) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.finish && <>Acabamento: {item.finish}</>}
                      {item.finish && item.color && " · "}
                      {item.color && <>Cor: {item.color}</>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.id, item.quantity - 1)
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent"
                    aria-label="Diminuir"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.id, item.quantity + 1)
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={clear}
              className="text-sm text-muted-foreground transition-colors hover:text-destructive"
            >
              Limpar lista
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Solicitar orçamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}