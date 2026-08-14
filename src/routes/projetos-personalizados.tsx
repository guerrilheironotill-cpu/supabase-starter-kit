import { createFileRoute } from "@tanstack/react-router";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";
import { absoluteUrl } from "@/lib/site-config";
import {
  ArrowRight,
  DraftingCompass,
  Hammer,
  Layers3,
  Ruler,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const Route = createFileRoute("/projetos-personalizados")({
  head: () => ({
    meta: [
      { title: "Projetos sob medida em concreto, madeira e metal — Arteno" },
      {
        name: "description",
        content:
          "Desenvolvemos vasos, mobiliário e peças sob medida em concreto, madeira e metal para arquitetos, paisagistas e projetos autorais.",
      },
      {
        property: "og:title",
        content: "Projetos sob medida em concreto, madeira e metal — Arteno",
      },
      {
        property: "og:description",
        content:
          "Do desenho à produção: soluções sob medida com linguagem industrial e execução artesanal.",
      },
      {
        property: "og:image",
        content: absoluteUrl("/images/projetos-personalizados/hero-projeto-personalizado.webp"),
      },
      { property: "og:url", content: absoluteUrl("/projetos-personalizados") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/projetos-personalizados") }],
  }),
  component: CustomProjectsPage,
});

const DIFFERENTIALS = [
  {
    icon: Ruler,
    title: "Feito sob medida",
    text: "Proporções, dimensões e acabamentos definidos para cada contexto.",
  },
  {
    icon: Layers3,
    title: "Materiais combinados",
    text: "Concreto, madeira e metal trabalhando como uma composição única.",
  },
  {
    icon: Hammer,
    title: "Produção artesanal",
    text: "Acompanhamento próximo e cuidado em cada etapa de fabricação.",
  },
  {
    icon: Sparkles,
    title: "Know-how autoral",
    text: "Soluções técnicas e novas ideias quando o projeto pede evolução.",
  },
];

function CustomProjectsPage() {
  const whatsappNumber = useWhatsAppNumber();
  const projectWhatsAppUrl = whatsappLinkFrom(
    whatsappNumber,
    "Olá! Gostaria de conversar sobre um projeto sob medida.",
  );
  return (
    <main className="overflow-hidden bg-white text-[#2a2f2c]">
      <section className="px-4 sm:px-8 lg:px-[50px]">
        <div className="relative min-h-[72vh] overflow-hidden rounded-3xl bg-[#2a2f2c]">
          <img
            src="/images/projetos-personalizados/hero-projeto-personalizado.webp"
            width={1774}
            height={887}
            alt="Projeto sob medida com vasos, banco de concreto, madeira e estrutura metálica"
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10" />
          <div className="relative z-10 flex min-h-[72vh] max-w-3xl flex-col justify-end px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.32em] text-white/75">
              Projetos sob medida
            </p>
            <h1
              className="mt-5 animate-fade-in font-display text-4xl leading-[1.02] sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "100ms" }}
            >
              Ideias únicas merecem formas próprias.
            </h1>
            <p
              className="mt-6 max-w-xl animate-fade-in text-base leading-relaxed text-white/80 sm:text-lg"
              style={{ animationDelay: "180ms" }}
            >
              Criamos vasos, mobiliário e peças especiais em concreto, madeira e metal.
            </p>
            <a
              href={projectWhatsAppUrl}
              target="_blank"
              aria-label="Conte sobre seu projeto pelo WhatsApp (abre em nova aba)"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-fit animate-fade-in items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a2f2c] transition hover:-translate-y-0.5 hover:shadow-xl"
              style={{ animationDelay: "260ms" }}
            >
              Conte sobre seu projeto
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
        <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
          Design que nasce do contexto
        </p>
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <h2 className="font-display text-4xl leading-tight text-primary sm:text-5xl">
            Do detalhe arquitetônico à peça que organiza o espaço.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary/70">
            Desenvolvemos soluções exclusivas para áreas internas e externas, respeitando estética,
            uso, escala e viabilidade produtiva.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-8 lg:px-[50px]">
        <div className="relative min-h-[62vh] overflow-hidden rounded-3xl bg-neutral-100">
          <img
            src="/images/projetos-personalizados/materiais-oficina.webp"
            width={1672}
            height={941}
            alt="Processo artesanal combinando concreto, madeira e metal"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 max-w-3xl p-6 text-white sm:p-10 lg:p-14">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Concreto · madeira · metal
            </p>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl">Matéria com presença.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Exploramos peso, textura, calor e precisão para criar peças duráveis e expressivas.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
              Estilo industrial
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-5xl">
              Estrutura aparente. Beleza essencial.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-primary/70 lg:justify-self-end">
            O industrial orienta nossa linguagem sem limitar o projeto: superfícies honestas,
            encontros precisos e materiais que envelhecem com personalidade.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-primary/10 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFERENTIALS.map((item, index) => (
            <article
              key={item.title}
              className="animate-fade-in bg-white p-7 sm:p-8"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <item.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-8 font-display text-xl font-semibold text-primary">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-primary/65">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f2f1ed] py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="overflow-hidden rounded-3xl">
            <img
              src="/images/projetos-personalizados/colaboracao-arquitetos.webp"
              width={1713}
              height={918}
              alt="Colaboração entre arquitetos, paisagistas e especialista em produção"
              loading="lazy"
              className="aspect-[16/10] h-full w-full object-cover transition-transform duration-[1600ms] hover:scale-[1.02]"
            />
          </div>
          <div className="lg:pl-8">
            <UsersRound className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
              Arquitetos e paisagistas
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-5xl">
              Parceria fiel ao projeto.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-primary/70">
              Trabalhamos lado a lado com arquitetos e paisagistas, seguindo fielmente desenhos,
              medidas e especificações. Quando há espaço para evoluir, contribuímos com novas ideias
              baseadas em nosso know-how de materiais e produção.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <DraftingCompass className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <h2 className="mt-6 font-display text-4xl text-primary sm:text-5xl">Como criamos</h2>
          </div>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ["01", "Entendimento", "Escopo, referências, medidas e necessidades do espaço."],
              [
                "02",
                "Desenvolvimento",
                "Materiais, soluções construtivas, acabamento e validação.",
              ],
              ["03", "Produção", "Execução cuidadosa e acompanhamento até a entrega."],
            ].map(([number, title, text]) => (
              <li key={number} className="border-t border-primary/15 pt-5">
                <span className="text-xs font-semibold tracking-widest text-primary/45">
                  {number}
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-primary/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-8 sm:pb-28 lg:px-[50px]">
        <div className="group relative min-h-[520px] overflow-hidden rounded-3xl bg-[#2a2f2c] text-white sm:min-h-[560px]">
          <img
            src="/images/projetos-personalizados/cta-casa-vasos-v1.webp"
            width={1774}
            height={887}
            alt="Casa contemporânea com vasos de concreto em projeto paisagístico"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[1800ms] ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#26352d] from-0% via-[#26352d]/95 via-35% to-transparent to-78%" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
          <div className="relative z-10 flex min-h-[520px] max-w-4xl flex-col items-start justify-end px-6 py-12 sm:min-h-[560px] sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
              Seu projeto, nossa matéria
            </p>
            <h2 className="mt-4 max-w-4xl font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Vamos transformar uma ideia em uma peça única?
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              Conte sobre o espaço, as medidas e a intenção do projeto. Desenvolvemos a solução
              junto com você.
            </p>
            <a
              href={projectWhatsAppUrl}
              target="_blank"
              aria-label="Solicitar projeto pelo WhatsApp (abre em nova aba)"
              rel="noopener noreferrer"
              className="mt-8 inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a2f2c] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Solicitar projeto
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
