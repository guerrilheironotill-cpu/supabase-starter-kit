import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Clock, Eye, FileText, Package, Database, AlertTriangle, MousePointerClick, Search, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardOverview,
});

type Stats = {
  products: number;
  categories: number;
  sizes: number;
};

async function fetchStats(): Promise<Stats> {
  const [prod, cat, sz] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("products").select("category").eq("active", true),
    supabase.from("product_sizes").select("id", { count: "exact", head: true }),
  ]);
  const catSet = new Set<string>();
  for (const r of cat.data ?? []) catSet.add((r as { category: string }).category);
  return {
    products: prod.count ?? 0,
    categories: catSet.size,
    sizes: sz.count ?? 0,
  };
}

type OrdersSummary = { configured: boolean; open: number; done: number };

type GscOverview = {
  configured: boolean;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  deltaClicks?: number;
  deltaImpressions?: number;
  topPages?: Array<{ url: string; clicks: number; impressions: number }>;
  topQueries?: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
};

async function fetchGsc(): Promise<GscOverview> {
  const res = await fetch("/api/gsc/overview");
  if (!res.ok) return { configured: false };
  return (await res.json()) as GscOverview;
}

type DbSize = {
  configured: boolean;
  sizeBytes: number;
  limitBytes: number;
  error?: string;
};

async function fetchDbSize(): Promise<DbSize> {
  const { data, error } = await supabase.rpc("db_size_info" as never);
  if (error) {
    return { configured: false, sizeBytes: 0, limitBytes: 0, error: error.message };
  }
  const row = Array.isArray(data) ? (data[0] as { size_bytes?: number; limit_bytes?: number } | undefined) : (data as { size_bytes?: number; limit_bytes?: number } | null);
  if (!row || row.size_bytes == null) {
    return { configured: false, sizeBytes: 0, limitBytes: 0 };
  }
  return {
    configured: true,
    sizeBytes: Number(row.size_bytes) || 0,
    limitBytes: Number(row.limit_bytes) || 500 * 1024 * 1024,
  };
}

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

type StorageUsage = {
  configured: boolean;
  sizeBytes: number;
  limitBytes: number;
  buckets: Array<{ name: string; bytes: number }>;
  error?: string;
};

async function fetchStorageUsage(): Promise<StorageUsage> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { configured: false, sizeBytes: 0, limitBytes: 0, buckets: [] };
  const res = await fetch("/api/storage-usage", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    ok: boolean;
    sizeBytes?: number;
    limitBytes?: number;
    buckets?: Array<{ name: string; bytes: number }>;
    error?: string;
  };
  if (!json.ok) {
    return { configured: false, sizeBytes: 0, limitBytes: 0, buckets: [], error: json.error };
  }
  return {
    configured: true,
    sizeBytes: json.sizeBytes ?? 0,
    limitBytes: json.limitBytes ?? 1024 * 1024 * 1024,
    buckets: json.buckets ?? [],
  };
}

function StorageUsageCard({ s }: { s?: StorageUsage }) {
  if (!s || !s.configured) return null;
  const pct = s.limitBytes > 0 ? (s.sizeBytes / s.limitBytes) * 100 : 0;
  const warn = pct >= 80;
  const critical = pct >= 95;
  const barColor = critical ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary";
  const borderColor = critical
    ? "border-destructive/50 bg-destructive/5"
    : warn
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-border bg-card";
  return (
    <div className={`mb-8 rounded-2xl border p-5 ${borderColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Uso do espaço do servidor
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatMB(s.sizeBytes)} / {formatMB(s.limitBytes)}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{pct.toFixed(1)}% utilizado</span>
        {warn && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              critical ? "text-destructive" : "text-amber-600"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {critical ? "Perto do limite — faça upgrade." : "Considere upgrade em breve."}
          </span>
        )}
      </div>
      {s.buckets.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {s.buckets.map((b) => (
            <li key={b.name} className="flex items-center justify-between">
              <span className="truncate">{b.name}</span>
              <span>{formatMB(b.bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DbUsageCard({ db }: { db?: DbSize }) {
  if (!db) return null;

  if (!db.configured) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Uso do banco de dados — configuração pendente
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rode o SQL abaixo no Supabase (SQL Editor) para habilitar o
              indicador de uso do banco:
            </p>
            <pre className="mt-3 overflow-auto rounded-md bg-black/80 p-3 text-[11px] leading-relaxed text-emerald-200">
{`create or replace function public.db_size_info()
returns table (size_bytes bigint, limit_bytes bigint)
language sql stable security definer set search_path = public as $$
  select pg_database_size(current_database())::bigint,
         (500 * 1024 * 1024)::bigint -- ajuste ao limite do seu plano
  where public.has_role(auth.uid(), 'admin');
$$;
revoke all on function public.db_size_info() from public, anon;
grant execute on function public.db_size_info() to authenticated;`}
            </pre>
            {db.error && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Erro: {db.error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pct = db.limitBytes > 0 ? (db.sizeBytes / db.limitBytes) * 100 : 0;
  const warn = pct >= 80;
  const critical = pct >= 95;
  const barColor = critical
    ? "bg-destructive"
    : warn
      ? "bg-amber-500"
      : "bg-primary";
  const borderColor = critical
    ? "border-destructive/50 bg-destructive/5"
    : warn
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-border bg-card";

  return (
    <div className={`mb-8 rounded-2xl border p-5 ${borderColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Uso do banco de dados
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatMB(db.sizeBytes)} / {formatMB(db.limitBytes)}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {pct.toFixed(1)}% utilizado
        </span>
        {warn && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              critical ? "text-destructive" : "text-amber-600"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {critical
              ? "Limite quase atingido — faça upgrade ou migre o banco."
              : "Perto do limite — considere upgrade em breve."}
          </span>
        )}
      </div>
    </div>
  );
}

