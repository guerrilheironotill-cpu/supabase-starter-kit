import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardMediaEditor } from "@/components/dashboard-media-editor";

export const Route = createFileRoute("/dashboard/acabamentos")({
  head: () => ({
    meta: [
      { title: "Acabamentos — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardFinishesPage,
});

type FinishRow = {
  name: string;
  image_url: string | null;
  description: string | null;
  count: number;
};

async function fetchFinishes(): Promise<FinishRow[]> {
  const { data, error } = await supabase
    .from("product_finishes")
    .select("name, image_url, description")
    .order("name");
  if (error) throw error;
  const map = new Map<string, FinishRow>();
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

function DashboardFinishesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "acabamentos"],
    queryFn: fetchFinishes,
    staleTime: 30_000,
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Acabamentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione imagem e descrição a cada acabamento.
        </p>
      </div>

      <DashboardSection title={`Acabamentos (${data.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acabamento cadastrado.</p>
        ) : (
          <div className="grid gap-3">
            {data.map((f) => (
              <DashboardMediaEditor
                key={f.name}
                label={f.name}
                sublabel={`${f.count} produto${f.count === 1 ? "" : "s"}`}
                imageUrl={f.image_url}
                description={f.description}
                bucketFolder="finishes"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("product_finishes")
                    .update({ image_url, description })
                    .eq("name", f.name);
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ["dashboard", "acabamentos"] });
                }}
              />
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}