import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { uploadOptimizedImage } from "@/lib/vps-media";
import { cn } from "@/lib/utils";
import { fetchProductCategoryOptions } from "@/lib/dashboard-taxonomies";
import { slugify } from "@/lib/products";
import { toast } from "sonner";

type Category = { id: string; name: string; slug: string };
type SizeRow = {
  id?: string;
  label: string;
  name: string;
  height: string;
  width: string;
  length: string;
  base_price: number;
  sale_price: number | null;
  sort_order: number;
};
type AttrRow = { id?: string; name: string; sort_order: number };

type ProductData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  images: string[];
  active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  seo_keywords: string[];
};

type Props = {
  productId: string | null;
  onClose: () => void;
  onSaved: (productId: string, slug: string) => void;
  mode?: "dialog" | "page";
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
};

function explainSaveError(error: unknown, context: string): string {
  const dbError = error && typeof error === "object" ? (error as SupabaseLikeError) : null;
  const code = dbError?.code ?? "";
  const detail = `${dbError?.message ?? ""} ${dbError?.details ?? ""}`.trim();
  const normalized = detail.toLowerCase();

  const missingColumn = detail.match(/null value in column ["']([^"']+)["']/i)?.[1];
  if (missingColumn) {
    const fieldLabels: Record<string, string> = {
      name: "Nome",
      slug: "Slug",
      category: "Categoria",
      price: "Preço normal de pelo menos um tamanho",
      origin: "Origem",
      product_id: "Produto",
      size: "Tamanho",
      finish: "Acabamento",
      color: "Cor",
    };
    const label = fieldLabels[missingColumn] ?? missingColumn;
    return `${context}: o campo obrigatório “${label}” não foi preenchido.`;
  }

  if (code === "23505" || normalized.includes("duplicate key")) {
    if (normalized.includes("slug")) {
      return `${context}: já existe um produto usando este slug. Altere o slug e tente novamente.`;
    }
    return `${context}: há um item duplicado. Remova a repetição e tente novamente.`;
  }
  if (code === "23502" || normalized.includes("not-null")) {
    return `${context}: um campo obrigatório não foi preenchido. Revise os campos marcados com *.`;
  }
  if (code === "23514" || normalized.includes("check constraint")) {
    return `${context}: um valor não é permitido. Confira medidas, preços e demais números informados.`;
  }
  if (
    code === "42501" ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security")
  ) {
    return `${context}: seu usuário não tem permissão para realizar esta operação. Entre novamente como administrador.`;
  }
  if (code === "22P02") {
    return `${context}: um dos valores está em formato inválido.`;
  }
  if (detail) return `${context}: ${detail}`;
  return `${context}: o banco não informou a causa. Recarregue a página e tente novamente.`;
}

function isMissingSeoColumnError(error: SupabaseLikeError | null): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("meta_title") ||
    message.includes("meta_description") ||
    message.includes("seo_keywords") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function normalizeProduct(row: Partial<ProductData> & { images?: string[] | null }): ProductData {
  return {
    id: row.id ?? "",
    slug: row.slug ?? "",
    name: row.name ?? "",
    description: row.description ?? null,
    category: row.category ?? "",
    images: row.images ?? [],
    active: row.active ?? true,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
    seo_keywords: row.seo_keywords ?? [],
  };
}

