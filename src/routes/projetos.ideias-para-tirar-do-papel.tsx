import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHero } from "@/components/page-hero";
import { ScrollReveal } from "@/components/scroll-reveal";
import { IDEA_FAQS, IDEA_PROJECTS, IDEA_STEPS } from "@/lib/ideas";
import { absoluteUrl } from "@/lib/site-config";
import { trackGaEvent, trackIdeaInterest } from "@/lib/track-event";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";

const TITLE = "Ideias para tirar do papel — Arteno";
const DESCRIPTION =
  "Projetos em concreto que queremos criar com você: esculturas e peças especiais desenvolvidas sob encomenda. Escolha uma ideia e fale com a gente.";

export const Route = createFileRoute("/projetos/ideias-para-tirar-do-papel")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: absoluteUrl(IDEA_PROJECTS[0].image) },
      { property: "og:url", content: absoluteUrl("/projetos/ideias-para-tirar-do-papel") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/projetos/ideias-para-tirar-do-papel") }],
  }),
  component: IdeasPage,
});

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M20.52 3.48A11.87 11.87 0 0 0 12.01 0C5.4 0 .04 5.36.04 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.98 11.98 0 0 0 5.81 1.48h.01c6.61 0 11.97-5.36 11.97-11.97a11.9 11.9 0 0 0-3.47-8.41ZM12.02 21.8h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.68.97.98-3.59-.23-.37a9.85 9.85 0 1 1 18.28-5.26c0 5.43-4.42 9.83-9.97 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.17 5.03 4.44.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.08-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function IdeasPage() {
  const whatsappNumber = useWhatsAppNumber();
  const projectLink = (name: string) =>
    whatsappLinkFrom(
      whatsappNumber,
      `Olá! Tenho interesse no projeto "${name}" (Ideias para tirar do papel).`,
    );
  const customLink = whatsappLinkFrom(
    whatsappNumber,
    "Olá! Tenho uma ideia de peça e gostaria de conversar com a Arteno.",
  );

  // The page view itself is sent by AnalyticsLoader; this event marks a visit to this page
  // as an audience of its own in GA.
  useEffect(() => {
    trackGaEvent("view_idea_projects", { projects: IDEA_PROJECTS.length });
  }, []);

  return (
    <main className="bg-background text-primary">
      <PageHero
        eyebrow="Projetos"
        title="Ideias para tirar do papel"
        crumbs={[{ label: "Home", to: "/" }, { label: "Ideias para tirar do papel" }]}
      />

      <section className="mx-auto max-w-3xl px-4 pb-4 pt-14 text-center sm:px-8 sm:pt-20">
        <p className="text-base leading-relaxed text-primary/80 sm:text-lg">
          São peças que queremos produzir e que ainda não existem. Cada uma é desenvolvida sob
          medida para o seu espaço: você escolhe a ideia, a gente cuida do resto.
        </p>
      </section>

      <section className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-8 sm:py-16">
        {IDEA_PROJECTS.map((project, index) => (
          <ScrollReveal key={project.slug}>
            <article id={project.slug} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <img
                src={project.image}
                alt={project.imageAlt}
                width={1200}
                height={1800}
                loading={index === 0 ? "eager" : "lazy"}
                className={`aspect-[4/5] w-full rounded-3xl object-cover ring-1 ring-primary/10 ${
                  index % 2 === 1 ? "lg:order-2" : ""
                }`}
              />
              <div>
                <h2 className="font-display text-3xl sm:text-4xl">{project.name}</h2>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-primary/80">
                  {project.description.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <ul className="mt-6 space-y-2 border-t border-primary/10 pt-5 text-sm text-primary/80">
                  {project.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <a
                  href={projectLink(project.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackIdeaInterest(project.name)}
                  aria-label={`Quero este projeto: ${project.name} (abre o WhatsApp em nova aba)`}
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#20b955] hover:shadow-lg"
                >
                  <WhatsAppIcon />
                  Quero este projeto
                </a>
              </div>
            </article>
          </ScrollReveal>
        ))}
      </section>

      <section className="bg-[#f5f6f2] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <h2 className="text-center font-display text-3xl sm:text-4xl">Como funciona</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {IDEA_STEPS.map((step, index) => (
              <li key={step.title} className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display text-lg text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary/75">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mx-auto mt-14 max-w-xl rounded-3xl border border-primary/10 bg-white p-8 text-center">
            <h3 className="font-display text-2xl">Tem uma peça em mente?</h3>
            <p className="mt-3 text-sm leading-relaxed text-primary/75">
              Mande a foto ou a referência e vemos juntos se conseguimos fazer.
            </p>
            <a
              href={customLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackIdeaInterest("Projeto próprio")}
              aria-label="Mandar minha ideia pelo WhatsApp (abre em nova aba)"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Mandar minha ideia
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
        <div className="text-center">
          <span className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
            <CircleHelp className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <h2 className="font-display text-3xl sm:text-4xl">Dúvidas frequentes</h2>
        </div>
        <Accordion type="single" collapsible className="mt-8 border-t border-primary/15">
          {IDEA_FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="border-primary/15">
              <AccordionTrigger className="py-5 text-left text-base text-primary hover:no-underline sm:text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 pr-8 text-sm leading-7 text-[#555b57] sm:text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
