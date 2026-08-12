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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";

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

type BusinessMetrics = {
  quotes: number;
  openOrders: number;
  monthlyQuotes: Array<{ month: string; quotes: number }>;
};

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
  monthlyTraffic?: Array<{ month: string; clicks: number; impressions: number }>;
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
  const row = Array.isArray(data)
    ? (data[0] as { size_bytes?: number; limit_bytes?: number } | undefined)
    : (data as { size_bytes?: number; limit_bytes?: number } | null);
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

type ServerStorage = {
  configured: boolean;
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
  uploadsBytes: number;
  error?: string;
};

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

function ProductImageSourcesCard({ s }: { s?: ProductImageSources }) {
  if (!s) return null;
  if (!s.ok) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Origem das imagens dos produtos — indisponível
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.error ?? "Não foi possível ler a tabela de produtos agora."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const totalUrls = s.vpsUrls + s.supabaseUrls + s.wordpressUrls + s.otherExternalUrls;
  const vpsPct = totalUrls > 0 ? (s.vpsUrls / totalUrls) * 100 : 0;
  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Origem das imagens dos produtos
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {s.totalProducts.toLocaleString("pt-BR")} produtos
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Na VPS</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{s.productsAllHosted}</div>
          <div className="text-[11px] text-muted-foreground">{s.vpsUrls} URLs</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            No Supabase
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">{s.supabaseUrls}</div>
          <div className="text-[11px] text-muted-foreground">{s.supabaseUrls} URLs</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            No WordPress
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">{s.wordpressUrls}</div>
          <div className="text-[11px] text-muted-foreground">URLs legadas</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Outras/sem imagem
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">{s.otherExternalUrls}</div>
          <div className="text-[11px] text-muted-foreground">
            {s.productsWithoutImages} produtos sem imagem
          </div>
        </div>
      </div>
      {totalUrls > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {vpsPct.toFixed(1)}% das URLs de imagem já apontam para a VPS. Produtos mistos:{" "}
          {s.productsMixed}.
        </p>
      )}
    </div>
  );
}

async function fetchServerStorage(): Promise<ServerStorage> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return {
        configured: false,
        usedBytes: 0,
        totalBytes: 0,
        availableBytes: 0,
        uploadsBytes: 0,
        error: "Sessão não encontrada.",
      };
    }
    const res = await fetch("/api/server-storage", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return {
        configured: false,
        usedBytes: 0,
        totalBytes: 0,
        availableBytes: 0,
        uploadsBytes: 0,
        error: `Falha ao consultar o disco da VPS (HTTP ${res.status}).`,
      };
    }
    const json = (await res.json()) as {
      ok: boolean;
      usedBytes?: number;
      totalBytes?: number;
      availableBytes?: number;
      uploadsBytes?: number;
      error?: string;
    };
    if (!json.ok) {
      return {
        configured: false,
        usedBytes: 0,
        totalBytes: 0,
        availableBytes: 0,
        uploadsBytes: 0,
        error: json.error,
      };
    }
    return {
      configured: true,
      usedBytes: json.usedBytes ?? 0,
      totalBytes: json.totalBytes ?? 0,
      availableBytes: json.availableBytes ?? 0,
      uploadsBytes: json.uploadsBytes ?? 0,
    };
  } catch (e) {
    return {
      configured: false,
      usedBytes: 0,
      totalBytes: 0,
      availableBytes: 0,
      uploadsBytes: 0,
      error: e instanceof Error ? e.message : "Erro desconhecido ao consultar a VPS.",
    };
  }
}

