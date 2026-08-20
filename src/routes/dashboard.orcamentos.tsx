import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Share2,
  Link as LinkIcon,
  FileDown,
  MessageCircle,
  Mail,
  Copy,
  Pencil,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardSection } from "@/components/dashboard-layout";
import { maskCnpj, maskCpf, maskPhoneBR } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ensureCustomerForApprovedQuote } from "@/lib/customer-conversion";

export const Route = createFileRoute("/dashboard/orcamentos")({
  validateSearch: (search: Record<string, unknown>) => ({
    orcamento: typeof search.orcamento === "string" ? search.orcamento : undefined,
  }),
  head: () => ({
    meta: [{ title: "Orçamentos — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardQuotesPage,
});

type OrderRow = {
  id: string;
  status: string;
  origin: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  total: number | null;
  items: unknown;
  created_at: string;
  notes?: string | null;
};

type QuoteSortKey = "id" | "customer" | "origin" | "total" | "created_at" | "status";
type SortDirection = "asc" | "desc";

type QuoteMeta = {
  freight: number;
  freightNote: string;
  deadline: string;
  payment: string;
  pix: string;
  note: string;
  address: string;
  app_order_id?: string;
  app_order_number?: number;
  personType?: "fisica" | "juridica";
  cpf?: string | null;
  cnpj?: string | null;
  companyName?: string | null;
  attribution?: Record<string, unknown> | null;
  conversionChannel?: string;
};

function parseMeta(raw: string | null | undefined): QuoteMeta {
  const empty: QuoteMeta = {
    freight: 0,
    freightNote: "",
    deadline: "",
    payment: "",
    pix: "",
    note: "",
    address: "",
  };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && "__meta" in p) {
      return {
        freight: Number(p.freight) || 0,
        freightNote: String(p.freightNote ?? ""),
        deadline: String(p.deadline ?? ""),
        payment: String(p.payment ?? ""),
        pix: String(p.pix ?? ""),
        note: String(p.note ?? ""),
        address: String(p.address ?? ""),
        app_order_id: typeof p.app_order_id === "string" ? p.app_order_id : undefined,
        app_order_number: Number.isFinite(Number(p.app_order_number))
          ? Number(p.app_order_number)
          : undefined,
        personType: p.personType === "juridica" ? "juridica" : "fisica",
        cpf: typeof p.cpf === "string" ? p.cpf : null,
        cnpj: typeof p.cnpj === "string" ? p.cnpj : null,
        companyName: typeof p.companyName === "string" ? p.companyName : null,
        attribution: p.attribution && typeof p.attribution === "object" ? p.attribution : undefined,
        conversionChannel:
          typeof p.conversionChannel === "string" ? p.conversionChannel : undefined,
      };
    }
  } catch {
    /* legacy plain-text notes */
  }
  return { ...empty, note: raw };
}

type ItemDraft = {
  kind: "catalog" | "custom";
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  size_id?: string;
  size_name?: string;
  finish?: string;
  color?: string;
  product_search?: string;
  height?: string;
  width?: string;
  length?: string;
};

type QuoteStatus = "em_aberto" | "aprovado" | "nao_aprovado";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  em_aberto: "Em aberto",
  aprovado: "Aprovado",
  nao_aprovado: "Não aprovado",
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  em_aberto: "bg-amber-500/15 text-amber-400",
  aprovado: "bg-emerald-500/15 text-emerald-400",
  nao_aprovado: "bg-red-500/15 text-red-400",
};

const STATUS_WRITE_CANDIDATES: Record<QuoteStatus, string[]> = {
  em_aberto: ["orcamento", "em_aberto", "em aberto", "aberto", "quote_pending", "open"],
  aprovado: ["aprovado", "aprovada", "approved"],
  nao_aprovado: [
    "recusado",
    "nao_aprovado",
    "não aprovado",
    "nao aprovado",
    "reprovado",
    "rejeitado",
    "quote_rejected",
    "rejected",
    "cancelado",
    "cancelled",
    "canceled",
    "declined",
    "quote_cancelled",
    "closed",
  ],
};

function normalizeQuoteStatus(status: string | null | undefined): QuoteStatus {
  const clean = String(status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  if (["aprovado", "aprovada", "quote_approved", "approved"].includes(clean)) return "aprovado";
  if (
    [
      "nao_aprovado",
      "recusado",
      "reprovado",
      "rejeitado",
      "quote_rejected",
      "rejected",
      "cancelado",
      "cancelled",
      "canceled",
      "declined",
      "quote_cancelled",
      "closed",
    ].includes(clean)
  )
    return "nao_aprovado";
  return "em_aberto";
}

const currency = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

function DashboardQuotesPage() {
  const { orcamento } = Route.useSearch();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<OrderRow | null>(null);
  const [editingSource, setEditingSource] = useState<OrderRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortKey, setSortKey] = useState<QuoteSortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deepLinkOpened, setDeepLinkOpened] = useState(false);

  const {
    data: allOrders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const { data, error } = await supabase
          .from("orders" as never)
          .select(
            "id, status, origin, customer_name, customer_phone, customer_email, total, items, created_at, notes",
          )
          .order("created_at", { ascending: false })
          .limit(200)
          .abortSignal(controller.signal);
        if (error) {
          console.warn("[orders] fetch failed:", error.message);
          throw new Error(error.message);
        }
        return (data ?? []) as unknown as OrderRow[];
      } finally {
        clearTimeout(timeout);
      }
    },
    retry: 1,
    staleTime: 30_000,
  });

  const orders = useMemo(() => {
    const filtered = allOrders.filter((o) => {
      const normalized = normalizeQuoteStatus(o.status);
      const haystack =
        `${o.customer_name} ${o.customer_email ?? ""} ${o.customer_phone ?? ""}`.toLowerCase();
      return (
        normalized !== "aprovado" &&
        (statusFilter === "all" || normalized === statusFilter) &&
        (originFilter === "all" || o.origin === originFilter) &&
        (!search || haystack.includes(search.toLowerCase()))
      );
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "total") comparison = Number(a.total ?? 0) - Number(b.total ?? 0);
      else if (sortKey === "created_at")
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "customer")
        comparison = a.customer_name.localeCompare(b.customer_name, "pt-BR");
      else if (sortKey === "status")
        comparison = normalizeQuoteStatus(a.status).localeCompare(normalizeQuoteStatus(b.status));
      else comparison = String(a[sortKey]).localeCompare(String(b[sortKey]), "pt-BR");
      return comparison * direction;
    });
  }, [allOrders, originFilter, search, sortDirection, sortKey, statusFilter]);

  function toggleSort(nextKey: QuoteSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "created_at" ? "desc" : "asc");
  }

  function editOrder(order: OrderRow) {
    setEditingSource(order);
    setDuplicateSource(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!orcamento || deepLinkOpened || allOrders.length === 0) return;
    const target = allOrders.find((order) => order.id === orcamento);
    if (!target) return;
    setEditingSource(target);
    setDuplicateSource(null);
    setOpen(true);
    setDeepLinkOpened(true);
  }, [allOrders, deepLinkOpened, orcamento]);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  async function bulkQuoteStatus(status: "em_aberto" | "nao_aprovado") {
    const ids = [...selected];
    const { error } = await supabase
      .from("orders" as never)
      .update({ status: STATUS_WRITE_CANDIDATES[status][0] } as never)
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success(`${ids.length} orçamento(s) atualizado(s)`);
  }
  async function deleteQuotes() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Excluir ${ids.length} orçamento(s)?`)) return;
    const { error } = await supabase
      .from("orders" as never)
      .delete()
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success("Orçamentos excluídos");
  }

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Orçamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orçamentos e pedidos do site, WhatsApp, Instagram e manuais.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setDuplicateSource(null);
              setEditingSource(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => {
                setDuplicateSource(null);
                setEditingSource(null);
              }}
            >
              <Plus className="h-4 w-4" /> Novo orçamento
            </Button>
          </DialogTrigger>
          <NewQuoteDialog
            key={
              editingSource
                ? `edit-${editingSource.id}`
                : duplicateSource
                  ? `duplicate-${duplicateSource.id}`
                  : "new"
            }
            duplicateSource={editingSource ?? duplicateSource}
            editMode={Boolean(editingSource)}
            onCreated={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["orders"] });
              qc.invalidateQueries({ queryKey: ["crm-leads"] });
            }}
          />
        </Dialog>
      </div>

      <DashboardSection title="Últimos orçamentos">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do cliente, e-mail ou telefone"
            className="min-w-[260px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="em_aberto">Em aberto</option>
            <option value="nao_aprovado">Não aprovado</option>
          </select>
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todas as origens</option>
            {[...new Set(allOrders.map((o) => o.origin))].map((origin) => (
              <option key={origin} value={origin}>
                {origin}
              </option>
            ))}
          </select>
        </div>
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
            <span>{selected.size} selecionado(s)</span>
            <button
              onClick={() => bulkQuoteStatus("em_aberto")}
              className="rounded border border-border bg-background px-2 py-1"
            >
              Marcar em aberto
            </button>
            <button
              onClick={() => bulkQuoteStatus("nao_aprovado")}
              className="rounded border border-border bg-background px-2 py-1"
            >
              Não aprovado
            </button>
            <button
              onClick={deleteQuotes}
              className="rounded px-2 py-1 text-destructive hover:bg-destructive/10"
            >
              Excluir
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)))
                    }
                  />
                </th>
                <SortableQuoteHeader
                  label="#"
                  column="id"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableQuoteHeader
                  label="Cliente"
                  column="customer"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableQuoteHeader
                  label="Origem"
                  column="origin"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableQuoteHeader
                  label="Total"
                  column="total"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableQuoteHeader
                  label="Data"
                  column="created_at"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableQuoteHeader
                  label="Status"
                  column="status"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-destructive">
                    Erro ao carregar orçamentos:{" "}
                    {error instanceof Error ? error.message : String(error)}
                  </td>
                </tr>
              )}
              {!isLoading && !error && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum orçamento ainda. Clique em "Novo orçamento" para criar.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => editOrder(o)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      editOrder(o);
                    }
                  }}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  aria-label={`Editar orçamento de ${o.customer_name}`}
                >
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(o.id)) next.delete(o.id);
                          else next.add(o.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">#{o.id.slice(0, 6)}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{o.customer_name}</div>
                    {o.customer_phone && (
                      <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                    <OriginBadge origin={o.origin} notes={o.notes} />
                  </td>
                  <td className="px-4 py-3">{currency(o.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{new Date(o.created_at).toLocaleDateString("pt-BR")}</div>
                    <div className="text-xs">
                      {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <StatusSelect order={o} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <ShareMenu
                      order={o}
                      onEdit={() => editOrder(o)}
                      onDuplicate={() => {
                        setEditingSource(null);
                        setDuplicateSource(o);
                        setOpen(true);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </>
  );
}

function SortableQuoteHeader({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: QuoteSortKey;
  active: QuoteSortKey;
  direction: SortDirection;
  onSort: (column: QuoteSortKey) => void;
}) {
  const selected = active === column;
  const Icon = !selected ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-4 py-3"
      aria-sort={selected ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-foreground"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${selected ? "text-primary" : "opacity-50"}`} />
      </button>
    </th>
  );
}

