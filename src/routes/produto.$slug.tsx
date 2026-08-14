import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchProductBySlug,
  productDescriptionToText,
  categorySlug,
  slugify,
  type ProductDetail,
  type ProductSize,
} from "@/lib/products";
import { ChevronLeft, ChevronRight, Download, MessageCircle, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuoteStore } from "@/lib/quote-store";
import { AdminEditBar } from "@/components/admin-edit-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProductRelatedSection } from "@/components/ProductRelatedSection";
import {
  AvailableColorsSection,
  AvailableFinishesSection,
} from "@/components/available-finishes-section";
import { openCatalogDownload } from "@/components/catalog-download-dialog";
import { absoluteUrl } from "@/lib/site-config";
import { fetchAttributeTerms } from "@/lib/dashboard-taxonomies";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductBySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.product.name} — Arteno` : "Produto — Arteno",
      },
      {
        name: "description",
        content:
          loaderData?.product.description?.slice(0, 160) ??
          "Produto de design contemporâneo para casa e jardim.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.product.name} — Arteno` : "Produto — Arteno",
      },
      {
        property: "og:image",
        content: loaderData?.product.images?.[0] ?? "",
      },
      { property: "og:type", content: "product" },
      ...(loaderData
        ? [{ property: "og:url", content: absoluteUrl(`/produto/${loaderData.product.slug}`) }]
        : []),
    ],
    links: loaderData
      ? [{ rel: "canonical", href: absoluteUrl(`/produto/${loaderData.product.slug}`) }]
      : [],
    scripts: loaderData
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify(productStructuredData(loaderData.product)),
          },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">Produto não encontrado</h1>
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

function productStructuredData(product: ProductDetail) {
  const url = absoluteUrl(`/produto/${product.slug}`);
  const images = product.images
    .filter(Boolean)
    .map((image) => (image.startsWith("http") ? image : absoluteUrl(image)));
  const description = productDescriptionToText(product.description ?? "").slice(0, 5000);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: description || undefined,
        image: images,
        category: product.category,
        brand: { "@type": "Brand", name: "Arteno" },
        url,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: product.category,
            item: absoluteUrl(`/categoria/${categorySlug(product.category)}`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: product.name,
            item: url,
          },
        ],
      },
    ],
  };
}

