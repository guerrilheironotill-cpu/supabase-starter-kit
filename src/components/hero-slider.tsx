import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Marquee } from "./marquee";

type Slide = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

const SLIDES: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Coleção 2026",
    title: "Vasos que transformam ambientes",
    description:
      "Peças exclusivas em cimento e fibra, feitas à mão para o seu jardim.",
    ctaLabel: "Ver vasos",
    ctaHref: "/",
  },
  {
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Novidade",
    title: "Jardineiras sob medida",
    description:
      "Design contemporâneo e acabamento premium para varandas e áreas externas.",
    ctaLabel: "Explorar jardineiras",
    ctaHref: "/",
  },
  {
    image:
      "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?auto=format&fit=crop&w=1920&q=80",
    eyebrow: "Casa & Jardim",
    title: "Mesas, bancos e fontes",
    description:
      "Mobiliário externo que combina natureza, conforto e sofisticação.",
    ctaLabel: "Outros produtos",
    ctaHref: "/",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      6000,
    );
    return () => clearInterval(id);
  }, []);

  const go = (dir: number) =>
    setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-[50px]">
      <div className="relative h-[56vh] min-h-[420px] w-full overflow-hidden rounded-3xl bg-primary">
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={i !== index}
        >
          <img
            src={s.image}
            alt={s.title}
            className={cn(
              "h-full w-full object-cover transition-transform duration-[8000ms] ease-out",
              i === index ? "scale-105" : "scale-100",
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent" />

          <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-10 sm:px-8 sm:pb-12 lg:pb-16">
            <div
              className={cn(
                "w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm transition-all duration-700 sm:p-8",
                i === index
                  ? "translate-y-0 opacity-100"
                  : "translate-y-6 opacity-0",
              )}
            >
              <span className="inline-block rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                {s.eyebrow}
              </span>
              <h2 className="mt-4 font-display text-3xl leading-[1.05] text-primary sm:text-4xl">
                {s.title}
              </h2>
              <p className="mt-3 text-sm text-primary/70 sm:text-base">
                {s.description}
              </p>
              <a
                href={s.ctaHref}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-secondary hover:text-primary"
              >
                {s.ctaLabel}
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Slide anterior"
        className="absolute left-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-secondary hover:text-primary sm:left-6"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Próximo slide"
        className="absolute right-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-secondary hover:text-primary sm:right-6"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      </div>

      {/* Marquee (no bg, no blur) sits over the slider bottom area */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20">
        <Marquee />
      </div>

      {/* Dots outside the slider */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Ir para o slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i === index
                ? "w-8 bg-secondary"
                : "w-4 bg-white/30 hover:bg-white/60",
            )}
          />
        ))}
      </div>
    </section>
  );
}