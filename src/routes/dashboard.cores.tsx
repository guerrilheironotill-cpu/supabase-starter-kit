import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";
import { fetchAttributeTerms, type AttributeTerm } from "@/lib/dashboard-taxonomies";

export const Route = createFileRoute("/dashboard/cores")({
  head: () => ({
    meta: [
      { title: "Cores — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardColorsPage,
});

const fetchColors = (): Promise<AttributeTerm[]> =>
  fetchAttributeTerms("product_colors", "color_catalog");

function DashboardColorsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "cores"],
    queryFn: fetchColors,
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione imagem e descrição a cada cor.
        </p>
      </div>

      <DashboardSection title={`Cores (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((c) => (
              <DashboardMediaEditor
                key={c.name}
                label={c.name}
                sublabel={`${c.count} produto${c.count === 1 ? "" : "s"}`}
                imageUrl={c.image_url}
                description={c.description}
                bucketFolder="colors"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("color_catalog")
                    .upsert(
                      {
                        name: c.name,
                        image_url,
                        description: description ?? null,
                      },
                      { onConflict: "name" },
                    );
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ["dashboard", "cores"] });
                }}
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}