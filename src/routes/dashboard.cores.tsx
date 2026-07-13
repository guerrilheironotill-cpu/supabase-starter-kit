import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";

export const Route = createFileRoute("/dashboard/cores")({
  head: () => ({
    meta: [
      { title: "Cores — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardColorsPage,
});

type ColorRow = {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  product_id: string;
  products: { name: string } | null;
};

async function fetchColors(): Promise<ColorRow[]> {
  const { data, error } = await supabase
    .from("product_colors")
    .select("id, name, image_url, description, product_id, products(name)")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as ColorRow[];
}

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
                key={c.id}
                label={c.name}
                sublabel={c.products?.name ?? undefined}
                imageUrl={c.image_url}
                description={c.description}
                bucketFolder="colors"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("product_colors")
                    .update({ image_url, description })
                    .eq("id", c.id);
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