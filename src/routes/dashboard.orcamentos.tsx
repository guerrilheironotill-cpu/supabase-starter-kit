import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardQuotesPage,
});

const MOCK = [
  { id: "1042", cliente: "Ana Ribeiro", total: "R$ 1.280", data: "12/07", status: "Novo" },
  { id: "1041", cliente: "Marcos Silva", total: "R$ 2.740", data: "11/07", status: "Em contato" },
  { id: "1040", cliente: "Julia Souza", total: "R$ 890", data: "10/07", status: "Fechado" },
  { id: "1039", cliente: "Pedro Lima", total: "R$ 3.410", data: "09/07", status: "Novo" },
];

function DashboardQuotesPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Orçamentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos recebidos via WhatsApp e formulário.
        </p>
      </div>
      <DashboardSection title="Últimos orçamentos">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.map((q) => (
                <tr key={q.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">#{q.id}</td>
                  <td className="px-4 py-3">{q.cliente}</td>
                  <td className="px-4 py-3">{q.total}</td>
                  <td className="px-4 py-3 text-muted-foreground">{q.data}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <FileText className="h-3 w-3" /> {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Dados de exemplo. Conecte a tabela de orçamentos para exibir dados reais.
        </p>
      </DashboardSection>
    </>
  );
}