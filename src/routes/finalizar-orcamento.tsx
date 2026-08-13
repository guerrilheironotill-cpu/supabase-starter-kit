import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { publicSupabase } from "@/integrations/supabase/client";
import { whatsappLinkFrom } from "@/lib/site-settings";

type FinalizationItem = {
  name: string;
  quantity: number;
  price: number;
  size_name?: string | null;
  finish?: string | null;
  color?: string | null;
};

type FinalizationContext = {
  orderId: string;
  emailNotificationToken: string;
  dashboardUrl: string;
  whatsappNumber: string;
  whatsappText: string;
  notificationPayload: {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    items: FinalizationItem[];
    total: number;
    notes: string;
  };
};

export const Route = createFileRoute("/finalizar-orcamento")({
  head: () => ({
    meta: [
      { title: "Finalizar orçamento — Arteno Vaso & Decor" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinalizeQuotePage,
});

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinalizeQuotePage() {
  const [context, setContext] = useState<FinalizationContext | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("arteno:quote-finalization");
    if (!raw) return;
    try {
      setContext(JSON.parse(raw) as FinalizationContext);
    } catch {
      sessionStorage.removeItem("arteno:quote-finalization");
    }
  }, []);

  async function finalizeByEmail() {
    if (!context || sendingEmail) return;
    setSendingEmail(true);
    setEmailError(null);
    const { error } = await publicSupabase.functions.invoke("notify-new-order", {
      body: { order_id: context.orderId, token: context.emailNotificationToken },
    });
    setSendingEmail(false);
    if (error) {
      setEmailError(
        "Não foi possível enviar o e-mail agora. Tente novamente ou continue pelo WhatsApp.",
      );
      return;
    }
    setEmailSent(true);
  }

  if (!context) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-primary">Orçamento não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Volte ao orçamento para revisar e finalizar sua solicitação.
        </p>
        <Link
          to="/orcamento"
          className="mt-6 inline-flex bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
        >
          Voltar ao orçamento
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-white py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="border border-border bg-card p-6 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Orçamento #{context.orderId.slice(0, 6)}
          </p>
          <h1 className="mt-3 font-display text-3xl text-primary sm:text-4xl">
            Orçamento quase pronto
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Para finalizar, precisamos combinar o frete, o prazo de produção e o pagamento. Escolha
            como deseja continuar o atendimento.
          </p>

          <section className="mt-8 border-y border-border py-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Resumo do pedido
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {context.notificationPayload.items.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {item.quantity}× {item.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[item.size_name, item.finish, item.color].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="shrink-0">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{money(context.notificationPayload.total)}</span>
            </div>
          </section>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a
              href={whatsappLinkFrom(context.whatsappNumber, context.whatsappText)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-28 flex-col items-center justify-center gap-3 bg-[#1f8f4e] px-6 py-5 text-center font-medium text-white transition hover:bg-[#197a42]"
            >
              <MessageCircle className="h-7 w-7" />
              Finalizar por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void finalizeByEmail()}
              disabled={sendingEmail || emailSent}
              className="flex min-h-28 flex-col items-center justify-center gap-3 border border-primary bg-white px-6 py-5 text-center font-medium text-primary transition hover:bg-primary/5 disabled:opacity-60"
            >
              <Mail className="h-7 w-7" />
              {emailSent ? "E-mail enviado" : sendingEmail ? "Enviando..." : "Finalizar por e-mail"}
            </button>
          </div>
          {emailSent && (
            <p className="mt-4 text-center text-sm text-emerald-700">
              Solicitação enviada. A Arteno continuará o atendimento pelo seu e-mail.
            </p>
          )}
          {emailError && <p className="mt-4 text-center text-sm text-destructive">{emailError}</p>}
        </div>
      </div>
    </main>
  );
}
