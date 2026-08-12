import { useEffect, useState } from "react";
import { fetchProductsByCategory, type Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type ProductRelatedSectionProps = {
  currentProductId: string;
  category: string;
  limit?: number;
};

export function ProductRelatedSection({
  currentProductId,
  category,
  limit = 8,
}: ProductRelatedSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    fetchProductsByCategory(category, 12)
      .then((items) => {
        setProducts(items.filter((p) => p.id !== currentProductId).slice(0, limit));
      })
      .catch((err) => console.error("Erro ao buscar relacionados:", err))
      .finally(() => setLoading(false));
  }, [category, currentProductId, limit]);

  useEffect(() => {
    if (!carouselApi || paused || products.length < 2) return;

    const autoplay = window.setInterval(() => {
      carouselApi.scrollNext();
    }, 4000);

    return () => window.clearInterval(autoplay);
  }, [carouselApi, paused, products.length]);

  if (loading || products.length === 0) return null;

  return (
    <section className="bg-[#f5f6f2] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="text-center font-display text-3xl text-primary sm:text-4xl">
          Produtos Relacionados
        </h2>
        <Carousel
          className="mt-10 sm:mt-12"
          opts={{ align: "start", loop: products.length > 4, duration: 28 }}
          setApi={setCarouselApi}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          aria-label="Produtos relacionados"
        >
          <CarouselContent className="-ml-3 sm:-ml-5">
            {products.map((product) => (
              <CarouselItem
                key={product.id}
                className="basis-1/2 pl-3 sm:basis-1/3 sm:pl-5 lg:basis-1/4"
              >
                <ProductCard product={product} variant="home" />
              </CarouselItem>
            ))}
          </CarouselContent>
          {products.length > 4 && (
            <>
              <CarouselPrevious
                className="left-2 h-10 w-10 border-primary/20 bg-white/95 text-primary shadow-md hover:bg-white sm:-left-5"
                aria-label="Ver produtos anteriores"
              />
              <CarouselNext
                className="right-2 h-10 w-10 border-primary/20 bg-white/95 text-primary shadow-md hover:bg-white sm:-right-5"
                aria-label="Ver próximos produtos"
              />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
