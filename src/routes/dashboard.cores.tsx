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
  const [{ data: pcs, error: pErr }, { data: cat, error: cErr }] = await Promise.all([
    supabase.from("product_colors").select("name"),
    supabase.from("color_catalog").select("name, image_url, description"),
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;
  const counts = new Map<string, number>();
  for (const r of (pcs ?? []) as Array<{ name: string }>) {
    counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  }
  const catMap = new Map<string, { image_url: string | null; description: string | null }>();
  for (const c of (cat ?? []) as Array<{
    name: string;
    image_url: string | null;
    description: string | null;
  }>) {
    catMap.set(c.name, { image_url: c.image_url, description: c.description });
  }
  return Array.from(counts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      image_url: catMap.get(name)?.image_url ?? null,
      description: catMap.get(name)?.description ?? null,
      count: counts.get(name) ?? 0,
    }));
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