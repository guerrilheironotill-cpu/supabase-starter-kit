import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import {
  fetchProductBySlug,
  slugify,
  type ProductDetail,
  type ProductSize,
} from "@/lib/products";
import { useQuoteStore } from "@/lib/quote-store";

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
  const addItem = useQuoteStore((s) => s.addItem);

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

  function handleAdd() {
    addItem({
      id: `${p.id}`,
      name: p.name,
      slug: p.slug,
      image: images[0],
    });
  }

  return (
    <>
      <PageHero
        title={p.name}
        eyebrow={p.category}
        crumbs={[
          { label: "Home", to: "/" },
          {
            label: p.category,
            to: `/categoria/${slugify(p.category)}`,
          },
          { label: p.name },
        ]}
        image={images[0]}
      />

      <section className="bg-[#eaf3dd] py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:items-start">
          {/* Gallery — stacked, scrolls with page */}
          <div className="flex flex-col gap-4">
            {images.length > 0 ? (
              images.map((src: string, i: number) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-primary/10"
                >
                  <img
                    src={src}
                    alt={`${p.name} — imagem ${i + 1}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="aspect-square rounded-3xl bg-primary/5" />
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
                <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-primary/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-primary/5 text-xs uppercase tracking-widest text-primary/70">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Tam.</th>
                        <th className="px-3 py-2 font-semibold">Alt.</th>
                        <th className="px-3 py-2 font-semibold">Larg.</th>
                        <th className="px-3 py-2 font-semibold">Comp.</th>
                        <th className="px-3 py-2 font-semibold">Preço</th>
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
                            <td className="px-3 py-2.5 font-semibold">
                              {sizeCode(i, sizes.length)}
                            </td>
                            <td className="px-3 py-2.5">
                              {dims?.altura ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {dims?.largura ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {dims?.comprimento ?? (dims ? "—" : s.name)}
                            </td>
                            <td className="px-3 py-2.5">
                              {hasSale ? (
                                <span className="flex flex-wrap items-baseline gap-1.5">
                                  <span className="text-xs text-primary/50 line-through">
                                    {formatBRL(s.base_price)}
                                  </span>
                                  <span className="font-semibold">
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
              </div>
            )}

            {p.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-primary/80">
                {p.description}
              </p>
            )}

            <button
              type="button"
              onClick={handleAdd}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              <Check className="h-4 w-4" />
              Adicionar ao orçamento
            </button>
          </div>
        </div>
      </section>
    </>
  );
}