function StorageUsageCard({ s }: { s?: ServerStorage }) {
  if (!s) return null;
  if (!s.configured) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Uso do espaço do servidor — indisponível
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.error ?? "Não foi possível medir o disco da VPS agora."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const pct = s.totalBytes > 0 ? (s.usedBytes / s.totalBytes) * 100 : 0;
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
          {formatMB(s.usedBytes)} / {formatMB(s.totalBytes)}
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
      <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
        <span>Uploads da Arteno</span>
        <span>{formatMB(s.uploadsBytes)}</span>
      </div>
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
              Rode o SQL abaixo no Supabase (SQL Editor) para habilitar o indicador de uso do banco:
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
            {db.error && <p className="mt-2 text-[11px] text-muted-foreground">Erro: {db.error}</p>}
          </div>
        </div>
      </div>
    );
  }

  const pct = db.limitBytes > 0 ? (db.sizeBytes / db.limitBytes) * 100 : 0;
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
        <span className="text-xs text-muted-foreground">{pct.toFixed(1)}% utilizado</span>
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

async function fetchBusinessMetrics(): Promise<BusinessMetrics> {
  const start = new Date();
  start.setMonth(start.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);
  const [quotesResult, appOrdersResult] = await Promise.all([
    supabase
      .from("orders" as never)
      .select("created_at")
      .gte("created_at", start.toISOString()),
    supabase.from("app_orders" as never).select("status"),
  ]);
  if (quotesResult.error) throw new Error(quotesResult.error.message);
  if (appOrdersResult.error) throw new Error(appOrdersResult.error.message);

  const monthly = new Map<string, number>();
  for (const row of (quotesResult.data ?? []) as unknown as Array<{ created_at: string }>) {
    const month = row.created_at.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }
  const appOrders = (appOrdersResult.data ?? []) as unknown as Array<{ status: string }>;
  return {
    quotes: (quotesResult.data ?? []).length,
    openOrders: appOrders.filter(
      (row) => !["completed", "cancelled", "refunded", "failed"].includes(row.status),
    ).length,
    monthlyQuotes: Array.from(monthly, ([month, quotes]) => ({ month, quotes })),
  };
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(Number(year), Number(value) - 1, 1),
  );
}

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
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            isNeutral ? "text-muted-foreground" : isNegative ? "text-red-600" : "text-emerald-600"
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

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");
  const fmtDelta = (d?: number) =>
    typeof d === "number" ? `${d > 0 ? "+" : ""}${d.toFixed(1)}%` : "—";
  const chartMonths = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - index), 1);
    const month = date.toISOString().slice(0, 7);
    const traffic = gsc?.monthlyTraffic?.find((row) => row.month === month);
    const quotes = business?.monthlyQuotes.find((row) => row.month === month)?.quotes ?? 0;
    return {
      month: monthLabel(month),
      clicks: traffic?.clicks ?? null,
      impressions: traffic?.impressions ?? null,
      quotes,
    };
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Visão geral</h1>
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
        <Kpi label="Orçamentos (12m)" value={business?.quotes ?? "—"} delta="—" icon={FileText} />
        <Kpi label="Pedidos em aberto" value={business?.openOrders ?? "—"} delta="—" icon={Clock} />
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
                  {p.clicks.toLocaleString("pt-BR")} cliques ·{" "}
                  {p.impressions.toLocaleString("pt-BR")} impr.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DbUsageCard db={dbSize} />
      <StorageUsageCard s={storageUsage} />
      <ProductImageSourcesCard s={imageSources} />

      <DashboardSection title="Tráfego e orçamentos" description="Últimos 12 meses">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMonths} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                <XAxis
                  dataKey="month"
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
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name="Cliques no Google"
                  stroke="#2a4a2f"
                  strokeWidth={2}
                  fill="url(#views)"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="quotes"
                  name="Orçamentos"
                  stroke="#5a8c3a"
                  strokeWidth={2}
                  fill="url(#quotes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DashboardSection>

      <div className="grid gap-6 lg:grid-cols-3">
        {gsc?.configured && gsc.topQueries && gsc.topQueries.length > 0 && (
          <div className="lg:col-span-3">
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
                          <td className="py-2 text-right">
                            {q.impressions.toLocaleString("pt-BR")}
                          </td>
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
      </div>
    </>
  );
}
