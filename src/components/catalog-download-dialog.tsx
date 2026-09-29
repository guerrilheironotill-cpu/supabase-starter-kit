import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCatalogsByCategory, downloadPreparedCatalog } from "@/lib/catalog-cache";
import { fetchCategories } from "@/lib/products";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadInterest, ProfessionalType } from "@/lib/commercial-rules";
import { maskCnpj, maskPhoneBR } from "@/lib/masks";
import { cn } from "@/lib/utils";

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
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchCategories()
      .then(setCategories)
      .catch((error) => console.error("Falha ao carregar categorias do catálogo:", error));
  }, [open]);

  const required = !adminMode;
  const requiredMark = required ? <span className="text-destructive">*</span> : null;

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

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
    setProgressLabel(null);
    try {
      const variant =
        clientType === "reseller"
          ? "reseller"
          : clientType === "professional"
            ? "professional"
            : "standard";

      if (selectedCategories.length === 0) {
        await downloadPreparedCatalog(variant, setProgress);
      } else {
        const { skipped } = await downloadCatalogsByCategory(
          variant,
          selectedCategories,
          (percent, current) => {
            setProgress(percent);
            if (current.category) {
              setProgressLabel(
                `Categoria ${current.index + 1} de ${current.total}: ${current.category}`,
              );
            }
          },
        );
        if (skipped.length > 0) {
          toast.warning(`Sem produtos com preço para baixar: ${skipped.join(", ")}.`);
        }
      }

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
      setProgressLabel(null);
    }
  }

  const downloadLabel =
    selectedCategories.length === 0
      ? "Baixar Catálogo Completo"
      : selectedCategories.length === 1
        ? "Baixar catálogo da categoria"
        : `Baixar ${selectedCategories.length} catálogos`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Baixar Catálogo</DialogTitle>
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

          {categories.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Categorias <span className="font-normal text-muted-foreground">(opcional)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const active = selectedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary/20 bg-white text-primary hover:border-primary/50",
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-primary/60">
                {selectedCategories.length === 0
                  ? "Sem seleção, baixa o catálogo completo, com todas as categorias."
                  : "Cada categoria selecionada vira um arquivo PDF separado, menor e mais rápido de baixar."}
              </p>
            </fieldset>
          )}

          {adminMode && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/70">
              Todos os campos são opcionais. O tipo de cliente define a versão do catálogo; se
              preencher algum contato, ele é salvo como lead.
            </p>
          )}
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/70">
            {selectedCategories.length === 0
              ? "O catálogo completo inclui todos os produtos, cores e acabamentos disponíveis."
              : "O catálogo por categoria inclui os produtos daquela categoria, sem a galeria de cores e acabamentos."}
          </p>
        </div>
        <DialogFooter>
          <div className="w-full">
            {generating && (
              <div className="mb-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progressLabel && <p className="mt-1 text-xs text-primary/60">{progressLabel}</p>}
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
                : downloadLabel}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
