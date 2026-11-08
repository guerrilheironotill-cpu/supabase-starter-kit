export type HomeFaqItem = {
  question: string;
  answer: string;
  link?: { to: "/projetos-personalizados"; label: string };
};

export const HOME_FAQS: HomeFaqItem[] = [
  {
    question: "Os produtos da Arteno são feitos artesanalmente?",
    answer:
      "Sim. Nossas peças são produzidas em processo artesanal, por isso pequenas variações de textura e tonalidade fazem parte das características de cada produto.",
  },
  {
    question: "Posso escolher a cor e o acabamento?",
    answer:
      "As opções disponíveis variam conforme o produto. Na página de cada item você encontra as cores e os acabamentos que podem ser selecionados.",
  },
  {
    question: "Onde encontro as medidas e os preços?",
    answer:
      "As medidas, o preço normal e o preço promocional ficam visíveis na página de cada produto. O valor final é atualizado conforme o tamanho e o acabamento escolhidos.",
  },
  {
    question: "A Arteno desenvolve peças sob medida?",
    answer:
      "Sim. Desenvolvemos projetos personalizados para arquitetos, paisagistas, empresas e clientes que precisam de dimensões ou soluções específicas.",
    link: { to: "/projetos-personalizados", label: "Conheça os projetos personalizados." },
  },
  {
    question: "Como solicito um orçamento?",
    answer:
      "Você pode selecionar os produtos no site e enviar sua lista pelo WhatsApp, ou falar diretamente conosco pelo botão de orçamento personalizado.",
  },
];

export function homeFaqStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.link ? `${faq.answer} ${faq.link.label}` : faq.answer,
      },
    })),
  };
}
