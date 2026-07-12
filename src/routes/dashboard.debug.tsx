import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Trash2 } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";
import { supabase } from "@/integrations/supabase/client";
import { useFormDebugLogStore, type FormDebugLog } from "@/lib/form-debug-log";

export const Route = createFileRoute("/dashboard/debug")({
  head: () => ({
    meta: [
      { title: "Debug — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardDebugPage,
});

type LeadPreview = {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string | null;
};

async function fetchLeadDiagnostics() {
  const checkedAt = new Date().toISOString();
  const { data, error, status, statusText } = await supabase
    .from("leads" as never)
    .select("id, name, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return {
      ok: false,
      checkedAt,
      status,
      statusText,
      message: error.message,
      details: {
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      rows: [] as LeadPreview[],
    };
  }

  return {
    ok: true,
    checkedAt,
    status,
    statusText,
    message: "Leitura da tabela leads respondeu sem erro.",
    details: null,
    rows: (data ?? []) as LeadPreview[],
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detailsToText(details: unknown) {
  if (!details) return "";
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function DashboardDebugPage() {
  const logs = useFormDebugLogStore((s) => s.logs);
  const clearLogs = useFormDebugLogStore((s) => s.clearLogs);
  const diagnostics = useQuery({
    queryKey: ["dashboard", "debug", "leads"],
    queryFn: fetchLeadDiagnostics,
    staleTime: 0,
  });

  const latestError = logs.find((log) => log.level === "error");

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Debug do formulário
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erros capturados no envio do orçamento por WhatsApp e teste de acesso à tabela leads.
        </p>
      </div>

      <DashboardSection
        title="Status da tabela leads"
        description="Mostra se o dashboard consegue ler os leads salvos no Supabase."
        action={
          <button
            type="button"
            onClick={() => diagnostics.refetch()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        }
      >
        <div className="border border-border bg-card p-5">
          {diagnostics.isLoading ? (
            <p className="text-sm text-muted-foreground">Verificando Supabase…</p>
          ) : diagnostics.data?.ok ? (
            <div className="flex flex-wrap items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">SELECT funcionando</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status {diagnostics.data.status}. Última checagem: {formatDate(diagnostics.data.checkedAt)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-destructive">
                  {diagnostics.data?.message ?? "Falha ao consultar leads."}
                </p>
                {diagnostics.data?.details && (
                  <pre className="mt-3 max-h-48 overflow-auto border border-border bg-background p-3 text-xs text-muted-foreground">
                    {detailsToText(diagnostics.data.details)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 overflow-hidden border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                </tr>
              </thead>
              <tbody>
                {(diagnostics.data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      Nenhum lead retornado pela consulta.
                    </td>
                  </tr>
                ) : (
                  diagnostics.data?.rows.map((lead) => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{lead.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lead.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Logs do formulário"
        description="Cada tentativa de envio grava aqui o sucesso ou a mensagem de erro retornada pelo Supabase."
        action={
          <button
            type="button"
            onClick={clearLogs}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        }
      >
        {latestError && (
          <div className="mb-4 border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
              Último erro capturado
            </p>
            <p className="mt-2 text-sm text-foreground">{latestError.message}</p>
          </div>
        )}

        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="border border-border bg-card p-6 text-center">
              <Database className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Ainda não há logs. Envie o formulário de WhatsApp novamente e volte aqui.
              </p>
            </div>
          ) : (
            logs.map((log) => <DebugLogItem key={log.id} log={log} />)
          )}
        </div>
      </DashboardSection>
    </>
  );
}

function DebugLogItem({ log }: { log: FormDebugLog }) {
  const tone =
    log.level === "error"
      ? "border-destructive/40"
      : log.level === "success"
        ? "border-primary/40"
        : "border-border";
  const badge =
    log.level === "error"
      ? "bg-destructive/10 text-destructive"
      : log.level === "success"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  const details = detailsToText(log.details);

  return (
    <article className={`border bg-card p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${badge}`}>
            {log.level}
          </span>
          <h2 className="mt-3 text-sm font-semibold text-foreground">{log.action}</h2>
        </div>
        <time className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</time>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{log.message}</p>
      {details && (
        <pre className="mt-3 max-h-56 overflow-auto border border-border bg-background p-3 text-xs text-muted-foreground">
          {details}
        </pre>
      )}
    </article>
  );
}