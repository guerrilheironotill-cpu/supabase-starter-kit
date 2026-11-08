import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type IdeaGalleryImage = { src: string; alt: string };

const AUTOPLAY_MS = 5000;

/** Image carousel with fade transition, arrows, dots and autoplay (one image at a time). */
export function IdeaGallery({
  images,
  priority = false,
  className,
}: {
  images: IdeaGalleryImage[];
  priority?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = images.length;

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reducedMotion, index]);

  const go = (direction: number) => setIndex((i) => (i + direction + count) % count);

  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-primary/5 ring-1 ring-primary/10",
        className,
      )}
      role="group"
      aria-roledescription="carrossel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          width={1024}
          height={1280}
          loading={priority && i === 0 ? "eager" : "lazy"}
          aria-hidden={i !== index ? true : undefined}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Imagem anterior"
            className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md transition hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Próxima imagem"
            className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md transition hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
            {images.map((image, i) => (
              <button
                key={image.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir para a imagem ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-2.5 rounded-full shadow-sm transition-all duration-300",
                  i === index ? "w-7 bg-white" : "w-2.5 bg-white/60 hover:bg-white/90",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
