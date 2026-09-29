import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadPreparedCatalog } from "@/lib/catalog-cache";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadInterest, ProfessionalType } from "@/lib/commercial-rules";
import { maskCnpj, maskPhoneBR } from "@/lib/masks";

export const OPEN_CATALOG_EVENT = "arteno:open-catalog";

export function openCatalogDownload() {
  window.dispatchEvent(new CustomEvent(OPEN_CATALOG_EVENT));
}

export function CatalogDownloadDialog({
  open,
  onOpenChange,
  adminMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Admin downloads skip required fields so the catalog can be sent to anyone. */
  adminMode?: boolean;
}) {
  const [clientType, setClientType] = useState<LeadInterest>("final");
  const [professionalType, setProfessionalType] = useState<ProfessionalType | "">("");
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const required = !adminMode;
  const requiredMark = required ? <span className="text-destructive">*</span> : null;

  async function generate() {
    if (required) {
      if (!name.trim()) return toast.error("Por favor, informe o seu nome.");
      if (!phone.trim()) return toast.error("Por favor, informe o seu telefone.");
      if (!email.trim()) return toast.error("Por favor, informe o seu e-mail.");
      if (clientType === "reseller" && !cnpj.trim()) return toast.error("Informe o CNPJ.");
      if (clientType === "professional" && !professionalType)
        return toast.error("Informe a sua área profissional.");
    }
    // An admin download without any contact data has no lead to register.
    const hasContact = Boolean(name.trim() || phone.trim() || email.trim());
    setGenerating(true);
    try {
      await downloadPreparedCatalog(
        clientType === "reseller"
          ? "reseller"
          : clientType === "professional"
            ? "professional"
            : "standard",
        setProgress,
      );

      let existingLead = false;
      if (hasContact) {
        try {
          const response = await fetch("/api/catalog-lead", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim(),
              clientType,
              professionalType,
              cnpj,
            }),
          });
          const result = (await response.json()) as {
            ok?: boolean;
            existing?: boolean;
            error?: string;
          };
          if (!response.ok || !result.ok) throw new Error(result.error ?? response.statusText);
          existingLead = Boolean(result.existing);
        } catch (error) {
          console.error("Erro ao registrar lead do catálogo:", error);
        }
      }
      if (existingLead && adminMode) {
        toast.info(
          "Este cliente já possui cadastro. O catálogo foi baixado sem criar um novo lead.",
        );
      } else {
        toast.success("Catálogo gerado com sucesso!");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao gerar catálogo:", error);
      toast.error("Não foi possível gerar o catálogo. Tente novamente.");
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Baixar Catálogo Completo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Nome {requiredMark}
              <input
                aria-label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                required={required}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Telefone {requiredMark}
              <input
                aria-label="Telefone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000"
                required={required}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary sm:col-span-2">
              E-mail {requiredMark}
              <input
                aria-label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required={required}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Tipo de cliente</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["final", "Cliente final"],
                ["professional", "Profissional / Especificador"],
                ["reseller", "Revendedor / Lojista"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="catalog-client-type"
                    checked={clientType === value}
                    onChange={() => setClientType(value as typeof clientType)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {clientType === "professional" && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Área profissional {requiredMark}
              <select
                aria-label="Área profissional"
                value={professionalType}
                required={required}
                onChange={(e) => setProfessionalType(e.target.value as ProfessionalType)}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione</option>
                <option value="architect">Arquiteto</option>
                <option value="landscaper">Paisagista</option>
                <option value="interior_designer">Designer de interiores</option>
                <option value="gardener">Jardineiro</option>
                <option value="other">Outro profissional</option>
              </select>
            </label>
          )}

          {clientType === "reseller" && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              CNPJ {requiredMark}
              <input
                aria-label="CNPJ"
                value={cnpj}
                onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                required={required}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          )}

          {adminMode && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/70">
              Todos os campos são opcionais. O tipo de cliente define a versão do catálogo; se
              preencher algum contato, ele é salvo como lead.
            </p>
          )}
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/70">
            O catálogo inclui todos os produtos, categorias, cores e acabamentos disponíveis.
          </p>
        </div>
        <DialogFooter>
          <div className="w-full">
            {generating && (
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {generating
                ? progress > 0
                  ? `Preparando ${progress}%...`
                  : "Baixando..."
                : "Baixar Catálogo"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
