import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import { ProductGrid } from "@/components/product-grid";
import { AdminEditBar } from "@/components/admin-edit-bar";
import { CategoryShowcase } from "@/components/category-showcase";
import { HomeFaq } from "@/components/home-faq";
import { fetchHeroSlides } from "@/lib/hero-slides";
import { absoluteUrl } from "@/lib/site-config";
import { fetchHomeProjects } from "@/lib/home-projects";
import { HomeProjectsGallery } from "@/components/home-projects-gallery";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [heroSlides, projects] = await Promise.all([fetchHeroSlides(), fetchHomeProjects()]);
    return { heroSlides, projects };
  },
  head: () => ({ links: [{ rel: "canonical", href: absoluteUrl("/") }] }),
  component: Index,
});

function Index() {
  const { heroSlides, projects } = Route.useLoaderData();
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
      <HomeProjectsGallery projects={projects} />
      <HomeFaq />
    </>
  );
}
