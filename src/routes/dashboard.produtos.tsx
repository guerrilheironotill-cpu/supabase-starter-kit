import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { refreshPreparedCatalogs } from "@/lib/catalog-cache";
import {
  clearCatalogPdfPending,
  isCatalogPdfPending,
  markCatalogPdfPending,
} from "@/lib/catalog-pending";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";

export const Route = createFileRoute("/dashboard/produtos")({
  head: () => ({
    meta: [{ title: "Produtos — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardProductsPage,
});

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, category, active, images, origin, sort_order, created_at, product_sizes(id, name, size, base_price), product_finishes(id), product_colors(id)",
    )
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  active: boolean;
  images: string[] | null;
  origin: string | null;
  sort_order: number | null;
  created_at: string;
  product_sizes: Array<{
    id: string;
    name: string | null;
    size: string | null;
    base_price: number | null;
  }> | null;
  product_finishes: Array<{ id: string }> | null;
  product_colors: Array<{ id: string }> | null;
};

function missingProductFields(product: ProductRow): string[] {
  const missing: string[] = [];
  const sizes = product.product_sizes ?? [];

  if (!product.images?.some((image) => image?.trim())) missing.push("imagem");
  if (sizes.length === 0) {
    missing.push("tamanho", "preço");
  } else {
    const hasIncompleteDimensions = sizes.some((item) => {
      const dimensions = item.name || item.size || "";
      return !/(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)/i.test(
        dimensions,
      );
    });
    if (hasIncompleteDimensions) missing.push("tamanho");
    if (sizes.some((item) => !item.base_price || Number(item.base_price) <= 0))
      missing.push("preço");
  }
  if (!product.product_finishes?.length) missing.push("acabamento");
  if (!product.product_colors?.length) missing.push("cor");

  return missing;
}

type SortKey = "name" | "category" | "sizes" | "active";
type SortDirection = "asc" | "desc";
function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      className="px-4 py-3"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
      >
        {label}
        <Icon
          className={
            active ? "h-3.5 w-3.5 text-foreground" : "h-3.5 w-3.5 opacity-45 group-hover:opacity-80"
          }
        />
      </button>
    </th>
  );
}
function DashboardProductsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const [updatingPdf, setUpdatingPdf] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard", "produtos"],
    queryFn: fetchProducts,
    staleTime: 60_000,
  });

  useEffect(() => {
    setPdfPending(isCatalogPdfPending());
  }, []);

  function markPdfPending() {
    markCatalogPdfPending();
    setPdfPending(true);
  }

  async function updateProductsInPdf() {
    if (updatingPdf) return;
    setUpdatingPdf(true);
    try {
      await refreshPreparedCatalogs();
      clearCatalogPdfPending();
      setPdfPending(false);
      toast.success("Produtos atualizados nos dois catálogos PDF.");
    } catch (error) {
      console.error("Falha ao atualizar os produtos nos PDFs:", error);
      toast.error("Não foi possível atualizar os PDFs. A atualização continua pendente.");
    } finally {
      setUpdatingPdf(false);
    }
  }

  const sortedProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const rows = (data as ProductRow[]).filter((row) => {
      const prices = (row.product_sizes ?? [])
        .map((size) => Number(size.base_price) || 0)
        .filter(Boolean);
      const price = prices.length ? Math.min(...prices) : 0;
      const date = row.created_at?.slice(0, 10) ?? "";
      return (
        (!normalizedSearch || row.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch)) &&
        (visibility === "all" || (visibility === "visible" ? row.active : !row.active)) &&
        (originFilter === "all" || (row.origin ?? "manual") === originFilter) &&
        (!minPrice || price >= Number(minPrice)) &&
        (!maxPrice || price <= Number(maxPrice)) &&
        (!dateFrom || date >= dateFrom) &&
        (!dateTo || date <= dateTo)
      );
    });
    if (!sortKey) return rows;

    const direction = sortDirection === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      } else if (sortKey === "category") {
        comparison = (a.category ?? "").localeCompare(b.category ?? "", "pt-BR", {
          sensitivity: "base",
        });
      } else if (sortKey === "sizes") {
        comparison = (a.product_sizes?.length ?? 0) - (b.product_sizes?.length ?? 0);
      } else if (sortKey === "active") {
        comparison = Number(a.active) - Number(b.active);
      }

      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      }
      return comparison * direction;
    });
  }, [
    data,
    dateFrom,
    dateTo,
    maxPrice,
    minPrice,
    originFilter,
    search,
    sortDirection,
    sortKey,
    visibility,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const allSelected =
    sortedProducts.length > 0 && sortedProducts.every((row) => selectedIds.has(row.id));

  function toggleProduct(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
      const next = new Set(current);
      sortedProducts.forEach((row) => next.add(row.id));
      return next;
    });
  }

  async function deleteSelectedProducts() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      setSelectedIds(new Set());
      setConfirmDelete(false);
      await qc.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
      markPdfPending();
      toast.success(
        `${ids.length} produto${ids.length === 1 ? " excluído" : "s excluídos"} com sucesso.`,
      );
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível excluir os produtos selecionados.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function setSelectedVisibility(active: boolean) {
    const ids = [...selectedIds];
    const { error } = await supabase.from("products").update({ active }).in("id", ids);
    if (error) return toast.error(error.message);
    setSelectedIds(new Set());
    await qc.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
    markPdfPending();
    toast.success(active ? "Produtos publicados" : "Produtos ocultados do site");
  }

  async function moveProduct(row: ProductRow, direction: -1 | 1) {
    const rows = (data as ProductRow[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const index = rows.findIndex((item) => item.id === row.id);
    const other = rows[index + direction];
    if (!other) return;
    const currentOrder = row.sort_order ?? index + 1;
    const otherOrder = other.sort_order ?? index + direction + 1;
    const [a, b] = await Promise.all([
      supabase
        .from("products")
        .update({ sort_order: otherOrder } as never)
        .eq("id", row.id),
      supabase
        .from("products")
        .update({ sort_order: currentOrder } as never)
        .eq("id", other.id),
    ]);
    if (a.error || b.error)
      return toast.error(a.error?.message ?? b.error?.message ?? "Falha ao ordenar");
    await qc.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
  }

  async function duplicateProduct(row: ProductRow) {
    if (duplicatingId) return;
    setDuplicatingId(row.id);
    let newProductId: string | null = null;
    try {
      const [productResult, sizesResult, finishesResult, colorsResult] = await Promise.all([
        supabase
          .from("products")
          .select("name, description, category, images, active, meta_title, meta_description")
          .eq("id", row.id)
          .single(),
        supabase
          .from("product_sizes")
          .select("size, base_price, sale_price, sort_order")
          .eq("product_id", row.id)
          .order("sort_order"),
        supabase
          .from("product_finishes")
          .select("finish, sort_order")
          .eq("product_id", row.id)
          .order("sort_order"),
        supabase
          .from("product_colors")
          .select("color, sort_order")
          .eq("product_id", row.id)
          .order("sort_order"),
      ]);
      if (productResult.error) throw productResult.error;
      if (sizesResult.error) throw sizesResult.error;
      if (finishesResult.error) throw finishesResult.error;
      if (colorsResult.error) throw colorsResult.error;

      const suffix = Date.now().toString(36);
      const source = productResult.data;
      const { data: created, error: createError } = await supabase
        .from("products")
        .insert({
          ...source,
          name: `${source.name} — Cópia`,
          slug: `${row.slug}-copia-${suffix}`,
          active: false,
        })
        .select("id")
        .single();
      if (createError) throw createError;
      newProductId = created.id;

      const inserts = [];
      if ((sizesResult.data ?? []).length > 0) {
        inserts.push(
          supabase
            .from("product_sizes")
            .insert(
              (sizesResult.data ?? []).map((size) => ({ ...size, product_id: newProductId })),
            ),
        );
      }
      if ((finishesResult.data ?? []).length > 0) {
        inserts.push(
          supabase.from("product_finishes").insert(
            (finishesResult.data ?? []).map((finish) => ({
              ...finish,
              product_id: newProductId,
            })),
          ),
        );
      }
      if ((colorsResult.data ?? []).length > 0) {
        inserts.push(
          supabase
            .from("product_colors")
            .insert(
              (colorsResult.data ?? []).map((color) => ({ ...color, product_id: newProductId })),
            ),
        );
      }
      const relationResults = await Promise.all(inserts);
      const relationError = relationResults.find((result) => result.error)?.error;
      if (relationError) throw relationError;

      await qc.invalidateQueries({ queryKey: ["dashboard", "produtos"] });
      toast.success(`Produto duplicado como “${source.name} — Cópia”.`);
      void navigate({
        to: "/dashboard/editar-produto/$productId",
        params: { productId: newProductId },
      });
    } catch (error) {
      if (newProductId) await supabase.from("products").delete().eq("id", newProductId);
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível duplicar o produto.";
      toast.error(message);
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Produtos cadastrados no catálogo.</p>
          {pdfPending && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              Atualização dos produtos no PDF pendente.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/dashboard/cadastrar-produto" })}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" /> Cadastrar produto
          </button>
          <button
            type="button"
            onClick={() => void updateProductsInPdf()}
            disabled={updatingPdf || !pdfPending}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updatingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {updatingPdf ? "Atualizando PDFs..." : "Atualizar produtos no PDF"}
          </button>
        </div>
      </div>

      <DashboardSection title={`Cadastros (${data.length})`}>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar produto por nome"
              className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="visible">Visíveis no site</option>
            <option value="hidden">Não visíveis</option>
          </select>
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todas as origens</option>
            <option value="manual">Manual</option>
            <option value="woocommerce_import">Importado</option>
          </select>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Preço mín."
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Preço máx."
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} produto{selectedIds.size === 1 ? " selecionado" : "s selecionados"}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void setSelectedVisibility(true)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                Tornar visível
              </button>
              <button
                type="button"
                onClick={() => void setSelectedVisibility(false)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                Ocultar do site
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4" /> Excluir selecionados
              </button>
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos os produtos"
                    className="h-4 w-4 accent-primary"
                  />
                </th>
                <SortableHeader
                  label="Produto"
                  sortKey="name"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Categoria"
                  sortKey="category"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Tamanhos"
                  sortKey="sizes"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="active"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              ) : sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado para “{search.trim()}”.
                  </td>
                </tr>
              ) : (
                sortedProducts.map((row) => {
                  const sizeCount = row.product_sizes?.length ?? 0;
                  const missingFields = missingProductFields(row);
                  const incomplete = missingFields.length > 0;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-border ${selectedIds.has(row.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleProduct(row.id)}
                          aria-label={`Selecionar ${row.name}`}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {row.images?.[0] && (
                              <img
                                src={row.images[0]}
                                alt={row.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <span className="font-medium text-foreground">{row.name}</span>
                          {incomplete && (
                            <span
                              title={`Cadastro incompleto: faltando ${missingFields.join(", ")}.`}
                              aria-label={`Cadastro incompleto: faltando ${missingFields.join(", ")}`}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-sm"
                            >
                              !
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                          {sizeCount} tamanho{sizeCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.active
                              ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {row.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <RowActionsMenu
                            label={`Ações de ${row.name}`}
                            actions={[
                              {
                                label: "Editar produto",
                                icon: Pencil,
                                onClick: () =>
                                  void navigate({
                                    to: "/dashboard/editar-produto/$productId",
                                    params: { productId: row.id },
                                  }),
                              },
                              {
                                label: "Duplicar produto",
                                icon: Copy,
                                onClick: () => void duplicateProduct(row),
                              },
                              {
                                label: "Visualizar no site",
                                icon: Eye,
                                onClick: () =>
                                  window.open(
                                    `/produto/${row.slug}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  ),
                              },
                              {
                                label: "Mover para cima",
                                icon: ArrowUp,
                                onClick: () => void moveProduct(row, -1),
                              },
                              {
                                label: "Mover para baixo",
                                icon: ArrowDown,
                                onClick: () => void moveProduct(row, 1),
                              },
                              {
                                label: "Excluir produto",
                                icon: Trash2,
                                destructive: true,
                                onClick: () => {
                                  setSelectedIds(new Set([row.id]));
                                  setConfirmDelete(true);
                                },
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produtos selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} produto
              {selectedIds.size === 1 ? " será excluído" : "s serão excluídos"} permanentemente,
              incluindo tamanhos, acabamentos e cores associados. Orçamentos já criados não serão
              alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedProducts();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