function StatusSelect({ order }: { order: OrderRow }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<QuoteStatus>(() => normalizeQuoteStatus(order.status));
  const [saving, setSaving] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [listInput, setListInput] = useState("Leads – Orçamentos não aprovados");

  const suggestedTags = useMemo(() => {
    const items = Array.isArray(order.items) ? (order.items as Array<{ name?: string }>) : [];
    const set = new Set<string>();
    for (const i of items) {
      const n = String(i?.name ?? "").trim();
      if (n) set.add(`Interesse em ${n.split(/\s+/).slice(0, 2).join(" ")}`);
    }
    return Array.from(set).slice(0, 6);
  }, [order.items]);

  useEffect(() => {
    setValue(normalizeQuoteStatus(order.status));
  }, [order.status]);

  const persist = async (next: QuoteStatus, extraNotes?: string) => {
    setSaving(true);
    try {
      let lastError: unknown = null;

      for (const status of STATUS_WRITE_CANDIDATES[next]) {
        const patch: Record<string, unknown> = { status };
        if (extraNotes) patch.notes = extraNotes;

        const { data, error } = await supabase
          .from("orders" as never)
          .update(patch as never)
          .eq("id", order.id)
          .select("id")
          .maybeSingle();

        if (!error && data) {
          setValue(next);
          qc.setQueryData<OrderRow[]>(["orders"], (current) =>
            current?.map((row) =>
              row.id === order.id ? { ...row, status: next, notes: extraNotes ?? row.notes } : row,
            ),
          );
          qc.invalidateQueries({ queryKey: ["orders"] });
          return true;
        }

        lastError = error ?? new Error("Nenhuma linha foi atualizada.");
        console.warn(`[orders.update:${status}]`, error?.message ?? "nenhuma linha atualizada");
      }

      throw new Error(
        (lastError as { message?: string } | null)?.message ??
          "Não foi possível atualizar o status.",
      );
    } catch (e) {
      toast.error("Erro ao atualizar status: " + (e as Error).message, {
        duration: 8000,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const rejectAsLead = async (tag: string, listName: string) => {
    setSaving(true);
    try {
      const items = Array.isArray(order.items)
        ? (order.items as Array<{
            product_id?: string | null;
            name: string;
            quantity: number;
            price: number;
          }>)
        : [];
      const leadItems = items.map((i) => ({
        id: i.product_id ?? `custom_${Math.random().toString(36).slice(2, 8)}`,
        name: i.name,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.price) || 0,
      }));

      // Try inserting with extra columns; fall back gracefully if columns don't exist.
      const basePayload: Record<string, unknown> = {
        name: order.customer_name,
        phone: order.customer_phone ?? null,
        items: leadItems,
        source: "orcamento_nao_aprovado",
      };
      const withExtras = { ...basePayload, tag, list_name: listName };
      let insertErr: { message: string } | null = null;
      let res = await supabase
        .from("leads" as never)
        .insert(withExtras as never)
        .select("id")
        .maybeSingle();
      if (res.error) {
        console.warn("[lead insert withExtras failed]", res.error);
        insertErr = res.error;
        res = await supabase
          .from("leads" as never)
          .insert(basePayload as never)
          .select("id")
          .maybeSingle();
        if (res.error) {
          console.warn("[lead insert base failed]", res.error);
          insertErr = res.error;
        } else {
          insertErr = null;
        }
      }
      if (insertErr) {
        toast.error("Erro ao cadastrar lead: " + insertErr.message, {
          duration: 10000,
        });
      } else {
        toast.success(`Lead cadastrado: ${order.customer_name} — ${tag}`);
      }
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.refetchQueries({ queryKey: ["crm-leads"] });

      // now persist the quote status
      await persist("nao_aprovado");
    } finally {
      setSaving(false);
      setTagOpen(false);
    }
  };

  const approveAndPush = async () => {
    setSaving(true);
    const fail = (step: string, err: unknown): never => {
      const msg = (err as { message?: string })?.message ?? String(err);
      console.error(`[approve:${step}]`, err);
      toast.error(`Falha ao aprovar (${step}): ${msg}`, { duration: 10000 });
      throw err;
    };
    try {
      const meta = parseMeta(order.notes);
      const items = Array.isArray(order.items)
        ? (order.items as Array<{
            product_id?: string | null;
            name: string;
            quantity: number;
            price: number;
            size_name?: string | null;
            finish?: string | null;
            color?: string | null;
            height?: number | null;
            width?: number | null;
            length?: number | null;
          }>)
        : [];
      const email = order.customer_email ?? null;
      const phone = order.customer_phone ?? null;

      // Approval is only persisted after a customer exists and can be linked.
      const customer = await ensureCustomerForApprovedQuote({
        name: order.customer_name || "Cliente",
        email,
        phone,
        address: meta.address,
        cpf: meta.cpf,
        cnpj: meta.cnpj,
      }).catch((error) => fail("garantir cliente", error));
      const customerId = customer.id;
      toast.success(
        customer.created
          ? "Cliente cadastrado e vinculado ao pedido"
          : "Cliente existente atualizado e vinculado ao pedido",
      );

      // 2) upsert app_order linked to this quote
      const subtotal = items.reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0,
      );
      const shipping = Number(meta.freight) || 0;
      const totalVal = subtotal + shipping;

      let existing: { id: string; number: number } | null = null;
      if (meta.app_order_id) {
        const { data: linked, error: qErr } = await supabase
          .from("app_orders" as never)
          .select("id, number")
          .eq("id", meta.app_order_id)
          .maybeSingle();
        if (qErr) fail("consultar pedido", qErr);
        existing = (linked as unknown as { id: string; number: number } | null) ?? null;
      }

      let newOrder: { id: string; number: number };
      if (existing) {
        const prev = existing as { id: string; number: number };
        const { error: uErr } = await supabase
          .from("app_orders" as never)
          .update({
            customer_id: customerId,
            customer_name: order.customer_name || "Cliente",
            customer_email: email,
            customer_phone: phone,
            customer_document: (meta.cpf || meta.cnpj || "").replace(/\D/g, "") || null,
            status: "pending",
            subtotal,
            shipping_total: shipping,
            total: totalVal,
            customer_note: meta.note || null,
          } as never)
          .eq("id", prev.id);
        if (uErr) fail("atualizar pedido", uErr);
        // replace items
        await supabase
          .from("app_order_items" as never)
          .delete()
          .eq("order_id", prev.id);
        newOrder = prev;
      } else {
        const { data: created, error: oErr } = await supabase
          .from("app_orders" as never)
          .insert({
            customer_id: customerId,
            customer_name: order.customer_name || "Cliente",
            customer_email: email,
            customer_phone: phone,
            customer_document: (meta.cpf || meta.cnpj || "").replace(/\D/g, "") || null,
            status: "pending",
            currency: "BRL",
            subtotal,
            shipping_total: shipping,
            total: totalVal,
            customer_note: meta.note || null,
          } as never)
          .select("id, number")
          .single();
        if (oErr) fail("criar pedido", oErr);
        newOrder = created as unknown as { id: string; number: number };
      }

      // 3) items
      if (items.length > 0) {
        const rows = items.map((i) => ({
          order_id: newOrder.id,
          product_id: i.product_id ?? null,
          name: i.name,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.price) || 0,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          meta: {
            size_name: i.size_name ?? null,
            finish: i.finish ?? null,
            color: i.color ?? null,
            height: i.height ?? null,
            width: i.width ?? null,
            length: i.length ?? null,
          },
        }));
        const { error: iErr } = await supabase
          .from("app_order_items" as never)
          .insert(rows as never);
        if (iErr) fail("inserir itens", iErr);
      }

      const { data: verifiedOrder, error: verifyError } = await supabase
        .from("app_orders" as never)
        .select("id, customer_id")
        .eq("id", newOrder.id)
        .maybeSingle();
      if (verifyError) fail("validar vínculo do cliente", verifyError);
      if (
        !(verifiedOrder as unknown as { customer_id?: string } | null)?.customer_id ||
        (verifiedOrder as unknown as { customer_id: string }).customer_id !== customerId
      ) {
        fail("validar vínculo do cliente", new Error("O pedido não ficou vinculado ao cliente."));
      }

      const nextNotes = JSON.stringify({
        __meta: 1,
        ...meta,
        app_order_id: newOrder.id,
        app_order_number: newOrder.number,
      });
      try {
        const saved = await persist("aprovado", nextNotes);
        if (!saved) return;
      } catch (e) {
        fail("atualizar status", e);
      }
      toast.success(`Pedido #${newOrder.number} criado`);
      qc.invalidateQueries({ queryKey: ["app-orders"] });
      qc.invalidateQueries({ queryKey: ["local-customers"] });
    } catch (e) {
      console.error("[approve:catch]", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          const next = normalizeQuoteStatus(v);
          const current = normalizeQuoteStatus(order.status);
          if (next === "aprovado" && current !== "aprovado") {
            void approveAndPush();
          } else if (next === "nao_aprovado" && current !== "nao_aprovado") {
            setTagInput(suggestedTags[0] ?? "");
            setTagOpen(true);
          } else {
            void persist(next);
          }
        }}
        disabled={saving}
      >
        <SelectTrigger
          className={`h-8 w-[150px] border-0 text-xs font-medium ${
            STATUS_STYLES[value] ?? "bg-muted text-muted-foreground"
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
              {k === "aprovado" ? " → Pedido" : ""}
              {k === "nao_aprovado" ? " → Lead" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={tagOpen} onOpenChange={(o) => !saving && setTagOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar como lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag de interesse</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ex: Interesse em vaso"
                className="mt-1"
              />
              {suggestedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestedTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagInput(t)}
                      className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Lista</Label>
              <Input
                value={listInput}
                onChange={(e) => setListInput(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                void rejectAsLead(tagInput.trim() || "Sem tag", listInput.trim() || "Leads")
              }
              disabled={saving || !tagInput.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareMenu({
  order,
  onEdit,
  onDuplicate,
}: {
  order: OrderRow;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const items = Array.isArray(order.items)
    ? (order.items as Array<{
        name: string;
        quantity: number;
        price: number;
        description?: string | null;
        size_name?: string | null;
        finish?: string | null;
        color?: string | null;
        height?: number | null;
        width?: number | null;
        length?: number | null;
      }>)
    : [];
  const meta = parseMeta(order.notes);
  const itemsSubtotal = items.reduce(
    (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
    0,
  );

  const summary = () => {
    const lines = [
      `Orçamento #${order.id.slice(0, 6)}`,
      `Cliente: ${order.customer_name}`,
      "",
      "Itens:",
      ...items.map(
        (i) => `• ${i.quantity}x ${i.name} — ${currency((i.price ?? 0) * (i.quantity ?? 1))}`,
      ),
      "",
      ...(meta.freight
        ? [
            `Frete: ${currency(meta.freight)}${meta.freightNote ? " (" + meta.freightNote + ")" : ""}`,
          ]
        : []),
      ...(meta.deadline ? [`Prazo de produção: ${meta.deadline}`] : []),
      ...(meta.payment ? [`Pagamento: ${meta.payment}`] : []),
      ...(meta.pix ? [`Pix (entrada): ${meta.pix}`] : []),
      "",
      `Total: ${currency(order.total)}`,
    ];
    return lines.join("\n");
  };

  const shareUrl = () => `${window.location.origin}/orcamento/${order.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const generatePdf = () => {
    const attrLine = (i: {
      size_name?: string | null;
      finish?: string | null;
      color?: string | null;
      height?: number | null;
      width?: number | null;
      length?: number | null;
    }) => {
      const parts = [
        i.size_name ? `Tamanho: ${i.size_name}` : "",
        i.finish ? `Acabamento: ${i.finish}` : "",
        i.color ? `Cor: ${i.color}` : "",
        i.height ? `Altura: ${i.height} cm` : "",
        i.width ? `Largura: ${i.width} cm` : "",
        i.length ? `Comprimento: ${i.length} cm` : "",
      ].filter(Boolean);
      return parts.length ? `<div class="muted">${parts.join(" · ")}</div>` : "";
    };
    const rows = items
      .map(
        (i) =>
          `<tr><td>${i.name}${attrLine(i)}${i.description ? `<div class="muted">${i.description}</div>` : ""}</td><td>${i.quantity}</td><td>${currency(i.price)}</td><td>${currency((i.price ?? 0) * (i.quantity ?? 1))}</td></tr>`,
      )
      .join("");
    const module = (title: string, body: string) =>
      `<section class="mod"><h2>${title}</h2><div>${body}</div></section>`;
    const clientBody = `
      <div class="row"><span>Cliente</span><b>${order.customer_name}</b></div>
      ${order.customer_phone ? `<div class="row"><span>Telefone</span><b>${order.customer_phone}</b></div>` : ""}
      ${order.customer_email ? `<div class="row"><span>E-mail</span><b>${order.customer_email}</b></div>` : ""}
      ${meta.address ? `<div class="row"><span>Endereço de entrega</span><b style="text-align:right;max-width:60%;white-space:pre-wrap;">${meta.address.replace(/</g, "&lt;")}</b></div>` : ""}
      <div class="row"><span>Data</span><b>${new Date(order.created_at).toLocaleDateString("pt-BR")}</b></div>
    `;
    const totalsBody = `
      <div class="row"><span>Subtotal</span><b>${currency(itemsSubtotal)}</b></div>
      ${meta.freight ? `<div class="row"><span>Frete${meta.freightNote ? ` <em>(${meta.freightNote})</em>` : ""}</span><b>${currency(meta.freight)}</b></div>` : ""}
      <div class="row total"><span>Total</span><b>${currency(order.total)}</b></div>
    `;
    const condBody = [
      meta.deadline
        ? `<div class="row"><span>Prazo de produção</span><b>${meta.deadline}</b></div>`
        : "",
      meta.payment
        ? `<div class="row"><span>Forma de pagamento</span><b>${meta.payment}</b></div>`
        : "",
      meta.pix
        ? `<div class="row"><span>Pix (entrada)</span><b><a href="${meta.pix}">${meta.pix}</a></b></div>`
        : "",
    ].join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Orçamento ${order.id.slice(0, 6)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 760px; margin: 0 auto; padding: 48px 32px; color: #111; background: #fff; }
  .brand { display:flex; align-items:center; justify-content:space-between; padding-bottom:20px; border-bottom:2px solid #111; margin-bottom:32px; }
  .brand .logo { font-family: Georgia, serif; font-size: 22px; letter-spacing: .02em; }
  .brand .doc { text-align:right; font-size:12px; color:#666; text-transform:uppercase; letter-spacing:.15em; }
  .brand .doc b { display:block; font-size:16px; color:#111; letter-spacing:.05em; margin-top:4px; }
  .mod { border: 1px solid #eee; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
  .mod h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .18em; color: #888; margin: 0 0 12px; font-weight: 600; }
  .row { display:flex; justify-content:space-between; padding: 6px 0; font-size: 14px; }
  .row span { color:#666; }
  .row b { color:#111; font-weight:500; }
  .row.total { border-top:1px solid #eee; margin-top:8px; padding-top:12px; font-size:18px; }
  .row.total b { font-weight:700; }
  em { font-style: normal; color:#999; font-size:12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 4px; border-bottom: 1px solid #f0f0f0; font-size: 13px; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #888; font-weight: 600; border-bottom: 1px solid #ddd; }
  th:last-child, td:last-child { text-align: right; }
  td .muted { color: #888; font-size: 12px; margin-top: 2px; }
  .foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align:center; font-size: 11px; color:#888; letter-spacing:.05em; }
  a { color: #111; text-decoration: underline; }
  @media print { .noprint { display: none; } body { padding: 24px; } }
</style></head><body>
<div style="display:flex;gap:16px;align-items:stretch;margin-bottom:0;">
  <div style="flex:1 1 50%;min-width:0;">${module("Cliente", clientBody)}</div>
  <div style="flex:1 1 50%;min-width:0;">
    <section style="height:100%;padding:18px 20px;border-radius:10px;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;text-align:right;">
      <img src="https://arteno.com.br/wp-content/uploads/2025/03/Ativo-8-e1782929111841.png" alt="" style="height:52px;width:auto;object-fit:contain;"/>
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.15em;margin-top:16px;">Orçamento<b style="display:block;font-size:18px;color:#111;letter-spacing:.05em;margin-top:4px;">#${order.id.slice(0, 6).toUpperCase()}</b></div>
    </section>
  </div>
</div>
${module("Itens", `<table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>`)}
${
  condBody
    ? `<div style="display:flex;gap:16px;align-items:stretch;"><div style="flex:1 1 50%;min-width:0;display:flex;"><section class="mod" style="flex:1;margin-bottom:0;"><h2>Condições</h2><div>${condBody}</div></section></div><div style="flex:1 1 50%;min-width:0;display:flex;"><section class="mod" style="flex:1;margin-bottom:0;"><h2>Valores</h2><div>${totalsBody}</div></section></div></div>`
    : module("Valores", totalsBody)
}
${meta.note ? module("Observações", `<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${meta.note.replace(/</g, "&lt;")}</div>`) : ""}
<div class="noprint" style="margin-top:24px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;border:1px solid #111;background:#111;color:#fff;border-radius:6px;">Salvar como PDF</button></div>
<script>setTimeout(function(){window.print();},400);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Bloqueado pelo navegador");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const sendWhatsapp = () => {
    const phone = (order.customer_phone ?? "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const text = encodeURIComponent(`${summary()}\n\n${shareUrl()}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const sendEmail = () => {
    const email = order.customer_email;
    if (!email) {
      toast.error("Cliente sem e-mail cadastrado");
      return;
    }
    const subject = encodeURIComponent(`Orçamento #${order.id.slice(0, 6)}`);
    const body = encodeURIComponent(`${summary()}\n\n${shareUrl()}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Editar orçamento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar orçamento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <LinkIcon className="mr-2 h-4 w-4" /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generatePdf}>
          <FileDown className="mr-2 h-4 w-4" /> Gerar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={sendWhatsapp}>
          <MessageCircle className="mr-2 h-4 w-4" /> Enviar por WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={sendEmail}>
          <Mail className="mr-2 h-4 w-4" /> Enviar por e-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NewQuoteDialog = NewQuoteDialogImpl;

function DimensionFields({
  item,
  onChange,
  catalogOverride = false,
}: {
  item: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  catalogOverride?: boolean;
}) {
  return (
    <fieldset className="mt-3 rounded-md border border-border bg-background/70 p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">
        {catalogOverride
          ? "Medidas específicas deste orçamento (opcional)"
          : "Tamanho do produto (opcional)"}
      </legend>
      {catalogOverride && (
        <p className="mb-2 text-xs text-muted-foreground">
          Estas medidas alteram somente este orçamento e não modificam o produto cadastrado.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Altura (cm)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={item.height ?? ""}
            onChange={(event) => onChange({ height: event.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Largura (cm)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={item.width ?? ""}
            onChange={(event) => onChange({ width: event.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Comprimento (cm)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={item.length ?? ""}
            onChange={(event) => onChange({ length: event.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}
function OriginBadge({ origin, notes }: { origin: string; notes?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    manual: { label: "Dashboard", cls: "bg-primary/15 text-primary" },
    site: { label: "Site", cls: "bg-blue-500/15 text-blue-600" },
    whatsapp: { label: "WhatsApp", cls: "bg-green-500/15 text-green-600" },
    direto: { label: "Direto", cls: "bg-slate-500/15 text-slate-500" },
    google_ads: { label: "Google Ads", cls: "bg-amber-500/15 text-amber-600" },
    google_organic: { label: "Google orgânico", cls: "bg-blue-500/15 text-blue-600" },
    bing_organic: { label: "Bing orgânico", cls: "bg-cyan-500/15 text-cyan-600" },
    instagram: { label: "Instagram", cls: "bg-pink-500/15 text-pink-600" },
    facebook: { label: "Facebook", cls: "bg-indigo-500/15 text-indigo-600" },
    redes_sociais: { label: "Redes sociais", cls: "bg-fuchsia-500/15 text-fuchsia-600" },
    referencia: { label: "Referência", cls: "bg-violet-500/15 text-violet-600" },
  };
  const key = (origin ?? "").toLowerCase();
  const info = map[key] ?? { label: origin || "—", cls: "bg-muted text-muted-foreground" };
  const attribution = parseMeta(notes).attribution;
  const details = attribution
    ? [attribution.source, attribution.medium, attribution.campaign].filter(Boolean).join(" / ")
    : "";
  return (
    <span
      title={details || info.label}
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function NewQuoteDialogImpl({
  onCreated,
  duplicateSource,
  editMode = false,
}: {
  onCreated: () => void;
  duplicateSource?: OrderRow | null;
  editMode?: boolean;
}) {
  const initialMeta = parseMeta(duplicateSource?.notes);
  const initialItems: ItemDraft[] = Array.isArray(duplicateSource?.items)
    ? (duplicateSource.items as Array<Record<string, unknown>>).map((item) => ({
        kind: item.kind === "custom" ? "custom" : "catalog",
        product_id: typeof item.product_id === "string" ? item.product_id : undefined,
        name: String(item.name ?? ""),
        description: typeof item.description === "string" ? item.description : undefined,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        size_id: typeof item.size_id === "string" ? item.size_id : undefined,
        size_name: typeof item.size_name === "string" ? item.size_name : undefined,
        finish: typeof item.finish === "string" ? item.finish : undefined,
        color: typeof item.color === "string" ? item.color : undefined,
        height: item.height == null ? "" : String(item.height),
        width: item.width == null ? "" : String(item.width),
        length: item.length == null ? "" : String(item.length),
      }))
    : [];
  const [name, setName] = useState(duplicateSource?.customer_name ?? "");
  const [phone, setPhone] = useState(duplicateSource?.customer_phone ?? "");
  const [email, setEmail] = useState(duplicateSource?.customer_email ?? "");
  const [personType, setPersonType] = useState<"fisica" | "juridica">(
    initialMeta.personType ?? "fisica",
  );
  const [cpf, setCpf] = useState(maskCpf(initialMeta.cpf ?? ""));
  const [cnpj, setCnpj] = useState(maskCnpj(initialMeta.cnpj ?? ""));
  const [companyName, setCompanyName] = useState(initialMeta.companyName ?? "");
  const [address, setAddress] = useState(initialMeta.address);
  const [notes, setNotes] = useState(initialMeta.note);
  const [freight, setFreight] = useState<number>(initialMeta.freight);
  const [freightNote, setFreightNote] = useState(initialMeta.freightNote);
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "shipping">(
    initialMeta.freight > 0 || initialMeta.address ? "shipping" : "pickup",
  );
  const [deadline, setDeadline] = useState(initialMeta.deadline);
  const [payment, setPayment] = useState(initialMeta.payment);
  const [pix, setPix] = useState(initialMeta.pix);
  const [items, setItems] = useState<ItemDraft[]>(
    initialItems.length ? initialItems : [{ kind: "custom", name: "", quantity: 1, price: 0 }],
  );
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    () => new Set(initialItems.length ? [] : [0]),
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  type ProductFull = {
    id: string;
    name: string;
    product_sizes: Array<{
      id: string;
      name: string;
      size?: string;
      base_price: number;
      sale_price: number | null;
      sort_order: number;
    }>;
    product_finishes: Array<{ id: string; name: string; sort_order: number }>;
    product_colors: Array<{ id: string; name: string; sort_order: number }>;
  };
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-quote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, product_sizes(id, name, size, base_price, sale_price, sort_order), product_finishes(id, name, sort_order), product_colors(id, name, sort_order)",
        )
        .eq("active", true)
        .order("name")
        .limit(500);
      if (error) return [] as ProductFull[];
      return (data ?? []) as ProductFull[];
    },
  });

  const itemsSubtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0),
    [items],
  );
  const total = itemsSubtotal + (Number(freight) || 0);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = (kind: "catalog" | "custom") => {
    setItems((prev) => [{ kind, name: "", quantity: 1, price: 0 }, ...prev]);
    setExpandedItems((current) => new Set([0, ...Array.from(current, (index) => index + 1)]));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setExpandedItems(
      (current) =>
        new Set(
          Array.from(current)
            .filter((index) => index !== idx)
            .map((index) => (index > idx ? index - 1 : index)),
        ),
    );
  };

  const toggleItem = (idx: number) =>
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, "");
    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (personType === "fisica" && cpfDigits.length !== 11) {
      toast.error("Informe um CPF válido (11 dígitos)");
      return;
    }
    if (personType === "juridica") {
      if (cnpjDigits.length !== 14) {
        toast.error("Informe um CNPJ válido (14 dígitos)");
        return;
      }
      if (!companyName.trim()) {
        toast.error("Informe o nome da empresa");
        return;
      }
    }
    if (items.length === 0 || items.every((i) => !i.name.trim())) {
      toast.error("Adicione ao menos um item");
      return;
    }
    setSaving(true);
    try {
      const cleanItems = items
        .filter((i) => i.name.trim())
        .map((i) => ({
          kind: i.kind,
          product_id: i.product_id ?? null,
          name: i.name,
          description: i.description ?? null,
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
          size_id: i.size_id ?? null,
          size_name: i.size_name ?? null,
          finish: i.finish ?? null,
          color: i.color ?? null,
          height: i.height?.trim() ? Number(i.height) : null,
          width: i.width?.trim() ? Number(i.width) : null,
          length: i.length?.trim() ? Number(i.length) : null,
        }));

      // 1) create a lead so it also appears in CRM (items as jsonb array — same shape as WhatsApp)
      const leadItems = cleanItems.map((i) => ({
        id: i.product_id ?? `custom_${Math.random().toString(36).slice(2, 8)}`,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
      }));
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sessão administrativa expirada.");

      if (!editMode) {
        const leadResponse = await fetch("/api/admin-leads", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            phone: phone || null,
            email: email || null,
            cpf: personType === "fisica" ? cpf : null,
            cnpj: personType === "juridica" ? cnpj : null,
            items: leadItems,
            source: "manual",
          }),
        });
        const leadResult = (await leadResponse.json()) as {
          ok?: boolean;
          error?: string;
        };
        if (!leadResponse.ok || !leadResult.ok) {
          throw new Error(
            "Não foi possível salvar o lead no CRM: " +
              (leadResult.error || `erro HTTP ${leadResponse.status}`),
          );
        }
      }

      // 2) create the order
      const metaPayload = JSON.stringify({
        __meta: 1,
        freight: Number(freight) || 0,
        freightNote,
        deadline,
        payment,
        pix,
        note: notes,
        address,
        personType,
        cpf: personType === "fisica" ? cpf : null,
        cnpj: personType === "juridica" ? cnpj : null,
        companyName: personType === "juridica" ? companyName : null,
        attribution: initialMeta.attribution,
        conversionChannel: initialMeta.conversionChannel,
      });
      const basePayload: Record<string, unknown> = {
        customer_name: name,
        customer_phone: phone || null,
        items: cleanItems,
        total,
        notes: metaPayload,
      };
      const createAttempts: Record<string, unknown>[] = [
        { ...basePayload, origin: "manual", customer_email: email || null },
        { ...basePayload, customer_email: email || null },
        { ...basePayload },
      ];
      let orderErr: { message: string } | null = null;
      let orderSaved = false;
      if (editMode && duplicateSource) {
        // Origin describes acquisition and must not change when an existing quote is edited.
        const updateAttempts: Record<string, unknown>[] = [
          { ...basePayload, customer_email: email || null },
          { ...basePayload },
        ];
        for (const payload of updateAttempts) {
          const { error } = await supabase
            .from("orders" as never)
            .update(payload as never)
            .eq("id", duplicateSource.id);
          if (!error) {
            orderErr = null;
            orderSaved = true;
            break;
          }
          orderErr = error;
          console.warn("[order update attempt]", error.message, Object.keys(payload));
        }
      } else {
        for (const status of STATUS_WRITE_CANDIDATES.em_aberto) {
          for (const payload of createAttempts) {
            const { error } = await supabase
              .from("orders" as never)
              .insert({ ...payload, status } as never);
            if (!error) {
              orderErr = null;
              orderSaved = true;
              break;
            }
            orderErr = error;
            console.warn(`[order insert attempt:${status}]`, error.message, Object.keys(payload));
          }
          if (orderSaved) break;
        }
      }
      if (!orderSaved && orderErr) throw orderErr;

      toast.success(editMode ? "Orçamento atualizado" : "Orçamento criado");
      onCreated();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : JSON.stringify(e);
      console.error(editMode ? "[edit order]" : "[new order]", e);
      toast.error(`Erro ao ${editMode ? "atualizar" : "criar"} orçamento: ${msg}`, {
        duration: 8000,
      });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {editMode
            ? "Editar orçamento"
            : duplicateSource
              ? "Duplicar orçamento"
              : "Novo orçamento"}
        </DialogTitle>
      </DialogHeader>

      <ol className="mb-2 flex items-center gap-4 border-b border-border pb-3 text-xs uppercase tracking-widest">
        {[
          { n: 1, label: "Produtos" },
          { n: 2, label: "Cliente" },
          { n: 3, label: "Entrega" },
        ].map((s) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => setStep(s.n as 1 | 2 | 3)}
                className={`flex items-center gap-2 ${
                  active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary text-primary"
                        : "border-border"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 py-2">
        {step === 2 && (
          <div>
            <Label>Tipo de pessoa *</Label>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="np-personType"
                  checked={personType === "fisica"}
                  onChange={() => setPersonType("fisica")}
                />
                Pessoa física
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="np-personType"
                  checked={personType === "juridica"}
                  onChange={() => setPersonType("juridica")}
                />
                Pessoa jurídica
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                maxLength={16}
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {personType === "fisica" ? (
              <div>
                <Label>CPF *</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  maxLength={14}
                  placeholder="000.000.000-00"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>CNPJ *</Label>
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Nome da empresa *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border border-border p-3">
            <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Entrega
            </Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="np-deliveryMode"
                  checked={deliveryMode === "pickup"}
                  onChange={() => {
                    setDeliveryMode("pickup");
                    setFreight(0);
                    setFreightNote("");
                    setAddress("");
                  }}
                />
                Retirar na fábrica
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="np-deliveryMode"
                  checked={deliveryMode === "shipping"}
                  onChange={() => setDeliveryMode("shipping")}
                />
                Frete
              </label>
            </div>

            {deliveryMode === "shipping" && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label>Endereço de entrega</Label>
                  <Textarea
                    placeholder="Rua, número, complemento, bairro, cidade/UF, CEP"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Valor do frete (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={freight}
                      onChange={(e) => setFreight(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Observação do frete</Label>
                    <Input
                      placeholder="Ex: carga e descarga inclusos"
                      value={freightNote}
                      onChange={(e) => setFreightNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Itens</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addItem("catalog")}
                >
                  + Catálogo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addItem("custom")}>
                  + Personalizado
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 ${
                    it.kind === "catalog"
                      ? "border-slate-200 bg-slate-50"
                      : "border-border bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleItem(idx)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1 text-left"
                      aria-expanded={expandedItems.has(idx)}
                    >
                      <span className="truncate font-medium text-foreground">
                        {it.name.trim() ||
                          (it.kind === "catalog"
                            ? "Novo produto do catálogo"
                            : "Novo produto personalizado")}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          expandedItems.has(idx) ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${it.name || "item"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {expandedItems.has(idx) && (
                    <>
                      <div className="mb-2 mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {it.kind === "catalog" ? "Do catálogo" : "Personalizado"}
                      </div>
                      {it.kind === "catalog" ? (
                        (() => {
                          const p = products.find((x) => x.id === it.product_id);
                          const sizes = [...(p?.product_sizes ?? [])].sort(
                            (a, b) => a.sort_order - b.sort_order,
                          );
                          const finishes = [...(p?.product_finishes ?? [])].sort(
                            (a, b) => a.sort_order - b.sort_order,
                          );
                          const colors = [...(p?.product_colors ?? [])].sort(
                            (a, b) => a.sort_order - b.sort_order,
                          );
                          const productSearch = (it.product_search ?? "")
                            .trim()
                            .toLocaleLowerCase("pt-BR");
                          const filteredProducts = productSearch
                            ? products.filter((product) =>
                                product.name.toLocaleLowerCase("pt-BR").includes(productSearch),
                              )
                            : products;
                          return (
                            <div className="space-y-2">
                              <div className="relative">
                                <Label className="text-xs">Buscar produto por nome</Label>
                                <Input
                                  type="search"
                                  autoComplete="off"
                                  placeholder="Comece a digitar o nome do produto"
                                  value={it.product_search ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateItem(idx, {
                                      product_search: value,
                                      product_id: undefined,
                                      name: "",
                                      size_id: undefined,
                                      size_name: undefined,
                                      finish: undefined,
                                      color: undefined,
                                      height: undefined,
                                      width: undefined,
                                      length: undefined,
                                      price: 0,
                                    });
                                  }}
                                />

                                {productSearch && !p && (
                                  <div className="absolute inset-x-0 top-full z-30 max-h-60 overflow-y-auto border border-t-0 border-border bg-background shadow-xl">
                                    {filteredProducts.length > 0 ? (
                                      filteredProducts.slice(0, 10).map((product) => (
                                        <button
                                          key={product.id}
                                          type="button"
                                          onClick={() =>
                                            updateItem(idx, {
                                              product_id: product.id,
                                              name: product.name,
                                              product_search: product.name,
                                              size_id: undefined,
                                              size_name: undefined,
                                              finish: undefined,
                                              color: undefined,
                                              height: undefined,
                                              width: undefined,
                                              length: undefined,
                                              price: 0,
                                            })
                                          }
                                          className="block w-full border-t border-border/60 px-3 py-2.5 text-left text-sm text-foreground transition-colors first:border-t-0 hover:bg-muted"
                                        >
                                          {product.name}
                                        </button>
                                      ))
                                    ) : (
                                      <p className="px-3 py-3 text-sm text-muted-foreground">
                                        Nenhum produto encontrado.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {p && (
                                <div className="flex items-center justify-between border border-border bg-background px-3 py-2 text-sm">
                                  <span>
                                    Produto selecionado: <strong>{p.name}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItem(idx, {
                                        product_id: undefined,
                                        name: "",
                                        product_search: "",
                                        size_id: undefined,
                                        size_name: undefined,
                                        finish: undefined,
                                        color: undefined,
                                        height: undefined,
                                        width: undefined,
                                        length: undefined,
                                        price: 0,
                                      })
                                    }
                                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              )}

                              {p && (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  {sizes.length > 0 && (
                                    <div>
                                      <Label className="text-xs">Tamanho</Label>
                                      <Select
                                        value={it.size_id ?? ""}
                                        onValueChange={(v) => {
                                          const s = sizes.find((x) => x.id === v);
                                          const priceFromSize = s
                                            ? (s.sale_price ?? s.base_price)
                                            : it.price;
                                          updateItem(idx, {
                                            size_id: v,
                                            size_name: s?.name,
                                            price: Number(priceFromSize) || 0,
                                          });
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {sizes.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                              {s.name} — {currency(s.sale_price ?? s.base_price)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {finishes.length > 0 && (
                                    <div>
                                      <Label className="text-xs">Acabamento</Label>
                                      <Select
                                        value={it.finish ?? ""}
                                        onValueChange={(v) => updateItem(idx, { finish: v })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {finishes.map((f) => (
                                            <SelectItem key={f.id} value={f.name}>
                                              {f.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {colors.length > 0 && (
                                    <div>
                                      <Label className="text-xs">Cor</Label>
                                      <Select
                                        value={it.color ?? ""}
                                        onValueChange={(v) => updateItem(idx, { color: v })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {colors.map((c) => (
                                            <SelectItem key={c.id} value={c.name}>
                                              {c.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              )}
                              {p && (
                                <DimensionFields
                                  item={it}
                                  onChange={(patch) => updateItem(idx, patch)}
                                  catalogOverride
                                />
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          <Input
                            placeholder="Nome do produto personalizado"
                            value={it.name}
                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                          />
                          <Textarea
                            className="mt-2"
                            placeholder="Descrição / detalhes"
                            value={it.description ?? ""}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                          />
                          <DimensionFields item={it} onChange={(patch) => updateItem(idx, patch)} />
                        </>
                      )}

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor unitário (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.price}
                            onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!it.name.trim()}
                          onClick={() =>
                            setExpandedItems((current) => {
                              const next = new Set(current);
                              next.delete(idx);
                              return next;
                            })
                          }
                        >
                          Concluir item
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Prazo de produção</Label>
              <Input
                placeholder="Ex: 15 dias úteis"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input
                placeholder="Ex: 50% entrada + 50% na entrega"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Link Pix (entrada)</Label>
              <Input
                placeholder="https://... ou copia e cola Pix"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-1 rounded-lg bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal itens</span>
            <span>{currency(itemsSubtotal)}</span>
          </div>
          {freight > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Frete</span>
              <span>{currency(freight)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold text-foreground">{currency(total)}</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        {step > 1 && (
          <Button
            variant="outline"
            type="button"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
          >
            Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button type="button" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
            Próximo
          </Button>
        ) : (
          <Button onClick={submit} disabled={saving}>
            {saving
              ? "Salvando…"
              : editMode
                ? "Salvar alterações"
                : duplicateSource
                  ? "Criar cópia"
                  : "Criar orçamento"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
