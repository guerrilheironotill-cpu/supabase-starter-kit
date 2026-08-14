import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function attributeImages(attribute: AttributeTerm): string[] {
  return [attribute.image_url, ...attribute.gallery].filter(
    (url, index, images): url is string => Boolean(url) && images.indexOf(url) === index,
  );
}

function videoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const videoPosition = parts.findIndex((part) => /^\d+$/.test(part));
      if (videoPosition < 0) return null;
      const id = parts[videoPosition];
      const hash = url.searchParams.get("h") || parts[videoPosition + 1];
      const params = new URLSearchParams({ dnt: "1", title: "0", byline: "0", portrait: "0" });
      if (hash && !/^\d+$/.test(hash)) params.set("h", hash);
      return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }

    if (host === "drive.google.com") {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/) || url.pathname.match(/\/d\/([^/]+)/);
      const id = fileMatch?.[1] || url.searchParams.get("id");
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
  } catch {
    return null;
  }
  return null;
}

type AttributeKind = "finishes" | "colors";

function AvailableAttributeSection({ kind, availableNames }: { kind: AttributeKind; availableNames: string[] }) {
  const isFinish = kind === "finishes";
  const title = isFinish ? "Acabamentos disponíveis" : "Cores disponíveis";
  const singular = isFinish ? "acabamento" : "cor";
  const [attributes, setAttributes] = useState<AttributeTerm[]>([]);
  const [selected, setSelected] = useState<AttributeTerm | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    fetchAttributeTerms(
      isFinish ? "product_finishes" : "product_colors",
      isFinish ? "finish_catalog" : "color_catalog",
    )
      .then((items) => setAttributes(items.filter((item) => item.count > 0).slice(0, 9)))
      .catch((error) => console.error(`Erro ao buscar ${title.toLowerCase()}:`, error));
  }, [isFinish, title]);

  const images = useMemo(() => (selected ? attributeImages(selected) : []), [selected]);
  const video = useMemo(
    () => isFinish ? videoEmbedUrl(selected?.video_url) : null,
    [isFinish, selected?.video_url],
  );
  const mediaCount = images.length + (video ? 1 : 0);
  const showingVideo = Boolean(video && mediaIndex === images.length);

  useEffect(() => {
    if (mediaIndex >= mediaCount) setMediaIndex(0);
  }, [mediaCount, mediaIndex]);

  const availableSet = new Set(availableNames);
  const visibleAttributes = attributes.filter((attribute) => availableSet.has(attribute.name));

  if (visibleAttributes.length === 0) return null;

  function openLightbox(attribute: AttributeTerm) {
    if (attributeImages(attribute).length === 0 && !(isFinish && videoEmbedUrl(attribute.video_url))) return;
    setSelected(attribute);
    setMediaIndex(0);
  }

  function previousMedia() {
    setMediaIndex((current) => (current - 1 + mediaCount) % mediaCount);
  }

  function nextMedia() {
    setMediaIndex((current) => (current + 1) % mediaCount);
  }

  return (
    <section className="border-t border-primary/10 bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-primary/65">
          Selecione {isFinish ? "um acabamento" : "uma cor"} para visualizar suas imagens{isFinish ? " e vídeos" : ""} em detalhes.
        </p>

        <Carousel
          className="mx-auto mt-9 max-w-6xl px-10 sm:px-12"
          opts={{ align: "start", containScroll: "trimSnaps" }}
          aria-label={title}
        >
          <CarouselContent className="-ml-4">
            {visibleAttributes.map((finish) => {
              const hasMedia = attributeImages(finish).length > 0 || Boolean(isFinish && videoEmbedUrl(finish.video_url));
              return (
                <CarouselItem key={finish.name} className="basis-1/2 pl-4 sm:basis-1/3 md:basis-1/4 lg:basis-[14.285714%]">
                  <button
                    type="button"
                    onClick={() => openLightbox(finish)}
                    disabled={!hasMedia}
                    className="group flex w-full flex-col items-center gap-3 text-center disabled:cursor-default"
                    aria-label={hasMedia ? `Ver galeria do acabamento ${finish.name}` : finish.name}
                  >
                    <span className="relative flex h-[150px] w-[150px] max-w-full items-center justify-center overflow-hidden rounded-full transition duration-300 group-enabled:hover:scale-[1.03]">
                      {finish.image_url ? (
                        <img src={finish.image_url} alt={finish.name} width={400} height={400} className="h-full w-full object-cover transition duration-500 group-enabled:hover:scale-105" loading="lazy" />
                      ) : (
                        <span className="px-3 text-xs font-medium text-primary/45">Imagem em breve</span>
                      )}
                      {isFinish && finish.video_url && (
                        <span className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#2a2f2c] shadow">
                          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium leading-snug text-primary">{finish.name}</span>
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-0 h-10 w-10 border-primary/20 bg-white text-primary shadow-sm hover:bg-neutral-50" aria-label={`Ver ${title.toLowerCase()} anteriores`} />
          <CarouselNext className="right-0 h-10 w-10 border-primary/20 bg-white text-primary shadow-sm hover:bg-neutral-50" aria-label={`Ver mais ${title.toLowerCase()}`} />
        </Carousel>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-primary/10 bg-white p-0 text-primary sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.name ?? `Galeria de ${singular}`}</DialogTitle>
            <DialogDescription>Galeria de imagens{isFinish ? " e vídeo" : ""} {isFinish ? "do acabamento selecionado" : "da cor selecionada"}.</DialogDescription>
          </DialogHeader>

          {selected && mediaCount > 0 && (
            <div className="flex max-h-[92vh] flex-col">
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-white">
                {showingVideo && video ? (
                  <div className="aspect-video max-h-[72vh] w-full bg-white">
                    <iframe
                      src={video}
                      title={`Vídeo do acabamento ${selected.name}`}
                      className="h-full w-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <img src={images[mediaIndex]} alt={`${selected.name} — imagem ${mediaIndex + 1}`} width={1200} height={900} className="max-h-[72vh] w-full object-contain" />
                )}
                {mediaCount > 1 && (
                  <>
                    <button type="button" onClick={previousMedia} className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#2a2f2c] shadow-md backdrop-blur-sm transition hover:bg-white sm:left-5" aria-label="Item anterior">
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button type="button" onClick={nextMedia} className="absolute right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#2a2f2c] shadow-md backdrop-blur-sm transition hover:bg-white sm:right-5" aria-label="Próximo item">
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
              </div>

              <div className="border-t border-primary/10 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-xl font-semibold text-primary">{selected.name}</p>
                    {selected.description && <p className="mt-1 line-clamp-2 text-sm text-primary/65">{selected.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-primary/55">{mediaIndex + 1} / {mediaCount}</span>
                </div>

                {mediaCount > 1 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {images.map((url, index) => (
                      <button key={url} type="button" onClick={() => setMediaIndex(index)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${index === mediaIndex ? "border-[#2a2f2c]" : "border-transparent opacity-60 hover:opacity-100"}`} aria-label={`Abrir imagem ${index + 1}`}>
                        <img src={url} alt="" width={240} height={180} className="h-full w-full object-cover" />
                      </button>
                    ))}
                    {video && (
                      <button type="button" onClick={() => setMediaIndex(images.length)} className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 bg-neutral-100 text-[#2a2f2c] transition ${showingVideo ? "border-[#2a2f2c]" : "border-transparent opacity-60 hover:opacity-100"}`} aria-label="Abrir vídeo">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function AvailableFinishesSection({ availableNames }: { availableNames: string[] }) {
  return <AvailableAttributeSection kind="finishes" availableNames={availableNames} />;
}

export function AvailableColorsSection({ availableNames }: { availableNames: string[] }) {
  return <AvailableAttributeSection kind="colors" availableNames={availableNames} />;
}
