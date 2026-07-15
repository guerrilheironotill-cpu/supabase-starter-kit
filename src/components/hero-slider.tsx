import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Marquee } from "./marquee";
import { DEFAULT_SLIDES, fetchHeroSlides } from "@/lib/hero-slides";

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const { data: SLIDES = DEFAULT_SLIDES } = useQuery({
    queryKey: ["home", "hero-slides"],
    queryFn: fetchHeroSlides,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!SLIDES.length) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      6000,
    );
    return () => clearInterval(id);
  }, [SLIDES.length]);

  const go = (dir: number) =>
    setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-[50px] animate-[heroIn_1600ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <style>{`@keyframes heroIn{0%{opacity:0;transform:translateY(24px) scale(.98)}100%{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="relative h-[62vh] min-h-[462px] w-full overflow-hidden rounded-3xl bg-primary">
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-all duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            i === index ? "opacity-100 scale-100" : "opacity-0 scale-[1.03]",
          )}
          aria-hidden={i !== index}
        >
          <img
            src={s.image}
            alt={s.title}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-[9000ms] ease-out",
              i === index ? "scale-110" : "scale-100",
            )}
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-primary/20" />

          <div className="relative z-10 flex h-full items-center justify-center px-4 pb-16 sm:px-8">
            <div
              className={cn(
                "w-[90%] sm:w-[75%] lg:w-[60%] text-center text-white transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-200",
                i === index
                  ? "translate-y-0 opacity-100"
                  : "translate-y-8 opacity-0",
              )}
            >
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">
                {s.eyebrow}
              </span>
              <h1 className="mt-4 font-display text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                {s.title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
                {s.description}
              </p>
              <a
                href={s.ctaHref}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/70 bg-transparent px-6 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-primary"
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

      {/* Marquee sits over the slider bottom, inside rounded clip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30">
        <Marquee />
      </div>
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
                ? "w-8 bg-primary"
                : "w-4 bg-primary/25 hover:bg-primary/50",
            )}
          />
        ))}
      </div>
    </section>
  );
}