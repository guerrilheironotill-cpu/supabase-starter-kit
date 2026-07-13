import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fetchProductCategoryOptions } from "@/lib/dashboard-taxonomies";

type Category = { id: string; name: string; slug: string };
type SizeRow = { id?: string; name: string; base_price: number; sale_price: number | null; sort_order: number };
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
};

type Props = {
  productId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
};

function isMissingSeoColumnError(error: SupabaseLikeError | null): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("meta_title") ||
    message.includes("meta_description") ||
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
  };
}

async function fetchEditableProduct(productId: string): Promise<ProductData> {
  const withSeo = await supabase
    .from("products")
    .select("id, slug, name, description, category, images, active, meta_title, meta_description")
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

export function ProductEditorDialog({ productId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"basic" | "images" | "sizes" | "finishes" | "colors" | "seo">("basic");

  const [product, setProduct] = useState<ProductData | null>(null);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [finishes, setFinishes] = useState<AttrRow[]>([]);
  const [colors, setColors] = useState<AttrRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!productId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, s, f, c, cats] = await Promise.all([
          fetchEditableProduct(productId),
          supabase.from("product_sizes").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("product_finishes").select("*").eq("product_id", productId).order("sort_order"),
          supabase.from("product_colors").select("*").eq("product_id", productId).order("sort_order"),
          fetchProductCategoryOptions(),
        ]);
        if (cancel) return;
        setProduct(p);
        setSizes((s.data ?? []) as SizeRow[]);
        setFinishes(((f.data ?? []) as AttrRow[]).map((x) => ({ id: x.id, name: x.name, sort_order: x.sort_order })));
        setColors(((c.data ?? []) as AttrRow[]).map((x) => ({ id: x.id, name: x.name, sort_order: x.sort_order })));
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
    const ext = file.name.split(".").pop() || "jpg";
    const path = `products/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("catalog-media")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    return supabase.storage.from("catalog-media").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const productPayload = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        category: product.category,
        images: product.images,
        active: product.active,
        meta_title: product.meta_title,
        meta_description: product.meta_description,
      };
      const { error: pErr } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", product.id);
      if (pErr) {
        if (!isMissingSeoColumnError(pErr)) throw pErr;
        const { meta_title: _metaTitle, meta_description: _metaDescription, ...fallbackPayload } = productPayload;
        const { error: fallbackErr } = await supabase
          .from("products")
          .update(fallbackPayload)
          .eq("id", product.id);
        if (fallbackErr) throw fallbackErr;
      }

      await Promise.all([
        replaceRows("product_sizes", product.id, sizes.map((s, i) => ({
          product_id: product.id,
          name: s.name,
          base_price: s.base_price,
          sale_price: s.sale_price,
          sort_order: i,
        }))),
        replaceRows("product_finishes", product.id, finishes.map((f, i) => ({
          product_id: product.id,
          name: f.name,
          sort_order: i,
        }))),
        replaceRows("product_colors", product.id, colors.map((c, i) => ({
          product_id: product.id,
          name: c.name,
          sort_order: i,
        }))),
      ]);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function replaceRows(
    table: "product_sizes" | "product_finishes" | "product_colors",
    productId: string,
    rows: Array<Record<string, unknown>>,
  ) {
    const { error: delErr } = await supabase.from(table).delete().eq("product_id", productId);
    if (delErr) throw delErr;
    if (rows.length === 0) return;
    const { error: insErr } = await supabase.from(table).insert(rows);
    if (insErr) throw insErr;
  }

  return (
    <Dialog open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dark dashboard-scope max-h-[90vh] max-w-3xl overflow-hidden bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Editar produto</DialogTitle>
        </DialogHeader>

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

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4 text-sm">
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
                <AttrTab label="Acabamento" rows={finishes} setRows={setFinishes} catalog="finish_catalog" />
              )}
              {tab === "colors" && (
                <AttrTab label="Cor" rows={colors} setRows={setColors} catalog="color_catalog" />
              )}
              {tab === "seo" && <SeoTab product={product} setProduct={setProduct} />}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
              <span className="text-xs text-destructive">{error}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar alterações
                </button>
              </div>
            </div>
          </>
        ) : null}
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
      <Field label="Nome">
        <input
          className={inputCls}
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
        />
      </Field>
      <Field label="Slug">
        <input
          className={inputCls}
          value={product.slug}
          onChange={(e) => setProduct({ ...product, slug: e.target.value })}
        />
      </Field>
      <Field label="Categoria">
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
          rows={5}
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro no upload");
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
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
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
            <div key={url + i} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
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
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2">
          <input
            placeholder="Nome"
            className={inputCls}
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Preço"
            className={inputCls}
            value={r.base_price}
            onChange={(e) => update(i, { base_price: Number(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Promo"
            className={inputCls}
            value={r.sale_price ?? ""}
            onChange={(e) =>
              update(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, k) => k !== i))}
            className="rounded-md border border-border bg-background px-2 hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([
            ...rows,
            { name: "", base_price: 0, sale_price: null, sort_order: rows.length },
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
      const [catalogRows, productRows] = await Promise.all([
        supabase.from(catalog).select("name").order("name"),
        supabase.from(relation).select("name").order("name"),
      ]);
      const names = new Set<string>();
      if (!catalogRows.error) {
        for (const row of (catalogRows.data ?? []) as Array<{ name: string | null }>) {
          if (row.name) names.add(row.name);
        }
      }
      if (!productRows.error) {
        for (const row of (productRows.data ?? []) as Array<{ name: string | null }>) {
          if (row.name) names.add(row.name);
        }
      }
      setOptions(Array.from(names).sort((a, b) => a.localeCompare(b)));
    })();
  }, [catalog]);

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input
            list={`${catalog}-opts`}
            className={inputCls}
            placeholder={label}
            value={r.name}
            onChange={(e) =>
              setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, k) => k !== i))}
            className="rounded-md border border-border bg-background px-2 hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <datalist id={`${catalog}-opts`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => setRows([...rows, { name: "", sort_order: rows.length }])}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar {label.toLowerCase()}
      </button>
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
  return (
    <div className="space-y-3">
      <Field label="Meta title">
        <input
          className={inputCls}
          maxLength={60}
          value={product.meta_title ?? ""}
          onChange={(e) => setProduct({ ...product, meta_title: e.target.value || null })}
        />
      </Field>
      <Field label="Meta description">
        <textarea
          rows={3}
          maxLength={160}
          className={cn(inputCls, "resize-none")}
          value={product.meta_description ?? ""}
          onChange={(e) => setProduct({ ...product, meta_description: e.target.value || null })}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Sem preenchimento, o nome e a descrição do produto são usados.
      </p>
    </div>
  );
}