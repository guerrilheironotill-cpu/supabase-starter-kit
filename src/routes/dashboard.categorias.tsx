import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";

export const Route = createFileRoute("/dashboard/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardCategoriesPage,
});

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  cover_image: string | null;
};

async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, cover_image")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

function DashboardCategoriesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "categorias"],
    queryFn: fetchCategories,
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina a imagem de capa de cada categoria.
        </p>
      </div>

      <DashboardSection title={`Categorias (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((c) => (
              <DashboardMediaEditor
                key={c.id}
                label={c.name}
                sublabel={`/${c.slug}`}
                imageUrl={c.cover_image}
                descriptionEditable={false}
                bucketFolder="categories"
                onSave={async ({ image_url }) => {
                  const { error } = await supabase
                    .from("categories")
                    .update({ cover_image: image_url })
                    .eq("id", c.id);
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ["dashboard", "categorias"] });
                }}
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}