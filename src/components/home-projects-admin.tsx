import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";
import {
  fetchHomeProjects,
  fetchHomeProjectProductOptions,
  saveHomeProjects,
  uploadHomeProjectImage,
  type HomeProject,
  type HomeProjectProductOption,
} from "@/lib/home-projects";

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

export function HomeProjectsAdmin() {
  const [items, setItems] = useState<HomeProject[]>([]);
  const [products, setProducts] = useState<HomeProjectProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    void Promise.all([fetchHomeProjects(true), fetchHomeProjectProductOptions()])
      .then(([projectItems, productItems]) => { setItems(projectItems); setProducts(productItems); })
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<HomeProject>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setDirty(true);
  };
  const move = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };
  const add = () => {
    setItems((current) => [...current, { id: crypto.randomUUID(), image: "", alt: "", active: true, sortOrder: current.length }]);
    setDirty(true);
  };

  async function save() {
    const incomplete = items.find((item) => !item.image.trim() || !item.alt.trim());
    if (incomplete) {
      setMessage({ kind: "error", text: "Todas as imagens precisam de arquivo e ALT TEXT." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveHomeProjects(items);
      setItems((current) => current.map((item, index) => ({ ...item, sortOrder: index })));
      setDirty(false);
      setMessage({ kind: "ok", text: "Galeria salva e publicada." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Falha ao salvar a galeria." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardSection
      title="Home — Projetos com Arteno"
      description="Galeria vertical 9:16. As imagens são recortadas, convertidas para WebP e otimizadas automaticamente."
      action={<div className="flex gap-2"><button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"><Plus className="h-3.5 w-3.5" /> Adicionar</button><button type="button" onClick={() => void save()} disabled={!dirty || saving} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium", dirty ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar alterações</button></div>}
    >
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : items.length === 0 ? (
        <button type="button" onClick={add} className="w-full rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground hover:bg-muted/40">Nenhum projeto cadastrado. Clique para adicionar o primeiro.</button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <ProjectEditor key={item.id} item={item} products={products} index={index} total={items.length} onChange={(patch) => update(item.id, patch)} onMove={(direction) => move(index, direction)} onRemove={() => { setItems((current) => current.filter((row) => row.id !== item.id)); setDirty(true); }} />
          ))}
        </div>
      )}
      {message && <p className={cn("mt-4 text-sm", message.kind === "ok" ? "text-emerald-600" : "text-destructive")}>{message.text}</p>}
    </DashboardSection>
  );
}

function ProjectEditor({ item, products, index, total, onChange, onMove, onRemove }: { item: HomeProject; products: HomeProjectProductOption[]; index: number; total: number; onChange: (patch: Partial<HomeProject>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    setUploading(true); setError(null);
    try { onChange({ image: await uploadHomeProjectImage(file) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha no upload."); }
    finally { setUploading(false); }
  }
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Projeto {index + 1}</span><div className="flex gap-1"><button type="button" onClick={() => onChange({ active: !item.active })} className="rounded p-1.5 hover:bg-muted" title={item.active ? "Despublicar" : "Publicar"}>{item.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</button><button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1.5 hover:bg-muted disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1.5 hover:bg-muted disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={onRemove} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></div></div>
      <div className="mx-auto aspect-[9/16] max-h-72 overflow-hidden rounded-lg bg-muted">{item.image ? <img src={item.image} alt={item.alt} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">9:16</div>}</div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{item.image ? "Alterar imagem" : "Enviar imagem"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /></label>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <label className="mt-3 block text-xs font-medium text-muted-foreground">ALT TEXT *<input value={item.alt} onChange={(event) => onChange({ alt: event.target.value })} placeholder="Vaso Atenas em projeto residencial" className={`${inputClass} mt-1`} /></label>
      <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Informações futuras (opcional)</summary><div className="mt-2 grid gap-2"><label>Produto vinculado<select value={item.productUrl ?? ""} onChange={(event) => { const product = products.find((option) => `/produto/${option.slug}` === event.target.value); onChange({ productUrl: event.target.value || undefined, productName: product?.name || undefined }); }} className={`${inputClass} mt-1`}><option value="">Nenhum produto vinculado</option>{products.map((product) => <option key={product.id} value={`/produto/${product.slug}`}>{product.name}</option>)}</select></label><input value={item.location ?? ""} onChange={(event) => onChange({ location: event.target.value })} placeholder="Localização" className={inputClass} /><input value={item.category ?? ""} onChange={(event) => onChange({ category: event.target.value })} placeholder="Categoria" className={inputClass} /><input value={item.professional ?? ""} onChange={(event) => onChange({ professional: event.target.value })} placeholder="Arquiteto / paisagista" className={inputClass} /></div></details>
    </article>
  );
}
