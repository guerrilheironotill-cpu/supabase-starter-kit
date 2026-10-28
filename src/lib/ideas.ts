import type { ReactNode } from "react";

export type IdeaProject = {
  slug: string;
  name: string;
  image: string;
  imageAlt: string;
  /** Short paragraphs describing the piece. */
  description: string[];
  /** Two or three bullet highlights (size, material, lead time). */
  highlights: string[];
};

export const IDEA_PROJECTS: IdeaProject[] = [
  {
    slug: "escultura-infinito",
    name: "Escultura Infinito",
    image: "/images/projetos/escultura-infinito.webp",
    imageAlt:
      "Escultura em forma de fita contínua em tom de pedra clara sobre pedestal, em um jardim com buxos e flores",
    description: [
      "Uma fita contínua que se dobra sobre si mesma, em acabamento claro que lembra pedra natural. Ideal para jardins, entradas e áreas de convivência, sobre um pedestal que valoriza a peça.",
      "É um projeto novo para nós: desenvolvemos o molde e o protótipo junto com você.",
    ],
    highlights: [
      "Altura sugerida: a combinar (referência: cerca de 1,8 m)",
      "Material: concreto com acabamento em tom travertino",
      "Prazo: definido após o projeto e o orçamento",
    ],
  },
];

IDEA_PROJECTS.push({
  slug: "escultura-rosto-em-blocos",
  name: "Escultura Rosto em Blocos",
  image: "/images/projetos/escultura-rosto.webp",
  imageAlt:
    "Escultura de um rosto monumental montado em blocos escuros, com olho, nariz e boca, em meio a plantas de folhas grandes",
  description: [
    "Um rosto monumental montado em blocos que se encaixam: o olho, o nariz e a boca viram volumes independentes, em um concreto escuro de textura rugosa. Fica no meio da vegetação como uma peça de arte, e é ideal para jardins, áreas de piscina e espaços de convivência.",
    "É um projeto novo para nós: desenvolvemos os moldes e o protótipo junto com você, ajustando a expressão, o tamanho e o acabamento ao seu espaço.",
  ],
  highlights: [
    "Altura sugerida: a combinar, conforme o espaço e a presença desejada",
    "Material: concreto em tom grafite, com textura rugosa",
    "Prazo: definido após o projeto e o orçamento",
  ],
});

IDEA_PROJECTS.push({
  slug: "fonte-de-parede-com-cortina-de-agua",
  name: "Fonte de parede com cortina de água",
  image: "/images/projetos/fonte-parede-circular.webp",
  imageAlt:
    "Painel de concreto claro com abertura circular por onde cai uma cortina de fios de água, em um jardim com vasos e plantas",
  description: [
    "Um painel de concreto claro, com textura que lembra pedra travertino, e uma abertura circular por onde cai uma cortina de fios de água. A peça une escultura e o som da água, e funciona como divisória de jardim, fundo de varanda ou ponto focal na entrada.",
    "A água circula em circuito fechado: ela cai pela abertura, é recolhida por um reservatório escondido na base da peça e volta ao topo por uma bomba, através de uma tubulação embutida. Assim, a fonte praticamente não desperdiça água, e é preciso apenas repor o que evapora.",
    "É um projeto novo para nós: desenvolvemos o molde, o sistema hidráulico e o protótipo junto com você, e a manutenção se resume a limpar o filtro e o reservatório e repor a água de tempos em tempos.",
  ],
  highlights: [
    "Sistema: reservatório na base, bomba e tubulação embutida, em circuito fechado",
    "Material: concreto em tom areia, com textura que lembra travertino",
    "Altura e abertura: a combinar, conforme o espaço",
    "Prazo: definido após o projeto e o orçamento",
  ],
});

export const IDEA_STEPS = [
  {
    title: "Escolha o projeto",
    text: "Inspire-se em uma das referências ou nos conte a sua.",
  },
  {
    title: "Definimos os detalhes",
    text: "Tamanho, acabamento e orçamento combinados com você.",
  },
  {
    title: "Produzimos e entregamos",
    text: "A peça é feita para o seu espaço, do molde à instalação.",
  },
];

export const IDEA_FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: "Esses projetos já foram feitos antes?",
    answer:
      "Não. São ideias que queremos tirar do papel. Por isso o projeto é desenvolvido junto com você, com molde e protótipo próprios, e o primeiro cliente participa de todo o processo.",
  },
  {
    question: "Posso mudar o tamanho, o acabamento ou a cor?",
    answer:
      "Sim. As imagens são referências. Tamanho, acabamento e cor são definidos conforme o seu espaço e o orçamento.",
  },
  {
    question: "Quanto tempo leva para ficar pronto?",
    answer:
      "O prazo depende do projeto. Como envolve desenvolver molde e protótipo, informamos uma estimativa após entender o que você precisa.",
  },
  {
    question: "Como funciona o orçamento e o pagamento?",
    answer:
      "Você fala com a gente pelo WhatsApp, explica o projeto e recebemos as informações para montar o orçamento. Pagamento e prazos são combinados antes de começar a produção.",
  },
  {
    question: "A peça é exclusiva para mim?",
    answer:
      "Podemos combinar exclusividade do projeto por um período. Converse com a gente sobre isso ao pedir o orçamento.",
  },
  {
    question: "Vocês entregam e instalam?",
    answer:
      "Sim, conforme o local e o tamanho da peça. Informe a cidade e o tipo de instalação ao falar com a equipe.",
  },
  {
    question: "O material aguenta chuva e sol?",
    answer:
      "As peças em concreto são feitas para áreas externas. Orientamos o melhor acabamento para o ambiente em que ela ficará.",
  },
];
