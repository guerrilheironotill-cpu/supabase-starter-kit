import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, ImageIcon, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";

export const Route = createFileRoute("/dashboard/midia")({
  head: () => ({
    meta: [
      { title: "Mídia — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MidiaPage,
});

type MediaItem = {
  url: string;
  source: string;
  productName?: string;
};

const STATIC_MEDIA: MediaItem[] = [
  {
    url: "/images/logo-arteno-header-site.svg",
    source: "Logo do site",
  },
  {
    url: "/images/sobre-arteno-vasos-concreto.webp",
    source: "Hero da home",
  },
];

function MidiaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("name, images")
        .eq("active", true);
      if (error) {
        setError(error.message);
        setItems(STATIC_MEDIA);
        setLoading(false);
        return;
      }
      const fromProducts: MediaItem[] = [];
      for (const row of (data ?? []) as { name: string; images: string[] | null }[]) {
        for (const url of row.images ?? []) {
          if (url) fromProducts.push({ url, source: "Produto", productName: row.name });
        }
      }
      const seen = new Set<string>();
      const merged = [...STATIC_MEDIA, ...fromProducts].filter((m) => {
        if (seen.has(m.url)) return false;
        seen.add(m.url);
        return true;
      });
      setItems(merged);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.url.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q) ||
        (m.productName?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <DashboardSection
      title="Biblioteca de mídia"
      description="Todas as imagens usadas no site: logo, hero e fotos dos produtos cadastrados."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, URL ou origem"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {loading ? "Carregando…" : `${filtered.length} imagem(ns)`}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Erro ao carregar produtos: {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma imagem encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m) => (
            <div
              key={m.url}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <a href={m.url} target="_blank" rel="noreferrer" className="block">
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img
                    src={m.url}
                    alt={m.productName ?? m.source}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              </a>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-foreground">
                  {m.productName ?? m.source}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{m.source}</p>
                <button
                  type="button"
                  onClick={() => copy(m.url)}
                  className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  {copied === m.url ? (
                    <>
                      <Check className="h-3 w-3" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copiar URL
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
