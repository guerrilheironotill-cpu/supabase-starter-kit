import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadPreparedCatalog } from "@/lib/catalog-cache";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadInterest, ProfessionalType } from "@/lib/commercial-rules";

export const OPEN_CATALOG_EVENT = "arteno:open-catalog";

export function openCatalogDownload() {
  window.dispatchEvent(new CustomEvent(OPEN_CATALOG_EVENT));
}

export function CatalogDownloadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [clientType, setClientType] = useState<LeadInterest>("final");
  const [professionalType, setProfessionalType] = useState<ProfessionalType | "">("");
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  async function generate() {
    if (!name.trim()) return toast.error("Por favor, informe o seu nome.");
    if (!phone.trim()) return toast.error("Por favor, informe o seu telefone.");
    if (!email.trim()) return toast.error("Por favor, informe o seu e-mail.");
    if (clientType === "reseller" && !cnpj.trim()) return toast.error("Informe o CNPJ.");
    if (clientType === "professional" && !professionalType)
      return toast.error("Informe a sua área profissional.");
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

      const { error } = await supabase.from("leads").insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        destination: "email",
        source: "catalogo-pdf",
        client_type: clientType,
        lead_interest: clientType,
        professional_type: clientType === "professional" ? professionalType : null,
        cnpj: clientType === "reseller" ? cnpj : null,
        categories: ["Todas"],
        items: {
          client_type: clientType,
          professional_type: professionalType || null,
          catalog: "completo",
        },
      } as never);

      if (error) console.error("Erro ao registrar lead do catálogo:", error);
      toast.success("Catálogo gerado com sucesso!");
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
              Nome *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Telefone *
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary sm:col-span-2">
              E-mail *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
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
              Área profissional *
              <select
                value={professionalType}
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
              CNPJ *
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
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
