import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchProductBySlug,
  slugify,
  type ProductDetail,
  type ProductSize,
} from "@/lib/products";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuoteStore } from "@/lib/quote-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductBySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.product.name} — Casa & Jardim`
          : "Produto — Casa & Jardim",
      },
      {
        name: "description",
        content:
          loaderData?.product.description?.slice(0, 160) ??
          "Produto de design contemporâneo para casa e jardim.",
      },
      {
        property: "og:title",
        content: loaderData?.product.name ?? "Produto",
      },
      {
        property: "og:image",
        content: loaderData?.product.images?.[0] ?? "",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">
        Produto não encontrado
      </h1>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
      >
        Voltar para home
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">Erro ao carregar</h1>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  ),
  component: ProductPage,
});

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseDims(
  name: string,
): { altura: string; largura: string; comprimento: string } | null {
  const m = name.match(
    /(\d+(?:[.,]\d+)?)\s*cm\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm/i,
  );
  if (!m) return null;
  return {
    altura: `${m[1]} cm`,
    largura: `${m[2]} cm`,
    comprimento: `${m[3]} cm`,
  };
}

const SIZE_LABELS = ["P", "M", "G", "GG", "XG", "XXG"];
function sizeCode(idx: number, total: number): string {
  if (total === 1) return "Único";
  if (total <= SIZE_LABELS.length) return SIZE_LABELS[idx];
  return String(idx + 1);
}

