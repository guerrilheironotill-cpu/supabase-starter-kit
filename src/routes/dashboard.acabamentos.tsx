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
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  product_id: string;
  products: { name: string } | null;
};

async function fetchFinishes(): Promise<FinishRow[]> {
  const { data, error } = await supabase
    .from("product_finishes")
    .select("id, name, image_url, description, product_id, products(name)")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as FinishRow[];
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
                key={f.id}
                label={f.name}
                sublabel={f.products?.name ?? undefined}
                imageUrl={f.image_url}
                description={f.description}
                bucketFolder="finishes"
                onSave={async ({ image_url, description }) => {
                  const { error } = await supabase
                    .from("product_finishes")
                    .update({ image_url, description })
                    .eq("id", f.id);
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