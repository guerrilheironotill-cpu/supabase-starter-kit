import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  GripVertical,
  Truck,
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
import { fetchAttributeTerms } from "@/lib/dashboard-taxonomies";
import { quoteDiscountAmount } from "@/lib/commercial-rules";
import { currentPrice, sizeDisplayLabel, validSalePrice } from "@/lib/products";
import { FreightQuoteActions } from "@/components/freight-quote-dialog";

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
  sort_order?: number | null;
};

type QuoteSortKey = "manual" | "id" | "customer" | "origin" | "total" | "created_at" | "status";
type SortDirection = "asc" | "desc";

type QuoteMeta = {
  freight: number;
  freightNote: string;
  deadline: string;
  payment: string;
  pix: string;
  note: string;
  address: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountReason: string;
  app_order_id?: string;
  app_order_number?: number;
  personType?: "fisica" | "juridica";
  cpf?: string | null;
  cnpj?: string | null;
  companyName?: string | null;
  attribution?: Record<string, unknown> | null;
  conversionChannel?: string;
};

type CustomerSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  address_1: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
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
    discountType: "percentage",
    discountValue: 0,
    discountReason: "",
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
        discountType: p.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Math.max(0, Number(p.discountValue) || 0),
        discountReason: String(p.discountReason ?? ""),
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

function calculateDiscount(
  items: Array<{ price: number; quantity: number; regular_price?: number | null }>,
  type: "percentage" | "fixed",
  value: number,
) {
  return quoteDiscountAmount(
    items.map((i) => ({
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      regularPrice: i.regular_price,
    })),
    type,
    value,
  );
}

type ItemDraft = {
  kind: "catalog" | "custom";
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  /** Regular unit price (extras included); the percentage discount is based on it. */
  regular_price?: number;
  size_id?: string;
  size_name?: string;
  finish?: string;
  custom_finish?: string;
  finish_extra?: number;
  color?: string;
  custom_color?: string;
  color_extra?: number;
  product_search?: string;
  height?: string;
  width?: string;
  length?: string;
};

type QuoteStatus = "rascunho" | "em_aberto" | "aprovado" | "nao_aprovado";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  em_aberto: "Em aberto",
  aprovado: "Aprovado",
  nao_aprovado: "Não aprovado",
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  rascunho: "bg-slate-500/15 text-slate-400",
  em_aberto: "bg-amber-500/15 text-amber-400",
  aprovado: "bg-emerald-500/15 text-emerald-400",
  nao_aprovado: "bg-red-500/15 text-red-400",
};