function GalleryImage({
  src,
  alt,
  eager,
}: {
  src: string;
  alt: string;
  eager: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const elCenter = rect.top + rect.height / 2;
      const viewCenter = vh / 2;
      const distance = Math.abs(elCenter - viewCenter);
      // Full size at center; shrinks with distance, min 0.85
      const t = Math.min(1, distance / (vh / 2));
      const s = 1 - t * 0.15;
      setScale(s);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="aspect-square overflow-hidden bg-white ring-1 ring-primary/10"
      style={{
        transform: `scale(${scale})`,
        transition: "transform 120ms ease-out",
        willChange: "transform",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function ProductPage() {
  const { product: initial } = Route.useLoaderData();
  const { data: product = initial } = useQuery({
    queryKey: ["product", initial.slug],
    queryFn: () => fetchProductBySlug(initial.slug),
    initialData: initial,
    staleTime: 60_000,
  });

  const p = product as ProductDetail;
  const sizes: ProductSize[] = [...(p.product_sizes ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const effectivePrices = sizes.map((s) => s.sale_price ?? s.base_price);
  const priceMin = effectivePrices.length ? Math.min(...effectivePrices) : null;
  const priceMax = effectivePrices.length ? Math.max(...effectivePrices) : null;
  const hasDiscount = sizes.some(
    (s) => s.sale_price !== null && s.sale_price < s.base_price,
  );
  const basePrices = sizes.map((s) => s.base_price);
  const baseMin = basePrices.length ? Math.min(...basePrices) : null;
  const baseMax = basePrices.length ? Math.max(...basePrices) : null;

  const images = p.images ?? [];

  const finishes = [...(p.product_finishes ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const colors = [...(p.product_colors ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const addItem = useQuoteStore((s) => s.addItem);
  const [selectedSizeId, setSelectedSizeId] = useState<string>(
    sizes[0]?.id ?? "",
  );
  const [selectedFinish, setSelectedFinish] = useState<string>(
    finishes[0]?.name ?? "",
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    colors[0]?.name ?? "",
  );
  const [qty, setQty] = useState<number>(1);
  const [open, setOpen] = useState(false);

  function handleAddSelected() {
    const idx = sizes.findIndex((s) => s.id === selectedSizeId);
    const s = sizes[idx];
    if (!s) return;
    addItem({
      id: `${p.id}:${s.id}:${selectedFinish}:${selectedColor}`,
      name: p.name,
      slug: p.slug,
      image: images[0],
      quantity: qty,
      sizeLabel: sizeCode(idx, sizes.length),
      dimensions: s.name,
      finish: selectedFinish || undefined,
      color: selectedColor || undefined,
    });
    setOpen(false);
  }


  return (
    <>
      <section className="bg-background py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-primary/60">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link to="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <li>
                <Link
                  to={`/categoria/${slugify(p.category)}`}
                  className="hover:text-primary"
                >
                  {p.category}
                </Link>
              </li>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <li className="text-primary">{p.name}</li>
            </ol>
          </nav>
        </div>
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:items-start">
          {/* Gallery — stacked, scrolls with page */}
          <div className="flex flex-col gap-4">
            {images.length > 0 ? (
              images.map((src: string, i: number) => (
                <GalleryImage
                  key={i}
                  src={src}
                  alt={`${p.name} — imagem ${i + 1}`}
                  eager={i === 0}
                />
              ))
            ) : (
              <div className="aspect-square bg-primary/5" />
            )}
          </div>

          {/* Info — sticky until last image passes */}
          <div className="lg:sticky lg:top-24">
            <h1 className="font-display text-3xl text-primary sm:text-4xl">
              {p.name}
            </h1>

            {priceMin !== null && priceMax !== null && (
              <div className="mt-4">
                {hasDiscount && baseMin !== null && baseMax !== null && (
                  <div className="text-sm text-primary/50 line-through">
                    {baseMin === baseMax
                      ? formatBRL(baseMin)
                      : `${formatBRL(baseMin)} até ${formatBRL(baseMax)}`}
                  </div>
                )}
                <div className="font-display text-3xl text-primary">
                  {priceMin === priceMax
                    ? formatBRL(priceMin)
                    : `${formatBRL(priceMin)} até ${formatBRL(priceMax)}`}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 font-display text-lg font-semibold text-primary">
                  Tabela de tamanhos
                </h2>
                <div className="bg-white ring-1 ring-primary/10">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-primary/10 text-xs font-semibold text-primary">
                      <tr>
                        <th className="px-4 py-3">Tam.</th>
                        <th className="px-4 py-3">Alt.</th>
                        <th className="px-4 py-3">Larg.</th>
                        <th className="px-4 py-3">Comp.</th>
                        <th className="px-4 py-3">Estoque</th>
                        <th className="px-4 py-3">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="text-primary">
                      {sizes.map((s, i) => {
                        const dims = parseDims(s.name);
                        const hasSale =
                          s.sale_price !== null && s.sale_price < s.base_price;
                        return (
                          <tr
                            key={s.id}
                            className="border-t border-primary/10"
                          >
                            <td className="px-4 py-3 font-medium">
                              {sizeCode(i, sizes.length)}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.altura : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.largura : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.comprimento : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              Sob Encomenda
                            </td>
                            <td className="px-4 py-3">
                              {hasSale ? (
                                <span className="flex flex-wrap items-baseline gap-1.5">
                                  <span className="text-xs text-primary/50 line-through">
                                    {formatBRL(s.base_price)}
                                  </span>
                                  <span className="font-semibold underline">
                                    {formatBRL(s.sale_price!)}
                                  </span>
                                </span>
                              ) : (
                                <span className="font-semibold">
                                  {formatBRL(s.base_price)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar ao orçamento
                  </button>
                </div>

              </div>
            )}

            {p.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-primary/80">
                {p.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar ao orçamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Tamanho
              <select
                value={selectedSizeId}
                onChange={(e) => setSelectedSizeId(e.target.value)}
                className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {sizes.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {sizeCode(i, sizes.length)} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            {finishes.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
                Acabamento
                <select
                  value={selectedFinish}
                  onChange={(e) => setSelectedFinish(e.target.value)}
                  className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {finishes.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {colors.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
                Cor
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="border border-primary/20 bg-white px-3 py-2 text-sm font-normal text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {colors.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
              Quantidade
              <div className="inline-flex h-[38px] items-center gap-2 border border-primary/20 bg-white px-2">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center text-primary transition-colors hover:bg-primary/5"
                  aria-label="Diminuir"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="inline-flex h-7 w-7 items-center justify-center text-primary transition-colors hover:bg-primary/5"
                  aria-label="Aumentar"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={handleAddSelected}
              className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}