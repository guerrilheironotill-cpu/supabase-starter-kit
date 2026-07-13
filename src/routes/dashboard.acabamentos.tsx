import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { DashboardGalleryEditor } from "@/components/dashboard-gallery-editor";

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
  gallery: string[];
  description: string | null;
  count: number;
};

async function fetchFinishes(): Promise<FinishRow[]> {
  const [{ data: pfs, error: pErr }, { data: cat, error: cErr }] = await Promise.all([
    supabase.from("product_finishes").select("name"),
    supabase.from("finish_catalog").select("name, image_url, gallery, description"),
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;
  const counts = new Map<string, number>();
  for (const r of (pfs ?? []) as Array<{ name: string }>) {
    counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  }
  const catMap = new Map<string, { image_url: string | null; gallery: string[]; description: string | null }>();
  for (const c of (cat ?? []) as Array<{
    name: string;
    image_url: string | null;
    gallery: string[] | null;
    description: string | null;
  }>) {
    catMap.set(c.name, {
      image_url: c.image_url,
      gallery: c.gallery ?? [],
      description: c.description,
    });
  }
  return Array.from(counts.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const c = catMap.get(name);
      return {
        name,
        image_url: c?.image_url ?? null,
        gallery: c?.gallery ?? [],
        description: c?.description ?? null,
        count: counts.get(name) ?? 0,
      };
    });
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
              <DashboardGalleryEditor
                key={f.name}
                label={f.name}
                sublabel={`${f.count} produto${f.count === 1 ? "" : "s"}`}
                mainImage={f.image_url}
                gallery={f.gallery}
                description={f.description}
                showGallery
                maxGallery={10}
                bucketFolder="finishes"
                onSave={async ({ image_url, gallery, description }) => {
                  const { error } = await supabase
                    .from("finish_catalog")
                    .upsert(
                      {
                        name: f.name,
                        image_url,
                        gallery: gallery ?? [],
                        description: description ?? null,
                      },
                      { onConflict: "name" },
                    );
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