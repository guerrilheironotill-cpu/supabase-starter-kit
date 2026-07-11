import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import {
  ProductGrid,
  FEATURED_VASES,
  PLANTERS,
} from "@/components/product-grid";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <HeroSlider />
      <AboutSection />
      <ProductGrid title="Vasos em Destaque" products={FEATURED_VASES} />
      <ProductGrid title="Jardineiras" products={PLANTERS} />
    </>
  );
}
