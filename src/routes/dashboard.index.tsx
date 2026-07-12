import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Eye, FileText, Package, TrendingUp, Users } from "lucide-react";
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

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const trafficData = MONTHS.map((m, i) => ({
  month: m,
  views: Math.round(1200 + Math.sin(i / 1.6) * 380 + i * 90),
  quotes: Math.round(40 + Math.cos(i / 1.4) * 18 + i * 3),
}));

const categoryData = [
  { name: "Vasos", value: 42 },
  { name: "Jardineiras", value: 28 },
  { name: "Mesas", value: 12 },
  { name: "Bancos", value: 10 },
  { name: "Fontes", value: 8 },
];

const conversionData = [
  { day: "Seg", visitas: 320, orc: 12 },
  { day: "Ter", visitas: 410, orc: 18 },
  { day: "Qua", visitas: 380, orc: 14 },
  { day: "Qui", visitas: 520, orc: 24 },
  { day: "Sex", visitas: 610, orc: 31 },
  { day: "Sáb", visitas: 480, orc: 22 },
  { day: "Dom", visitas: 300, orc: 9 },
];

const PIE_COLORS = ["#2a4a2f", "#5a8c3a", "#a8c97a", "#c9e0a5", "#e6f2c7"];

const TOP_PRODUCTS = [
  { name: "Vaso Toscana G", category: "Vasos", views: 1284, quotes: 42 },
  { name: "Jardineira Ravena", category: "Jardineiras", views: 982, quotes: 31 },
  { name: "Vaso Milano P", category: "Vasos", views: 861, quotes: 27 },
  { name: "Mesa Provence", category: "Mesas", views: 704, quotes: 19 },
  { name: "Fonte Aurora", category: "Fontes", views: 612, quotes: 14 },
  { name: "Banco Siena", category: "Bancos", views: 498, quotes: 11 },
];

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
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <ArrowUpRight className="h-3.5 w-3.5" /> {delta}
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

  const maxViews = Math.max(...TOP_PRODUCTS.map((p) => p.views));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Visão geral
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas do site e desempenho dos produtos.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Visitas (mês)" value="14.328" delta="+12,4%" icon={Eye} />
        <Kpi label="Orçamentos" value="238" delta="+8,1%" icon={FileText} />
        <Kpi label="Produtos ativos" value={stats?.products ?? "—"} delta="+3" icon={Package} />
        <Kpi label="Categorias" value={stats?.categories ?? "—"} delta="+1" icon={Users} />
      </div>

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

      <div className="mt-6">
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
      </div>
    </>
  );
}