import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import type { HomeProject } from "@/lib/home-projects";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function HomeProjectsGallery({ projects }: { projects: HomeProject[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const close = () => setOpenIndex(null);
  const previous = () => setOpenIndex((value) => value === null ? null : (value - 1 + projects.length) % projects.length);
  const next = () => setOpenIndex((value) => value === null ? null : (value + 1) % projects.length);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, projects.length]);

  if (projects.length === 0) return null;
  const selected = openIndex === null ? null : projects[openIndex];

  return (
    <section className="bg-white pt-12 pb-0 sm:pt-16" aria-labelledby="projects-with-arteno-title">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-8">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/5 text-primary">
          <Images className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <h2 id="projects-with-arteno-title" className="font-display text-3xl text-primary sm:text-4xl">
          Projetos com Arteno
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Peças Arteno compondo ambientes reais de arquitetura, decoração e paisagismo.
        </p>
      </div>

      <Carousel opts={{ align: "start", loop: projects.length > 6, duration: 35 }} className="group/gallery mt-9 w-full">
        <CarouselContent className="ml-0">
          {projects.map((project, index) => (
            <CarouselItem key={project.id} className="basis-full pl-0 min-[480px]:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 min-[1440px]:basis-1/6">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="group/project relative block aspect-[9/16] w-full overflow-hidden bg-primary/5 text-left"
                aria-label={`Ampliar: ${project.alt}`}
              >
                <img
                  src={project.image}
                  alt={project.alt}
                  width={1080}
                  height={1920}
                  loading={index < 6 ? "eager" : "lazy"}
                  fetchPriority={index < 2 ? "high" : "auto"}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/project:scale-[1.025]"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-5 pt-16 font-display text-base text-white drop-shadow-sm sm:px-5 sm:pb-6 sm:text-lg">
                  {project.alt}
                </span>
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {projects.length > 1 && (
          <>
            <CarouselPrevious className="left-3 h-11 w-11 border-0 bg-white/90 text-primary opacity-0 shadow-lg transition-opacity group-hover/gallery:opacity-100 hover:bg-white" />
            <CarouselNext className="right-3 h-11 w-11 border-0 bg-white/90 text-primary opacity-0 shadow-lg transition-opacity group-hover/gallery:opacity-100 hover:bg-white" />
          </>
        )}
      </Carousel>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
            if (Math.abs(delta) > 50) delta > 0 ? previous() : next();
            touchStart.current = null;
          }}
        >
          <button type="button" onClick={close} aria-label="Fechar galeria" className="absolute right-4 top-4 z-10 rounded-full bg-black/35 p-2 text-white hover:bg-black/60">
            <X className="h-6 w-6" />
          </button>
          {projects.length > 1 && (
            <>
              <button type="button" onClick={previous} aria-label="Projeto anterior" className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/60 sm:left-6 sm:p-3">
                <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
              <button type="button" onClick={next} aria-label="Próximo projeto" className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/60 sm:right-6 sm:p-3">
                <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
            </>
          )}
          <figure className="flex h-full max-h-[94vh] max-w-[92vw] flex-col items-center justify-center">
            <img src={selected.image} alt={selected.alt} width={1080} height={1920} className="min-h-0 max-h-[calc(94vh-54px)] max-w-full object-contain" />
            <figcaption className="mt-3 text-center font-display text-base text-white sm:text-lg">{selected.alt}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
