import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Pencil, Save, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/crm/leads")({
  head: () => ({
    meta: [
      { title: "Leads — CRM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadsPage,
});

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  items: unknown;
  source: string | null;
  tag?: string | null;
  list_name?: string | null;
  created_at: string;
};

function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<LeadRow>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as LeadRow[];
    },
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.phone, l.email, l.tag, l.list_name, l.source]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const startEdit = (l: LeadRow) => {
    setEditing(l.id);
    setDraft({
      name: l.name ?? "",
      phone: l.phone ?? "",
      email: l.email ?? "",
      tag: l.tag ?? "",
      list_name: l.list_name ?? "",
      source: l.source ?? "",
    });
  };

  const saveEdit = async (id: string) => {
    const patch = { ...draft };
    // remove keys that fail if column doesn't exist
    const attempt = async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from("leads" as never)
        .update(payload as never)
        .eq("id", id);
      return error;
    };
    let err = await attempt(patch as Record<string, unknown>);
    if (err) {
      const { tag, list_name, email, ...rest } = patch as Record<string, unknown>;
      void tag; void list_name; void email;
      err = await attempt(rest);
    }
    if (err) {
      toast.error("Erro ao salvar: " + err.message);
      return;
    }
    toast.success("Lead atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
  };

  const removeLead = async (id: string) => {
    if (!window.confirm("Excluir este lead?")) return;
    const { error } = await supabase.from("leads" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lead excluído");
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    }
  };

  const exportCsv = () => {
    const headers = ["id", "name", "phone", "email", "tag", "list_name", "source", "created_at"];
    const rows = leads.map((l) =>
      headers.map((h) => {
        const v = (l as unknown as Record<string, unknown>)[h];
        if (v == null) return "";
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error("CSV vazio");
      return;
    }
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ",") { out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cols = parseLine(line);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const v = cols[i]?.trim();
        if (v === undefined || v === "") return;
        if (h === "id" || h === "created_at") return; // don't overwrite
        obj[h] = v;
      });
      return obj;
    }).filter((r) => Object.keys(r).length > 0);

    if (rows.length === 0) {
      toast.error("Nenhum lead válido no CSV");
      return;
    }
    // Try insert with all columns; if it fails, retry stripping extras
    const attempt = async (payload: Record<string, unknown>[]) => {
      return supabase.from("leads" as never).insert(payload as never);
    };
    let { error } = await attempt(rows);
    if (error) {
      const stripped = rows.map((r) => {
        const { tag, list_name, email, ...rest } = r;
        void tag; void list_name; void email;
        return rest;
      });
      ({ error } = await attempt(stripped));
    }
    if (error) toast.error("Erro no import: " + error.message);
    else {
      toast.success(`${rows.length} leads importados`);
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    }
  };

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.length} leads no total. Edite, exporte ou importe via CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, tag, lista…"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Nome</th>
              <th className="px-3 py-3">Telefone</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Tag</th>
              <th className="px-3 py-3">Lista</th>
              <th className="px-3 py-3">Origem</th>
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {error && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-destructive">{(error as Error).message}</td></tr>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum lead.</td></tr>
            )}
            {filtered.map((l) => {
              const isEditing = editing === l.id;
              return (
                <tr key={l.id} className="border-t border-border">
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2"><Input value={String(draft.name ?? "")} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></td>
                      <td className="px-3 py-2"><Input value={String(draft.phone ?? "")} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></td>
                      <td className="px-3 py-2"><Input value={String(draft.email ?? "")} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></td>
                      <td className="px-3 py-2"><Input value={String(draft.tag ?? "")} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} /></td>
                      <td className="px-3 py-2"><Input value={String(draft.list_name ?? "")} onChange={(e) => setDraft((d) => ({ ...d, list_name: e.target.value }))} /></td>
                      <td className="px-3 py-2"><Input value={String(draft.source ?? "")} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => void saveEdit(l.id)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          <Save className="h-3 w-3" /> Salvar
                        </button>
                        <button onClick={() => setEditing(null)} className="ml-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 font-medium">{l.name ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.phone ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.email ?? "—"}</td>
                      <td className="px-3 py-3">{l.tag ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{l.tag}</span> : "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.list_name ?? "—"}</td>
                      <td className="px-3 py-3 text-xs uppercase text-muted-foreground">{l.source ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => startEdit(l)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                        <button onClick={() => void removeLead(l.id)} className="ml-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-muted">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
