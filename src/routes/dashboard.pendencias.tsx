import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendenciasPage,
});

type Priority = "alta" | "media" | "baixa";
type Item = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  done?: boolean;
};

const INITIAL: Item[] = [
  {
    id: "status-pedido",
    title: "Edição do status do pedido em /dashboard/pedidos",
    description:
      "Select inline por linha ainda não persiste corretamente em app_orders. Revisar updateStatus e feedback visual.",
    priority: "alta",
  },
  {
    id: "crm-real",
    title: "CRM com dados reais (Google e Meta)",
    description:
      "Substituir métricas fictícias em /dashboard/crm por integrações reais com Google Ads/Analytics e Meta Ads.",
    priority: "alta",
  },
  {
    id: "revendedores",
    title: "Área de revendedores",
    description:
      "Implementar cadastro, login e catálogo com preços diferenciados para revendedores.",
    priority: "media",
  },
  {
    id: "ga4-eventos-botoes",
    title: "GA4 — rastrear cliques em botões (eventos customizados)",
    description:
      "Passo a passo: 1) Confirmar GA4 Measurement ID em Configurações → Integrações. 2) Criar helper src/lib/analytics.ts com trackEvent(name, params) usando window.gtag. 3) Instrumentar CTAs: click_whatsapp (header/produto/drawer), generate_lead (envio orçamento), select_item (product-card), view_item (/produto/:slug), search (busca), begin_checkout (abrir drawer orçamento), contact (form contato). 4) Em GA4 → Admin → Events, marcar generate_lead e click_whatsapp como conversão. 5) (Opcional) Espelhar no Meta Pixel (ViewContent, Lead, Contact). 6) Validar no GA4 DebugView antes de publicar.",
    priority: "media",
  },
  {
    id: "merchant-fase-2",
    title: "Google Merchant — Fase 2: Enhanced Conversions",
    description:
      "Após instrumentar GA4 (fase 1 de eventos), usar generate_lead como Enhanced Conversion no Google Ads. Passos: 1) Vincular GA4 ao Google Ads em Admin → Product links. 2) Importar generate_lead como conversão no Ads. 3) Ativar Enhanced Conversions passando email/telefone hasheado do lead (form orçamento). 4) Validar no painel Diagnostics do Ads.",
    priority: "media",
  },
  {
    id: "merchant-fase-3",
    title: "Google Merchant — Fase 3: Painel de Performance Max (opcional)",
    description:
      "Alternativa a gerenciar campanhas direto no Google Ads. Passos: 1) Criar OAuth com Google Ads API. 2) Endpoint para criar campanha Performance Max apontando para o feed do Merchant. 3) UI no dashboard para budget diário, países-alvo, pausar/ativar. 4) Métricas (impressões, cliques, conversões) via Ads API. Recomendado: usar Google Ads direto até ter volume que justifique o painel próprio.",
    priority: "baixa",
  },
];


const PRIORITY_STYLE: Record<Priority, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

function PendenciasPage() {
  const [items, setItems] = useState<Item[]>(INITIAL);

  const toggle = (id: string) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
    );

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          Pendências
        </h1>
        <p className="text-sm text-muted-foreground">
          Lista de itens em aberto no site. Marque como resolvido conforme forem
          concluídos.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Em aberto ({open.length})
        </h2>
        <ul className="space-y-2">
          {open.map((it) => (
            <Row key={it.id} item={it} onToggle={toggle} />
          ))}
          {open.length === 0 && (
            <li className="text-sm text-muted-foreground border rounded-md p-4">
              Nenhuma pendência em aberto 🎉
            </li>
          )}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Resolvidos ({done.length})
          </h2>
          <ul className="space-y-2">
            {done.map((it) => (
              <Row key={it.id} item={it} onToggle={toggle} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ item, onToggle }: { item: Item; onToggle: (id: string) => void }) {
  return (
    <li className="border rounded-md p-4 flex items-start gap-3 bg-card">
      <button
        onClick={() => onToggle(item.id)}
        className="mt-0.5 text-muted-foreground hover:text-foreground"
        aria-label={item.done ? "Marcar como aberto" : "Marcar como resolvido"}
      >
        {item.done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-medium",
              item.done && "line-through text-muted-foreground",
            )}
          >
            {item.title}
          </span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded border",
              PRIORITY_STYLE[item.priority],
            )}
          >
            {item.priority}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
      </div>
    </li>
  );
}