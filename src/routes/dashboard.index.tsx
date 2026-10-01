import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Eye,
  FileText,
  Package,
  Database,
  AlertTriangle,
  MousePointerClick,
  Search,
  HardDrive,
  TrendingUp,
  Wallet,
  Users,
  Tags,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [{ title: "Visão geral — Dashboard" }, { name: "robots", content: "noindex" }],
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

// ---- Business metrics (orders/leads are both real tables — see fetchBusinessMetrics) ----

type DayCount = { date: string; quotes: number };
type MonthCount = { month: string; quotes: number };
type YearCount = { year: string; quotes: number };
type LeadSource = { source: string; count: number };

type BusinessMetrics = {
  quotes12m: number;
  openOrders: number;
  conversionRate: number | null;
  avgTicket: number | null;
  newLeads30d: number;
  leadSources: LeadSource[];
  dailyQuotes: DayCount[];
  monthlyQuotes: MonthCount[];
  yearlyQuotes: YearCount[];
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  "catalogo-pdf": "Catálogo em PDF",
  manual: "Cadastro manual",
  orcamento_nao_aprovado: "Orçamento não aprovado",
};

function leadSourceLabel(source: string) {
  return LEAD_SOURCE_LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

async function fetchBusinessMetrics(): Promise<BusinessMetrics> {
  const [ordersResult, appOrdersResult, leadsResult] = await Promise.all([
    supabase.from("orders" as never).select("created_at, status, total"),
    supabase.from("app_orders" as never).select("status"),
    supabase.from("leads" as never).select("source, created_at"),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (appOrdersResult.error) throw new Error(appOrdersResult.error.message);
  if (leadsResult.error) throw new Error(leadsResult.error.message);

  const orders = (ordersResult.data ?? []) as unknown as Array<{
    created_at: string;
    status: string;
    total: number;
  }>;
  const daily = new Map<string, number>();
  const monthly = new Map<string, number>();
  const yearly = new Map<string, number>();
  for (const row of orders) {
    const date = row.created_at.slice(0, 10);
    const month = row.created_at.slice(0, 7);
    const year = row.created_at.slice(0, 4);
    daily.set(date, (daily.get(date) ?? 0) + 1);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
    yearly.set(year, (yearly.get(year) ?? 0) + 1);
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const quotes12m = orders.filter((o) => new Date(o.created_at) >= twelveMonthsAgo).length;

  // "Conversion" here means decided quotes (approved vs cancelled) — an open quote hasn't
  // been decided yet, so it's excluded rather than counted against the rate.
  const approved = orders.filter((o) => o.status === "aprovado");
  const cancelled = orders.filter((o) => o.status === "cancelado");
  const decided = approved.length + cancelled.length;
  const conversionRate = decided > 0 ? (approved.length / decided) * 100 : null;
  const avgTicket =
    approved.length > 0
      ? approved.reduce((s, o) => s + (Number(o.total) || 0), 0) / approved.length
      : null;

  const appOrders = (appOrdersResult.data ?? []) as unknown as Array<{ status: string }>;

  const leads = (leadsResult.data ?? []) as unknown as Array<{
    source: string | null;
    created_at: string;
  }>;
  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.source ?? "outro";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newLeads30d = leads.filter((l) => new Date(l.created_at) >= thirtyDaysAgo).length;

  return {
    quotes12m,
    openOrders: appOrders.filter(
      (row) => !["completed", "cancelled", "refunded", "failed"].includes(row.status),
    ).length,
    conversionRate,
    avgTicket,
    newLeads30d,
    leadSources: Array.from(sourceCounts, ([source, count]) => ({ source, count })).sort(
      (a, b) => b.count - a.count,
    ),
    dailyQuotes: Array.from(daily, ([date, quotes]) => ({ date, quotes })),
    monthlyQuotes: Array.from(monthly, ([month, quotes]) => ({ month, quotes })),
    yearlyQuotes: Array.from(yearly, ([year, quotes]) => ({ year, quotes })),
  };
}

// ---- Google Search Console (clicks/impressions) ----

type GscOverview = {
  configured: boolean;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  deltaClicks?: number;
  deltaImpressions?: number;
  topPages?: Array<{ url: string; clicks: number; impressions: number }>;
  topQueries?: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

async function fetchGsc(): Promise<GscOverview> {
  const res = await fetch("/api/gsc/overview");
  if (!res.ok) return { configured: false };
  return (await res.json()) as GscOverview;
}

// ---- GA4 (real visit counts) ----

type Ga4Day = { date: string; users: number; sessions: number; views: number };
type Ga4Month = { month: string; users: number; sessions: number; views: number };
type Ga4Year = { year: string; users: number; sessions: number; views: number };

type Ga4Overview = {
  configured: boolean;
  users30d?: number;
  deltaUsers30d?: number;
  sessions30d?: number;
  views30d?: number;
  daily?: Ga4Day[];
  monthly?: Ga4Month[];
  yearly?: Ga4Year[];
};

async function fetchGa4(): Promise<Ga4Overview> {
  const res = await fetch("/api/analytics/overview");
  if (!res.ok) return { configured: false };
  return (await res.json()) as Ga4Overview;
}

// ---- Infra cards (DB + VPS storage) — kept, just demoted to a compact footer row ----

type DbSize = { configured: boolean; sizeBytes: number; limitBytes: number; error?: string };

async function fetchDbSize(): Promise<DbSize> {
  const { data, error } = await supabase.rpc("db_size_info" as never);
  if (error) return { configured: false, sizeBytes: 0, limitBytes: 0, error: error.message };
  const row = Array.isArray(data)
    ? (data[0] as { size_bytes?: number; limit_bytes?: number } | undefined)
    : (data as { size_bytes?: number; limit_bytes?: number } | null);
  if (!row || row.size_bytes == null) return { configured: false, sizeBytes: 0, limitBytes: 0 };
  return {
    configured: true,
    sizeBytes: Number(row.size_bytes) || 0,
    limitBytes: Number(row.limit_bytes) || 500 * 1024 * 1024,
  };
}

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

type ServerStorage = {
  configured: boolean;
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
  uploadsBytes: number;
  error?: string;
};

async function fetchServerStorage(): Promise<ServerStorage> {
  const empty: ServerStorage = {
    configured: false,
    usedBytes: 0,
    totalBytes: 0,
    availableBytes: 0,
    uploadsBytes: 0,
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ...empty, error: "Sessão não encontrada." };
    const res = await fetch("/api/server-storage", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      return { ...empty, error: `Falha ao consultar o disco da VPS (HTTP ${res.status}).` };
    const json = (await res.json()) as {
      ok: boolean;
      usedBytes?: number;
      totalBytes?: number;
      availableBytes?: number;
      uploadsBytes?: number;
      error?: string;
    };
    if (!json.ok) return { ...empty, error: json.error };
    return {
      configured: true,
      usedBytes: json.usedBytes ?? 0,
      totalBytes: json.totalBytes ?? 0,
      availableBytes: json.availableBytes ?? 0,
      uploadsBytes: json.uploadsBytes ?? 0,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "Erro desconhecido ao consultar a VPS.",
    };
  }
}

type ProductImageSources = {
  configured: boolean;
  ok: boolean;
  totalProducts: number;
  productsWithoutImages: number;
  productsAllExternal: number;
  productsMixed: number;
  productsAllHosted: number;
  vpsUrls: number;
  supabaseUrls: number;
  wordpressUrls: number;
  otherExternalUrls: number;
  error?: string;
};

async function fetchProductImageSources(): Promise<ProductImageSources> {
  const empty: ProductImageSources = {
    configured: false,
    ok: false,
    totalProducts: 0,
    productsWithoutImages: 0,
    productsAllExternal: 0,
    productsMixed: 0,
    productsAllHosted: 0,
    vpsUrls: 0,
    supabaseUrls: 0,
    wordpressUrls: 0,
    otherExternalUrls: 0,
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ...empty, error: "Sessão não encontrada." };
    const res = await fetch("/api/product-image-sources", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    const json = (await res.json()) as Partial<ProductImageSources> & {
      ok?: boolean;
      error?: string;
    };
    if (!json.ok) return { ...empty, error: json.error };
    return { ...empty, ...json, ok: true, configured: true };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "erro" };
  }
}

// ---- Small presentational pieces ----

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: typeof Eye;
}) {
  const isNegative = typeof delta === "string" && delta.trim().startsWith("-");
  const isNeutral = !delta || delta === "—";
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
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              isNeutral
                ? "text-muted-foreground"
                : isNegative
                  ? "text-red-600"
                  : "text-emerald-600",
            )}
          >
            {isNeutral ? null : isNegative ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5" />
            )}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

