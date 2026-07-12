import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, FileText, Download, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import jsPDF from "jspdf";
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

  const [delivery, setDelivery] = useState<"pickup" | "shipping">("pickup");
  const [cep, setCep] = useState("");

  const cepDigits = cep.replace(/\D/g, "");
  // Florianópolis e região (Grande Fpolis): 88000-88169
  const shippingAvailable = useMemo(() => {
    if (cepDigits.length !== 8) return null;
    const n = parseInt(cepDigits.slice(0, 5), 10);
    return n >= 88000 && n <= 88169;
  }, [cepDigits]);

  // If user selected shipping but CEP is out of area, force pickup
  const effectiveDelivery =
    delivery === "shipping" && shippingAvailable === false ? "pickup" : delivery;

  const buildSummary = () => {
    const lines: string[] = [];
    lines.push("Orçamento — Casa & Jardim");
    lines.push("");
    items.forEach((it, idx) => {
      lines.push(`${idx + 1}. ${it.name} (x${it.quantity})`);
      const details = [
        it.sizeLabel && `Tamanho: ${it.sizeLabel}`,
        it.dimensions && `Medidas: ${it.dimensions}`,
        it.finish && `Acabamento: ${it.finish}`,
        it.color && `Cor: ${it.color}`,
      ].filter(Boolean);
      details.forEach((d) => lines.push(`   - ${d}`));
    });
    lines.push("");
    lines.push(
      `Entrega: ${effectiveDelivery === "pickup" ? "Retirar na fábrica" : `Cotar frete (CEP ${cep})`}`,
    );
    return lines.join("\n");
  };

  const generatePDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const marginX = 15;
    let y = 20;
    doc.setFontSize(16);
    doc.text("Orçamento — Casa & Jardim", marginX, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString("pt-BR"), marginX, y);
    y += 8;
    doc.setDrawColor(200);
    doc.line(marginX, y, 195, y);
    y += 6;

    doc.setFontSize(11);
    items.forEach((it, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${it.name}  (x${it.quantity})`, marginX, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const details = [
        it.sizeLabel && `Tamanho: ${it.sizeLabel}`,
        it.dimensions && `Medidas: ${it.dimensions}`,
        it.finish && `Acabamento: ${it.finish}`,
        it.color && `Cor: ${it.color}`,
      ].filter(Boolean) as string[];
      details.forEach((d) => {
        doc.text(`   • ${d}`, marginX, y);
        y += 5;
      });
      y += 2;
    });

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(200);
    doc.line(marginX, y, 195, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Entrega", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(
      effectiveDelivery === "pickup"
        ? "Retirar na fábrica"
        : `Cotar frete — CEP ${cep}`,
      marginX,
      y,
    );

    doc.save("orcamento.pdf");
  };

  const sendWhatsApp = () => {
    const text = encodeURIComponent(buildSummary());
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const sendEmail = () => {
    const subject = encodeURIComponent("Orçamento — Casa & Jardim");
    const body = encodeURIComponent(buildSummary());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Seu orçamento
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            Nenhum produto adicionado ao orçamento ainda.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border overflow-hidden border border-border bg-card">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 p-4 animate-fade-in"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden bg-muted">
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
                    className="inline-flex h-8 w-8 items-center justify-center border border-border transition-colors hover:bg-accent"
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
                    className="inline-flex h-8 w-8 items-center justify-center border border-border transition-colors hover:bg-accent"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
          </div>

          <div className="border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Método de entrega
              </p>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="delivery"
                    checked={effectiveDelivery === "pickup"}
                    onChange={() => setDelivery("pickup")}
                  />
                  Retirar na fábrica
                </label>
                <label
                  className={`flex items-center gap-3 text-sm ${
                    shippingAvailable === false
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    disabled={shippingAvailable === false}
                    checked={effectiveDelivery === "shipping"}
                    onChange={() => setDelivery("shipping")}
                  />
                  Cotar frete
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                CEP de entrega
              </label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                maxLength={9}
                placeholder="00000-000"
                className="mt-2 block w-full max-w-xs border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {shippingAvailable === false && (
                <p className="mt-2 text-xs text-destructive">
                  Não temos logística de entrega para este endereço. Se quiser
                  continuar, selecione a opção "Retirar na fábrica".
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={generatePDF}
              className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Gerar PDF
            </button>
            <button
              type="button"
              onClick={sendEmail}
              className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Continuar por e-mail
            </button>
            <button
              type="button"
              onClick={sendWhatsApp}
              className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.15-3.43-8.44Z" />
              </svg>
              Continuar por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}