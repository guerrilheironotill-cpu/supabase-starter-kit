import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Armchair,
  Building2,
  CircleDot,
  Flower2,
  Ruler,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { absoluteUrl } from "@/lib/site-config";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";
import { ScrollReveal } from "@/components/scroll-reveal";

export const Route = createFileRoute("/mobiliario-urbano")({
  head: () => ({
    meta: [
      { title: "Mobiliário urbano em concreto para projetos — Arteno" },
      {
        name: "description",
        content:
          "Bancos, jardineiras, mesas, lixeiras e delimitadores em concreto para condomínios, incorporadoras, arquitetos e espaços públicos.",
      },
      { property: "og:title", content: "Mobiliário urbano em concreto — Arteno" },
      {
        property: "og:description",
        content:
          "Soluções resistentes e personalizadas para áreas coletivas, empreendimentos e espaços públicos.",
      },
      { property: "og:image", content: absoluteUrl("/images/mobiliario-urbano/hero-praca-v1.png") },
      { property: "og:url", content: absoluteUrl("/mobiliario-urbano") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/mobiliario-urbano") }],
  }),
  component: UrbanFurniturePage,
});

const SOLUTIONS = [
  {
    icon: Armchair,
    title: "Bancos",
    text: "Modelos individuais, lineares e modulares para permanência e convivência.",
  },
  {
    icon: Flower2,
    title: "Floreiras e jardineiras",
    text: "Volumes que organizam fluxos, vegetação e áreas de descanso.",
  },
  {
    icon: Ruler,
    title: "Mesas",
    text: "Apoio para alimentação, trabalho e encontro em áreas compartilhadas.",
  },
  {
    icon: Trash2,
    title: "Lixeiras",
    text: "Soluções discretas, resistentes e integradas à linguagem do projeto.",
  },
  {
    icon: CircleDot,
    title: "Delimitadores",
    text: "Balizadores e peças para orientar circulação e proteger áreas sensíveis.",
  },
  {
    icon: Wrench,
    title: "Peças sob medida",
    text: "Dimensões, encaixes e combinações desenvolvidas para necessidades específicas.",
  },
];

function UrbanFurniturePage() {
  const whatsappNumber = useWhatsAppNumber();
  const quoteUrl = whatsappLinkFrom(
    whatsappNumber,
    "Olá! Gostaria de conversar sobre um projeto de mobiliário urbano.",
  );

  return (
    <main className="overflow-hidden bg-white text-[#2a2f2c]">
      <section className="px-4 sm:px-8 lg:px-[50px]">
        <div className="relative min-h-[76vh] overflow-hidden rounded-3xl bg-[#202722]">
          <img
            src="/images/mobiliario-urbano/hero-praca-v1.png"
            alt="Praça contemporânea com bancos, mesas, jardineiras e lixeiras em concreto"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
          <div className="relative z-10 flex min-h-[76vh] max-w-3xl flex-col justify-end px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
              Mobiliário urbano
            </p>
            <h1
              className="mt-5 animate-fade-in font-display text-4xl leading-[1.02] sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "120ms" }}
            >
              Espaços coletivos com presença e propósito.
            </h1>
            <p
              className="mt-6 max-w-xl animate-fade-in text-base leading-relaxed text-white/80 sm:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              Criamos peças resistentes em concreto, madeira e metal para organizar, acolher e
              transformar áreas de uso comum.
            </p>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-fit animate-fade-in items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a2f2c] transition hover:-translate-y-0.5 hover:shadow-xl"
              style={{ animationDelay: "360ms" }}
            >
              Solicitar orçamento técnico <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <ScrollReveal className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
          Design para o uso cotidiano
        </p>
        <div>
          <h2 className="font-display text-4xl leading-tight text-primary sm:text-5xl">
            Mobiliário que participa da arquitetura.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary/70">
            Cada solução considera escala, fluxo, ergonomia, manutenção e implantação. O resultado é
            uma composição coerente com o espaço e preparada para uso intenso.
          </p>
        </div>
      </ScrollReveal>

      <section className="bg-[#f2f1ed] py-20 sm:py-28">
        <ScrollReveal className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
                Soluções
              </p>
              <h2 className="mt-4 font-display text-4xl text-primary sm:text-5xl">
                Uma família completa de peças.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-relaxed text-primary/70 lg:justify-self-end">
              Elementos independentes ou combinados em sistemas modulares para condomínios,
              incorporadoras, escritórios, hotéis, arquitetos e espaços públicos.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-primary/10 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((item, index) => (
              <article
                key={item.title}
                className="bg-white p-7 sm:p-8"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <item.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                <h3 className="mt-8 font-display text-2xl text-primary">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-primary/65">{item.text}</p>
              </article>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
        <ScrollReveal className="overflow-hidden rounded-3xl">
          <img
            src="/images/mobiliario-urbano/detalhe-concreto-madeira-v1.png"
            alt="Detalhe de banco e jardineira modular em concreto e madeira"
            loading="lazy"
            className="aspect-[4/3] h-full w-full object-cover transition-transform duration-[1600ms] hover:scale-[1.02]"
          />
        </ScrollReveal>
        <ScrollReveal delay={120} className="lg:pl-8">
          <ShieldCheck className="h-7 w-7 text-primary" strokeWidth={1.5} />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
            Resistência e acabamento
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-5xl">
            Feito para permanecer.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-primary/70">
            Materiais, espessuras e acabamentos são definidos conforme exposição, intensidade de uso
            e rotina de manutenção. Também planejamos pontos de fixação, movimentação, drenagem e
            instalação.
          </p>
          <ul className="mt-8 grid gap-4 text-sm text-primary/75 sm:grid-cols-2">
            {[
              "Uso interno e externo",
              "Acabamentos personalizáveis",
              "Instalação planejada",
              "Produção sob demanda",
            ].map((item) => (
              <li key={item} className="border-t border-primary/15 pt-4">
                {item}
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </section>

      <section className="bg-[#26352d] py-20 text-white sm:py-28">
        <ScrollReveal className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Building2 className="h-7 w-7" strokeWidth={1.5} />
            <h2 className="mt-6 font-display text-4xl sm:text-5xl">Do projeto à instalação.</h2>
          </div>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              [
                "01",
                "Leitura do espaço",
                "Plantas, fluxos, quantidades, referências e requisitos técnicos.",
              ],
              [
                "02",
                "Desenvolvimento",
                "Dimensionamento, materiais, acabamentos e validação da solução.",
              ],
              [
                "03",
                "Produção e entrega",
                "Fabricação, conferência e orientação para implantação das peças.",
              ],
            ].map(([number, title, text]) => (
              <li key={number} className="border-t border-white/20 pt-5">
                <span className="text-xs tracking-widest text-white/45">{number}</span>
                <h3 className="mt-5 font-display text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{text}</p>
              </li>
            ))}
          </ol>
        </ScrollReveal>
      </section>

      <section className="px-4 py-20 sm:px-8 sm:py-28 lg:px-[50px]">
        <ScrollReveal className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-[#f2f1ed] px-6 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
              Condomínios, empresas e espaços públicos
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-primary sm:text-5xl">
              Vamos desenvolver o mobiliário do seu projeto?
            </h2>
          </div>
          <a
            href={quoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Solicitar orçamento técnico <ArrowRight className="h-4 w-4" />
          </a>
        </ScrollReveal>
      </section>
    </main>
  );
}