type Granularity = "day" | "month" | "year";

function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (next: Granularity) => void;
}) {
  const options: Array<[Granularity, string]> = [
    ["day", "Dia"],
    ["month", "Mês"],
    ["year", "Ano"],
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** One metric, one color, one axis — a trend chart's only job is to show its own shape. */
function TrendChart({
  data,
  dataKey,
  color,
  gradientId,
  valueFormatter,
}: {
  data: Array<{ label: string; value: number | null }>;
  dataKey: string;
  color: string;
  gradientId: string;
  valueFormatter?: (value: number) => string;
}) {
  const chartData = data.map((row) => ({ ...row, [dataKey]: row.value }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value: number) => [
              valueFormatter ? valueFormatter(value) : value,
              undefined,
            ]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(Number(year), Number(value) - 1, 1),
  );
}

function dayLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function lastNDays(n: number) {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (n - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function lastNMonths(n: number) {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (n - 1 - index), 1);
    return date.toISOString().slice(0, 7);
  });
}

function GoogleSetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Google Search Console e Analytics ainda não estão conectados
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O site já envia dados para o Google Analytics (GA4), mas o servidor ainda não tem
            permissão para ler esses relatórios de volta para este painel. Peça para quem configurou
            o projeto no Google Cloud concluir a conta de serviço — veja o passo a passo que foi
            combinado para isso.
          </p>
        </div>
      </div>
    </div>
  );
}

