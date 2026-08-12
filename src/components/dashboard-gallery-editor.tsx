import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Star, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadOptimizedImage, type MediaFolder } from "@/lib/vps-media";

type Props = {
  label: string;
  editableLabel?: boolean;
  sublabel?: string;
  mainImage: string | null;
  gallery?: string[];
  description?: string | null;
  videoUrl?: string | null;
  extraPrice?: number;
  showExtraPrice?: boolean;
  showVideo?: boolean;
  showDescription?: boolean;
  showGallery?: boolean;
  maxGallery?: number;
  bucketFolder: MediaFolder;
  onSave: (values: {
    name: string;
    image_url: string | null;
    gallery?: string[];
    description?: string | null;
    video_url?: string | null;
    extra_price?: number;
  }) => Promise<void>;
};

function getSaveErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [details.message, details.details, details.hint].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );
    if (parts.length > 0) {
      const code = typeof details.code === "string" ? ` [${details.code}]` : "";
      return `${parts.join(" — ")}${code}`;
    }
  }
  return "Falha ao salvar";
}

export function DashboardGalleryEditor({
  label,
  editableLabel = false,
  sublabel,
  mainImage,
  gallery = [],
  description,
  videoUrl,
  extraPrice = 0,
  showExtraPrice = false,
  showVideo = false,
  showDescription = true,
  showGallery = false,
  maxGallery = 10,
  bucketFolder,
  onSave,
}: Props) {
  const [editName, setEditName] = useState(label);
  const [main, setMain] = useState<string | null>(mainImage);
  const [gal, setGal] = useState<string[]>(gallery);
  const [desc, setDesc] = useState<string>(description ?? "");
  const [video, setVideo] = useState<string>(videoUrl ?? "");
  const [priceExtra, setPriceExtra] = useState<number>(extraPrice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const mainInput = useRef<HTMLInputElement>(null);
  const galInput = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File): Promise<string> {
    return uploadOptimizedImage(file, bucketFolder);
  }

  async function handleMain(file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadOne(file);
      setMain(url);
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function handleGallery(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const remaining = maxGallery - gal.length;
      const arr = Array.from(files).slice(0, Math.max(0, remaining));
      const urls = await Promise.all(arr.map((f) => uploadOne(f)));
      setGal((g) => [...g, ...urls].slice(0, maxGallery));
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    setGal((g) => {
      const j = i + dir;
      if (j < 0 || j >= g.length) return g;
      const c = g.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setDirty(true);
  }

  function removeGal(i: number) {
    setGal((g) => g.filter((_, k) => k !== i));
    setDirty(true);
  }

  function promoteToMain(url: string) {
    setGal((g) => {
      const next = g.filter((u) => u !== url);
      if (main) next.unshift(main);
      return next.slice(0, maxGallery);
    });
    setMain(url);
    setDirty(true);
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const normalizedName = editName.trim();
      if (!normalizedName) throw new Error("Informe o nome.");
      await onSave({
        name: normalizedName,
        image_url: main,
        gallery: showGallery ? gal : undefined,
        description: showDescription ? desc.trim() || null : undefined,
        video_url: showVideo ? video.trim() || null : undefined,
        extra_price: showExtraPrice ? Math.max(0, Number(priceExtra) || 0) : undefined,
      });
      setDirty(false);
    } catch (e) {
      setError(getSaveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-muted">
          {main ? (
            <>
              <img src={main} alt={label} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setMain(null);
                  setDirty(true);
                }}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            {editableLabel ? (
              <input
                value={editName}
                onChange={(event) => {
                  setEditName(event.target.value);
                  setDirty(true);
                }}
                aria-label="Nome"
                className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 pr-12 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            ) : (
              <p className="font-medium text-foreground">{label}</p>
            )}
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          </div>
          {showDescription && (
            <textarea
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                setDirty(true);
              }}
              placeholder="Descrição"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          {showExtraPrice && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Acréscimo no preço (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={priceExtra}
                onChange={(event) => {
                  setPriceExtra(Math.max(0, Number(event.target.value) || 0));
                  setDirty(true);
                }}
                className="w-full max-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Use zero quando o acabamento não alterar o valor.
              </p>
            </div>
          )}
          {showVideo && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Vídeo do acabamento
              </label>
              <input
                type="url"
                value={video}
                onChange={(event) => {
                  setVideo(event.target.value);
                  setDirty(true);
                }}
                placeholder="Cole o link do Vimeo ou Google Drive"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                No Google Drive, compartilhe o arquivo como “Qualquer pessoa com o link”.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={mainInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMain(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => mainInput.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Imagem principal
            </button>
          </div>
        </div>
      </div>

      {showGallery && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Galeria ({gal.length}/{maxGallery})
            </p>
            <input
              ref={galInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleGallery(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => galInput.current?.click()}
              disabled={busy || gal.length >= maxGallery}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>
          {gal.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma imagem na galeria.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {gal.map((url, i) => (
                <div
                  key={url + i}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-1 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => promoteToMain(url)}
                        title="Definir como principal"
                        className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGal(i)}
                        title="Remover"
                        className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="rounded bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === gal.length - 1}
                        className="rounded bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-30"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !dirty}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors",
            dirty
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
