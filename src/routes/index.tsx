import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import { ProductGrid } from "@/components/product-grid";
import { AdminEditBar } from "@/components/admin-edit-bar";
import { CategoryShowcase } from "@/components/category-showcase";
import { HomeFaq } from "@/components/home-faq";
import { fetchHeroSlides } from "@/lib/hero-slides";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/")({
  loader: async () => ({ heroSlides: await fetchHeroSlides() }),
  head: () => ({ links: [{ rel: "canonical", href: absoluteUrl("/") }] }),
  component: Index,
});

function Index() {
  const { heroSlides } = Route.useLoaderData();
  return (
    <>
      <AdminEditBar label="Editar página Home" to="/dashboard/paginas/home" />
      <HeroSlider initialSlides={heroSlides} />
      <AboutSection />
      <ProductGrid
        title="Vasos em Destaque"
        category="Vasos"
        slugs={[
          "vaso-atenas",
          "vaso-beirute",
          "vaso-dublin",
          "vaso-bali",
          "vaso-daka",
          "vaso-toquio",
          "vaso-dacar",
          "vaso-campala",
        ]}
      />
      <ProductGrid title="Jardineiras" category="Jardineiras" limit={12} carousel />
      <CategoryShowcase />
      <HomeFaq />
    </>
  );
}
