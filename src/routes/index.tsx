import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import { ProductGrid } from "@/components/product-grid";
import { AdminEditBar } from "@/components/admin-edit-bar";
import { CategoryShowcase, HOME_SHOWCASE_CATEGORIES } from "@/components/category-showcase";
import { HomeFaq } from "@/components/home-faq";
import { fetchHeroSlides } from "@/lib/hero-slides";
import { fetchCategoryCards, fetchProductsByCategory, fetchProductsBySlugs } from "@/lib/products";
import { absoluteUrl } from "@/lib/site-config";
import { fetchHomeProjects } from "@/lib/home-projects";
import { HomeProjectsGallery } from "@/components/home-projects-gallery";
const HomeLatestPosts = lazy(() =>
  import("@/components/blog/home-latest-posts").then((module) => ({
    default: module.HomeLatestPosts,
  })),
);

const FEATURED_VASE_SLUGS = [
  "vaso-atenas",
  "vaso-beirute",
  "vaso-dublin",
  "vaso-santa-fe",
  "vaso-daka",
  "vaso-toquio",
  "vaso-dacar",
  "vaso-campala",
];

export const Route = createFileRoute("/")({
  loader: async () => {
    const [heroSlides, projects, featuredVases, planters, categoryCards] = await Promise.all([
      fetchHeroSlides(),
      fetchHomeProjects(),
      fetchProductsBySlugs(FEATURED_VASE_SLUGS).catch(() => []),
      fetchProductsByCategory("Jardineiras", 12).catch(() => []),
      fetchCategoryCards(HOME_SHOWCASE_CATEGORIES).catch(() => []),
    ]);
    return { heroSlides, projects, featuredVases, planters, categoryCards };
  },
  head: () => ({ links: [{ rel: "canonical", href: absoluteUrl("/") }] }),
  component: Index,
});

function Index() {
  const { heroSlides, projects, featuredVases, planters, categoryCards } = Route.useLoaderData();
  return (
    <>
      <AdminEditBar label="Editar página Home" to="/dashboard/paginas/home" />
      <HeroSlider initialSlides={heroSlides} />
      <AboutSection />
      <ProductGrid title="Vasos em Destaque" category="Vasos" products={featuredVases} />
      <ProductGrid title="Jardineiras" category="Jardineiras" products={planters} carousel />
      <CategoryShowcase categories={categoryCards} />
      <HomeProjectsGallery projects={projects} />
      <Suspense fallback={null}>
        <HomeLatestPosts />
      </Suspense>
      <HomeFaq />
    </>
  );
}
