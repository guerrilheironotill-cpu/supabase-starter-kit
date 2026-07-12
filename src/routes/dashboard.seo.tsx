import { createFileRoute } from "@tanstack/react-router";
import { Check, ExternalLink, Info } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/seo")({
  head: () => ({
    meta: [
      { title: "SEO — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardSeoPage,
});

const CHECKS = [
  {
    label: "Robots.txt",
    detail: "Bloqueia /dashboard, /auth e rotas internas dos crawlers.",
    href: "/robots.txt",
  },
  {
    label: "Sitemap.xml dinâmico",
    detail: "Gera URLs de categorias e produtos a partir do Supabase.",
    href: "/sitemap.xml",
  },
  {
    label: "Metadados por rota",
    detail: "title, description, og:title, og:description em cada página.",
  },
  {
    label: "JSON-LD Organization",
    detail: "Structured data no <head> raiz para o Google Knowledge Panel.",
  },
  {
    label: "og:image e twitter:card",
    detail: "Configurados em produtos e categorias com imagem principal.",
  },
  {
    label: "Rotas do painel com noindex",
    detail: "/dashboard/* não é indexado.",
  },
];

function DashboardSeoPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          SEO
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status do SEO técnico do site.
        </p>
      </div>

      <DashboardSection title="Checklist técnico">
        <ul className="grid gap-3 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <li
              key={c.label}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                {c.href && (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DashboardSection>

      <DashboardSection title="Rank Math (WordPress)" description="Importar dados do site antigo">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Info className="h-4 w-4" />
            </span>
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">
                Sim, dá para puxar configurações do Rank Math — mas com ressalvas.
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  Rank Math grava título, meta description e og:* no{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">postmeta</code>{" "}
                  de cada post/página (chaves{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">rank_math_title</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">rank_math_description</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">rank_math_facebook_image</code>).
                </li>
                <li>
                  Configurações globais (título do site, separador, schema padrão) ficam em{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">wp_options</code>{" "}
                  na chave <code className="rounded bg-muted px-1 py-0.5 text-xs">rank-math-options-titles</code>.
                </li>
                <li>
                  O Rank Math <strong>não expõe endpoints REST próprios</strong> para esses campos.
                  Para ler via API, é preciso registrar os campos em{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">register_rest_field</code>{" "}
                  no WordPress (mini plugin) — depois o conector WordPress da Lovable puxa
                  em <code className="rounded bg-muted px-1 py-0.5 text-xs">/wp-json/wp/v2/posts</code>.
                </li>
                <li>
                  Alternativa mais rápida: exportar via <em>Rank Math → Status &amp; Tools → Import &amp; Export</em>{" "}
                  e me enviar o JSON — eu mapeio título/descrição/og para as rotas equivalentes aqui.
                </li>
              </ul>
              <p className="mt-3">
                Se quiser seguir pela API, ative o conector <strong>WordPress</strong> em
                Connectors e me avise — monto o import automático.
              </p>
            </div>
          </div>
        </div>
      </DashboardSection>
    </>
  );
}