function DbUsageCard({ db }: { db?: DbSize }) {
  if (!db) return null;
  if (!db.configured) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Uso do banco de dados — configuração pendente
          </span>
        </div>
      </div>
    );
  }
  const pct = db.limitBytes > 0 ? (db.sizeBytes / db.limitBytes) * 100 : 0;
  const warn = pct >= 80;
  const critical = pct >= 95;
  const barColor = critical ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Banco de dados
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatMB(db.sizeBytes)} / {formatMB(db.limitBytes)}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

function StorageUsageCard({ s }: { s?: ServerStorage }) {
  if (!s) return null;
  if (!s.configured) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Espaço da Arteno — indisponível
          </span>
        </div>
      </div>
    );
  }
  const pct = s.totalBytes > 0 ? (s.usedBytes / s.totalBytes) * 100 : 0;
  const warn = pct >= 70;
  const critical = pct >= 95;
  const barColor = critical ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Espaço da Arteno
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatMB(s.usedBytes)} / {formatMB(s.totalBytes)}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
        />
      </div>
      {warn && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-[11px] font-medium",
            critical ? "text-destructive" : "text-amber-600",
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          {critical ? "Limite crítico — novos uploads serão bloqueados." : "Espaço em alerta."}
        </p>
      )}
    </div>
  );
}

