import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/site-config";
import { OPEN_COOKIE_PREFERENCES_EVENT } from "@/lib/cookie-consent";
import { PageHero } from "@/components/page-hero";

export const Route = createFileRoute("/politica-de-cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Arteno" },
      {
        name: "description",
        content: "Saiba como a Arteno utiliza cookies e tecnologias semelhantes e gerencie suas preferências.",
      },
      { property: "og:title", content: "Política de Cookies — Arteno" },
      { property: "og:url", content: absoluteUrl("/politica-de-cookies") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/politica-de-cookies") }],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <div className="bg-background pb-16 text-foreground">
      <PageHero
        title="Política de Cookies"
        eyebrow="Privacidade"
        crumbs={[{ label: "Início", to: "/" }, { label: "Política de Cookies" }]}
      />

      <article className="mx-auto w-full max-w-4xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="text-sm text-muted-foreground">Última atualização: 3 de agosto de 2026.</p>

        <div className="mt-10 space-y-9 text-sm leading-7 text-foreground/80">
        <PolicySection title="1. O que são cookies">
          Cookies e tecnologias semelhantes são pequenos registros utilizados por sites para
          permitir seu funcionamento, lembrar preferências e, quando autorizado, medir audiência
          e campanhas. Algumas dessas tecnologias podem envolver o tratamento de dados pessoais.
        </PolicySection>
        <PolicySection title="2. Como utilizamos essas tecnologias">
          A Arteno utiliza recursos estritamente necessários para disponibilizar o site, proteger
          áreas autenticadas e manter escolhas essenciais. Tecnologias opcionais de análise ou
          publicidade somente são utilizadas depois da autorização do visitante.
        </PolicySection>
        <PolicySection title="3. Categorias">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Necessários:</strong> funcionamento, segurança, autenticação e registro das preferências de privacidade.</li>
            <li><strong>Análise:</strong> medição de acessos, páginas visitadas e desempenho do site, quando ferramentas analíticas forem ativadas.</li>
            <li><strong>Publicidade:</strong> medição de campanhas e personalização de anúncios, quando plataformas publicitárias forem ativadas.</li>
          </ul>
        </PolicySection>
        <PolicySection title="4. Serviços de terceiros">
          O site poderá utilizar, mediante consentimento aplicável, serviços como Google Analytics,
          Google Ads e Meta Pixel. Esses fornecedores podem tratar dados conforme suas próprias
          políticas. Esta seção deverá ser atualizada sempre que um serviço for incluído ou removido.
        </PolicySection>
        <PolicySection title="5. Prazo e registro da escolha">
          A preferência é armazenada no navegador para que o site respeite a decisão em visitas
          futuras. Uma nova escolha poderá ser solicitada quando esta política ou os serviços
          utilizados forem alterados.
        </PolicySection>
        <PolicySection title="6. Como alterar ou revogar">
          Você pode revisar ou revogar sua autorização gratuitamente a qualquer momento pelo botão
          abaixo ou pelo link “Preferências de cookies” no rodapé.
          <div className="mt-4">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}
              className="border border-primary bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Abrir preferências de cookies
            </button>
          </div>
        </PolicySection>
        <PolicySection title="7. Contato">
          Para dúvidas sobre privacidade e tratamento de dados pessoais, entre em contato pelos
          canais oficiais da Arteno. Substitua este trecho pelo e-mail específico do responsável
          pela privacidade antes da publicação definitiva.
        </PolicySection>
        </div>
      </article>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
