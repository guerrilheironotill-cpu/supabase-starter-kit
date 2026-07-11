import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <HeroSlider />
  );
}
