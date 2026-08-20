import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { absoluteUrl } from "@/lib/site-config";

type ContentSection = {
  title: string;
  paragraphs: string[];
  image?: { src: string; alt: string };
};

const sections: ContentSection[] = [
  {
    title: "Poros, bolhas e pequenas marcas",
    paragraphs: [
      "Durante a moldagem do concreto, pequenas quantidades de ar podem permanecer próximas à superfície da peça. Após a desforma, esses pontos podem aparecer na forma de pequenos poros, cavidades ou marcas.",
      "A quantidade, o tamanho e a distribuição desses poros podem variar de uma peça para outra e fazem parte das características naturais do concreto.",
      "Por isso, mesmo peças produzidas com a mesma forma, composição e acabamento nunca apresentam uma superfície absolutamente idêntica.",
    ],
  },
  {
    title: "Variações de tonalidade",
    paragraphs: [
      "O concreto é um material composto por diferentes matérias-primas minerais. Sua aparência final pode sofrer pequenas variações decorrentes dos próprios materiais, da pigmentação, da umidade, do processo de cura e das condições de fabricação.",
      "Dessa forma, duas peças produzidas na mesma cor podem apresentar sutis diferenças de tonalidade.",
      "Essas variações são especialmente perceptíveis quando peças produzidas em momentos diferentes são posicionadas lado a lado e são consideradas parte natural do material.",
    ],
  },
  {
    title: "Linhas, texturas e marcas do processo",
    paragraphs: [
      "A superfície de uma peça de concreto registra parte do processo utilizado para produzi-la.",
      "Pequenas linhas, mudanças sutis de textura, marcas de moldagem e diferenças no aspecto superficial podem surgir durante o preenchimento da forma, acomodação do concreto, cura e desforma.",
      "Por trabalharmos com peças produzidas individualmente, essas características podem aparecer de maneiras diferentes em cada unidade.",
    ],
  },
  {
    title: "Emendas e linhas de moldagem",
    paragraphs: [
      "Alguns formatos exigem formas compostas por duas ou mais partes.",
      "Nesses casos, os pontos de encontro entre as partes da forma podem deixar uma linha discreta na superfície da peça. Mesmo após o acabamento manual, essa marca pode permanecer parcialmente visível.",
      "Sua posição está relacionada ao processo necessário para produzir determinado formato e não compromete a resistência ou a utilização da peça.",
    ],
  },
  {
    title: "Microfissuras e craquelamento superficial",
    paragraphs: [
      "Durante o processo de cura, o concreto perde umidade e passa por pequenas movimentações naturais.",
      "Dependendo da geometria da peça, das condições ambientais e das características da superfície, podem surgir microfissuras ou um leve craquelamento superficial.",
      "Quando restritas à camada superficial, essas marcas possuem caráter predominantemente estético e não significam necessariamente que exista comprometimento estrutural da peça.",
      "Fissuras maiores, profundas ou que apresentem evolução, entretanto, não devem ser tratadas automaticamente como uma característica estética e devem ser avaliadas pela Arteno.",
    ],
  },
  {
    title: "Por que nenhuma peça é exatamente igual?",
    paragraphs: [
      "Porque não produzimos objetos plásticos ou superfícies impressas industrialmente. Trabalhamos com concreto.",
      "Cada mistura é preparada, moldada, curada, desformada e acabada individualmente. Mesmo seguindo um processo controlado, o material reage de maneira própria.",
      "É justamente essa combinação entre controle técnico e variação natural que proporciona ao concreto sua aparência característica.",
      "Por isso, pequenas diferenças entre as peças não são apenas esperadas: elas fazem parte da linguagem do material.",
    ],
  },
  {
    title: "Construídas para durar",
    paragraphs: [
      "Na Arteno, as características naturais do concreto convivem com uma construção pensada para proporcionar resistência e durabilidade.",
      "Nossas peças são produzidas em concreto estrutural e recebem reforços adequados às características de cada produto, podendo incluir tela de fibra de vidro e reforços internos em aço galvanizado.",
      "As peças também passam por processos de proteção e impermeabilização compatíveis com sua aplicação.",
      "O objetivo é preservar a aparência autêntica do concreto sem abrir mão do desempenho necessário para o uso cotidiano.",
    ],
  },
  {
    title: "Característica natural ou problema?",
    paragraphs: [
      "Poros, pequenas diferenças de tonalidade, variações de textura, marcas discretas provenientes da moldagem e microfissuras exclusivamente superficiais podem fazer parte das características naturais do concreto.",
      "Já situações como fissuras profundas, quebras, desprendimento de partes ou alterações que possam comprometer a estabilidade e o uso da peça devem ser comunicadas à Arteno para avaliação.",
      "Em caso de dúvida, nossa equipe poderá analisar a peça e orientar sobre cada situação.",
    ],
  },
  {
    title: "Produzido artesanalmente",
    paragraphs: [
      "Cada peça Arteno passa por diferentes etapas antes de chegar ao seu espaço.",
      "Da preparação do concreto à moldagem, cura, desforma, acabamento e proteção final, existe uma combinação de processos técnicos e trabalho manual.",
      "O resultado são peças que compartilham o mesmo desenho e padrão de qualidade, mas preservam as pequenas particularidades de um material natural e de uma produção artesanal.",
    ],
  },
];

