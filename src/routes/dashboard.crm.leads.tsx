import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Upload,
  Pencil,
  Save,
  X,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/row-actions-menu";

export const Route = createFileRoute("/dashboard/crm/leads")({
  head: () => ({
    meta: [{ title: "Leads — CRM" }, { name: "robots", content: "noindex" }],
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
  contact_info?: unknown;
  client_type?: string | null;
  lead_interest?: string | null;
  professional_type?: string | null;
  cnpj?: string | null;
};

type SortKey =
  "name" | "phone" | "email" | "orders" | "list_name" | "source" | "status" | "created_at";
type SortDirection = "asc" | "desc";
type LeadOrder = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  notes?: string | null;
  created_at: string;
};

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function leadDocument(lead: LeadRow): string {
  const info = lead.contact_info;
  if (info && typeof info === "object" && !Array.isArray(info)) {
    const record = info as Record<string, unknown>;
    return digits(record.document ?? record.cpf ?? record.cnpj);
  }
  if (typeof info === "string") {
    try {
      const record = JSON.parse(info) as Record<string, unknown>;
      return digits(record.document ?? record.cpf ?? record.cnpj);
    } catch {
      return "";
    }
  }
  return "";
}

function orderDocument(order: LeadOrder): string {
  if (!order.notes) return "";
  try {
    const meta = JSON.parse(order.notes) as Record<string, unknown>;
    return digits(meta.cpf ?? meta.cnpj);
  } catch {
    return "";
  }
}

function ordersForLead(lead: LeadRow, orders: LeadOrder[]): LeadOrder[] {
  const document = leadDocument(lead);
  const phone = digits(lead.phone);
  const email = String(lead.email ?? "")
    .trim()
    .toLowerCase();
  return orders.filter((order) => {
    const orderDoc = orderDocument(order);
    if (document && orderDoc) return document === orderDoc;
    const orderPhone = digits(order.customer_phone);
    const orderEmail = String(order.customer_email ?? "")
      .trim()
      .toLowerCase();
    return Boolean((phone && phone === orderPhone) || (email && email === orderEmail));
  });
}

function QuoteLinks({ orders }: { orders: LeadOrder[] }) {
  if (!orders.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {orders.map((order) => (
        <a
          key={order.id}
          href={`/orcamento/${order.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
          title={`Abrir orçamento de ${new Date(order.created_at).toLocaleDateString("pt-BR")}`}
        >
          #{order.id.slice(0, 6).toUpperCase()}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}
const LEAD_STATUSES = ["Novo", "Em contato", "Proposta", "Fechado", "Descartado"] as const;

function leadStatus(lead: LeadRow): string {
  const info = lead.contact_info;
  if (info && typeof info === "object" && !Array.isArray(info) && "status" in info) {
    return String((info as { status?: unknown }).status || "Novo");
  }
  if (typeof info === "string") {
    try {
      return String((JSON.parse(info) as { status?: unknown }).status || "Novo");
    } catch {
      return "Novo";
    }
  }
  return "Novo";
}

function leadProfile(lead: LeadRow): string {
  const value = lead.lead_interest || lead.client_type;
  if (value === "professional" || value === "architect") {
    const professions: Record<string, string> = {
      architect: "Arquiteto",
      landscaper: "Paisagista",
      interior_designer: "Designer de interiores",
      gardener: "Jardineiro",
      other: "Outro profissional",
    };
    return `Profissional${lead.professional_type ? ` · ${professions[lead.professional_type] || lead.professional_type}` : ""}`;
  }
  if (value === "reseller") return "Revendedor / Lojista";
  if (value === "final") return "Cliente final";
  return "Não informado";
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      className="px-3 py-3"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "opacity-40"}`} />
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Novo: "bg-blue-500/15 text-blue-700",
    "Em contato": "bg-amber-500/15 text-amber-700",
    Proposta: "bg-violet-500/15 text-violet-700",
    Fechado: "bg-emerald-500/15 text-emerald-700",
    Descartado: "bg-red-500/15 text-red-700",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.Novo}`}
    >
      {status}
    </span>
  );
}
function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<LeadRow>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("Novo");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    data: leads = [],
    isLoading,
    error,
  } = useQuery({
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

  const { data: leadOrders = [] } = useQuery({
    queryKey: ["orders-for-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as never)
        .select("id, customer_name, customer_phone, customer_email, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as LeadOrder[];
    },
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [
        l.name,
        l.phone,
        l.email,
        l.tag,
        l.list_name,
        l.source,
        l.lead_interest,
        l.client_type,
        l.professional_type,
        l.cnpj,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const sorted = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aValue =
        sortKey === "status"
          ? leadStatus(a)
          : sortKey === "orders"
            ? ordersForLead(a, leadOrders).length
            : a[sortKey];
      const bValue =
        sortKey === "status"
          ? leadStatus(b)
          : sortKey === "orders"
            ? ordersForLead(b, leadOrders).length
            : b[sortKey];
      if (sortKey === "created_at") {
        return (
          (new Date(String(aValue)).getTime() - new Date(String(bValue)).getTime()) * direction
        );
      }
      return (
        String(aValue ?? "").localeCompare(String(bValue ?? ""), "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }) * direction
      );
    });
  }, [filtered, leadOrders, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const callBulkApi = async (method: "PATCH" | "DELETE", body: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão administrativa expirada.");
    const response = await fetch("/api/admin-leads-bulk", {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error || `Erro HTTP ${response.status}`);
  };

  const updateSelectedStatus = async () => {
    if (!selected.size) return;
    setBulkSaving(true);
    try {
      await callBulkApi("PATCH", { ids: Array.from(selected), status: bulkStatus });
      toast.success(`Status atualizado em ${selected.size} lead${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["crm-leads"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBulkSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (
      !selected.size ||
      !window.confirm(`Excluir ${selected.size} lead${selected.size === 1 ? "" : "s"}?`)
    )
      return;
    setBulkSaving(true);
    try {
      await callBulkApi("DELETE", { ids: Array.from(selected) });
      toast.success(`${selected.size} lead${selected.size === 1 ? " excluído" : "s excluídos"}`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["crm-leads"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBulkSaving(false);
    }
  };

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
      void tag;
      void list_name;
      void email;
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
    try {
      await callBulkApi("DELETE", { ids: [id] });
      toast.success("Lead excluído");
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const exportCsv = () => {
    const headers = ["id", "name", "phone", "email", "tag", "list_name", "source", "created_at"];
    const rows = leads.map((l) =>
      headers
        .map((h) => {
          const v = (l as unknown as Record<string, unknown>)[h];
          if (v == null) return "";
          const s = typeof v === "string" ? v : JSON.stringify(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
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
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ",") {
            out.push(cur);
            cur = "";
          } else cur += c;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    const rows = lines
      .slice(1)
      .map((line) => {
        const cols = parseLine(line);
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const v = cols[i]?.trim();
          if (v === undefined || v === "") return;
          if (h === "id" || h === "created_at") return; // don't overwrite
          obj[h] = v;
        });
        return obj;
      })
      .filter((r) => Object.keys(r).length > 0);

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
        void tag;
        void list_name;
        void email;
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

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <span className="text-sm font-medium">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <select
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => void updateSelectedStatus()} disabled={bulkSaving}>
            Alterar status
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void deleteSelected()}
            disabled={bulkSaving}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" /> Excluir selecionados
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={bulkSaving}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os leads exibidos"
                  checked={sorted.length > 0 && sorted.every((lead) => selected.has(lead.id))}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      for (const lead of sorted) {
                        if (event.target.checked) next.add(lead.id);
                        else next.delete(lead.id);
                      }
                      return next;
                    });
                  }}
                />
              </th>
              <SortableHeader
                label="Nome"
                sortKey="name"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Telefone"
                sortKey="phone"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Email"
                sortKey="email"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <th className="px-3 py-3">Perfil</th>
              <SortableHeader
                label="Orçamentos"
                sortKey="orders"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Lista"
                sortKey="list_name"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Origem"
                sortKey="source"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Data"
                sortKey="created_at"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !error && sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum lead.
                </td>
              </tr>
            )}
            {sorted.map((l) => {
              const isEditing = editing === l.id;
              return (
                <tr
                  key={l.id}
                  className={`border-t border-border ${selected.has(l.id) ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-3 align-middle">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${l.name ?? "lead"}`}
                      checked={selected.has(l.id)}
                      onChange={(event) => {
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2">
                        <Input
                          value={String(draft.name ?? "")}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={String(draft.phone ?? "")}
                          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={String(draft.email ?? "")}
                          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs">{leadProfile(l)}</td>
                      <td className="px-3 py-2">
                        <QuoteLinks orders={ordersForLead(l, leadOrders)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={String(draft.list_name ?? "")}
                          onChange={(e) => setDraft((d) => ({ ...d, list_name: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={String(draft.source ?? "")}
                          onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={leadStatus(l)} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => void saveEdit(l.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          <Save className="h-3 w-3" /> Salvar
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="ml-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 font-medium">{l.name ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.phone ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.email ?? "—"}</td>
                      <td className="px-3 py-3 text-xs">
                        {leadProfile(l)}
                        {l.cnpj ? <div className="text-muted-foreground">CNPJ {l.cnpj}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <QuoteLinks orders={ordersForLead(l, leadOrders)} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{l.list_name ?? "—"}</td>
                      <td className="px-3 py-3 text-xs uppercase text-muted-foreground">
                        {l.source ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={leadStatus(l)} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <RowActionsMenu
                          actions={[
                            { label: "Editar lead", icon: Pencil, onClick: () => startEdit(l) },
                            {
                              label: "Excluir lead",
                              icon: Trash2,
                              destructive: true,
                              onClick: () => void removeLead(l.id),
                            },
                          ]}
                        />
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
