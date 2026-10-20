import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PROJECTS_PUBLIC } from "@/lib/feature-flags";
import { useIsAdmin } from "@/lib/use-is-admin";

import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { absoluteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/projetos/")({
  head: () => ({
    meta: [
      { title: "Projetos desenvolvidos — Arteno" },
      { name: "robots", content: "noindex, follow" },
      {
        name: "description",
        content: "Projetos especiais desenvolvidos pela Arteno em concreto.",
      },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/projetos") }],
  }),
  component: DevelopedProjectsPage,
});

function DevelopedProjectsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const blocked = !PROJECTS_PUBLIC && isAdmin !== true;
  useEffect(() => {
    if (!PROJECTS_PUBLIC && isAdmin === false) void navigate({ to: "/", replace: true });
  }, [isAdmin, navigate]);
  if (blocked) return null;
  return (
    <main className="bg-background text-primary">
      <PageHero
        eyebrow="Projetos"
        title="Projetos desenvolvidos"
        crumbs={[{ label: "Home", to: "/" }, { label: "Projetos desenvolvidos" }]}
      />
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8 sm:py-24">
        <h2 className="font-display text-2xl sm:text-3xl">
          Ainda não temos projetos desenvolvidos para mostrar aqui.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-primary/75">
          Esta área vai reunir as peças especiais que criamos sob encomenda. Enquanto isso, veja as
          ideias que queremos tirar do papel e converse com a gente sobre a sua.
        </p>
        <Link
          to="/projetos/ideias-para-tirar-do-papel"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          Ideias para tirar do papel
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
