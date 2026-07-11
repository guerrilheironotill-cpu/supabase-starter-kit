import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { AboutSection } from "@/components/about-section";
import { Marquee } from "@/components/marquee";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <HeroSlider />
      <div className="py-10 sm:py-14">
        <Marquee tone="dark" />
      </div>
      <AboutSection />
    </>
  );
}