function parseSizeDimensions(value: string | null | undefined) {
  const match = value?.match(
    /(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
  );
  return {
    height: match?.[1]?.replace(",", ".") ?? "",
    width: match?.[2]?.replace(",", ".") ?? "",
    length: match?.[3]?.replace(",", ".") ?? "",
  };
}

function sizeName(row: SizeRow) {
  const dimensions =
    !row.height && !row.width && !row.length
      ? row.name.split("|").slice(-1)[0].trim()
      : `${row.height || 0}x${row.width || 0}x${row.length || 0}cm`;
  return row.label.trim() ? `${row.label.trim()} | ${dimensions}` : dimensions;
}

function storedSizeLabel(value: string) {
  return value.includes("|") ? value.split("|")[0].trim() : "";
}

const KEYWORD_SIMILARITY_LIMIT = 0.85;

function normalizeKeyword(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function keywordSimilarity(left: string, right: string) {
  const a = normalizeKeyword(left);
  const b = normalizeKeyword(right);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

const sizesSignature = (rows: SizeRow[]) =>
  JSON.stringify(
    rows.map((row) => ({
      name: sizeName(row),
      base_price: row.base_price,
      sale_price: row.sale_price,
    })),
  );

const attributesSignature = (rows: AttrRow[]) => JSON.stringify(rows.map((row) => row.name));

async function fetchEditableProduct(productId: string): Promise<ProductData> {
  const withSeo = await supabase
    .from("products")
    .select(
      "id, slug, name, description, category, images, active, meta_title, meta_description, seo_keywords",
    )
    .eq("id", productId)
    .maybeSingle();

  if (!withSeo.error) {
    if (!withSeo.data) throw new Error("Produto não encontrado.");
    return normalizeProduct(withSeo.data as Partial<ProductData> & { images?: string[] | null });
  }

  if (!isMissingSeoColumnError(withSeo.error)) throw withSeo.error;

  const fallback = await supabase
    .from("products")
    .select("id, slug, name, description, category, images, active")
    .eq("id", productId)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  if (!fallback.data) throw new Error("Produto não encontrado.");
  return normalizeProduct(fallback.data as Partial<ProductData> & { images?: string[] | null });
}

export function ProductEditorDialog({ productId, onClose, onSaved, mode = "dialog" }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"basic" | "images" | "sizes" | "finishes" | "colors" | "seo">(
    "basic",
  );

  const [product, setProduct] = useState<ProductData | null>(null);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [finishes, setFinishes] = useState<AttrRow[]>([]);
  const [colors, setColors] = useState<AttrRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const initialSizes = useRef("");
  const initialFinishes = useRef("");
  const initialColors = useRef("");
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  const editorSignature = JSON.stringify({ product, sizes, finishes, colors });

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!productId) {
          const cats = await fetchProductCategoryOptions();
          if (cancel) return;
          setCategories(cats as Category[]);
          setProduct(normalizeProduct({ category: cats[0]?.name ?? "", active: true }));
          initialSizes.current = sizesSignature([]);
          initialFinishes.current = attributesSignature([]);
          initialColors.current = attributesSignature([]);
          return;
        }
        const [p, s, f, c, cats] = await Promise.all([
          fetchEditableProduct(productId),
          supabase
            .from("product_sizes")
            .select("*")
            .eq("product_id", productId)
            .order("sort_order"),
          supabase
            .from("product_finishes")
            .select("*")
            .eq("product_id", productId)
            .order("sort_order"),
          supabase
            .from("product_colors")
            .select("*")
            .eq("product_id", productId)
            .order("sort_order"),
          fetchProductCategoryOptions(),
        ]);
        if (cancel) return;
        setProduct(p);
        const loadedSizes = (
          (s.data ?? []) as Array<{
            id: string;
            size: string;
            name?: string;
            base_price: number;
            sale_price: number | null;
            sort_order: number;
          }>
        ).map((x, index, all) => {
          const name = x.name ?? x.size ?? "";
          return {
            id: x.id,
            label:
              storedSizeLabel(name) ||
              (all.length === 1
                ? "Único"
                : (["P", "M", "G", "GG", "XG", "XXG"][index] ?? String(index + 1))),
            name,
            ...parseSizeDimensions(name),
            base_price: x.base_price ?? 0,
            sale_price: x.sale_price ?? null,
            sort_order: x.sort_order ?? 0,
          };
        });
        const loadedFinishes = (
          (f.data ?? []) as Array<{ id: string; finish: string; name?: string; sort_order: number }>
        ).map((x) => ({ id: x.id, name: x.name ?? x.finish ?? "", sort_order: x.sort_order ?? 0 }));
        const loadedColors = (
          (c.data ?? []) as Array<{ id: string; color: string; name?: string; sort_order: number }>
        ).map((x) => ({ id: x.id, name: x.name ?? x.color ?? "", sort_order: x.sort_order ?? 0 }));
        setSizes(loadedSizes);
        setFinishes(loadedFinishes);
        setColors(loadedColors);
        initialSizes.current = sizesSignature(loadedSizes);
        initialFinishes.current = attributesSignature(loadedFinishes);
        initialColors.current = attributesSignature(loadedColors);
        setCategories(cats as Category[]);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Falha ao carregar");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [productId]);

  async function uploadImage(file: File): Promise<string> {
    return uploadOptimizedImage(file, "products");
  }

  async function save() {
    if (!product) return;
    setSaving(true);
    setError(null);
    let newlyCreatedProductId: string | null = null;
    try {
      const name = product.name.trim();
      const slug = product.slug.trim();
      if (!name) throw new Error("Informe o nome do produto.");
      if (!slug) throw new Error("Informe o slug do produto.");
      if (!product.category) throw new Error("Selecione a categoria do produto.");
      const invalidSize = sizes.find((size) => {
        const hasAllDimensions = Boolean(size.height && size.width && size.length);
        const preservedLegacySize = Boolean(
          size.name && !size.height && !size.width && !size.length,
        );
        return !hasAllDimensions && !preservedLegacySize;
      });
      if (invalidSize) {
        throw new Error("Preencha altura, largura e comprimento de todos os tamanhos.");
      }
      const sizeWithoutLabel = sizes.find((size) => !size.label.trim());
      if (sizeWithoutLabel) {
        throw new Error("Preencha o campo Tamanho de todos os tamanhos, por exemplo P, M ou G.");
      }
      if (product.active && sizes.length === 0) {
        throw new Error("Cadastre pelo menos um tamanho com preço antes de publicar o produto.");
      }
      const invalidRegularPrice = sizes.find(
        (size) => !Number.isFinite(Number(size.base_price)) || Number(size.base_price) <= 0,
      );
      if (product.active && invalidRegularPrice) {
        throw new Error(
          "Todo tamanho de um produto publicado precisa ter preço normal maior que zero.",
        );
      }
      const invalidSalePrice = sizes.find((size) => {
        if (size.sale_price == null) return false;
        const sale = Number(size.sale_price);
        return !Number.isFinite(sale) || sale <= 0 || sale >= Number(size.base_price);
      });
      if (invalidSalePrice) {
        throw new Error("O preço promocional deve ser maior que zero e menor que o preço normal.");
      }
      const regularPrices = sizes
        .map((size) => Number(size.base_price))
        .filter((price) => Number.isFinite(price) && price >= 0);
      const legacyPrice = regularPrices.length > 0 ? Math.min(...regularPrices) : 0;
      const productPayload = {
        name,
        slug,
        description: product.description,
        category: product.category,
        images: product.images,
        image: product.images[0] ?? null,
        price: legacyPrice,
        active: product.active,
        origin: "manual",
        meta_title: product.meta_title,
        meta_description: product.meta_description,
        seo_keywords: product.seo_keywords,
      };
      let savedProductId = product.id;
      const productWrite = product.id
        ? await supabase.from("products").update(productPayload).eq("id", product.id)
        : await supabase.from("products").insert(productPayload).select("id").single();
      const pErr = productWrite.error;
      if (!product.id && productWrite.data) {
        savedProductId = productWrite.data.id;
        newlyCreatedProductId = productWrite.data.id;
      }
      if (pErr) {
        if (!isMissingSeoColumnError(pErr)) {
          throw new Error(explainSaveError(pErr, "Não foi possível salvar os dados básicos"));
        }
        const fallbackPayload = {
          name: productPayload.name,
          slug: productPayload.slug,
          description: productPayload.description,
          category: productPayload.category,
          images: productPayload.images,
          image: productPayload.image,
          price: productPayload.price,
          active: productPayload.active,
          origin: productPayload.origin,
        };
        const fallbackWrite = product.id
          ? await supabase.from("products").update(fallbackPayload).eq("id", product.id)
          : await supabase.from("products").insert(fallbackPayload).select("id").single();
        const fallbackErr = fallbackWrite.error;
        if (fallbackErr) {
          throw new Error(
            explainSaveError(fallbackErr, "Não foi possível salvar os dados básicos"),
          );
        }
        if (!product.id && fallbackWrite.data) {
          savedProductId = fallbackWrite.data.id;
          newlyCreatedProductId = fallbackWrite.data.id;
        }
      }
      if (!savedProductId) throw new Error("Não foi possível identificar o produto cadastrado.");

      const relationUpdates: Array<Promise<void>> = [];
      if (sizesSignature(sizes) !== initialSizes.current) {
        relationUpdates.push(
          replaceRows(
            "product_sizes",
            "Não foi possível salvar os tamanhos",
            savedProductId,
            sizes.map((s, i) => ({
              product_id: savedProductId,
              size: sizeName(s),
              base_price: s.base_price,
              sale_price: s.sale_price,
              sort_order: i,
            })),
          ),
        );
      }
      if (attributesSignature(finishes) !== initialFinishes.current) {
        relationUpdates.push(
          replaceRows(
            "product_finishes",
            "Não foi possível salvar os acabamentos",
            savedProductId,
            finishes.map((f, i) => ({
              product_id: savedProductId,
              finish: f.name,
              sort_order: i,
            })),
          ),
        );
      }
      if (attributesSignature(colors) !== initialColors.current) {
        relationUpdates.push(
          replaceRows(
            "product_colors",
            "Não foi possível salvar as cores",
            savedProductId,
            colors.map((c, i) => ({
              product_id: savedProductId,
              color: c.name,
              sort_order: i,
            })),
          ),
        );
      }
      await Promise.all(relationUpdates);

      initialSizes.current = sizesSignature(sizes);
      initialFinishes.current = attributesSignature(finishes);
      initialColors.current = attributesSignature(colors);
      setSavedSignature(editorSignature);

      toast.success(
        product.id
          ? `Produto "${name}" salvo com sucesso!`
          : `Produto "${name}" cadastrado com sucesso!`,
      );
      onSaved(savedProductId, slug);
      if (mode === "dialog") onClose();
    } catch (e) {
      if (newlyCreatedProductId) {
        await supabase.from("products").delete().eq("id", newlyCreatedProductId);
      }
      const msg =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Falha ao salvar o produto.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function replaceRows(
    table: "product_sizes" | "product_finishes" | "product_colors",
    context: string,
    productId: string,
    rows: Array<Record<string, unknown>>,
  ) {
    const { error: delErr } = await supabase.from(table).delete().eq("product_id", productId);
    if (delErr)
      throw new Error(explainSaveError(delErr, `${context} (remoção dos vínculos antigos)`));
    if (rows.length === 0) return;
    const { error: insErr } = await supabase.from(table).insert(rows);
    if (insErr) throw new Error(explainSaveError(insErr, context));
  }

  const editorBody = (
    <>
      {mode === "dialog" ? (
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{productId ? "Editar produto" : "Cadastrar produto"}</DialogTitle>
        </DialogHeader>
      ) : (
        <div className="border-b border-border px-6 py-5">
          <h1 className="text-xl font-semibold text-foreground">
            {productId ? "Editar produto" : "Cadastrar produto"}
          </h1>
          {product?.name && <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error && !product ? (
        <div className="space-y-4 px-6 py-8 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Fechar
          </button>
        </div>
      ) : product ? (
        <>
          <div className="flex gap-1 border-b border-border px-6 py-2 overflow-x-auto">
            {(
              [
                ["basic", "Básico"],
                ["images", `Imagens (${product.images.length})`],
                ["sizes", `Tamanhos (${sizes.length})`],
                ["finishes", `Acabamentos (${finishes.length})`],
                ["colors", `Cores (${colors.length})`],
                ["seo", "SEO"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === k
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className={cn("px-6 py-4 text-sm", mode === "dialog" && "max-h-[60vh] overflow-y-auto")}
          >
            {tab === "basic" && (
              <BasicTab product={product} setProduct={setProduct} categories={categories} />
            )}
            {tab === "images" && (
              <ImagesTab
                images={product.images}
                setImages={(imgs) => setProduct({ ...product, images: imgs })}
                uploadImage={uploadImage}
              />
            )}
            {tab === "sizes" && <SizesTab rows={sizes} setRows={setSizes} />}
            {tab === "finishes" && (
              <AttrTab
                label="Acabamento"
                rows={finishes}
                setRows={setFinishes}
                catalog="finish_catalog"
              />
            )}
            {tab === "colors" && (
              <AttrTab label="Cor" rows={colors} setRows={setColors} catalog="color_catalog" />
            )}
            {tab === "seo" && <SeoTab product={product} setProduct={setProduct} />}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
            <span className={cn("text-xs", error ? "text-destructive" : "text-emerald-600")}>
              {error || (savedSignature === editorSignature ? "Salvo" : "")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {mode === "page" ? "Voltar para produtos" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {productId ? "Salvar alterações" : "Cadastrar produto"}
              </button>
              {mode === "page" && productId && product.slug && (
                <a
                  href={`/produto/${product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Visualizar no site"
                  aria-label="Visualizar produto no site"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  if (mode === "page") {
    return (
      <div className="dark dashboard-scope overflow-hidden rounded-2xl border border-border bg-background text-foreground">
        {editorBody}
      </div>
    );
  }

  return (
    <Dialog open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dark dashboard-scope max-h-[90vh] max-w-3xl overflow-hidden bg-background p-0 text-foreground">
        {editorBody}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function BasicTab({
  product,
  setProduct,
  categories,
}: {
  product: ProductData;
  setProduct: (p: ProductData) => void;
  categories: Category[];
}) {
  return (
    <div className="space-y-3">
      <Field label="Nome *">
        <input
          className={inputCls}
          value={product.name}
          onChange={(e) => {
            const name = e.target.value;
            setProduct({
              ...product,
              name,
              slug:
                !product.slug || product.slug === slugify(product.name)
                  ? slugify(name)
                  : product.slug,
            });
          }}
        />
      </Field>
      <Field label="Slug *">
        <input
          className={inputCls}
          value={product.slug}
          onChange={(e) => setProduct({ ...product, slug: e.target.value })}
        />
      </Field>
      <Field label="Categoria *">
        <select
          className={inputCls}
          value={product.category}
          onChange={(e) => setProduct({ ...product, category: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descrição">
        <textarea
          rows={10}
          className={cn(inputCls, "resize-none")}
          value={product.description ?? ""}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
        />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={product.active}
          onChange={(e) => setProduct({ ...product, active: e.target.checked })}
        />
        Produto ativo
      </label>
    </div>
  );
}

function ImagesTab({
  images,
  setImages,
  uploadImage,
}: {
  images: string[];
  setImages: (imgs: string[]) => void;
  uploadImage: (f: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFiles(files: FileList) {
    setBusy(true);
    setErr(null);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadImage));
      setImages([...images, ...urls]);
      toast.success(`${urls.length} imagem(ns) enviada(s)!`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro no upload";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = images.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setImages(next);
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        Enviar imagens
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {images.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem imagens.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <div
              key={url + i}
              className="group relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Capa
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, k) => k !== i))}
                  className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SizesTab({ rows, setRows }: { rows: SizeRow[]; setRows: (r: SizeRow[]) => void }) {
  function update(i: number, patch: Partial<SizeRow>) {
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function duplicate(i: number) {
    const source = rows[i];
    const copy: SizeRow = {
      ...source,
      id: undefined,
      label: source.label.trim() ? `${source.label.trim()} cópia` : "",
      sort_order: i + 1,
    };
    const nextRows = [...rows];
    nextRows.splice(i + 1, 0, copy);
    setRows(nextRows.map((row, index) => ({ ...row, sort_order: index })));
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Tamanho {i + 1}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => duplicate(i)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                aria-label={`Duplicar tamanho ${i + 1}`}
                title="Duplicar tamanho"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </button>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, k) => k !== i))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-destructive hover:bg-muted"
                aria-label={`Excluir tamanho ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Tamanho *">
              <input
                type="text"
                className={inputCls}
                value={r.label}
                placeholder="Ex.: P, M, G"
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </Field>
            <Field label="Altura (cm)">
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                value={r.height}
                onChange={(e) => update(i, { height: e.target.value })}
              />
            </Field>
            <Field label="Largura (cm)">
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                value={r.width}
                onChange={(e) => update(i, { width: e.target.value })}
              />
            </Field>
            <Field label="Comprimento (cm)">
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputCls}
                value={r.length}
                onChange={(e) => update(i, { length: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Preço (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={r.base_price}
                onChange={(e) => update(i, { base_price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Preço promocional (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={r.sale_price ?? ""}
                onChange={(e) =>
                  update(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
          </div>
          {!r.height && !r.width && !r.length && r.name && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tamanho atual: {r.name}. Preencha as três medidas para padronizar.
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([
            ...rows,
            {
              label: "",
              name: "",
              height: "",
              width: "",
              length: "",
              base_price: 0,
              sale_price: null,
              sort_order: rows.length,
            },
          ])
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar tamanho
      </button>
    </div>
  );
}

function AttrTab({
  label,
  rows,
  setRows,
  catalog,
}: {
  label: string;
  rows: AttrRow[];
  setRows: (r: AttrRow[]) => void;
  catalog: "finish_catalog" | "color_catalog";
}) {
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const relation = catalog === "finish_catalog" ? "product_finishes" : "product_colors";
      const finishCol = catalog === "finish_catalog" ? "finish" : "color";
      const [catalogRows, productRows] = await Promise.all([
        supabase.from(catalog).select("name").order("name"),
        supabase.from(relation).select(finishCol).order(finishCol),
      ]);
      const names = new Map<string, string>();
      const addOption = (value: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return;
        const normalized = trimmed.toLocaleLowerCase("pt-BR");
        if (!names.has(normalized)) names.set(normalized, trimmed);
      };
      if (!catalogRows.error) {
        for (const row of (catalogRows.data ?? []) as Array<{ name: string | null }>) {
          addOption(row.name);
        }
      }
      if (!productRows.error) {
        for (const row of (productRows.data ?? []) as Array<Record<string, string | null>>) {
          const val = row[finishCol];
          addOption(val);
        }
      }
      setOptions(Array.from(names.values()).sort((a, b) => a.localeCompare(b)));
    })();
  }, [catalog]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Marque os itens disponíveis para este produto. Os desmarcados permanecem visíveis como
          excluídos.
        </p>
        <button
          type="button"
          onClick={() => setRows(options.map((name, index) => ({ name, sort_order: index })))}
          disabled={options.length > 0 && rows.length === options.length}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Selecionar todos
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = rows.some((row) => row.name === option);
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                selected ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setRows([...rows, { name: option, sort_order: rows.length }]);
                  } else {
                    setRows(rows.filter((row) => row.name !== option));
                  }
                }}
                className="h-4 w-4 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{option}</span>
                <span
                  className={cn(
                    "text-[11px]",
                    selected ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {selected ? "Disponível" : `Excluído do produto`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum {label.toLowerCase()} cadastrado.</p>
      )}
    </div>
  );
}

function SeoTab({
  product,
  setProduct,
}: {
  product: ProductData;
  setProduct: (p: ProductData) => void;
}) {
  const keywords = product.seo_keywords;
  const [keywordDraft, setKeywordDraft] = useState("");
  const [popularKeywords, setPopularKeywords] = useState<Array<{ keyword: string; count: number }>>(
    [],
  );
  const titleText = (product.meta_title || product.name).toLocaleLowerCase("pt-BR");
  const descriptionText = (product.meta_description || "").toLocaleLowerCase("pt-BR");
  const contentText = (product.description || "").toLocaleLowerCase("pt-BR");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("products").select("seo_keywords");
      if (cancelled || error) return;
      const counts = new Map<string, { keyword: string; count: number }>();
      for (const row of (data ?? []) as Array<{ seo_keywords: string[] | null }>) {
        for (const rawKeyword of row.seo_keywords ?? []) {
          const keyword = rawKeyword.trim();
          if (!keyword) continue;
          const normalized = keyword.toLocaleLowerCase("pt-BR");
          const current = counts.get(normalized);
          counts.set(normalized, {
            keyword: current?.keyword ?? keyword,
            count: (current?.count ?? 0) + 1,
          });
        }
      }
      setPopularKeywords(
        Array.from(counts.values()).sort(
          (a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword, "pt-BR"),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addKeyword(value: string) {
    const keyword = value.trim().replace(/,+$/, "").trim();
    if (!keyword || keywords.length >= 12) return;
    const normalizedKeyword = normalizeKeyword(keyword);
    const selectedMatch = keywords.find(
      (existing) => normalizeKeyword(existing) === normalizedKeyword,
    );
    if (selectedMatch) {
      toast.warning(`A palavra-chave “${selectedMatch}” já foi adicionada a este produto.`);
      return;
    }
    const catalogMatch = popularKeywords.find(
      (existing) => normalizeKeyword(existing.keyword) === normalizedKeyword,
    );
    if (catalogMatch) {
      setProduct({ ...product, seo_keywords: [...keywords, catalogMatch.keyword] });
      setKeywordDraft("");
      return;
    }
    const candidates = Array.from(
      new Set([...keywords, ...popularKeywords.map((item) => item.keyword)]),
    );
    const closest = candidates
      .map((existing) => ({ existing, similarity: keywordSimilarity(keyword, existing) }))
      .sort((a, b) => b.similarity - a.similarity)[0];
    if (closest && closest.similarity >= KEYWORD_SIMILARITY_LIMIT) {
      toast.warning(
        `Palavra-chave muito semelhante a “${closest.existing}” (${Math.round(closest.similarity * 100)}% de correspondência).`,
      );
      return;
    }
    setProduct({ ...product, seo_keywords: [...keywords, keyword] });
    setKeywordDraft("");
  }

  function removeKeyword(keyword: string) {
    setProduct({ ...product, seo_keywords: keywords.filter((item) => item !== keyword) });
  }

  const availablePopularKeywords = popularKeywords
    .filter(
      ({ keyword }) =>
        !keywords.some(
          (selected) => selected.toLocaleLowerCase("pt-BR") === keyword.toLocaleLowerCase("pt-BR"),
        ),
    )
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <Field label="Título SEO">
        <input
          className={inputCls}
          maxLength={60}
          value={product.meta_title ?? ""}
          onChange={(e) => setProduct({ ...product, meta_title: e.target.value || null })}
        />
      </Field>
      <Field label="Descrição SEO">
        <textarea
          rows={3}
          maxLength={160}
          className={cn(inputCls, "resize-none")}
          value={product.meta_description ?? ""}
          onChange={(e) => setProduct({ ...product, meta_description: e.target.value || null })}
        />
      </Field>
      <Field label="Palavras-chave de foco">
        <input
          type="text"
          className={inputCls}
          placeholder="Digite uma palavra-chave e pressione Enter"
          value={keywordDraft}
          disabled={keywords.length >= 12}
          onChange={(e) => setKeywordDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== ",") return;
            e.preventDefault();
            addKeyword(keywordDraft);
          }}
          onBlur={() => addKeyword(keywordDraft)}
        />
      </Field>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="rounded-full p-0.5 text-primary/55 hover:bg-primary/10 hover:text-primary"
                aria-label={`Remover palavra-chave ${keyword}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="self-center text-[11px] text-muted-foreground">
            {keywords.length}/12
          </span>
        </div>
      )}
      {availablePopularKeywords.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground">Palavras-chave mais usadas</p>
          <div className="flex flex-wrap gap-2">
            {availablePopularKeywords.map(({ keyword, count }) => (
              <button
                key={keyword}
                type="button"
                onClick={() => addKeyword(keyword)}
                disabled={keywords.length >= 12}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
              >
                {keyword} <span className="text-muted-foreground">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {keywords.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground">Análise das palavras-chave</p>
          {keywords.map((keyword) => {
            const normalized = keyword.toLocaleLowerCase("pt-BR");
            const locations = [
              titleText.includes(normalized) && "título",
              descriptionText.includes(normalized) && "descrição SEO",
              contentText.includes(normalized) && "conteúdo",
            ].filter(Boolean);
            return (
              <div
                key={keyword}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="font-medium text-foreground">{keyword}</span>
                <span className={locations.length ? "text-emerald-600" : "text-amber-600"}>
                  {locations.length
                    ? `Presente em: ${locations.join(", ")}`
                    : "Ainda não aparece no texto"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Use termos específicos e naturais. O Google ignora a antiga tag meta keywords; estes termos
        ajudam a alinhar título, descrição e conteúdo sem repetição artificial.
      </p>
    </div>
  );
}
