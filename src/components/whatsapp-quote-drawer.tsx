import { useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { maskCnpj, maskCpf, maskPhoneBR } from "@/lib/masks";
import { useQuoteStore } from "@/lib/quote-store";
import { useLeadsStore } from "@/lib/leads-store";
import { publicSupabase } from "@/integrations/supabase/client";
import { compactError, useFormDebugLogStore } from "@/lib/form-debug-log";

import { useWhatsAppNumber } from "@/lib/site-settings";
import { getMarketingAttribution } from "@/lib/marketing-attribution";

const baseSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido")
    .regex(/^[0-9()+\-\s]+$/, "Use apenas números"),
  customerType: z.enum(["final", "professional", "reseller"]),
  professionalDocument: z.enum(["cpf", "cnpj"]),
  cpf: z.string().trim().optional(),
  cnpj: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
});

const schema = baseSchema.superRefine((v, ctx) => {
  if (v.customerType === "final") {
    if ((v.cpf ?? "").replace(/\D/g, "").length !== 11) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF inválido" });
    }
  } else if (v.customerType === "reseller") {
    if ((v.cnpj ?? "").replace(/\D/g, "").length !== 14) {
      ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ inválido" });
    }
  } else if (
    v.professionalDocument === "cpf" &&
    (v.cpf ?? "").replace(/\D/g, "").length > 0 &&
    (v.cpf ?? "").replace(/\D/g, "").length !== 11
  ) {
    ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF inválido" });
  } else if (
    v.professionalDocument === "cnpj" &&
    (v.cnpj ?? "").replace(/\D/g, "").length > 0 &&
    (v.cnpj ?? "").replace(/\D/g, "").length !== 14
  ) {
    ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ inválido" });
  }
});