function ProductImageSourcesCard({ s }: { s?: ProductImageSources }) {
  if (!s || !s.ok) return null;
  const totalUrls = s.vpsUrls + s.supabaseUrls + s.wordpressUrls + s.otherExternalUrls;
  const vpsPct = totalUrls > 0 ? (s.vpsUrls / totalUrls) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Origem das imagens dos produtos
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{s.totalProducts} produtos</span>
      </div>
      {totalUrls > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {vpsPct.toFixed(0)}% das URLs já apontam para a VPS · {s.productsMixed} produtos mistos ·{" "}
          {s.productsWithoutImages} sem imagem
        </p>
      )}
    </div>
  );
}

function LeadSourcesCard({ sources }: { sources?: LeadSource[] }) {
  if (!sources || sources.length === 0) return null;
  const max = Math.max(...sources.map((s) => s.count));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Tags className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Origem dos leads
        </span>
      </div>
      <div className="space-y-2.5">
        {sources.map((s) => (
          <div key={s.source} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-foreground">
              {leadSourceLabel(s.source)}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [granularity, setGranularity] = useState<Granularity>("month");

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
  const { data: business } = useQuery({
    queryKey: ["dashboard", "business-metrics"],
    queryFn: fetchBusinessMetrics,
    staleTime: 60_000,
  });
  const { data: dbSize } = useQuery({
    queryKey: ["dashboard", "db-size"],
    queryFn: fetchDbSize,
    staleTime: 5 * 60_000,
  });
  const { data: storageUsage } = useQuery({
    queryKey: ["dashboard", "server-storage"],
    queryFn: fetchServerStorage,
    staleTime: 5 * 60_000,
  });
  const { data: imageSources } = useQuery({
    queryKey: ["dashboard", "product-image-sources"],
    queryFn: fetchProductImageSources,
    staleTime: 5 * 60_000,
  });
  const { data: gsc } = useQuery({
    queryKey: ["dashboard", "gsc"],
    queryFn: fetchGsc,
    staleTime: 10 * 60_000,
  });
  const { data: ga4 } = useQuery({
    queryKey: ["dashboard", "ga4"],
    queryFn: fetchGa4,
    staleTime: 10 * 60_000,
  });

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");
  const fmtDelta = (d?: number) =>
    typeof d === "number" ? `${d > 0 ? "+" : ""}${d.toFixed(1)}%` : "—";
  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const googleConfigured = Boolean(gsc?.configured || ga4?.configured);

  const visitsSeries = useMemo(() => {
    if (granularity === "day") {
      return lastNDays(30).map((date) => ({
        label: dayLabel(date),
        value: ga4?.daily?.find((d) => d.date === date)?.users ?? (ga4?.configured ? 0 : null),
      }));
    }
    if (granularity === "year") {
      const years = Array.from(new Set((ga4?.yearly ?? []).map((y) => y.year))).sort();
      return years.map((year) => ({
        label: year,
        value: ga4?.yearly?.find((y) => y.year === year)?.users ?? (ga4?.configured ? 0 : null),
      }));
    }
    return lastNMonths(12).map((month) => ({
      label: monthLabel(month),
      value: ga4?.monthly?.find((m) => m.month === month)?.users ?? (ga4?.configured ? 0 : null),
    }));
  }, [granularity, ga4]);

  const quotesSeries = useMemo(() => {
    if (granularity === "day") {
      return lastNDays(30).map((date) => ({
        label: dayLabel(date),
        value: business?.dailyQuotes?.find((d) => d.date === date)?.quotes ?? 0,
      }));
    }
    if (granularity === "year") {
      const years = Array.from(new Set((business?.yearlyQuotes ?? []).map((y) => y.year))).sort();
      return years.map((year) => ({
        label: year,
        value: business?.yearlyQuotes?.find((y) => y.year === year)?.quotes ?? 0,
      }));
    }
    return lastNMonths(12).map((month) => ({
      label: monthLabel(month),
      value: business?.monthlyQuotes?.find((m) => m.month === month)?.quotes ?? 0,
    }));
  }, [granularity, business]);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Orçamentos, pedidos e catálogo da Arteno — dados reais do banco, atualizados a cada
          minuto.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Orçamentos (12m)" value={fmt(business?.quotes12m)} icon={FileText} />
        <Kpi label="Pedidos em aberto" value={fmt(business?.openOrders)} icon={Clock} />
        <Kpi
          label="Taxa de conversão"
          value={business?.conversionRate != null ? `${business.conversionRate.toFixed(0)}%` : "—"}
          icon={TrendingUp}
        />
        <Kpi
          label="Ticket médio"
          value={business?.avgTicket != null ? fmtBRL(business.avgTicket) : "—"}
          icon={Wallet}
        />
        <Kpi label="Produtos ativos" value={fmt(stats?.products)} icon={Package} />
      </div>

      <DashboardSection
        title="Tráfego e orçamentos"
        description="O quanto o site é visitado e quanto disso vira orçamento"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Kpi
              label="Visitas (30d)"
              value={ga4?.configured ? fmt(ga4.users30d) : "—"}
              delta={ga4?.configured ? fmtDelta(ga4.deltaUsers30d) : undefined}
              icon={Users}
            />
            <Kpi
              label="Cliques no Google (30d)"
              value={gsc?.configured ? fmt(gsc.clicks) : "—"}
              delta={gsc?.configured ? fmtDelta(gsc.deltaClicks) : undefined}
              icon={MousePointerClick}
            />
            <Kpi
              label="Impressões no Google (30d)"
              value={gsc?.configured ? fmt(gsc.impressions) : "—"}
              delta={gsc?.configured ? fmtDelta(gsc.deltaImpressions) : undefined}
              icon={Search}
            />
          </div>

          {!googleConfigured && <GoogleSetupNotice />}

          <div className="flex items-center justify-end">
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Visitas ao site
              </p>
              <TrendChart
                data={visitsSeries}
                dataKey="visits"
                color="#2a7a4f"
                gradientId="visits-fill"
                valueFormatter={(v) => `${fmt(v)} visitas`}
              />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Orçamentos recebidos
              </p>
              <TrendChart
                data={quotesSeries}
                dataKey="quotes"
                color="#5a8c3a"
                gradientId="quotes-fill"
                valueFormatter={(v) => `${fmt(v)} orçamentos`}
              />
            </div>
          </div>
        </div>
      </DashboardSection>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LeadSourcesCard sources={business?.leadSources} />
        </div>
        {gsc?.configured && gsc.topPages && gsc.topPages.length > 0 && (
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5">
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
                      {p.clicks.toLocaleString("pt-BR")} cliques ·{" "}
                      {p.impressions.toLocaleString("pt-BR")} impr.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {gsc?.configured && gsc.topQueries && gsc.topQueries.length > 0 && (
        <div className="mt-6">
          <DashboardSection
            title="Top palavras-chave no Google (30d)"
            description="Termos pelos quais o site aparece nas buscas"
          >
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 font-medium">Termo</th>
                      <th className="pb-2 text-right font-medium">Cliques</th>
                      <th className="pb-2 text-right font-medium">Impressões</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                      <th className="pb-2 text-right font-medium">Posição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gsc.topQueries.map((q) => (
                      <tr key={q.query} className="border-t border-border/60">
                        <td className="py-2 text-foreground">{q.query}</td>
                        <td className="py-2 text-right">{q.clicks.toLocaleString("pt-BR")}</td>
                        <td className="py-2 text-right">{q.impressions.toLocaleString("pt-BR")}</td>
                        <td className="py-2 text-right">{q.ctr.toFixed(1)}%</td>
                        <td className="py-2 text-right">{q.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DashboardSection>
        </div>
      )}

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <DbUsageCard db={dbSize} />
        <StorageUsageCard s={storageUsage} />
        <ProductImageSourcesCard s={imageSources} />
      </div>
    </>
  );
}
