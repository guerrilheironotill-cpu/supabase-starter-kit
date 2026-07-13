import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";
import { slugify } from "@/lib/products";

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
  slug: string;
  name: string;
  cover_image: string | null;
};

async function fetchCategories(): Promise<CategoryRow[]> {
  const [{ data: prods, error: pErr }, { data: cats, error: cErr }] = await Promise.all([
    supabase.from("products").select("category").eq("active", true),
    supabase.from("categories").select("slug, name, cover_image"),
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;

  const covers = new Map<string, string | null>();
  for (const c of cats ?? []) {
    const row = c as { slug: string; cover_image: string | null };
    covers.set(row.slug, row.cover_image);
  }

  const names = new Set<string>();
  for (const p of prods ?? []) {
    const n = (p as { category: string | null }).category;
    if (n) names.add(n);
  }

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const slug = slugify(name);
      return { slug, name, cover_image: covers.get(slug) ?? null };
    });
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
                key={c.slug}
                label={c.name}
                sublabel={`/${c.slug}`}
                imageUrl={c.cover_image}
                descriptionEditable={false}
                bucketFolder="categories"
                onSave={async ({ image_url }) => {
                  const { error } = await supabase
                    .from("categories")
                    .upsert(
                      { slug: c.slug, name: c.name, cover_image: image_url },
                      { onConflict: "slug" },
                    );
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