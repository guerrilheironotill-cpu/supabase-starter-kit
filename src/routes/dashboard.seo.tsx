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

      <DashboardSection
        title="Guia — o que você precisa fazer"
        description="Passo a passo do que roda fora daqui (contas externas). Deixe para depois; o site continua funcionando sem isso."
      >
        <div className="space-y-4">
          <GuideBlock
            title="1. Google Search Console"
            steps={[
              "Acesse search.google.com/search-console e adicione a propriedade do domínio final (ex.: seudominio.com.br).",
              "Escolha o método Prefixo de URL (mais simples) e valide via tag HTML ou DNS.",
              "Se escolher tag HTML, me envie o conteúdo — coloco no <head> do site.",
              "Após validar, vá em Sitemaps e envie: https://seudominio.com.br/sitemap.xml",
            ]}
          />
          <GuideBlock
            title="2. Google Analytics 4"
            steps={[
              "Acesse analytics.google.com e crie uma propriedade GA4 para o novo domínio (ou reutilize a atual).",
              "Crie um Fluxo de dados Web apontando para a URL final.",
              "Copie o Measurement ID (G-XXXX) e cole em Dashboard → Configurações → Integrações.",
              "Depois de colar, avise que ativo o script no site — inclusive eventos de view_item e generate_lead.",
            ]}
          />
          <GuideBlock
            title="3. Meta Pixel (Facebook/Instagram Ads)"
            steps={[
              "Acesse business.facebook.com → Gerenciador de Eventos.",
              "Reutilize o Pixel do site atual ou crie um novo (Conectar fontes de dados → Web).",
              "Copie o Pixel ID (15–16 dígitos) e cole em Dashboard → Configurações → Integrações.",
              "Depois de colar, ativo o script — dispara PageView, ViewContent e Lead automaticamente.",
            ]}
          />
          <GuideBlock
            title="4. Catálogo do Facebook (Commerce Manager)"
            steps={[
              "Em business.facebook.com → Gerenciador de Comércio, reutilize o catálogo do site atual ou crie um novo (tipo E-commerce).",
              "Copie o Catalog ID em Configurações do catálogo e cole em Dashboard → Configurações → Integrações.",
              "Avise para eu publicar o feed em /feeds/facebook-catalog.xml.",
              "No Commerce Manager: Fontes de dados → Adicionar itens → Feed de dados → Feed programado, cole a URL do feed e defina frequência diária.",
            ]}
          />
          <GuideBlock
            title="5. Google Merchant Center (Shopping)"
            steps={[
              "Acesse merchants.google.com e reutilize a conta do site atual (ou crie uma nova).",
              "Preencha informações da empresa, frete e impostos conforme já configurados hoje.",
              "Copie o Merchant ID (canto superior direito) e cole em Dashboard → Configurações → Integrações.",
              "Avise para eu publicar o feed em /feeds/google-merchant.xml.",
              "No Merchant Center: Produtos → Feeds → + → Feed programado, cole a URL e defina frequência diária.",
            ]}
          />
          <GuideBlock
            title="6. Redirecionamentos do site antigo (WordPress → novo)"
            steps={[
              "Liste as URLs mais acessadas do site atual (Search Console → Desempenho, exportar top 100).",
              "Me envie a lista com a URL equivalente aqui — configuro os redirects 301 antes do go-live.",
              "Isso preserva o SEO acumulado; sem os 301s você perde ranking dos produtos antigos.",
            ]}
          />
          <GuideBlock
            title="7. Go-live (troca de DNS)"
            steps={[
              "Quando estivermos prontos, publique o projeto na Lovable e configure o domínio custom.",
              "Atualize o DNS no seu registrador (Registro.br ou outro) apontando para os registros da Lovable.",
              "Após propagar, reenvie o sitemap no Search Console e re-verifique o Pixel em Events Manager → Testar eventos.",
            ]}
          />
        </div>
      </DashboardSection>
    </>
  );
}

function GuideBlock({ title, steps }: { title: string; steps: string[] }) {
  return (
    <details className="rounded-2xl border border-border bg-card p-5 group" open>
      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
        {title}
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}