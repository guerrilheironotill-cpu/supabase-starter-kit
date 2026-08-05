import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    question: "Os produtos da Arteno são feitos artesanalmente?",
    answer: "Sim. Nossas peças são produzidas em processo artesanal, por isso pequenas variações de textura e tonalidade fazem parte das características de cada produto.",
  },
  {
    question: "Posso escolher a cor e o acabamento?",
    answer: "As opções disponíveis variam conforme o produto. Na página de cada item você encontra as cores e os acabamentos que podem ser selecionados.",
  },
  {
    question: "Onde encontro as medidas e os preços?",
    answer: "Adicione os produtos ao orçamento e, ao finalizar, receba a relação completa com os respectivos valores. Se preferir, clique em “Catálogo (PDF)” para baixar o catálogo completo.",
  },
  {
    question: "A Arteno desenvolve peças sob medida?",
    answer: "Sim. Desenvolvemos projetos personalizados para arquitetos, paisagistas, empresas e clientes que precisam de dimensões ou soluções específicas.",
  },
  {
    question: "Como solicito um orçamento?",
    answer: "Você pode selecionar os produtos no site e enviar sua lista pelo WhatsApp, ou falar diretamente conosco pelo botão de orçamento personalizado.",
  },
];

export function HomeFaq() {
  return (
    <section className="bg-[#f5f6f2] py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 max-w-md font-display text-3xl leading-tight text-primary sm:text-4xl">
            Tudo o que você precisa saber.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-primary/65 sm:text-base">
            Encontre respostas rápidas sobre nossos produtos, opções e atendimento.
          </p>
        </div>

        <Accordion type="single" collapsible className="border-t border-primary/15">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="border-primary/15">
              <AccordionTrigger className="py-5 text-base text-primary hover:no-underline sm:text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-primary/65 sm:text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