export function WhatsAppQuoteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"final" | "professional" | "reseller">("final");
  const [professionalDocument, setProfessionalDocument] = useState<"cpf" | "cnpj">("cnpj");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    cpf?: string;
    cnpj?: string;
    companyName?: string;
  }>({});
  const items = useQuoteStore((s) => s.items);
  const whatsappNumber = useWhatsAppNumber();
  const addLead = useLeadsStore((s) => s.addLead);
  const addDebugLog = useFormDebugLogStore((s) => s.addLog);

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      name,
      phone,
      customerType,
      professionalDocument,
      cpf,
      cnpj,
      companyName,
    });
    if (!parsed.success) {
      const fieldErrors: {
        name?: string;
        phone?: string;
        cpf?: string;
        cnpj?: string;
        companyName?: string;
      } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof fieldErrors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      addDebugLog({
        level: "error",
        action: "whatsapp_form_validation",
        message: "O formulário não passou na validação antes do envio.",
        details: fieldErrors,
      });
      return;
    }
    setErrors({});

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const list =
      items.length > 0
        ? items
            .map((i, idx) => {
              const details: string[] = [];
              if (i.sizeLabel || i.dimensions) {
                details.push(`Tamanho: ${[i.sizeLabel, i.dimensions].filter(Boolean).join(" — ")}`);
              }
              if (i.finish) details.push(`Acabamento: ${i.finish}`);
              if (i.color) details.push(`Cor: ${i.color}`);
              details.push(`Quantidade: ${i.quantity}`);
              if (typeof i.unitPrice === "number") {
                details.push(
                  `Valor unit.: ${formatBRL(i.unitPrice)} (subtotal ${formatBRL(
                    i.unitPrice * i.quantity,
                  )})`,
                );
              }
              if (i.slug && origin) {
                details.push(`Link: ${origin}/produto/${i.slug}`);
              }
              return `${idx + 1}. ${i.name}\n   ${details.join("\n   ")}`;
            })
            .join("\n\n")
        : "— (nenhum produto selecionado ainda)";

    const message =
      `Olá! Gostaria de solicitar um orçamento.\n\n` +
      `Nome: ${parsed.data.name}\n` +
      `Perfil: ${parsed.data.customerType === "final" ? "Cliente final" : parsed.data.customerType === "professional" ? "Profissional / Especificador" : "Revendedor / Lojista"}\n` +
      (parsed.data.companyName ? `Empresa: ${parsed.data.companyName}\n` : "") +
      (parsed.data.customerType === "final" || parsed.data.professionalDocument === "cpf"
        ? parsed.data.cpf
          ? `CPF: ${parsed.data.cpf}\n`
          : ""
        : parsed.data.cnpj
          ? `CNPJ: ${parsed.data.cnpj}\n`
          : "") +
      `Telefone: ${parsed.data.phone}\n\n` +
      `Produtos:\n${list}`;

    // Persiste no CRM: primeiro no Supabase (best-effort), depois localStorage como fallback
    const payload = {
      name: parsed.data.name,
      phone: parsed.data.phone,
      items,
      source: "whatsapp" as const,
    };
    addDebugLog({
      level: "info",
      action: "whatsapp_form_submit",
      message: "Tentativa de gravar lead na tabela public.leads.",
      details: {
        table: "public.leads",
        role: "anon/public client",
        name: payload.name,
        phone: payload.phone,
        itemCount: payload.items.length,
      },
    });
    // Fire-and-forget (não bloqueia a abertura do WhatsApp)
    void (async () => {
      try {
        const { error } = await publicSupabase.from("leads" as never).insert(payload as never);
        if (error) {
          console.warn("[leads] supabase insert failed:", error.message);
          addDebugLog({
            level: "error",
            action: "supabase_insert_lead_failed",
            message: error.message,
            details: compactError(error),
          });
          return;
        }
        addDebugLog({
          level: "success",
          action: "supabase_insert_lead_success",
          message: "Lead enviado ao Supabase sem erro de INSERT.",
          details: { table: "public.leads" },
        });
      } catch (error: unknown) {
        console.warn("[leads] supabase insert crashed:", error);
        addDebugLog({
          level: "error",
          action: "supabase_insert_lead_crash",
          message: compactError(error).message,
          details: compactError(error),
        });
      }
    })();
    addLead(payload);

    // Also create an orçamento (order) row so it appears in the dashboard
    void (async () => {
      try {
        const cleanItems = items.map((i) => ({
          kind: "catalog" as const,
          product_id: i.id ?? null,
          name: i.name,
          description: null,
          quantity: i.quantity,
          price: i.unitPrice ?? 0,
          size_id: null,
          size_name: i.sizeLabel ?? null,
          finish: i.finish ?? null,
          color: i.color ?? null,
        }));
        const meta = {
          __meta: 1,
          personType: parsed.data.customerType === "final" ? "fisica" : "juridica",
          customerType: parsed.data.customerType,
          cpf:
            parsed.data.customerType === "final" || parsed.data.professionalDocument === "cpf"
              ? parsed.data.cpf
              : null,
          cnpj:
            parsed.data.customerType === "reseller" || parsed.data.professionalDocument === "cnpj"
              ? parsed.data.cnpj
              : null,
          companyName: parsed.data.customerType !== "final" ? parsed.data.companyName : null,
          attribution: getMarketingAttribution(),
          conversionChannel: "whatsapp",
        };
        const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
        await publicSupabase.from("orders" as never).insert({
          status: "orcamento",
          origin: meta.attribution?.channel ?? "whatsapp",
          customer_name: parsed.data.name,
          customer_phone: parsed.data.phone,
          customer_email: null,
          items: cleanItems,
          total,
          notes: JSON.stringify(meta),
        } as never);
      } catch (err) {
        console.warn("[orders] whatsapp insert failed", err);
      }
    })();

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className={cn("fixed inset-0 z-[60]", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Solicitar orçamento pelo WhatsApp"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Orçamento</p>
            <p className="font-display text-2xl">Fale conosco</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-secondary/20"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col justify-between p-6" noValidate>
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Deixe seu nome e telefone para iniciar a conversa no WhatsApp. Enviaremos junto os
              produtos do seu orçamento.
            </p>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-primary">
                Nome <span className="text-destructive">*</span>
              </span>
              <input
                aria-label="Nome"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="name"
                required
                className="mt-2 block w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                placeholder="Seu nome"
              />
              {errors.name && (
                <span className="mt-1 block text-xs text-destructive">{errors.name}</span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-primary">
                Perfil do cliente <span className="text-destructive">*</span>
              </span>
              <select
                aria-label="Perfil do cliente"
                value={customerType}
                onChange={(e) =>
                  setCustomerType(e.target.value as "final" | "professional" | "reseller")
                }
                required
                className="mt-2 block w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="final">Cliente final</option>
                <option value="professional">Profissional / Especificador</option>
                <option value="reseller">Revendedor / Lojista</option>
              </select>
            </label>

            {customerType !== "final" && (
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-widest text-primary">
                  Nome da empresa
                </span>
                <input
                  aria-label="Nome da empresa"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  maxLength={120}
                  className="mt-2 block w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="Razão social"
                />
                {errors.companyName && (
                  <span className="mt-1 block text-xs text-destructive">{errors.companyName}</span>
                )}
              </label>
            )}

            {customerType === "professional" && (
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-widest text-primary">
                  Documento
                </span>
                <select
                  aria-label="Tipo de documento"
                  value={professionalDocument}
                  onChange={(e) => setProfessionalDocument(e.target.value as "cpf" | "cnpj")}
                  className="mt-2 block w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                >
                  <option value="cnpj">Informar CNPJ (opcional)</option>
                  <option value="cpf">Informar CPF (opcional)</option>
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-primary">
                {customerType === "final" || professionalDocument === "cpf" ? "CPF" : "CNPJ"}{" "}
                {customerType !== "professional" && <span className="text-destructive">*</span>}
              </span>
              <input
                aria-label={
                  customerType === "final" || professionalDocument === "cpf" ? "CPF" : "CNPJ"
                }
                type="text"
                value={customerType === "final" || professionalDocument === "cpf" ? cpf : cnpj}
                onChange={(e) =>
                  customerType === "final" || professionalDocument === "cpf"
                    ? setCpf(maskCpf(e.target.value))
                    : setCnpj(maskCnpj(e.target.value))
                }
                maxLength={customerType === "final" || professionalDocument === "cpf" ? 14 : 18}
                required={customerType !== "professional"}
                className="mt-2 block w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                placeholder={
                  customerType === "final" || professionalDocument === "cpf"
                    ? "000.000.000-00"
                    : "00.000.000/0000-00"
                }
              />
              {(errors.cpf || errors.cnpj) && (
                <span className="mt-1 block text-xs text-destructive">
                  {errors.cpf ?? errors.cnpj}
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-primary">
                Telefone <span className="text-destructive">*</span>
              </span>
              <input
                aria-label="Telefone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
                maxLength={16}
                autoComplete="tel"
                required
                className="mt-2 block w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                placeholder="(11) 99999-9999"
              />
              {errors.phone && (
                <span className="mt-1 block text-xs text-destructive">{errors.phone}</span>
              )}
            </label>

            {items.length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-primary">
                  Produtos ({items.reduce((n, i) => n + i.quantity, 0)})
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className="truncate">{i.name}</span>
                      <span className="shrink-0">x{i.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-medium text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-secondary"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.15-3.43-8.44Z" />
            </svg>
            Enviar para o WhatsApp
          </button>
        </form>
      </aside>
    </div>
  );
}
