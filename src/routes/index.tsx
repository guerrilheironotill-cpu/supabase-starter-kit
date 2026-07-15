import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import { ProductGrid } from "@/components/product-grid";
import { AdminEditBar } from "@/components/admin-edit-bar";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <AdminEditBar label="Editar página Home" to="/dashboard/paginas/home" />
      <HeroSlider />
      <AboutSection />
      <ProductGrid title="Vasos em Destaque" category="Vasos" />
      <ProductGrid title="Jardineiras" category="Jardineiras" />
    </>
  );
}