async function fetchOrdersSummary(): Promise<OrdersSummary> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { configured: false, open: 0, done: 0 };
  const res = await fetch("/api/wc/orders-summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { configured: false, open: 0, done: 0 };
  const json = (await res.json()) as OrdersSummary & { error?: string };
  if (json.error) console.warn("[wc/orders-summary]", json.error);
  return json;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const trafficData = MONTHS.map((m, i) => ({
  month: m,
  views: Math.round(1200 + Math.sin(i / 1.6) * 380 + i * 90),
  quotes: Math.round(40 + Math.cos(i / 1.4) * 18 + i * 3),
}));

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta: string;
  icon: typeof Eye;
}) {
  const isNegative = typeof delta === "string" && delta.trim().startsWith("-");
  const isNeutral = delta === "—" || delta === "";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            isNeutral
              ? "text-muted-foreground"
              : isNegative
                ? "text-red-600"
                : "text-emerald-600"
          }`}
        >
          {isNeutral ? null : isNegative ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5" />
          )}
          {delta}
        </span>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
  const { data: orders } = useQuery({
    queryKey: ["dashboard", "wc-orders"],
    queryFn: fetchOrdersSummary,
    staleTime: 60_000,
  });
  const { data: dbSize } = useQuery({
    queryKey: ["dashboard", "db-size"],
    queryFn: fetchDbSize,
    staleTime: 5 * 60_000,
  });
  const { data: storageUsage } = useQuery({
    queryKey: ["dashboard", "storage-usage"],
    queryFn: fetchStorageUsage,
    staleTime: 5 * 60_000,
  });
  const { data: gsc } = useQuery({
    queryKey: ["dashboard", "gsc"],
    queryFn: fetchGsc,
    staleTime: 10 * 60_000,
  });

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");
  const fmtDelta = (d?: number) =>
    typeof d === "number" ? `${d > 0 ? "+" : ""}${d.toFixed(1)}%` : "—";

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Visão geral
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {gsc?.configured
            ? "Últimos 30 dias — dados reais do Google Search Console."
            : "Métricas do site e desempenho dos produtos."}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="Cliques (30d)"
          value={gsc?.configured ? fmt(gsc.clicks) : "—"}
          delta={gsc?.configured ? fmtDelta(gsc.deltaClicks) : "—"}
          icon={MousePointerClick}
        />
        <Kpi
          label="Impressões (30d)"
          value={gsc?.configured ? fmt(gsc.impressions) : "—"}
          delta={gsc?.configured ? fmtDelta(gsc.deltaImpressions) : "—"}
          icon={Search}
        />
        <Kpi label="Orçamentos" value="238" delta="+8,1%" icon={FileText} />
        <Kpi label="Pedidos em aberto" value={orders?.open ?? "—"} delta={orders?.configured ? "WC" : "—"} icon={Clock} />
        <Kpi label="Produtos ativos" value={stats?.products ?? "—"} delta="—" icon={Package} />
      </div>

      {gsc?.configured && gsc.topPages && gsc.topPages.length > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Top páginas no Google (30d)
            </span>
            <span className="text-[11px] text-muted-foreground">
              CTR médio {gsc.ctr}% · pos. média {gsc.position}
            </span>
          </div>
          <ul className="space-y-2">
            {gsc.topPages.map((p) => (
              <li key={p.url} className="flex items-center justify-between gap-3 text-sm">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-foreground hover:text-primary"
                >
                  {p.url.replace(/^https?:\/\/[^/]+/, "")}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.clicks.toLocaleString("pt-BR")} cliques · {p.impressions.toLocaleString("pt-BR")} impr.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DbUsageCard db={dbSize} />
      <StorageUsageCard s={storageUsage} />

      <DashboardSection
        title="Tráfego e orçamentos"
        description="Últimos 12 meses"
      >
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a4a2f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2a4a2f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="quotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a8c97a" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a8c97a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="views" name="Visitas" stroke="#2a4a2f" strokeWidth={2} fill="url(#views)" />
                <Area type="monotone" dataKey="quotes" name="Orçamentos" stroke="#5a8c3a" strokeWidth={2} fill="url(#quotes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DashboardSection>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardSection title="Categorias mais vistas">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {categoryData.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {c.name}
                  </span>
                  <span className="font-medium text-foreground">{c.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </DashboardSection>

        <div className="lg:col-span-2">
          <DashboardSection title="Conversão da semana" description="Visitas vs orçamentos">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="visitas" name="Visitas" fill="#2a4a2f" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="orc" name="Orçamentos" fill="#a8c97a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DashboardSection>
        </div>
      </div>

    </>
  );
}