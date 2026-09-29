import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import {
  AvailableColorsSection,
  AvailableFinishesSection,
} from "@/components/available-finishes-section";
import { absoluteUrl } from "@/lib/site-config";

// A full, browsable gallery of every color and finish — linked to from the catalog PDF
// (which only has room for a name and a small photo per option) via #cores/#acabamentos.
export const Route = createFileRoute("/acabamentos-e-cores")({
  head: () => ({
    meta: [
      { title: "Cores e acabamentos — Arteno" },
      {
        name: "description",
        content:
          "Veja em detalhe todas as cores e acabamentos disponíveis para os produtos Arteno.",
      },
      { property: "og:title", content: "Cores e acabamentos — Arteno" },
      {
        property: "og:description",
        content:
          "Todas as cores e acabamentos disponíveis para os produtos Arteno, com fotos e vídeos.",
      },
      { property: "og:url", content: absoluteUrl("/acabamentos-e-cores") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/acabamentos-e-cores") }],
  }),
  component: AcabamentosECoresPage,
});

function AcabamentosECoresPage() {
  return (
    <>
      <PageHero
        title="Cores e acabamentos"
        eyebrow="Opções disponíveis"
        crumbs={[{ label: "Home", to: "/" }, { label: "Cores e acabamentos" }]}
      />
      <AvailableColorsSection showAll id="cores" />
      <AvailableFinishesSection showAll id="acabamentos" />
    </>
  );
}
