import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { categorySlug, fetchProductsByCategory, fetchProductsBySlugs } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type ProductGridProps = {
  title: string;
  category: string;
  limit?: number;
  slugs?: string[];
  carousel?: boolean;
};

export function ProductGrid({
  title,
  category,
  limit = 8,
  slugs,
  carousel = false,
}: ProductGridProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "home-grid", category, limit, slugs],
    queryFn: () => (slugs ? fetchProductsBySlugs(slugs) : fetchProductsByCategory(category, limit)),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!carouselApi) return;
    const update = () => {
      setSelectedSlide(carouselApi.selectedScrollSnap());
      setSlideCount(carouselApi.scrollSnapList().length);
    };
    update();
    carouselApi.on("select", update);
    carouselApi.on("reInit", update);
    return () => {
      carouselApi.off("select", update);
      carouselApi.off("reInit", update);
    };
  }, [carouselApi]);

  return (
    <section className="bg-white py-10 sm:py-12">
      <ScrollReveal className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">{title}</h2>
        {isLoading ? (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-4">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/60" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="mt-10 text-center text-primary/70">Nenhum produto encontrado.</p>
        ) : carousel ? (
          <>
            <Carousel
              className="mt-10 sm:mt-12"
              opts={{ align: "start", containScroll: "trimSnaps", duration: 28 }}
              setApi={setCarouselApi}
              aria-label={`Carrossel de ${title}`}
            >
              <CarouselContent className="-ml-3 sm:-ml-5">
                {products.map((product) => (
                  <CarouselItem key={product.id} className="basis-1/2 pl-3 sm:pl-5 lg:basis-1/4">
                    <ProductCard product={product} variant="home" />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {products.length > 4 && (
                <>
                  <CarouselPrevious
                    className="left-2 h-10 w-10 border-primary/20 bg-white/95 text-primary shadow-sm hover:bg-white sm:-left-5"
                    aria-label="Ver jardineiras anteriores"
                  />
                  <CarouselNext
                    className="right-2 h-10 w-10 border-primary/20 bg-white/95 text-primary shadow-sm hover:bg-white sm:-right-5"
                    aria-label="Ver próximas jardineiras"
                  />
                </>
              )}
            </Carousel>
            {slideCount > 1 && (
              <div
                className="mt-7 flex items-center justify-center gap-2"
                aria-label="Navegação do carrossel"
              >
                {Array.from({ length: slideCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => carouselApi?.scrollTo(index)}
                    aria-label={`Ir para posição ${index + 1}`}
                    aria-current={selectedSlide === index ? "true" : undefined}
                    className={`h-2.5 rounded-full transition-all duration-300 ${selectedSlide === index ? "w-7 bg-primary" : "w-2.5 bg-primary/20 hover:bg-primary/40"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} variant="home" />
            ))}
          </div>
        )}
        {!isLoading && products.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Link
              to="/categoria/$slug"
              params={{ slug: categorySlug(category) }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </ScrollReveal>
    </section>
  );
}
