import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-layout";
import {
  DEFAULT_SLIDES,
  fetchHeroSlides,
  saveHeroSlides,
  uploadHeroImage,
  type HeroSlide,
} from "@/lib/hero-slides";
import { cn } from "@/lib/utils";
import { HomeProjectsAdmin } from "@/components/home-projects-admin";

export const Route = createFileRoute("/dashboard/paginas/home")({
  head: () => ({
    meta: [
      { title: "Home — Páginas — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPaginasPage,
});

function DashboardPaginasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["home", "hero-slides"],
    queryFn: fetchHeroSlides,
    staleTime: 0,
  });

  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (data) setSlides(data);
  }, [data]);

  function update(i: number, patch: Partial<HeroSlide>) {
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setDirty(true);
  }
  function remove(i: number) {
    setSlides((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setSlides((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function add() {
    setSlides((prev) => [
      ...prev,
      {
        image: "",
        eyebrow: "Novo",
        title: "Título do banner",
        description: "Descrição curta do banner.",
        ctaLabel: "Saiba mais",
        ctaHref: "/",
      },
    ]);
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await saveHeroSlides(slides);
      setDirty(false);
      setOk("Alterações salvas.");
      qc.invalidateQueries({ queryKey: ["home", "hero-slides"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  function resetToDefaults() {
    setSlides(DEFAULT_SLIDES);
    setDirty(true);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Páginas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite o conteúdo das páginas do site.
          </p>
        </div>
      </div>

      <DashboardSection
        title="Home — Slider principal"
        description="Título, subtítulo, imagem de fundo e link de cada banner."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Novo slide
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                dirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Salvar alterações
            </button>
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : slides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum slide.{" "}
            <button
              type="button"
              onClick={resetToDefaults}
              className="underline hover:text-foreground"
            >
              Restaurar padrão
            </button>
            .
          </div>
        ) : (
          <div className="grid gap-4">
            {slides.map((s, i) => (
              <SlideEditor
                key={i}
                slide={s}
                index={i}
                total={slides.length}
                onChange={(p) => update(i, p)}
                onRemove={() => remove(i)}
                onMove={(d) => move(i, d)}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 text-xs">
          {error && <span className="text-destructive">{error}</span>}
          {ok && <span className="text-emerald-500">{ok}</span>}
        </div>
      </DashboardSection>
      <div className="mt-8">
        <HomeProjectsAdmin />
      </div>
    </>
  );
}

function SlideEditor({
  slide,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  slide: HeroSlide;
  index: number;
  total: number;
  onChange: (patch: Partial<HeroSlide>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadHeroImage(file);
      onChange({ image: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Slide {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label="Mover para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label="Mover para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
            aria-label="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div>
          <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
            {slide.image ? (
              <img
                src={slide.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Enviar imagem
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
                e.target.value = "";
              }}
            />
          </label>
          {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
        </div>

        <div className="grid gap-2">
          <Field label="Etiqueta (eyebrow)">
            <input
              value={slide.eyebrow}
              onChange={(e) => onChange({ eyebrow: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Título">
            <input
              value={slide.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Subtítulo / descrição">
            <textarea
              value={slide.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Texto do botão">
              <input
                value={slide.ctaLabel}
                onChange={(e) => onChange({ ctaLabel: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Link do banner">
              <input
                value={slide.ctaHref}
                onChange={(e) => onChange({ ctaHref: e.target.value })}
                placeholder="/categoria/vasos"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="URL da imagem (opcional)">
            <input
              value={slide.image}
              onChange={(e) => onChange({ image: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