export const Route = createFileRoute("/caracteristicas-do-concreto")({
  head: () => ({
    meta: [
      { title: "Características do Concreto | Arteno" },
      {
        name: "description",
        content:
          "Entenda as variações naturais de tonalidade, textura, porosidade e marcas presentes nas peças de concreto produzidas pela Arteno.",
      },
      { property: "og:title", content: "Características do Concreto | Arteno" },
      {
        property: "og:description",
        content: "Conheça a beleza natural e as particularidades das peças artesanais de concreto.",
      },
      { property: "og:url", content: absoluteUrl("/caracteristicas-do-concreto") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/caracteristicas-do-concreto") }],
  }),
  component: ConcreteCharacteristicsPage,
});

function ConcreteCharacteristicsPage() {
  return (
    <main className="bg-white pb-20 text-primary">
      <header className="border-b border-primary/10 bg-[#f3f0e9] px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-xs text-primary/60">
            <ol className="flex items-center gap-1">
              <li>
                <Link to="/" className="hover:text-primary">
                  Início
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3 w-3" />
              </li>
              <li>Características do Concreto</li>
            </ol>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/55">
            Material e produção
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-medium sm:text-6xl">
            Características do Concreto
          </h1>
          <div className="mt-8 max-w-3xl space-y-4 text-lg leading-relaxed text-primary/75">
            <p>
              Cada peça Arteno carrega características próprias do concreto e do seu processo de
              fabricação.
            </p>
            <p>
              Por se tratar de um material mineral e de uma produção que envolve moldagem, cura e
              acabamento manual, pequenas variações de tonalidade, textura, porosidade e marcas
              superficiais podem ocorrer naturalmente.
            </p>
            <p>
              Essas particularidades não tornam uma peça inferior à outra. Pelo contrário: fazem
              parte da identidade do concreto e ajudam a tornar cada peça única.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {sections.map((section, index) => (
          <article
            key={section.title}
            className="grid gap-8 border-b border-primary/10 py-12 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16"
          >
            <div>
              <span className="text-xs font-semibold text-primary/45">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-3 font-display text-3xl font-medium leading-tight">
                {section.title}
              </h2>
            </div>
            <div>
              <div className="space-y-4 text-base leading-relaxed text-primary/75">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.image && (
                <figure className="mt-8 overflow-hidden bg-primary/5">
                  <img
                    src={section.image.src}
                    alt={section.image.alt}
                    width={1200}
                    height={800}
                    loading="lazy"
                    className="aspect-[3/2] w-full object-cover"
                  />
                </figure>
              )}
            </div>
          </article>
        ))}

        <p className="mx-auto mt-14 max-w-3xl text-center font-display text-2xl font-medium italic sm:text-3xl">
          Nenhuma peça é exatamente igual à outra. E é assim que o concreto deve ser.
        </p>
      </div>
    </main>
  );
}
