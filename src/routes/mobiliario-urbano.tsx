import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/mobiliario-urbano")({
  head: () => ({
    meta: [
      { title: "Mobiliário Urbano — Arteno" },
      {
        name: "description",
        content: "Mobiliário urbano Arteno para espaços públicos e projetos arquitetônicos.",
      },
      { property: "og:title", content: "Mobiliário Urbano — Arteno" },
      { property: "og:url", content: absoluteUrl("/mobiliario-urbano") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/mobiliario-urbano") }],
  }),
  component: UrbanFurniturePage,
});

function UrbanFurniturePage() {
  return (
    <main className="min-h-[60vh] bg-background pb-16 text-foreground">
      <PageHero
        title="Mobiliário Urbano"
        crumbs={[{ label: "Início", to: "/" }, { label: "Mobiliário Urbano" }]}
      />
    </main>
  );
}
