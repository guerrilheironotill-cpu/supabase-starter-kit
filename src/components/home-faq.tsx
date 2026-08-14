import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CircleHelp, Download } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/scroll-reveal";
import { WhatsAppQuoteDrawer } from "@/components/whatsapp-quote-drawer";
import { openCatalogDownload } from "@/components/catalog-download-dialog";

const FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: "Os produtos da Arteno são feitos artesanalmente?",
    answer: (
      <>
        Sim. Nossas peças são produzidas em processo artesanal, por isso pequenas variações de
        textura e tonalidade fazem parte das características de cada produto.
      </>
    ),
  },
  {
    question: "Posso escolher a cor e o acabamento?",
    answer: (
      <>
        As opções disponíveis variam conforme o produto. Na página de cada item você encontra as
        cores e os acabamentos que podem ser selecionados.
      </>
    ),
  },
  {
    question: "Onde encontro as medidas e os preços?",
    answer: (
      <>
        <p>
          Adicione os produtos ao orçamento e, ao finalizar, receba a relação completa com os
          respectivos valores.
        </p>
        <button
          type="button"
          onClick={openCatalogDownload}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary hover:text-white"
        >
          <Download className="h-3.5 w-3.5" /> Abrir catálogo em PDF
        </button>
      </>
    ),
  },
  {
    question: "A Arteno desenvolve peças sob medida?",
    answer: (
      <>
        Sim. Desenvolvemos projetos personalizados para arquitetos, paisagistas, empresas e clientes
        que precisam de dimensões ou soluções específicas.{" "}
        <Link
          to="/projetos-personalizados"
          className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
        >
          Conheça os projetos personalizados.
        </Link>
      </>
    ),
  },
  {
    question: "Como solicito um orçamento?",
    answer: (
      <>
        Você pode selecionar os produtos no site e enviar sua lista pelo WhatsApp, ou falar
        diretamente conosco pelo botão de orçamento personalizado.
      </>
    ),
  },
];

export function HomeFaq() {
  const [waOpen, setWaOpen] = useState(false);

  return (
    <section className="bg-[#f5f6f2] py-16 text-[#343936] sm:py-20">
      <ScrollReveal className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <span className="mb-7 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
            <CircleHelp className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 max-w-md font-display text-3xl leading-tight text-primary sm:text-4xl">
            Tudo o que você precisa saber.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#555b57] sm:text-base">
            Encontre respostas rápidas sobre nossos produtos, opções e atendimento.
          </p>
          <button
            type="button"
            onClick={() => setWaOpen(true)}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#20b955] hover:shadow-lg"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M20.52 3.48A11.87 11.87 0 0 0 12.01 0C5.4 0 .04 5.36.04 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.98 11.98 0 0 0 5.81 1.48h.01c6.61 0 11.97-5.36 11.97-11.97a11.9 11.9 0 0 0-3.47-8.41ZM12.02 21.8h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.68.97.98-3.59-.23-.37a9.85 9.85 0 1 1 18.28-5.26c0 5.43-4.42 9.83-9.97 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.17 5.03 4.44.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.08-.13-.27-.2-.57-.35Z" />
            </svg>
            Ainda com dúvidas? Fale com a gente
          </button>
        </div>

        <Accordion type="single" collapsible className="border-t border-primary/15">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="border-primary/15">
              <AccordionTrigger className="py-5 text-base text-primary hover:no-underline sm:text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-[#555b57] sm:text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollReveal>
      <WhatsAppQuoteDrawer open={waOpen} onClose={() => setWaOpen(false)} />
    </section>
  );
}
