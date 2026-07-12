import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MessageSquare, TrendingUp } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/crm")({
  head: () => ({
    meta: [
      { title: "CRM — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardCrmPage,
});

type Lead = {
  id: string;
  name: string;
  contact: string;
  channel: "WhatsApp" | "E-mail" | "Telefone";
  interest: string;
  status: "Novo" | "Em contato" | "Proposta" | "Fechado";
  createdAt: string;
};

const LEADS: Lead[] = [
  { id: "1", name: "Marina Alves", contact: "(11) 98123-4410", channel: "WhatsApp", interest: "Vaso Toscana G", status: "Novo", createdAt: "há 2h" },
  { id: "2", name: "Roberto Lima", contact: "roberto@studio.com", channel: "E-mail", interest: "Jardineira Ravena", status: "Em contato", createdAt: "há 5h" },
  { id: "3", name: "Fernanda Souza", contact: "(11) 99720-1188", channel: "WhatsApp", interest: "Mesa Provence", status: "Proposta", createdAt: "ontem" },
  { id: "4", name: "Carlos Menezes", contact: "(21) 98844-2210", channel: "Telefone", interest: "Fonte Aurora", status: "Fechado", createdAt: "2 dias" },
  { id: "5", name: "Juliana Prado", contact: "juliana@arq.com.br", channel: "E-mail", interest: "Vaso Milano P", status: "Novo", createdAt: "3 dias" },
];

const TOP_PRODUCTS = [
  { name: "Vaso Toscana G", category: "Vasos", views: 1284, quotes: 42 },
  { name: "Jardineira Ravena", category: "Jardineiras", views: 982, quotes: 31 },
  { name: "Vaso Milano P", category: "Vasos", views: 861, quotes: 27 },
  { name: "Mesa Provence", category: "Mesas", views: 704, quotes: 19 },
  { name: "Fonte Aurora", category: "Fontes", views: 612, quotes: 14 },
  { name: "Banco Siena", category: "Bancos", views: 498, quotes: 11 },
];

const CHANNEL_ICON = {
  WhatsApp: MessageSquare,
  "E-mail": Mail,
  Telefone: Phone,
} as const;

const STATUS_STYLES: Record<Lead["status"], string> = {
  Novo: "bg-primary/15 text-primary",
  "Em contato": "bg-amber-500/15 text-amber-400",
  Proposta: "bg-sky-500/15 text-sky-400",
  Fechado: "bg-emerald-500/15 text-emerald-400",
};

function DashboardCrmPage() {
  const maxViews = Math.max(...TOP_PRODUCTS.map((p) => p.views));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads, contatos e produtos mais acessados.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Leads (mês)", value: "128" },
          { label: "Em contato", value: "34" },
          { label: "Propostas", value: "12" },
          { label: "Fechados", value: "7" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <DashboardSection title="Leads recentes" description="Últimos contatos recebidos">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Interesse</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {LEADS.map((l) => {
                const Icon = CHANNEL_ICON[l.channel];
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{l.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {l.contact}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.interest}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[l.status]}`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.createdAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Produtos mais acessados"
        description="Top produtos por visualizações no mês"
      >
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <ul className="space-y-4">
            {TOP_PRODUCTS.map((p, i) => (
              <li key={p.name} className="flex items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        {p.views.toLocaleString("pt-BR")} visitas
                      </span>
                      <span>{p.quotes} orçamentos</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.views / maxViews) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DashboardSection>
    </>
  );
}