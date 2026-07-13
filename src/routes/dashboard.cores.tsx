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
  name: string;
  image_url: string | null;
  description: string | null;
  count: number;
};

async function fetchColors(): Promise<ColorRow[]> {
  const { data, error } = await supabase
    .from("product_colors")
    .select("name, image_url, description")
    .order("name");
  if (error) throw error;
  const map = new Map<string, ColorRow>();
  for (const r of (data ?? []) as Array<{
    name: string;
    image_url: string | null;
    description: string | null;
  }>) {
    const cur = map.get(r.name);
    if (!cur) {
      map.set(r.name, {
        name: r.name,
        image_url: r.image_url,
        description: r.description,
        count: 1,
      });
    } else {
      cur.count += 1;
      if (!cur.image_url && r.image_url) cur.image_url = r.image_url;
      if (!cur.description && r.description) cur.description = r.description;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
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
                key={c.name}
                label={c.name}
                sublabel={`${c.count} produto${c.count === 1 ? "" : "s"}`}
                imageUrl={c.image_url}
                description={c.description}
                bucketFolder="colors"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("product_colors")
                    .update({ image_url, description })
                    .eq("name", c.name);
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