function parseDims(name: string): { altura: string; largura: string; comprimento: string } | null {
  // Accept formats like "50x40x30 cm" or "50 cm × 40 cm × 30 cm".
  const m = name.match(
    /(\d+(?:[.,]\d+)?)(?:\s*cm)?\s*[×x]\s*(\d+(?:[.,]\d+)?)(?:\s*cm)?\s*[×x]\s*(\d+(?:[.,]\d+)?)(?:\s*cm)?/i,
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

function storedSizeCode(size: { name?: string | null; size?: string | null }, idx: number, total: number) {
  const value = size.name ?? size.size ?? "";
  const separator = value.indexOf("|");
  return separator >= 0 ? value.slice(0, separator).trim() : sizeCode(idx, total);
}

function storedDimensions(size: { name?: string | null; size?: string | null }) {
  const value = size.name ?? size.size ?? "";
  const separator = value.indexOf("|");
  return separator >= 0 ? value.slice(separator + 1).trim() : value;
}

function GalleryImage({
  src,
  alt,
  eager,
  onOpen,
}: {
  src: string;
  alt: string;
  eager: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
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
    <button
      type="button"
      ref={ref}
      onClick={onOpen}
      className="aspect-square w-full cursor-zoom-in overflow-hidden bg-white text-left ring-1 ring-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
    </button>
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
  const images = p.images ?? [];
  const description = productDescriptionToText(p.description);

  const { data: finishCatalog = [] } = useQuery({
    queryKey: ["attribute-terms", "product_finishes"],
    queryFn: () => fetchAttributeTerms("product_finishes", "finish_catalog"),
    staleTime: 60_000,
  });
  const finishes = [...(p.product_finishes ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((finish) => ({
      ...finish,
      extra_price: finishCatalog.find((term) => term.name === finish.name)?.extra_price ?? 0,
    }));
  const colors = [...(p.product_colors ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const addItem = useQuoteStore((s) => s.addItem);
  const [selectedSizeId, setSelectedSizeId] = useState<string>(sizes[0]?.id ?? "");
  const [selectedFinish, setSelectedFinish] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [open, setOpen] = useState(false);
  const [addedOpen, setAddedOpen] = useState(false);
  const [addedDescription, setAddedDescription] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const selectedFinishExtra =
    finishes.find((finish) => finish.name === selectedFinish)?.extra_price ?? 0;

  function openProductConfiguration(sizeId: string) {
    setSelectedSizeId(sizeId);
    setSelectedFinish("");
    setSelectedColor("");
    setQty(1);
    setOpen(true);
  }
  function handleAddSelected() {
    const idx = sizes.findIndex((s) => s.id === selectedSizeId);
    const s = sizes[idx];
    if (!s) return;
    if (!selectedFinish || !selectedColor) return;
    const basePrice = s.sale_price ?? s.base_price;
    addItem({
      id: `${p.id}:${s.id}:${selectedFinish}:${selectedColor}`,
      name: p.name,
      slug: p.slug,
      image: images[0],
      quantity: qty,
      sizeLabel: storedSizeCode(s, idx, sizes.length),
      // Use the canonical name if present; otherwise fall back to the raw size value.
      dimensions: storedDimensions(s),
      finish: selectedFinish || undefined,
      color: selectedColor || undefined,
      unitPrice: basePrice + selectedFinishExtra,
      basePrice,
      availableFinishes: finishes.map((finish) => ({
        name: finish.name,
        extraPrice: finish.extra_price,
      })),
      availableColors: colors.map((color) => color.name),
    });
    setAddedDescription(
      `${p.name}, tamanho ${storedSizeCode(s, idx, sizes.length)}${selectedFinish ? `, acabamento ${selectedFinish}` : ""}`,
    );
    setOpen(false);
    setAddedOpen(true);
  }

  return (
    <>
      <AdminEditBar
        label="Editar produto"
        to="/dashboard/editar-produto/$productId"
        params={{ productId: p.id }}
      />
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
                  to="/categoria/$slug"
                  params={{ slug: slugify(p.category) }}
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
          {/* Gallery — carousel on mobile, stacked on desktop */}
          <div className="min-w-0 lg:hidden">
            <MobileGallery images={images} name={p.name} onOpen={setLightboxIndex} />
          </div>
          <div className="hidden min-w-0 flex-col gap-4 lg:flex">
            {images.length > 0 ? (
              images.map((src: string, i: number) => (
                <GalleryImage
                  key={i}
                  src={src}
                  alt={`${p.name} — imagem ${i + 1}`}
                  eager={i === 0}
                  onOpen={() => setLightboxIndex(i)}
                />
              ))
            ) : (
              <div className="aspect-square bg-primary/5" />
            )}
          </div>

          {/* Info — sticky until last image passes */}
          <div className="min-w-0 lg:sticky lg:top-24">
            <h1 className="font-display text-3xl text-primary sm:text-4xl">{p.name}</h1>

            {description && (
              <section
                className="mt-8 border-t border-primary/10 pt-6"
                aria-labelledby="product-description-title"
              >
                <h2
                  id="product-description-title"
                  className="mb-3 font-display text-xl font-semibold text-primary"
                >
                  Descrição do produto
                </h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-primary/80">
                  {description}
                </p>
              </section>
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
                        <th className="px-4 py-3 text-center">
                          <span className="sr-only">Adicionar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-primary">
                      {sizes.map((s, i) => {
                        // Use the raw size field when the name does not contain dimensions.
                        const dims = parseDims(storedDimensions(s));
                        return (
                          <tr key={s.id} className="border-t border-primary/10">
                            <td className="px-4 py-3 font-medium">{storedSizeCode(s, i, sizes.length)}</td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.altura : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.largura : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">
                              {dims ? dims.comprimento : "—"}
                            </td>
                            <td className="px-4 py-3 text-primary/80">Sob Encomenda</td>{" "}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => openProductConfiguration(s.id)}
                                className="group/add relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2f2c] text-white transition-all hover:scale-105 hover:bg-[#3a403c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a2f2c]/40"
                                aria-label={`Adicionar ${p.name}, tamanho ${storedSizeCode(s, i, sizes.length)}`}
                              >
                                <Plus className="h-4 w-4" />
                                <span
                                  role="tooltip"
                                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-[#2a2f2c] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/add:opacity-100 group-focus-visible/add:opacity-100"
                                >
                                  Adicionar ao orçamento
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Botões sempre visíveis */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={openCatalogDownload}
                className="inline-flex flex-1 items-center justify-center gap-2 bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Baixar Catálogo
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("arteno:open-whatsapp"))}
                className="inline-flex flex-1 items-center justify-center gap-2 border border-[#2a2f2c] bg-white px-5 py-3 text-sm font-medium text-[#2a2f2c] transition-colors hover:bg-[#2a2f2c] hover:text-white cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                Suporte WhatsApp
              </button>
            </div>
            <div className="mt-4 border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-primary/80">
              Para ver os preços, adicione os produtos ao orçamento pelo botão + e finalize sua
              solicitação.
            </div>
          </div>
        </div>
      </section>

      <AvailableFinishesSection availableNames={finishes.map((finish) => finish.name)} />
      <AvailableColorsSection availableNames={colors.map((color) => color.name)} />

      {p.category && (
        <ProductRelatedSection currentProductId={p.id} category={p.category} limit={8} />
      )}

      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(isOpen) => !isOpen && setLightboxIndex(null)}
      >
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden border-primary/10 bg-white p-0 text-primary sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Galeria de {p.name}</DialogTitle>
          </DialogHeader>
          {lightboxIndex !== null && images[lightboxIndex] && (
            <div className="flex max-h-[94vh] flex-col bg-white">
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-white px-4 pb-3 pt-12 sm:px-8">
                <img
                  src={images[lightboxIndex]}
                  alt={`${p.name} — imagem ${lightboxIndex + 1}`}
                  className="max-h-[72vh] max-w-full object-contain"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)
                      }
                      className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-md ring-1 ring-primary/10 hover:bg-neutral-50 sm:left-5"
                      aria-label="Imagem anterior"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
                      className="absolute right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-md ring-1 ring-primary/10 hover:bg-neutral-50 sm:right-5"
                      aria-label="Próxima imagem"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
              </div>
              <div className="border-t border-primary/10 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-display text-lg font-semibold text-primary">{p.name}</p>
                  <span className="text-xs text-primary/55">
                    {lightboxIndex + 1} / {images.length}
                  </span>
                </div>
                {images.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {images.map((url, index) => (
                      <button
                        key={url + index}
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-white transition ${index === lightboxIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                        aria-label={`Abrir imagem ${index + 1}`}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar produto</DialogTitle>
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
                    {storedSizeCode(s, i, sizes.length)} — {storedDimensions(s)}
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
                  <option value="" disabled>
                    Selecione um acabamento
                  </option>
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
                  <option value="" disabled>
                    Selecione uma cor
                  </option>
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
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
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
            <div className="w-full">
              {(!selectedFinish || !selectedColor) && (
                <p className="mb-2 text-center text-xs text-destructive">
                  Selecione o acabamento e a cor para adicionar o produto.
                </p>
              )}
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={!selectedFinish || !selectedColor}
                className="inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-4 w-4" />
                Adicionar ao pedido
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addedOpen} onOpenChange={setAddedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Produto adicionado ao orçamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {addedDescription} adicionado ao carrinho.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setAddedOpen(false)}
              className="inline-flex flex-1 items-center justify-center border border-primary/20 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
            >
              Adicionar mais produtos
            </button>
            <Link
              to="/orcamento"
              onClick={() => setAddedOpen(false)}
              className="inline-flex flex-1 items-center justify-center bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Finalizar orçamento
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MobileGallery({
  images,
  name,
  onOpen,
}: {
  images: string[];
  name: string;
  onOpen: (index: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (images.length === 0) {
    return <div className="aspect-square bg-primary/5 lg:hidden" />;
  }

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <button
            type="button"
            key={i}
            onClick={() => onOpen(i)}
            className="aspect-square w-full flex-shrink-0 cursor-zoom-in snap-center bg-white ring-1 ring-primary/10"
          >
            <img
              src={src}
              alt={`${name} — imagem ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollTo(index - 1)}
            aria-label="Imagem anterior"
            disabled={index === 0}
            className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md ring-1 ring-primary/10 transition-opacity disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(index + 1)}
            aria-label="Próxima imagem"
            disabled={index === images.length - 1}
            className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md ring-1 ring-primary/10 transition-opacity disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="mt-3 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Ir para imagem ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-primary/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
