import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadOptimizedImage, type MediaFolder } from "@/lib/vps-media";

type Props = {
  label: string;
  sublabel?: string;
  imageUrl: string | null;
  description?: string | null;
  descriptionEditable?: boolean;
  bucketFolder: MediaFolder;
  onSave: (values: { image_url: string | null; description?: string | null }) => Promise<void>;
};

export function DashboardMediaEditor({
  label,
  sublabel,
  imageUrl,
  description,
  descriptionEditable = true,
  bucketFolder,
  onSave,
}: Props) {
  const [img, setImg] = useState<string | null>(imageUrl);
  const [desc, setDesc] = useState<string>(description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      setImg(await uploadOptimizedImage(file, bucketFolder));
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        image_url: img,
        description: descriptionEditable ? desc.trim() || null : undefined,
      });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-start">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
        {img ? (
          <>
            <img src={img} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setImg(null);
                setDirty(true);
              }}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remover imagem"
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
          <p className="font-medium text-foreground">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {descriptionEditable && (
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Enviar imagem
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !dirty}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              dirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            Salvar
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    </div>
  );
}
