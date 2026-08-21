import { ArrowRight, Check, CircleHelp } from "lucide-react";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";

export type LandingFeature = { title: string; text: string };
export type LandingFaq = { question: string; answer: string };

export function SeoLandingPage({
  eyebrow,
  title,
  subtitle,
  intro,
  hero,
  heroSrcSet,
  gallery,
  featuresTitle,
  features,
  faqTitle,
  faqs,
  whatsappText,
  ctaLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  intro: string[];
  hero: string;
  heroSrcSet?: string;
  gallery: { src: string; alt: string; srcSet?: string; width?: number; height?: number }[];
  featuresTitle: string;
  features: LandingFeature[];
  faqTitle?: string;
  faqs?: LandingFaq[];
  whatsappText: string;
  ctaLabel: string;
}) {
  const whatsapp = whatsappLinkFrom(useWhatsAppNumber(), whatsappText);
  return (
    <main className="bg-white text-[#2a2f2c]">
      <section className="px-4 sm:px-8 lg:px-[50px]">
        <div className="relative min-h-[68vh] overflow-hidden rounded-b-3xl bg-[#2a2f2c]">
          <img
            src={hero}
            srcSet={heroSrcSet}
            sizes="(max-width: 900px) 100vw, calc(100vw - 100px)"
            alt=""
            width={1920}
            height={1080}
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
          <div className="relative z-10 flex min-h-[68vh] max-w-4xl flex-col justify-end px-6 py-14 text-white sm:px-12 lg:px-16 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              {eyebrow}
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.04] sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              {subtitle}
            </p>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${ctaLabel} pelo WhatsApp (abre em nova aba)`}
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a2f2c] transition-colors hover:bg-white/90"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
          Feito para o seu espaço
        </p>
        <div>
          {intro.map((paragraph, index) => (
            <p key={index} className="mb-5 text-lg leading-relaxed text-primary/75 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-8 md:grid-cols-2">
        {gallery.map((image, index) => (
          <figure
            key={image.src}
            className={
              index === 0 && gallery.length % 2 === 1
                ? "overflow-hidden rounded-3xl md:col-span-2"
                : "overflow-hidden rounded-3xl"
            }
          >
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(max-width: 767px) calc(100vw - 32px), 50vw"
              alt={image.alt}
              width={image.width ?? 1200}
              height={image.height ?? 900}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </figure>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/55">
            Diferenciais Arteno
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-5xl">
            {featuresTitle}
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-primary/10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="bg-[#f7f6f2] p-7 sm:p-8">
              <Check className="h-5 w-5 text-primary" />
              <h3 className="mt-8 font-display text-xl font-semibold text-primary">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-primary/65">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {faqs && faqs.length > 0 && (
        <section className="bg-[#f2f1ed] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <CircleHelp className="h-7 w-7 text-primary" />
              <h2 className="mt-6 font-display text-4xl text-primary sm:text-5xl">{faqTitle}</h2>
            </div>
            <div className="divide-y divide-primary/15 border-y border-primary/15">
              {faqs.map((faq, index) => (
                <details key={faq.question} className="group py-5" open={index === 0}>
                  <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-primary marker:hidden">
                    {faq.question}
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/65">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 py-20 sm:px-8 lg:px-[50px]">
        <div className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-[#2a2f2c] px-6 py-12 text-white sm:px-12 lg:flex-row lg:items-end">
          <h2 className="max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
            Vamos desenvolver uma solução para o seu projeto?
          </h2>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${ctaLabel} pelo WhatsApp (abre em nova aba)`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2a2f2c]"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
