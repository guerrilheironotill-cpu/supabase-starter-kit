import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuoteStore, type QuoteItem } from "@/lib/quote-store";
import { useWhatsAppNumber } from "@/lib/site-settings";
import { maskCnpj, maskCpf, maskPhoneBR } from "@/lib/masks";
import { publicSupabase } from "@/integrations/supabase/client";
import { absoluteUrl } from "@/lib/site-config";
import { fetchProductBySlug } from "@/lib/products";
import { fetchAttributeTerms } from "@/lib/dashboard-taxonomies";

export const Route = createFileRoute("/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento — Arteno Vaso & Decor" },
      {
        name: "description",
        content: "Revise os produtos selecionados e solicite seu orçamento personalizado.",
      },
      { property: "og:title", content: "Orçamento — Arteno Vaso & Decor" },
      {
        property: "og:description",
        content: "Revise os produtos selecionados e solicite seu orçamento personalizado.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrcamentoPage,
});

type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type Customer = {
  name: string;
  email: string;
  phone: string;
  customerType: "final" | "professional" | "reseller";
  professionalDocument: "cpf" | "cnpj";
  cpf: string;
  cnpj: string;
  companyName: string;
};

const EMPTY_ADDRESS: Address = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function useCepAutocomplete(cep: string, onFill: (data: Partial<Address>) => void) {
  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then(
        (d: {
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
          erro?: boolean;
        }) => {
          if (cancelled || d.erro) return;
          onFill({
            street: d.logradouro ?? "",
            neighborhood: d.bairro ?? "",
            city: d.localidade ?? "",
            state: d.uf ?? "",
          });
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);
}

function itemSubtotal(it: QuoteItem) {
  return (it.unitPrice ?? 0) * it.quantity;
}

function OrcamentoPage() {
  const navigate = useNavigate();
  const items = useQuoteStore((s) => s.items);
  const removeItem = useQuoteStore((s) => s.removeItem);
  const updateQuantity = useQuoteStore((s) => s.updateQuantity);
  const updateConfiguration = useQuoteStore((s) => s.updateConfiguration);
  const updateConfigurationOptions = useQuoteStore((s) => s.updateConfigurationOptions);
  const clear = useQuoteStore((s) => s.clear);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [delivery, setDelivery] = useState<"pickup" | "shipping">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState<Address>(EMPTY_ADDRESS);
  const [customer, setCustomer] = useState<Customer>({
    name: "",
    email: "",
    phone: "",
    customerType: "final",
    professionalDocument: "cnpj",
    cpf: "",
    cnpj: "",
    companyName: "",
  });
  const [customerAddress, setCustomerAddress] = useState<Address>(EMPTY_ADDRESS);
  const [sameAsDelivery, setSameAsDelivery] = useState(true);
  const whatsappNumber = useWhatsAppNumber();
  const [submitted, setSubmitted] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useCepAutocomplete(deliveryAddress.cep, (patch) =>
    setDeliveryAddress((a) => ({ ...a, ...patch })),
  );
  useCepAutocomplete(customerAddress.cep, (patch) =>
    setCustomerAddress((a) => ({ ...a, ...patch })),
  );

  useEffect(() => {
    const legacyItems = items.filter(
      (item) => item.slug && (!item.availableFinishes?.length || !item.availableColors?.length),
    );
    if (legacyItems.length === 0) return;
    let cancelled = false;
    void (async () => {
      const finishCatalog = await fetchAttributeTerms("product_finishes", "finish_catalog");
      await Promise.all(
        legacyItems.map(async (item) => {
          const product = await fetchProductBySlug(item.slug!);
          if (!product || cancelled) return;
          updateConfigurationOptions(item.id, {
            basePrice: item.basePrice ?? item.unitPrice ?? 0,
            availableFinishes: product.product_finishes.map((finish) => ({
              name: finish.name,
              extraPrice:
                finishCatalog.find((catalogItem) => catalogItem.name === finish.name)
                  ?.extra_price ?? 0,
            })),
            availableColors: product.product_colors.map((color) => color.name),
          });
        }),
      );
    })().catch((error) => console.warn("[orcamento] opções do produto indisponíveis", error));
    return () => {
      cancelled = true;
    };
  }, [items, updateConfigurationOptions]);

  // Florianópolis / Grande Fpolis: 88000–88169
  const cepDigits = deliveryAddress.cep.replace(/\D/g, "");
  const shippingAvailable = useMemo(() => {
    if (cepDigits.length !== 8) return null;
    const n = parseInt(cepDigits.slice(0, 5), 10);
    return n >= 88000 && n <= 88169;
  }, [cepDigits]);

  const effectiveDelivery =
    delivery === "shipping" && shippingAvailable === false ? "pickup" : delivery;

  const subtotal = items.reduce((sum, it) => sum + itemSubtotal(it), 0);
  const hasPrices = items.some((it) => typeof it.unitPrice === "number");

  // If "same as billing" is checked, the delivery address equals the customer address.
  const finalDeliveryAddress = sameAsDelivery ? customerAddress : deliveryAddress;
  const deliveryFormAddress = sameAsDelivery ? customerAddress : deliveryAddress;

  const buildSummary = () => {
    const lines: string[] = [];
    lines.push("Orçamento — Arteno Vaso & Decor");
    lines.push("");
    lines.push("PRODUTOS");
    items.forEach((it, idx) => {
      lines.push(`${idx + 1}. ${it.name} (x${it.quantity})`);
      const details = [
        it.sizeLabel && `Tamanho: ${it.sizeLabel}`,
        it.dimensions && `Medidas: ${it.dimensions}`,
        it.finish && `Acabamento: ${it.finish}`,
        it.color && `Cor: ${it.color}`,
        it.slug && `Link: ${absoluteUrl(`/produto/${it.slug}`)}`,
        typeof it.unitPrice === "number" && `Subtotal: ${formatBRL(itemSubtotal(it))}`,
      ].filter(Boolean);
      details.forEach((d) => lines.push(`   - ${d}`));
    });
    if (hasPrices) {
      lines.push("");
      lines.push(`SUBTOTAL: ${formatBRL(subtotal)}`);
    }
    lines.push("");
    lines.push("CLIENTE");
    lines.push(`Nome: ${customer.name}`);
    if (
      customer.customerType === "reseller" ||
      (customer.customerType === "professional" && customer.professionalDocument === "cnpj")
    ) {
      lines.push(`Empresa: ${customer.companyName}`);
      if (customer.cnpj) lines.push(`CNPJ: ${customer.cnpj}`);
    } else {
      if (customer.cpf) lines.push(`CPF: ${customer.cpf}`);
    }
    lines.push(`E-mail: ${customer.email}`);
    lines.push(`Telefone: ${customer.phone}`);
    lines.push("");
    lines.push("ENTREGA");
    if (effectiveDelivery === "pickup") {
      lines.push("Retirar na fábrica");
    } else {
      const a = finalDeliveryAddress;
      lines.push(`Frete — ${a.street}, ${a.number}${a.complement ? ` (${a.complement})` : ""}`);
      lines.push(`${a.neighborhood} — ${a.city}/${a.state} — CEP ${a.cep}`);
    }
    return lines.join("\n");
  };

  const persistOrder = async (): Promise<string | null> => {
    if (savedOrderId) return savedOrderId;
    if (submitted) return null;
    setSubmitted(true);
    const cleanItems = items.map((i) => ({
      kind: "catalog" as const,
      product_id: null,
      name: i.name,
      description: null,
      quantity: i.quantity,
      price: i.unitPrice ?? 0,
      size_id: null,
      size_name: i.sizeLabel ?? null,
      finish: i.finish ?? null,
      color: i.color ?? null,
      product_url: i.slug ? absoluteUrl(`/produto/${i.slug}`) : null,
    }));
    const a = finalDeliveryAddress;
    const meta = {
      __meta: 1,
      freight: 0,
      freightNote: "",
      deadline: "",
      payment: "",
      pix: "",
      note: "",
      address:
        effectiveDelivery === "shipping"
          ? `${a.street}, ${a.number}${a.complement ? ` (${a.complement})` : ""} — ${a.neighborhood}, ${a.city}/${a.state} — CEP ${a.cep}`
          : "Retirar na fábrica",
      personType: customer.customerType === "final" ? "fisica" : "juridica",
      customerType: customer.customerType,
      cpf:
        customer.customerType === "final" ||
        (customer.customerType === "professional" && customer.professionalDocument === "cpf")
          ? customer.cpf
          : null,
      cnpj:
        customer.customerType === "reseller" ||
        (customer.customerType === "professional" && customer.professionalDocument === "cnpj")
          ? customer.cnpj
          : null,
      companyName: customer.customerType !== "final" ? customer.companyName : null,
    };
    const orderId = crypto.randomUUID();
    const emailNotificationToken = crypto.randomUUID();
    const notificationPayload = {
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      items: cleanItems,
      total: subtotal,
      notes: JSON.stringify(meta),
    };
    try {
      const { error } = await publicSupabase.from("orders" as never).insert({
        id: orderId,
        status: "orcamento",
        origin: "site",
        email_notification_token: emailNotificationToken,
        ...notificationPayload,
      } as never);
      if (error) throw error;
      setSavedOrderId(orderId);
      const dashboardUrl = absoluteUrl(`/dashboard/orcamentos?orcamento=${orderId}`);
      sessionStorage.setItem(
        "arteno:quote-finalization",
        JSON.stringify({
          orderId,
          emailNotificationToken,
          dashboardUrl,
          whatsappNumber,
          whatsappText: `${buildSummary()}\n\nABRIR ORÇAMENTO NO DASHBOARD\n${dashboardUrl}`,
          notificationPayload,
        }),
      );
      return orderId;
    } catch (err) {
      console.warn("[orcamento] persist failed", err);
      setSubmitted(false);
      return null;
    }
  };

  const finishQuote = async () => {
    const orderId = await persistOrder();
    if (!orderId) {
      setValidationErrors([
        "Não foi possível salvar o orçamento. Verifique sua conexão e tente novamente.",
      ]);
      return;
    }
    await navigate({ to: "/finalizar-orcamento" });
  };

  const productErrors = [
    ...(items.length === 0 ? ["Adicione pelo menos um produto ao orçamento."] : []),
    ...items.flatMap((item) => [
      ...(!item.finish ? [`Selecione o acabamento de ${item.name}.`] : []),
      ...(!item.color ? [`Selecione a cor de ${item.name}.`] : []),
    ]),
  ];
  const canGoStep2 = productErrors.length === 0;
  const cpfDigits = customer.cpf.replace(/\D/g, "");
  const cnpjDigits = customer.cnpj.replace(/\D/g, "");
  const docOk =
    customer.customerType === "final"
      ? cpfDigits.length === 11
      : customer.customerType === "reseller"
        ? cnpjDigits.length === 14
        : customer.professionalDocument === "cpf"
          ? cpfDigits.length === 0 || cpfDigits.length === 11
          : cnpjDigits.length === 0 || cnpjDigits.length === 14;
  const canGoStep3 =
    customer.name.trim() !== "" &&
    customer.email.trim() !== "" &&
    customer.phone.trim() !== "" &&
    docOk &&
    customerAddress.cep.replace(/\D/g, "").length === 8 &&
    customerAddress.street.trim() !== "" &&
    customerAddress.number.trim() !== "";
  const customerErrors = [
    ...(!customer.name.trim() ? ["Informe o nome completo."] : []),
    ...(!customer.email.trim() ? ["Informe o e-mail."] : []),
    ...(!customer.phone.trim() ? ["Informe o telefone ou WhatsApp."] : []),
    ...(!docOk
      ? [
          customer.customerType === "reseller"
            ? "Informe um CNPJ válido com 14 dígitos."
            : customer.customerType === "final"
              ? "Informe um CPF válido com 11 dígitos."
              : "O CPF ou CNPJ informado está incompleto.",
        ]
      : []),
    ...(customerAddress.cep.replace(/\D/g, "").length !== 8
      ? ["Informe o CEP de cadastro com 8 dígitos."]
      : []),
    ...(!customerAddress.street.trim() ? ["Informe a rua do endereço de cadastro."] : []),
    ...(!customerAddress.number.trim() ? ["Informe o número do endereço de cadastro."] : []),
  ];
  const deliveryOk =
    effectiveDelivery === "pickup" ||
    sameAsDelivery ||
    (deliveryAddress.cep.replace(/\D/g, "").length === 8 &&
      deliveryAddress.street.trim() !== "" &&
      deliveryAddress.number.trim() !== "");
  const canFinish = canGoStep3 && deliveryOk;
  const deliveryErrors = [
    ...customerErrors,
    ...(effectiveDelivery === "shipping" && !deliveryOk
      ? ["Complete o CEP, a rua e o número do endereço de entrega."]
      : []),
  ];

  function continueToNextStep() {
    const errors = step === 1 ? productErrors : customerErrors;
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setStep(step === 1 ? 2 : 3);
  }

  function tryFinishQuote() {
    if (!canFinish) {
      setValidationErrors(deliveryErrors);
      return;
    }
    setValidationErrors([]);
    void finishQuote();
  }

  if (items.length === 0) {
    return (
      <section className="min-h-[calc(100vh-96px)] bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Seu orçamento</h1>
          <div className="mt-8 border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Nenhum produto adicionado ao orçamento ainda.</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver produtos
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-96px)] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Stepper */}
        <Stepper
          step={step}
          onSelect={(s) =>
            setStep(
              s === 1 ? 1 : s === 2 ? (canGoStep2 ? 2 : step) : canGoStep2 && canGoStep3 ? 3 : step,
            )
          }
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Left column — active step content */}
          <div className="min-w-0">
            {step === 1 && (
              <StepProducts
                items={items}
                updateQuantity={updateQuantity}
                updateConfiguration={updateConfiguration}
                removeItem={removeItem}
                clear={clear}
              />
            )}
            {step === 2 && (
              <StepCustomer
                customer={customer}
                setCustomer={setCustomer}
                customerAddress={customerAddress}
                setCustomerAddress={setCustomerAddress}
              />
            )}
            {step === 3 && (
              <StepDelivery
                delivery={delivery}
                setDelivery={setDelivery}
                shippingAvailable={shippingAvailable}
                effectiveDelivery={effectiveDelivery}
                deliveryAddress={deliveryFormAddress}
                setDeliveryAddress={setDeliveryAddress}
                sameAsDelivery={sameAsDelivery}
                onToggleSame={(v) => {
                  setSameAsDelivery(v);
                  if (v) {
                    setDeliveryAddress(() => ({ ...customerAddress }));
                  } else {
                    setDeliveryAddress(() => EMPTY_ADDRESS);
                  }
                }}
              />
            )}
          </div>

          {/* Right column — sticky summary */}
          <aside className="lg:sticky lg:top-24">
            <div className="border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">
                  Resumo do orçamento
                </h2>
              </div>
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <li key={it.id} className="flex gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {typeof it.unitPrice === "number" ? formatBRL(itemSubtotal(it)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-5 py-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {hasPrices ? formatBRL(subtotal) : "A consultar"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entrega</span>
                  <span>
                    {effectiveDelivery === "pickup" ? "Retirar na fábrica" : "Frete a cotar"}
                  </span>
                </div>
              </div>

              {step < 3 ? (
                <div className="border-t border-border p-5">
                  <button
                    type="button"
                    onClick={continueToNextStep}
                    className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Voltar
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 border-t border-border p-5">
                  <button
                    type="button"
                    onClick={tryFinishQuote}
                    disabled={submitted}
                    className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitted ? "Salvando orçamento..." : "Finalizar orçamento"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar
                  </button>
                </div>
              )}
              {validationErrors.length > 0 && (
                <div
                  role="alert"
                  className="border-t border-destructive/20 bg-destructive/5 px-5 py-4"
                >
                  <p className="text-sm font-semibold text-destructive">
                    Revise os itens abaixo para continuar:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-destructive">
                    {validationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stepper({ step, onSelect }: { step: 1 | 2 | 3; onSelect: (s: 1 | 2 | 3) => void }) {
  const steps = [
    { n: 1, label: "Produtos" },
    { n: 2, label: "Seus dados" },
    { n: 3, label: "Entrega" },
  ] as const;
  return (
    <ol className="flex items-center gap-6 border-b border-border pb-4">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <li key={s.n} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelect(s.n)}
              className="flex items-center gap-3 text-left"
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center border text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-widest ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span className="ml-1 h-px w-10 bg-border sm:w-16" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepProducts({
  items,
  updateQuantity,
  updateConfiguration,
  removeItem,
  clear,
}: {
  items: QuoteItem[];
  updateQuantity: (id: string, q: number) => void;
  updateConfiguration: (
    id: string,
    configuration: Pick<QuoteItem, "finish" | "color" | "unitPrice">,
  ) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Produtos
        </h2>
        <ul className="mt-3 divide-y divide-border border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex gap-5 p-5">
              <div className="h-28 w-28 shrink-0 overflow-hidden bg-muted sm:h-32 sm:w-32">
                {item.image && (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-primary sm:text-xl">
                    {item.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  {item.sizeLabel && (
                    <div>
                      <dt className="uppercase tracking-widest">Tamanho</dt>
                      <dd className="text-foreground">{item.sizeLabel}</dd>
                    </div>
                  )}
                  {item.dimensions && (
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="uppercase tracking-widest">Medidas</dt>
                      <dd className="text-foreground">{item.dimensions}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Acabamento
                    {item.availableFinishes?.length ? (
                      <select
                        value={item.finish ?? ""}
                        onChange={(event) => {
                          const finish = item.availableFinishes?.find(
                            (option) => option.name === event.target.value,
                          );
                          updateConfiguration(item.id, {
                            finish: event.target.value,
                            color: item.color,
                            unitPrice:
                              (item.basePrice ?? item.unitPrice ?? 0) + (finish?.extraPrice ?? 0),
                          });
                        }}
                        className="border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                      >
                        <option value="" disabled>
                          Selecione o acabamento
                        </option>
                        {item.availableFinishes.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="py-2 text-sm normal-case tracking-normal text-foreground">
                        {item.finish ?? "Não informado"}
                      </span>
                    )}
                  </label>
                  <label className="grid gap-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Cor
                    {item.availableColors?.length ? (
                      <select
                        value={item.color ?? ""}
                        onChange={(event) =>
                          updateConfiguration(item.id, {
                            finish: item.finish,
                            color: event.target.value,
                            unitPrice: item.unitPrice,
                          })
                        }
                        className="border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                      >
                        <option value="" disabled>
                          Selecione a cor
                        </option>
                        {item.availableColors.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="py-2 text-sm normal-case tracking-normal text-foreground">
                        {item.color ?? "Não informada"}
                      </span>
                    )}
                  </label>
                </div>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <div className="inline-flex items-center border border-border">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="inline-flex h-9 w-9 items-center justify-center transition-colors hover:bg-accent"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="inline-flex h-9 w-9 items-center justify-center transition-colors hover:bg-accent"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {typeof item.unitPrice === "number" && (
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        Subtotal
                      </div>
                      <div className="font-display text-lg font-semibold text-primary">
                        {formatBRL(itemSubtotal(item))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            Limpar lista
          </button>
        </div>
      </section>
    </div>
  );
}

function StepCustomer({
  customer,
  setCustomer,
  customerAddress,
  setCustomerAddress,
}: {
  customer: Customer;
  setCustomer: (updater: (c: Customer) => Customer) => void;
  customerAddress: Address;
  setCustomerAddress: (updater: (a: Address) => Address) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Seus dados
        </h2>
        <div className="mt-3 grid gap-4 border border-border bg-card p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Perfil do cliente
            </span>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customerType"
                  checked={customer.customerType === "final"}
                  onChange={() => setCustomer((c) => ({ ...c, customerType: "final" }))}
                />
                Cliente final
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customerType"
                  checked={customer.customerType === "professional"}
                  onChange={() => setCustomer((c) => ({ ...c, customerType: "professional" }))}
                />
                Profissional / Especificador
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customerType"
                  checked={customer.customerType === "reseller"}
                  onChange={() => setCustomer((c) => ({ ...c, customerType: "reseller" }))}
                />
                Revendedor / Lojista
              </label>
            </div>
          </div>
          <Field
            label="Nome completo"
            required
            value={customer.name}
            onChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
            className="sm:col-span-2"
          />
          {customer.customerType !== "final" && (
            <Field
              label="Nome da empresa"
              value={customer.companyName}
              onChange={(v) => setCustomer((c) => ({ ...c, companyName: v }))}
              className="sm:col-span-2"
            />
          )}
          {customer.customerType === "professional" && (
            <div className="sm:col-span-2">
              <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Documento
              </span>
              <div className="mt-2 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={customer.professionalDocument === "cnpj"}
                    onChange={() => setCustomer((c) => ({ ...c, professionalDocument: "cnpj" }))}
                  />
                  Informar CNPJ
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={customer.professionalDocument === "cpf"}
                    onChange={() => setCustomer((c) => ({ ...c, professionalDocument: "cpf" }))}
                  />
                  Informar CPF
                </label>
              </div>
            </div>
          )}
          {customer.customerType === "final" ||
          (customer.customerType === "professional" && customer.professionalDocument === "cpf") ? (
            <Field
              label={customer.customerType === "professional" ? "CPF (opcional)" : "CPF"}
              required={customer.customerType === "final"}
              value={customer.cpf}
              onChange={(v) => setCustomer((c) => ({ ...c, cpf: maskCpf(v) }))}
              maxLength={14}
              placeholder="000.000.000-00"
              className="sm:col-span-2"
            />
          ) : (
            <Field
              label={customer.customerType === "professional" ? "CNPJ (opcional)" : "CNPJ"}
              required={customer.customerType === "reseller"}
              value={customer.cnpj}
              onChange={(v) => setCustomer((c) => ({ ...c, cnpj: maskCnpj(v) }))}
              maxLength={18}
              placeholder="00.000.000/0000-00"
              className="sm:col-span-2"
            />
          )}
          <Field
            label="E-mail"
            required
            type="email"
            value={customer.email}
            onChange={(v) => setCustomer((c) => ({ ...c, email: v }))}
          />
          <Field
            label="Telefone / WhatsApp"
            required
            value={customer.phone}
            onChange={(v) => setCustomer((c) => ({ ...c, phone: maskPhoneBR(v) }))}
            placeholder="(00) 00000-0000"
            maxLength={16}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Endereço de cadastro
        </h2>
        <div className="mt-3 border border-border bg-card p-5">
          <AddressFields
            title="Endereço de cadastro"
            address={customerAddress}
            onChange={setCustomerAddress}
            requireFull
            hideTitle
          />
        </div>
      </section>
    </div>
  );
}

function StepDelivery({
  delivery,
  setDelivery,
  shippingAvailable,
  effectiveDelivery,
  deliveryAddress,
  setDeliveryAddress,
  sameAsDelivery,
  onToggleSame,
}: {
  delivery: "pickup" | "shipping";
  setDelivery: (d: "pickup" | "shipping") => void;
  shippingAvailable: boolean | null;
  effectiveDelivery: "pickup" | "shipping";
  deliveryAddress: Address;
  setDeliveryAddress: (updater: (a: Address) => Address) => void;
  sameAsDelivery: boolean;
  onToggleSame: (v: boolean) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Entrega
        </h2>
        <div className="mt-3 space-y-4 border border-border bg-card p-5">
          <div className="space-y-2">
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
                shippingAvailable === false ? "opacity-50" : ""
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

          {effectiveDelivery === "pickup" && (
            <div className="overflow-hidden border border-border bg-background">
              <iframe
                title="Região aproximada para retirada em Jurerê"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-48.505%2C-27.455%2C-48.475%2C-27.425&layer=mapnik&marker=-27.44%2C-48.49"
                className="h-64 w-full border-0"
                loading="lazy"
              />
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">Retirada na região de Jurerê</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O mapa indica somente a região aproximada. O endereço exato será combinado durante
                  o atendimento.
                </p>
              </div>
            </div>
          )}

          {effectiveDelivery === "shipping" && (
            <>
              <label className="flex items-start gap-3 border-t border-border pt-4 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsDelivery}
                  onChange={(e) => onToggleSame(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Entregar no mesmo endereço de cobrança.
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Desmarque para informar outro endereço de entrega.
                  </span>
                </span>
              </label>

              <AddressFields
                title="Endereço de entrega"
                address={deliveryAddress}
                onChange={setDeliveryAddress}
                requireFull
                disabled={sameAsDelivery}
              />
            </>
          )}

          {shippingAvailable === false && delivery === "shipping" && (
            <p className="text-xs text-destructive">
              Não temos logística de entrega para este endereço. Se quiser continuar, selecione
              "Retirar na fábrica".
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function AddressFields({
  title,
  address,
  onChange,
  requireFull,
  hideTitle,
  disabled,
}: {
  title: string;
  address: Address;
  onChange: (updater: (a: Address) => Address) => void;
  requireFull: boolean;
  hideTitle?: boolean;
  disabled?: boolean;
}) {
  const set = <K extends keyof Address>(k: K, v: Address[K]) => onChange((a) => ({ ...a, [k]: v }));
  return (
    <div>
      {!hideTitle && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-6">
        <Field
          label="CEP"
          required={requireFull}
          value={address.cep}
          onChange={(v) => set("cep", v)}
          maxLength={9}
          placeholder="00000-000"
          disabled={disabled}
          className="sm:col-span-2"
        />
        <Field
          label="Rua"
          required={requireFull}
          value={address.street}
          onChange={(v) => set("street", v)}
          disabled={disabled}
          className="sm:col-span-4"
        />
        <Field
          label="Número"
          required={requireFull}
          value={address.number}
          onChange={(v) => set("number", v)}
          disabled={disabled}
          className="sm:col-span-2"
        />
        <Field
          label="Complemento"
          value={address.complement}
          onChange={(v) => set("complement", v)}
          disabled={disabled}
          className="sm:col-span-4"
        />
        <Field
          label="Bairro"
          value={address.neighborhood}
          onChange={(v) => set("neighborhood", v)}
          disabled={disabled}
          className="sm:col-span-3"
        />
        <Field
          label="Cidade"
          value={address.city}
          onChange={(v) => set("city", v)}
          disabled={disabled}
          className="sm:col-span-2"
        />
        <Field
          label="UF"
          value={address.state}
          onChange={(v) => set("state", v.toUpperCase())}
          maxLength={2}
          disabled={disabled}
          className="sm:col-span-1"
        />
      </div>
      {requireFull && (
        <p className="mt-2 text-xs text-muted-foreground">
          Digite o CEP para preencher rua, bairro, cidade e estado automaticamente.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
  className,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="mt-1.5 block w-full border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}
