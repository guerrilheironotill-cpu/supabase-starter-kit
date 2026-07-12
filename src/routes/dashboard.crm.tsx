import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MessageSquare } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";
import { useLeadsStore } from "@/lib/leads-store";

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
  isReal?: boolean;
};

const LEADS: Lead[] = [
  { id: "1", name: "Marina Alves", contact: "(11) 98123-4410", channel: "WhatsApp", interest: "Vaso Toscana G", status: "Novo", createdAt: "há 2h" },
  { id: "2", name: "Roberto Lima", contact: "roberto@studio.com", channel: "E-mail", interest: "Jardineira Ravena", status: "Em contato", createdAt: "há 5h" },
  { id: "3", name: "Fernanda Souza", contact: "(11) 99720-1188", channel: "WhatsApp", interest: "Mesa Provence", status: "Proposta", createdAt: "ontem" },
  { id: "4", name: "Carlos Menezes", contact: "(21) 98844-2210", channel: "Telefone", interest: "Fonte Aurora", status: "Fechado", createdAt: "2 dias" },
  { id: "5", name: "Juliana Prado", contact: "juliana@arq.com.br", channel: "E-mail", interest: "Vaso Milano P", status: "Novo", createdAt: "3 dias" },
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `${d} dias`;
}

function DashboardCrmPage() {
  const realLeads = useLeadsStore((s) => s.leads);

  const mapped: Lead[] = realLeads.map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.phone,
    channel: "WhatsApp",
    interest:
      l.items.length === 0
        ? "—"
        : l.items.length === 1
          ? `${l.items[0].name}${l.items[0].sizeLabel ? ` (${l.items[0].sizeLabel})` : ""}`
          : `${l.items[0].name} +${l.items.length - 1}`,
    status: "Novo",
    createdAt: timeAgo(l.createdAt),
    isReal: true,
  }));

  const allLeads: Lead[] = [...mapped, ...LEADS];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads e contatos recebidos pelo site. Reais são marcados com{" "}
          <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            Real
          </span>
          ; os demais são exemplos.
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
              {allLeads.map((l) => {
                const Icon = CHANNEL_ICON[l.channel];
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        {l.name}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            l.isReal
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {l.isReal ? "Real" : "Simulado"}
                        </span>
                      </span>
                    </td>
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
    </>
  );
}