const STATUS_WRITE_CANDIDATES: Record<QuoteStatus, string[]> = {
  rascunho: ["rascunho", "draft"],
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

  if (["rascunho", "draft"].includes(clean)) return "rascunho";
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

// Quotes without a manual position (new ones) come first, newest on top.
function compareManualOrder(a: OrderRow, b: OrderRow) {
  const aOrder = a.sort_order ?? null;
  const bOrder = b.sort_order ?? null;
  if (aOrder === null && bOrder !== null) return -1;
  if (aOrder !== null && bOrder === null) return 1;
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

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
  const [sortKey, setSortKey] = useState<QuoteSortKey>("manual");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dragHandleId, setDragHandleId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [manualOrderAvailable, setManualOrderAvailable] = useState(true);
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
        const baseColumns =
          "id, status, origin, customer_name, customer_phone, customer_email, total, items, created_at, notes";
        const fetchOrders = (columns: string) =>
          supabase
            .from("orders" as never)
            .select(columns)
            .order("created_at", { ascending: false })
            .limit(200)
            .abortSignal(controller.signal);
        let { data, error } = await fetchOrders(`${baseColumns}, sort_order`);
        // Until the sort_order migration is applied, fall back to the old column set.
        if (error && error.message.includes("sort_order")) {
          setManualOrderAvailable(false);
          ({ data, error } = await fetchOrders(baseColumns));
        } else if (!error) {
          setManualOrderAvailable(true);
        }
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
    if (sortKey === "manual") return filtered.sort(compareManualOrder);
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

  const canDrag = sortKey === "manual" && manualOrderAvailable;

  async function moveQuote(draggedId: string, targetId: string, after: boolean) {
    if (draggedId === targetId) return;
    // Reorder the full list (not just the filtered view) so hidden quotes keep their place.
    const ordered = [...allOrders].sort(compareManualOrder);
    const dragged = ordered.find((order) => order.id === draggedId);
    if (!dragged) return;
    const remaining = ordered.filter((order) => order.id !== draggedId);
    const targetIndex = remaining.findIndex((order) => order.id === targetId);
    if (targetIndex < 0) return;
    remaining.splice(after ? targetIndex + 1 : targetIndex, 0, dragged);
    const changed = remaining
      .map((order, position) => ({ order, position }))
      .filter(({ order, position }) => order.sort_order !== position);
    if (changed.length === 0) return;

    const positions = new Map(remaining.map((order, position) => [order.id, position]));
    qc.setQueryData<OrderRow[]>(["orders"], (current = []) =>
      current.map((order) => ({ ...order, sort_order: positions.get(order.id) ?? order.sort_order })),
    );
    const results = await Promise.all(
      changed.map(({ order, position }) =>
        supabase
          .from("orders" as never)
          .update({ sort_order: position } as never)
          .eq("id", order.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast.error(`Não foi possível salvar a ordem: ${failed.error.message}`);
      await qc.invalidateQueries({ queryKey: ["orders"] });
    }
  }

  function toggleSort(nextKey: QuoteSortKey) {
    if (nextKey === "manual") {
      setSortKey("manual");
      setSortDirection("asc");
      return;
    }
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
            <option value="rascunho">Rascunho</option>
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
                <th className="w-10 py-3 pl-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("manual")}
                    className={`inline-flex items-center transition-colors hover:text-foreground ${
                      sortKey === "manual" ? "text-primary" : "opacity-50"
                    }`}
                    title={
                      manualOrderAvailable
                        ? "Ordem manual (arraste as linhas)"
                        : "Ordem manual indisponível: aplique a migration de sort_order"
                    }
                    aria-label="Ordenar pela ordem manual"
                    aria-pressed={sortKey === "manual"}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                </th>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-destructive">
                    Erro ao carregar orçamentos:{" "}
                    {error instanceof Error ? error.message : String(error)}
                  </td>
                </tr>
              )}
              {!isLoading && !error && orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum orçamento ainda. Clique em "Novo orçamento" para criar.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  tabIndex={0}
                  draggable={canDrag && dragHandleId === o.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", o.id);
                    setDraggingId(o.id);
                  }}
                  onDragOver={(event) => {
                    if (!draggingId || draggingId === o.id) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const after = event.clientY > rect.top + rect.height / 2;
                    if (dropTarget?.id !== o.id || dropTarget.after !== after) {
                      setDropTarget({ id: o.id, after });
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingId && dropTarget) {
                      void moveQuote(draggingId, dropTarget.id, dropTarget.after);
                    }
                    setDropTarget(null);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                    setDragHandleId(null);
                  }}
                  onClick={() => editOrder(o)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      editOrder(o);
                    }
                  }}
                  className={`cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    draggingId === o.id ? "opacity-40" : ""
                  } ${
                    dropTarget?.id === o.id
                      ? dropTarget.after
                        ? "shadow-[inset_0_-2px_0_0_var(--color-primary)]"
                        : "shadow-[inset_0_2px_0_0_var(--color-primary)]"
                      : ""
                  }`}
                  aria-label={`Editar orçamento de ${o.customer_name}`}
                >
                  <td className="py-3 pl-3" onClick={(event) => event.stopPropagation()}>
                    {canDrag && (
                      <span
                        onMouseDown={() => setDragHandleId(o.id)}
                        onMouseUp={() => setDragHandleId(null)}
                        className="inline-flex cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                        title="Arraste para reordenar"
                        aria-hidden="true"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    )}
                  </td>
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
            regular_price?: number | null;
            size_name?: string | null;
            finish?: string | null;
            custom_finish?: string | null;
            color?: string | null;
            custom_color?: string | null;
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
      const discount = calculateDiscount(items, meta.discountType, meta.discountValue);
      const totalVal = subtotal - discount + shipping;
      const orderEditorNote = JSON.stringify({
        __order_editor_meta: 1,
        note: meta.note,
        freightNote: meta.freightNote,
        address: meta.address,
        deadline: meta.deadline,
        payment: meta.payment,
        pix: meta.pix,
        discountType: meta.discountType,
        discountValue: meta.discountValue,
        discountReason: meta.discountReason,
      });

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
            customer_note: orderEditorNote,
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
            customer_note: orderEditorNote,
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
            regular_price: Number(i.regular_price) > 0 ? Number(i.regular_price) : null,
            size_name: i.size_name ?? null,
            finish: i.finish ?? null,
            custom_finish: i.custom_finish ?? null,
            color: i.color ?? null,
            custom_color: i.custom_color ?? null,
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

type ProductFull = {
  id: string;
  name: string;
  product_sizes: Array<{
    id: string;
    name: string;
    size?: string;
    base_price: number;
    sale_price: number | null;
    weight_kg?: number | null;
    sort_order: number;
  }>;
  product_finishes: Array<{ id: string; name: string; sort_order: number }>;
  product_colors: Array<{ id: string; name: string; sort_order: number }>;
};

async function fetchProductsForQuote() {
  const load = (sizeColumns: string) =>
    supabase
      .from("products")
      .select(
        `id, name, product_sizes(${sizeColumns}), product_finishes(id, name, sort_order), product_colors(id, name, sort_order)`,
      )
      .eq("active", true)
      .order("name")
      .limit(500);
  const columns = "id, name, size, base_price, sale_price, sort_order";
  let { data, error } = await load(`${columns}, weight_kg`);
  // Until the weight_kg migration is applied, fall back to the old column set.
  if (error) ({ data, error } = await load(columns));
  if (error) return [] as ProductFull[];
  return (data ?? []) as unknown as ProductFull[];
}

type FreightSourceItem = {
  name: string;
  quantity: number;
  product_id?: string | null;
  size_id?: string | null;
  size_name?: string | null;
  height?: number | string | null;
  width?: number | string | null;
  length?: number | string | null;
};

/**
 * Items of a quote in the shape the freight quote needs, with the unit weight taken from the
 * catalog. Older quotes may carry stale size ids or no size, so the size is also matched by
 * label/name, and by being the product's only size.
 */
function toFreightItems(items: FreightSourceItem[], products: ProductFull[]) {
  return items
    .filter((i) => String(i.name ?? "").trim())
    .map((i) => {
      const product = products.find((p) => p.id === i.product_id);
      const sizes = [...(product?.product_sizes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const wanted = String(i.size_name ?? "").trim().toLocaleLowerCase("pt-BR");
      const size =
        sizes.find((s) => s.id === i.size_id) ??
        sizes.find(
          (s, index) =>
            wanted &&
            (String(s.name ?? "").trim().toLocaleLowerCase("pt-BR") === wanted ||
              sizeDisplayLabel(s, index, sizes.length).toLocaleLowerCase("pt-BR") === wanted),
        ) ??
        (sizes.length === 1 ? sizes[0] : undefined);
      const weight = size?.weight_kg ?? null;
      return {
        product_id: i.product_id ?? null,
        name: i.name,
        quantity: Number(i.quantity) || 1,
        size: i.size_name ?? null,
        height: Number(i.height) || null,
        width: Number(i.width) || null,
        length: Number(i.length) || null,
        size_id: size?.id ?? null,
        weight_kg: weight,
        catalog_weight_kg: weight,
      };
    });
}

function FreightMenuDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-quote"],
    queryFn: fetchProductsForQuote,
    enabled: open,
  });
  const items = toFreightItems(
    Array.isArray(order.items) ? (order.items as FreightSourceItem[]) : [],
    products,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cotação de frete</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Orçamento de {order.customer_name}: {items.length} produto(s). Peça os dados de entrega ao
          cliente por um link ou preencha tudo agora.
        </p>
        <FreightQuoteActions
          items={items}
          orderId={order.id}
          customerLabel={order.customer_name}
          customerPhone={order.customer_phone ?? ""}
          deadlineText={parseMeta(order.notes).deadline}
        />
      </DialogContent>
    </Dialog>
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
  const discount = calculateDiscount(items, meta.discountType, meta.discountValue);
  const discountLabel =
    meta.discountType === "percentage"
      ? `Desconto (${meta.discountValue}%)`
      : "Desconto";

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
      ...(discount > 0
        ? [
            `${discountLabel}: -${currency(discount)}${meta.discountReason ? " (" + meta.discountReason + ")" : ""}`,
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

  const generatePdf = async () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Bloqueado pelo navegador");
      return;
    }

    w.document.write("<!doctype html><html><body style='font-family:sans-serif;padding:24px'>Preparando PDF...</body></html>");
    w.document.close();

    let logoSrc = `${window.location.origin}/images/logo-arteno-header-site.svg`;
    try {
      const { getQuoteLogoDataUrl } = await import("@/lib/quote-pdf-logo");
      logoSrc = await getQuoteLogoDataUrl();
    } catch (error) {
      console.warn("Não foi possível embutir o logo no PDF:", error);
    }
    const attrLine = (i: {
      size_name?: string | null;
      finish?: string | null;
      custom_finish?: string | null;
      color?: string | null;
      custom_color?: string | null;
      height?: number | null;
      width?: number | null;
      length?: number | null;
    }) => {
      const parts = [
        i.size_name ? `Tamanho: ${i.size_name}` : "",
        i.finish
          ? `Acabamento: ${i.finish === "Personalizado" ? i.custom_finish || i.finish : i.finish}`
          : "",
        i.color
          ? `Cor: ${i.color === "Personalizado" ? i.custom_color || i.color : i.color}`
          : "",
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
      ${discount > 0 ? `<div class="row"><span>${discountLabel}${meta.discountReason ? ` <em>(${meta.discountReason.replace(/</g, "&lt;")})</em>` : ""}</span><b>-${currency(discount)}</b></div>` : ""}
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
  .item-totals { width: min(100%, 340px); margin: 16px 0 0 auto; padding-top: 8px; }
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
      <img src="${logoSrc}" alt="Arteno Vaso &amp; Decor" style="height:52px;width:214px;object-fit:contain;object-position:right center;"/>
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.15em;margin-top:16px;">Orçamento<b style="display:block;font-size:18px;color:#111;letter-spacing:.05em;margin-top:4px;">#${order.id.slice(0, 6).toUpperCase()}</b></div>
    </section>
  </div>
</div>
${module("Itens", `<table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="item-totals">${totalsBody}</div>`)}
${condBody ? module("Condições", condBody) : ""}
${meta.note ? module("Observações", `<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${meta.note.replace(/</g, "&lt;")}</div>`) : ""}
<div class="noprint" style="margin-top:24px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;border:1px solid #111;background:#111;color:#fff;border-radius:6px;">Salvar como PDF</button></div>
<script>
  (function () {
    var images = Array.from(document.images);
    var imagesReady = Promise.all(images.map(function (image) {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise(function (resolve) {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      Promise.all([imagesReady, fontsReady]),
      new Promise(function (resolve) { setTimeout(resolve, 3000); })
    ]).then(function () { setTimeout(function () { window.print(); }, 100); });
  })();
</script>
</body></html>`;
    w.document.open();
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
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, "_blank");
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

  const [freightOpen, setFreightOpen] = useState(false);

  return (
    <>
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
        <DropdownMenuItem onSelect={() => setFreightOpen(true)}>
          <Truck className="mr-2 h-4 w-4" /> Cotação de frete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FreightMenuDialog order={order} open={freightOpen} onOpenChange={setFreightOpen} />
    </>
  );
}

const NewQuoteDialog = NewQuoteDialogImpl;

type AttributeSelection = { value?: string; customName?: string; extra?: number };

function AttributePicker({
  label,
  required = false,
  options,
  value,
  customName,
  extra,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: Array<{ name: string; extra: number }>;
  value?: string;
  customName?: string;
  extra?: number;
  onChange: (patch: AttributeSelection) => void;
}) {
  const isCustom = value === "Personalizado";
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={isCustom ? "__custom__" : (value ?? "__none__")}
        onValueChange={(v) => {
          if (v === "__none__") onChange({ value: undefined, extra: 0 });
          else if (v === "__custom__") onChange({ value: "Personalizado", extra: 0 });
          else onChange({ value: v, extra: options.find((o) => o.name === v)?.extra ?? 0 });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="__none__">Nenhum</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.name} value={option.name}>
              {option.name}
              {option.extra > 0 ? ` (+ ${currency(option.extra)})` : ""}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {value && (
        <div className={`mt-2 grid gap-2 ${isCustom ? "sm:grid-cols-2" : ""}`}>
          {isCustom && (
            <Input
              placeholder={`Nome ${label === "Cor" ? "da cor" : "do acabamento"}`}
              value={customName ?? ""}
              onChange={(event) => onChange({ customName: event.target.value })}
            />
          )}
          <div>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Adicional (R$)"
              aria-label={`Adicional de ${label.toLowerCase()} (R$)`}
              value={extra ?? 0}
              onChange={(event) => onChange({ extra: Math.max(0, Number(event.target.value) || 0) })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Adicional por unidade, somado ao valor unitário
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
        regular_price: Number(item.regular_price) > 0 ? Number(item.regular_price) : undefined,
        size_id: typeof item.size_id === "string" ? item.size_id : undefined,
        size_name: typeof item.size_name === "string" ? item.size_name : undefined,
        finish: typeof item.finish === "string" ? item.finish : undefined,
        custom_finish: typeof item.custom_finish === "string" ? item.custom_finish : undefined,
        // Older quotes stored the extra under custom_* keys.
        finish_extra: Number(item.finish_extra ?? item.custom_finish_extra) || 0,
        color: typeof item.color === "string" ? item.color : undefined,
        custom_color: typeof item.custom_color === "string" ? item.custom_color : undefined,
        color_extra: Number(item.color_extra ?? item.custom_color_extra) || 0,
        height: item.height == null ? "" : String(item.height),
        width: item.width == null ? "" : String(item.width),
        length: item.length == null ? "" : String(item.length),
      }))
    : [];
  const [name, setName] = useState(duplicateSource?.customer_name ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
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
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    initialMeta.discountType,
  );
  const [discountValue, setDiscountValue] = useState(initialMeta.discountValue);
  const [discountReason, setDiscountReason] = useState(initialMeta.discountReason);
  const [items, setItems] = useState<ItemDraft[]>(
    initialItems.length ? initialItems : [{ kind: "custom", name: "", quantity: 1, price: 0 }],
  );
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    () => new Set(initialItems.length ? [] : [0]),
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(name.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [name]);

  const { data: customerSuggestions = [], isFetching: searchingCustomers } = useQuery({
    queryKey: ["quote-customer-suggestions", customerSearch.toLocaleLowerCase("pt-BR")],
    enabled: step === 2 && customerSearch.length > 0,
    queryFn: async () => {
      const firstTerm = customerSearch.split(/\s+/)[0].replace(/[%_,()]/g, "");
      if (!firstTerm) return [] as CustomerSuggestion[];
      const { data, error } = await supabase
        .from("customers" as never)
        .select("id,first_name,last_name,email,phone,cpf,cnpj,address_1,city,state,postcode")
        .ilike("first_name", `${firstTerm}%`)
        .order("first_name")
        .order("last_name")
        .limit(20);
      if (error) throw error;
      const normalizedSearch = customerSearch.toLocaleLowerCase("pt-BR");
      return ((data ?? []) as unknown as CustomerSuggestion[]).filter((customer) =>
        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`
          .trim()
          .toLocaleLowerCase("pt-BR")
          .startsWith(normalizedSearch),
      );
    },
    staleTime: 30000,
  });

  const selectCustomer = (customer: CustomerSuggestion) => {
    setName(`${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim());
    setPhone(maskPhoneBR(customer.phone ?? ""));
    setEmail(customer.email ?? "");
    if (customer.cnpj) {
      setPersonType("juridica");
      setCnpj(maskCnpj(customer.cnpj));
    } else {
      setPersonType("fisica");
      setCpf(maskCpf(customer.cpf ?? ""));
    }
    setAddress(
      [customer.address_1, customer.city, customer.state, customer.postcode]
        .filter(Boolean)
        .join(", "),
    );
    setShowCustomerSuggestions(false);
  };

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-quote"],
    queryFn: fetchProductsForQuote,
  });

  const itemsSubtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0),
    [items],
  );
  const discount = calculateDiscount(items, discountType, discountValue);
  const total = itemsSubtotal - discount + (Number(freight) || 0);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const { data: finishCatalog = [] } = useQuery({
    queryKey: ["quote-finish-catalog"],
    queryFn: () => fetchAttributeTerms("product_finishes", "finish_catalog"),
  });
  const { data: colorCatalog = [] } = useQuery({
    queryKey: ["quote-color-catalog"],
    queryFn: () => fetchAttributeTerms("product_colors", "color_catalog"),
  });
  const finishExtraByName = useMemo(
    () => new Map(finishCatalog.map((term) => [term.name, term.extra_price])),
    [finishCatalog],
  );
  const allFinishOptions = useMemo(
    () => finishCatalog.map((term) => ({ name: term.name, extra: term.extra_price })),
    [finishCatalog],
  );
  const allColorOptions = useMemo(
    () => colorCatalog.map((term) => ({ name: term.name, extra: term.extra_price })),
    [colorCatalog],
  );

  // Keeps the unit price in sync: the previous extra is removed and the new one added.
  const updateAttribute = (
    idx: number,
    attribute: "finish" | "color",
    patch: AttributeSelection,
  ) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== idx) return item;
        const extraKey = attribute === "finish" ? "finish_extra" : "color_extra";
        const nameKey = attribute === "finish" ? "custom_finish" : "custom_color";
        const previousExtra = Number(item[extraKey]) || 0;
        const nextExtra = patch.extra ?? previousExtra;
        const nextValue = patch.value ?? item[attribute];
        return {
          ...item,
          [attribute]: nextValue,
          [nameKey]:
            nextValue === "Personalizado" ? (patch.customName ?? item[nameKey]) : undefined,
          [extraKey]: nextExtra,
          price: Math.max(0, (Number(item.price) || 0) - previousExtra + nextExtra),
          regular_price:
            item.regular_price == null
              ? undefined
              : Math.max(0, item.regular_price - previousExtra + nextExtra),
        };
      }),
    );
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setExpandedItems(
      (current) =>
        new Set(
          Array.from(current, (index) =>
            index === idx ? target : index === target ? idx : index,
          ),
        ),
    );
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

  // Catalog items with a chosen size edit regular and promotional prices separately.
  const itemExtras = (it: ItemDraft) =>
    (Number(it.finish_extra) || 0) + (Number(it.color_extra) || 0);
  const itemRegular = (it: ItemDraft) => it.regular_price ?? it.price;
  const itemPromo = (it: ItemDraft) => (it.price < itemRegular(it) ? it.price : null);
  const catalogPrices = (it: ItemDraft) => {
    if (it.kind !== "catalog" || !it.size_id) return null;
    const size = products
      .find((p) => p.id === it.product_id)
      ?.product_sizes.find((s) => s.id === it.size_id);
    if (!size) return null;
    const promo = validSalePrice(size);
    const extras = itemExtras(it);
    return {
      sizeId: size.id,
      regular: Number(size.base_price) + extras,
      promo: promo === null ? null : promo + extras,
    };
  };
  const setRegularPrice = (idx: number, value: number) => {
    const it = items[idx];
    const promo = itemPromo(it);
    priceDirty.current = true;
    updateItem(idx, {
      regular_price: value,
      price: promo !== null && promo < value ? promo : value,
    });
  };
  const setPromoPrice = (idx: number, value: number) => {
    const it = items[idx];
    const regular = itemRegular(it);
    priceDirty.current = true;
    updateItem(idx, {
      regular_price: regular,
      price: value > 0 && value < regular ? value : regular,
    });
  };
  const queryClient = useQueryClient();
  const priceDirty = useRef(false);
  const [priceConfirm, setPriceConfirm] = useState<number | null>(null);
  const [savingProductPrice, setSavingProductPrice] = useState(false);
  const checkCatalogChange = (idx: number) => {
    if (!priceDirty.current) return;
    priceDirty.current = false;
    const it = items[idx];
    const catalog = catalogPrices(it);
    if (!catalog) return;
    const differs = (a: number | null, b: number | null) =>
      a === null || b === null ? a !== b : Math.abs(a - b) > 0.001;
    if (
      differs(itemRegular(it), catalog.regular) ||
      differs(itemPromo(it), catalog.promo)
    ) {
      setPriceConfirm(idx);
    }
  };
  const applyPriceToProduct = async () => {
    if (priceConfirm === null) return;
    const it = items[priceConfirm];
    const catalog = it ? catalogPrices(it) : null;
    if (!it || !catalog) return setPriceConfirm(null);
    const extras = itemExtras(it);
    const promo = itemPromo(it);
    setSavingProductPrice(true);
    const { error } = await supabase
      .from("product_sizes")
      .update({
        base_price: Math.round((itemRegular(it) - extras) * 100) / 100,
        sale_price: promo === null ? null : Math.round((promo - extras) * 100) / 100,
      })
      .eq("id", catalog.sizeId);
    setSavingProductPrice(false);
    if (error) {
      toast.error(`Não foi possível alterar o produto: ${error.message}`);
      return;
    }
    toast.success("Preço do produto atualizado");
    void queryClient.invalidateQueries({ queryKey: ["products-for-quote"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    setPriceConfirm(null);
  };
  const revertPriceToCatalog = () => {
    if (priceConfirm === null) return;
    const it = items[priceConfirm];
    const catalog = it ? catalogPrices(it) : null;
    if (it && catalog) {
      updateItem(priceConfirm, {
        regular_price: catalog.regular,
        price: catalog.promo ?? catalog.regular,
      });
    }
    setPriceConfirm(null);
  };

  const toggleItem = (idx: number) =>
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const buildCleanItems = () =>
    items
      .filter((i) => i.name.trim())
      .map((i) => ({
        kind: i.kind,
        product_id: i.product_id ?? null,
        name: i.name,
        description: i.description ?? null,
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
        regular_price: i.regular_price && i.regular_price > 0 ? i.regular_price : null,
        size_id: i.size_id ?? null,
        size_name: i.size_name ?? null,
        finish: i.finish ?? null,
        custom_finish: i.custom_finish?.trim() || null,
        finish_extra: Number(i.finish_extra) || 0,
        color: i.color ?? null,
        custom_color: i.custom_color?.trim() || null,
        color_extra: Number(i.color_extra) || 0,
        height: i.height?.trim() ? Number(i.height) : null,
        width: i.width?.trim() ? Number(i.width) : null,
        length: i.length?.trim() ? Number(i.length) : null,
      }));

  const buildMetaPayload = () =>
    JSON.stringify({
      __meta: 1,
      freight: Number(freight) || 0,
      freightNote,
      deadline,
      payment,
      pix,
      note: notes,
      address,
      discountType,
      discountValue: Number(discountValue) || 0,
      discountReason: discountReason.trim(),
      personType,
      cpf: personType === "fisica" ? cpf : null,
      cnpj: personType === "juridica" ? cnpj : null,
      companyName: personType === "juridica" ? companyName : null,
      attribution: initialMeta.attribution,
      conversionChannel: initialMeta.conversionChannel,
    });

  // A quote that is closed without being saved is kept as a draft ("rascunho").
  const sourceIsDraft =
    editMode && normalizeQuoteStatus(duplicateSource?.status) === "rascunho";
  const finishedRef = useRef(false);
  const saveDraftRef = useRef<() => void>(() => {});
  saveDraftRef.current = () => {
    if (finishedRef.current) return;
    if (editMode && !sourceIsDraft) return;
    const cleanItems = buildCleanItems();
    if (!name.trim() && !phone.trim() && !email.trim() && cleanItems.length === 0) return;
    const payload: Record<string, unknown> = {
      customer_name: name.trim() || "Sem nome",
      customer_phone: phone || null,
      customer_email: email || null,
      items: cleanItems,
      total,
      notes: buildMetaPayload(),
    };
    void (async () => {
      const writeStatuses = STATUS_WRITE_CANDIDATES.rascunho;
      for (const status of writeStatuses) {
        const { customer_email: _email, ...withoutEmail } = payload;
        const attempts =
          sourceIsDraft && duplicateSource
            ? [payload, withoutEmail]
            : [{ ...payload, origin: "manual" }, payload, withoutEmail];
        for (const attempt of attempts) {
          const query = supabase.from("orders" as never);
          const { error } =
            sourceIsDraft && duplicateSource
              ? await query.update({ ...attempt, status } as never).eq("id", duplicateSource.id)
              : await query.insert({ ...attempt, status } as never);
          if (!error) {
            toast.success("Orçamento salvo como rascunho");
            return;
          }
          console.warn(`[draft save:${status}]`, error.message);
        }
      }
      toast.error("Não foi possível salvar o rascunho do orçamento");
    })();
  };
  useEffect(() => () => saveDraftRef.current(), []);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, "");
    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (personType === "fisica" && cpfDigits.length > 0 && cpfDigits.length !== 11) {
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
    if (discountType === "percentage" && discountValue > 100) {
      toast.error("O desconto percentual não pode ser maior que 100%");
      return;
    }
    if (discountType === "fixed" && discountValue > itemsSubtotal) {
      toast.error("O desconto fixo não pode ser maior que o subtotal dos itens");
      return;
    }
    if (discountValue > 0 && !discountReason.trim()) {
      setStep(3);
      toast.error("Informe o motivo do desconto");
      return;
    }
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) continue;
      const product =
        item.kind === "catalog" && item.product_id
          ? products.find((candidate) => candidate.id === item.product_id)
          : undefined;
      if (product && !item.finish) {
        setStep(1);
        setExpandedItems((current) => new Set(current).add(index));
        toast.error(`Selecione o acabamento de ${item.name}`);
        return;
      }
      if (item.finish === "Personalizado" && !item.custom_finish?.trim()) {
        setStep(1);
        setExpandedItems((current) => new Set(current).add(index));
        toast.error(`Informe o nome do acabamento personalizado de ${item.name}`);
        return;
      }
      if (product && !item.color) {
        setStep(1);
        setExpandedItems((current) => new Set(current).add(index));
        toast.error(`Selecione a cor de ${item.name}`);
        return;
      }
      if (item.color === "Personalizado" && !item.custom_color?.trim()) {
        setStep(1);
        setExpandedItems((current) => new Set(current).add(index));
        toast.error(`Informe o nome da cor personalizada de ${item.name}`);
        return;
      }
    }
    setSaving(true);
    try {
      const cleanItems = buildCleanItems();

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

      if (!editMode || sourceIsDraft) {
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
      const metaPayload = buildMetaPayload();
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
        // Saving a draft turns it into a regular open quote.
        const statusPatch: Record<string, unknown> = sourceIsDraft
          ? { status: STATUS_WRITE_CANDIDATES.em_aberto[0] }
          : {};
        const updateAttempts: Record<string, unknown>[] = [
          { ...basePayload, ...statusPatch, customer_email: email || null },
          { ...basePayload, ...statusPatch },
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

      finishedRef.current = true;
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
          <div className="rounded-lg border border-border p-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Documento do cliente *
            </Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${personType === "fisica" ? "border-primary bg-primary/5" : "border-border"}`}>
                <input
                  type="radio"
                  name="np-personType"
                  checked={personType === "fisica"}
                  onChange={() => setPersonType("fisica")}
                />
                <span><b className="block">Pessoa física</b><span className="text-xs text-muted-foreground">Usar CPF</span></span>
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${personType === "juridica" ? "border-primary bg-primary/5" : "border-border"}`}>
                <input
                  type="radio"
                  name="np-personType"
                  checked={personType === "juridica"}
                  onChange={() => setPersonType("juridica")}
                />
                <span><b className="block">Pessoa jurídica</b><span className="text-xs text-muted-foreground">Usar CNPJ</span></span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome do cliente *</Label>
              <div className="relative">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => window.setTimeout(() => setShowCustomerSuggestions(false), 150)}
                  placeholder="Digite para buscar um cliente cadastrado"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showCustomerSuggestions && name.trim().length > 0}
                  aria-controls="quote-customer-suggestions"
                  autoComplete="off"
                />
                {showCustomerSuggestions && name.trim().length > 0 && (
                  <div
                    id="quote-customer-suggestions"
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {searchingCustomers && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Buscando clientes...</p>
                    )}
                    {!searchingCustomers && customerSuggestions.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum cliente cadastrado encontrado.
                      </p>
                    )}
                    {customerSuggestions.map((customer) => {
                      const fullName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
                      return (
                        <button
                          key={customer.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="w-full rounded-sm px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="block text-sm font-medium">{fullName}</span>
                          {(customer.phone || customer.email) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {[customer.phone, customer.email].filter(Boolean).join(" • ")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
                <Label>CPF</Label>
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
                <div>
                  <Label className="text-xs">Cotação de frete com transportadores</Label>
                  <div className="mt-1">
                    <FreightQuoteActions
                      items={toFreightItems(items, products)}
                      orderId={editMode ? duplicateSource?.id : null}
                      customerLabel={name}
                      customerPhone={phone}
                      deadlineText={deadline}
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
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {it.size_name ? `${it.size_name} · ` : ""}
                        Qtd: {Number(it.quantity) || 0}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          expandedItems.has(idx) ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                      aria-label={`Mover ${it.name || "item"} para cima`}
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === items.length - 1}
                      className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                      aria-label={`Mover ${it.name || "item"} para baixo`}
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
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
                                      custom_finish: undefined,
                                      finish_extra: 0,
                                      color: undefined,
                                      custom_color: undefined,
                                      color_extra: 0,
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
                                              custom_finish: undefined,
                                              finish_extra: 0,
                                              color: undefined,
                                              custom_color: undefined,
                                              color_extra: 0,
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
                                        custom_finish: undefined,
                                        finish_extra: 0,
                                        color: undefined,
                                        custom_color: undefined,
                                        color_extra: 0,
                                        height: undefined,
                                        width: undefined,
                                        length: undefined,
                                        price: 0,
                                        regular_price: undefined,
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
                                          const sizeIndex = sizes.findIndex((x) => x.id === v);
                                          const s = sizes[sizeIndex];
                                          // Keep the finish/color extras on top of the new size price.
                                          const extras =
                                            (Number(it.finish_extra) || 0) +
                                            (Number(it.color_extra) || 0);
                                          const priceFromSize = s
                                            ? currentPrice(s) + extras
                                            : it.price;
                                          updateItem(idx, {
                                            size_id: v,
                                            size_name: s
                                              ? sizeDisplayLabel(s, sizeIndex, sizes.length)
                                              : undefined,
                                            price: Number(priceFromSize) || 0,
                                            regular_price: s
                                              ? (Number(s.base_price) || 0) + extras
                                              : it.regular_price,
                                          });
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {sizes.map((s, sizeIndex) => {
                                            const promo = validSalePrice(s);
                                            return (
                                              <SelectItem key={s.id} value={s.id}>
                                                {sizeDisplayLabel(s, sizeIndex, sizes.length)}
                                                {" — "}
                                                {promo !== null
                                                  ? `${currency(promo)} (regular ${currency(s.base_price)})`
                                                  : currency(s.base_price)}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  <AttributePicker
                                    label="Acabamento"
                                    required
                                    options={finishes.map((f) => ({
                                      name: f.name,
                                      extra: finishExtraByName.get(f.name) ?? 0,
                                    }))}
                                    value={it.finish}
                                    customName={it.custom_finish}
                                    extra={it.finish_extra}
                                    onChange={(patch) => updateAttribute(idx, "finish", patch)}
                                  />
                                  <AttributePicker
                                    label="Cor"
                                    required
                                    options={colors.map((c) => ({ name: c.name, extra: 0 }))}
                                    value={it.color}
                                    customName={it.custom_color}
                                    extra={it.color_extra}
                                    onChange={(patch) => updateAttribute(idx, "color", patch)}
                                  />
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
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <AttributePicker
                              label="Acabamento"
                              options={allFinishOptions}
                              value={it.finish}
                              customName={it.custom_finish}
                              extra={it.finish_extra}
                              onChange={(patch) => updateAttribute(idx, "finish", patch)}
                            />
                            <AttributePicker
                              label="Cor"
                              options={allColorOptions}
                              value={it.color}
                              customName={it.custom_color}
                              extra={it.color_extra}
                              onChange={(patch) => updateAttribute(idx, "color", patch)}
                            />
                          </div>
                          <DimensionFields item={it} onChange={(patch) => updateItem(idx, patch)} />
                        </>
                      )}

                      <div
                        className={`mt-2 grid gap-2 ${
                          catalogPrices(it) ? "grid-cols-3" : "grid-cols-2"
                        }`}
                      >
                        <div>
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        {catalogPrices(it) ? (
                          <>
                            <div>
                              <Label className="text-xs">Valor regular (R$)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={itemRegular(it)}
                                onChange={(e) => setRegularPrice(idx, Number(e.target.value))}
                                onBlur={() => checkCatalogChange(idx)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Valor promocional (R$)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="Sem promoção"
                                value={itemPromo(it) ?? ""}
                                onChange={(e) => setPromoPrice(idx, Number(e.target.value))}
                                onBlur={() => checkCatalogChange(idx)}
                              />
                            </div>
                          </>
                        ) : (
                        <div>
                          <Label className="text-xs">Valor unitário (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.price}
                            onChange={(e) =>
                              // A manual price replaces the catalog price, so it becomes the discount base.
                              updateItem(idx, {
                                price: Number(e.target.value),
                                regular_price: undefined,
                              })
                            }
                          />
                          {it.regular_price != null && it.regular_price > it.price && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Regular {currency(it.regular_price)} · Promocional {currency(it.price)}
                            </p>
                          )}
                        </div>
                        )}
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
            <div className="sm:col-span-2 rounded-lg border border-border p-3">
              <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Desconto
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Tipo de desconto</Label>
                  <Select
                    value={discountType}
                    onValueChange={(value) =>
                      setDiscountType(value as "percentage" | "fixed")
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{discountType === "percentage" ? "Percentual (%)" : "Valor (R$)"}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={discountType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Motivo do desconto{discountValue > 0 ? " *" : ""}</Label>
                  <Input
                    placeholder="Ex: pagamento à vista no boleto"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              </div>
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
          {discount > 0 && (
            <div className="flex items-center justify-between text-emerald-600">
              <span>
                Desconto{discountType === "percentage" ? ` (${discountValue}%)` : ""}
              </span>
              <span>-{currency(discount)}</span>
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

      <Dialog
        open={priceConfirm !== null}
        onOpenChange={(next) => {
          // Dismissing keeps the change only in this quote.
          if (!next && !savingProductPrice) setPriceConfirm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar o valor do produto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Você mudou o valor de {priceConfirm !== null ? items[priceConfirm]?.name : "este item"}.
            Quer atualizar também o cadastro do produto (preço no site) ou aplicar apenas neste
            orçamento?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={revertPriceToCatalog}
              disabled={savingProductPrice}
            >
              Desfazer
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setPriceConfirm(null)}
              disabled={savingProductPrice}
            >
              Só neste orçamento
            </Button>
            <Button type="button" onClick={() => void applyPriceToProduct()} disabled={savingProductPrice}>
              {savingProductPrice ? "Salvando…" : "Alterar no produto também"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}
