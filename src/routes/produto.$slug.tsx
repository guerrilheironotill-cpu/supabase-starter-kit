import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";
import {
  fetchProductBySlug,
  slugify,
  type ProductDetail,
  type ProductSize,
  type ProductOption,
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
  const finishes: ProductOption[] = [...(p.product_finishes ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const colors: ProductOption[] = [...(p.product_colors ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const [imgIdx, setImgIdx] = useState(0);
  const [sizeId, setSizeId] = useState<string | null>(sizes[0]?.id ?? null);
  const [finishId, setFinishId] = useState<string | null>(
    finishes[0]?.id ?? null,
  );
  const [colorId, setColorId] = useState<string | null>(colors[0]?.id ?? null);

  const selectedSize: ProductSize | null =
    sizes.find((s) => s.id === sizeId) ?? null;
  const addItem = useQuoteStore((s) => s.addItem);

  function handleAdd() {
    addItem({
      id: `${p.id}:${sizeId ?? "default"}:${finishId ?? "-"}:${colorId ?? "-"}`,
      name:
        p.name + (selectedSize ? ` — ${selectedSize.name}` : ""),
      slug: p.slug,
      image: p.images?.[0],
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
        image={p.images?.[0]}
      />

      <section className="bg-[#eaf3dd] py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-primary/10">
              {p.images?.[imgIdx] ? (
                <img
                  src={p.images[imgIdx]}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-primary/5" />
              )}
            </div>
            {p.images && p.images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {p.images.map((src: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg ring-1 transition-all",
                      i === imgIdx
                        ? "ring-2 ring-primary"
                        : "ring-primary/10 hover:ring-primary/40",
                    )}
                  >
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h1 className="font-display text-3xl text-primary sm:text-4xl">
              {p.name}
            </h1>

            {selectedSize && (
              <div className="mt-4">
                {selectedSize.sale_price !== null &&
                selectedSize.sale_price < selectedSize.base_price ? (
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-3xl text-primary">
                      {formatBRL(selectedSize.sale_price)}
                    </span>
                    <span className="text-lg text-primary/50 line-through">
                      {formatBRL(selectedSize.base_price)}
                    </span>
                  </div>
                ) : (
                  <span className="font-display text-3xl text-primary">
                    {formatBRL(selectedSize.base_price)}
                  </span>
                )}
              </div>
            )}

            {p.description && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-primary/80">
                {p.description}
              </p>
            )}

            {sizes.length > 0 && (
              <OptionGroup
                label="Tamanho"
                options={sizes.map((s) => ({ id: s.id, name: s.name }))}
                value={sizeId}
                onChange={setSizeId}
              />
            )}
            {finishes.length > 0 && (
              <OptionGroup
                label="Acabamento"
                options={finishes.map((f) => ({ id: f.id, name: f.name }))}
                value={finishId}
                onChange={setFinishId}
              />
            )}
            {colors.length > 0 && (
              <OptionGroup
                label="Cor"
                options={colors.map((c) => ({ id: c.id, name: c.name }))}
                value={colorId}
                onChange={setColorId}
              />
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

type Opt = { id: string; name: string };
function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Opt[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/20 bg-white text-primary hover:border-primary/50",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}