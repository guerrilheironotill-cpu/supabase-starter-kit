import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftingCompass, Home, ChevronRight } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/paginas/")({
  head: () => ({
    meta: [{ title: "Páginas — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPaginasIndex,
});

const PAGES = [
  {
    to: "/dashboard/paginas/home" as const,
    label: "Home",
    description: "Slider principal, seções e destaques da página inicial.",
    icon: Home,
  },
  {
    to: "/projetos-personalizados" as const,
    label: "Projetos sob medida",
    description: "Página temporariamente visível apenas para administradores.",
    icon: DraftingCompass,
  },
];

function DashboardPaginasIndex() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Páginas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione uma página para editar seu conteúdo.
        </p>
      </div>

      <DashboardSection title="Páginas do site">
        <div className="grid gap-3 sm:grid-cols-2">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.to}
                to={p.to}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </DashboardSection>
    </>
  );
}
