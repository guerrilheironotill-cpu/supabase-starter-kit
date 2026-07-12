import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Gauge,
  ImageIcon,
  Zap,
  Network,
  FileCode2,
  Server,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/desempenho")({
  head: () => ({
    meta: [
      { title: "Desempenho — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardDesempenhoPage,
});

type Severity = "alta" | "media" | "baixa";

type Recommendation = {
  id: string;
  title: string;
  impact: Severity;
  category: "Imagens" | "Rede" | "JavaScript" | "SSR/Cache" | "Fontes";
  icon: typeof ImageIcon;
  problem: string;
  action: string;
  hint?: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "lcp-preload",
    title: "Pré-carregar a imagem LCP do hero",
    impact: "alta",
    category: "Imagens",
    icon: Zap,
    problem:
      "O maior elemento visível (hero) é carregado tarde, atrasando o LCP em ~170ms segundo o PageSpeed.",
    action:
      "Adicionar <link rel=\"preload\" as=\"image\" fetchpriority=\"high\"> no head() da rota / com a URL do primeiro slide.",
    hint: "src/routes/index.tsx → head().links",
  },
  {
    id: "image-format",
    title: "Servir imagens em AVIF/WebP",
    impact: "alta",
    category: "Imagens",
    icon: ImageIcon,
    problem:
      "Imagens estáticas do bundle ainda vão como JPG/PNG. Economia estimada de ~500 KB.",
    action:
      "Usar vite-imagetools nos imports (?format=avif&format=webp) ou variar via CDN de imagens.",
    hint: "vite.config.ts + imports em src/assets/*",
  },
  {
    id: "image-dims",
    title: "Definir width/height explícitos",
    impact: "media",
    category: "Imagens",
    icon: ImageIcon,
    problem:
      "Elementos <img> sem width/height causam pequenas variações de layout (CLS 0.008).",
    action:
      "Adicionar atributos width e height em <img> (hero, cards, banners) mantendo aspect-ratio via CSS.",
  },
  {
    id: "render-blocking",
    title: "Reduzir requisições que bloqueiam renderização",
    impact: "media",
    category: "Rede",
    icon: Network,
    problem:
      "CSS/JS de terceiros no head bloqueia o primeiro paint.",
    action:
      "Mover scripts não críticos para o final do body ou usar defer/async; carregar fontes com font-display: swap.",
  },
  {
    id: "js-unused",
    title: "Remover JavaScript não utilizado",
    impact: "media",
    category: "JavaScript",
    icon: FileCode2,
    problem:
      "Bundle carrega libs pouco usadas em páginas públicas.",
    action:
      "Usar imports dinâmicos (React.lazy) para o dashboard e drawers pesados; auditar com rollup-plugin-visualizer.",
  },
  {
    id: "cache-static",
    title: "Cache agressivo de assets estáticos",
    impact: "baixa",
    category: "SSR/Cache",
    icon: Server,
    problem:
      "Assets com fingerprint podem ficar 1 ano em cache do CDN.",
    action:
      "Confirmar Cache-Control: public, max-age=31536000, immutable para /assets no Worker.",
  },
  {
    id: "fonts",
    title: "Otimizar carregamento de fontes",
    impact: "baixa",
    category: "Fontes",
    icon: FileCode2,
    problem:
      "Fontes web podem atrasar o primeiro texto visível.",
    action:
      "Pré-conectar ao provedor (<link rel=\"preconnect\">) e usar font-display: swap nas @font-face.",
  },
];

const IMPACT_STYLES: Record<Severity, string> = {
  alta: "bg-destructive/15 text-destructive",
  media: "bg-amber-500/15 text-amber-400",
  baixa: "bg-emerald-500/15 text-emerald-400",
};

type Snapshot = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcp: string;
  cls: string;
  tbt: string;
  updatedAt: string;
};

const DEFAULT_SNAPSHOT: Snapshot = {
  performance: 99,
  accessibility: 100,
  bestPractices: 100,
  seo: 100,
  lcp: "0,8 s",
  cls: "0,008",
  tbt: "0 ms",
  updatedAt: "12/07/2026",
};

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90
      ? "text-emerald-400 ring-emerald-500/40"
      : value >= 50
        ? "text-amber-400 ring-amber-500/40"
        : "text-destructive ring-destructive/40";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ring-2 ${color}`}
        >
          <span className="text-lg font-semibold">{value}</span>
        </div>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function DashboardDesempenhoPage() {
  const [snapshot] = useState<Snapshot>(DEFAULT_SNAPSHOT);

  const url = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://www.example.com";
  }, []);

  const pageSpeedHref = `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`;

  const highs = RECOMMENDATIONS.filter((r) => r.impact === "alta").length;
  const meds = RECOMMENDATIONS.filter((r) => r.impact === "media").length;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Gauge className="h-6 w-6 text-primary" />
            Desempenho
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot do PageSpeed Insights e recomendações práticas para
            melhorar o site. Última medição: {snapshot.updatedAt}.
          </p>
        </div>
        <a
          href={pageSpeedHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Nova medição
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScoreCard label="Desempenho" value={snapshot.performance} />
        <ScoreCard label="Acessibilidade" value={snapshot.accessibility} />
        <ScoreCard label="Boas práticas" value={snapshot.bestPractices} />
        <ScoreCard label="SEO" value={snapshot.seo} />
      </div>

      <DashboardSection
        title="Core Web Vitals"
        description="Métricas de campo agregadas pelo PageSpeed."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: "LCP", value: snapshot.lcp, help: "Largest Contentful Paint" },
            { label: "CLS", value: snapshot.cls, help: "Cumulative Layout Shift" },
            { label: "TBT", value: snapshot.tbt, help: "Total Blocking Time" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {m.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{m.help}</p>
            </div>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recomendações"
        description={`${highs} alta(s) e ${meds} média(s) prioridade.`}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {RECOMMENDATIONS.map((r) => {
            const Icon = r.icon;
            return (
              <article
                key={r.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-foreground" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {r.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {r.category}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${IMPACT_STYLES[r.impact]}`}
                  >
                    {r.impact}
                  </span>
                </header>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-muted-foreground">{r.problem}</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <p className="text-foreground">{r.action}</p>
                  </div>
                  {r.hint && (
                    <p className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {r.hint}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </DashboardSection>
    </>
  );
}