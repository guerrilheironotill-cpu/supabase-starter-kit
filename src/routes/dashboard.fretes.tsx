import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSection } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskMoneyBR, maskPhoneBR } from "@/lib/masks";
import { customerFormMessage, FreightQuoteEditor } from "@/components/freight-quote-dialog";
import {
  buildProposalNotes,
  cargoValueFromOrder,
  chosenCarrierMessage,
  customerWhatsappUrl,
  FREIGHT_MODES,
  FREIGHT_STATUS_LABEL,
  FREIGHT_VEHICLES,
  freightFormUrl,
  freightPostText,
  freightUrl,
  loadSummary,
  parseProposalNotes,
  placeShort,
  rowToPublic,
  totalUnits,
  type FreightQuoteRow,
  type FreightStatus,
} from "@/lib/freight";

export const Route = createFileRoute("/dashboard/fretes")({
  head: () => ({
    meta: [{ title: "Cotações de frete — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: FreightQuotesPage,
});

type Proposal = {
  id: string;
  freight_quote_id: string;
  carrier_name: string;
  carrier_phone: string;
  price: number | null;
  deadline_days: number | null;
  notes: string | null;
  chosen_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<FreightStatus, string> = {
  rascunho: "bg-violet-500/15 text-violet-400",
  aguardando_cliente: "bg-amber-500/15 text-amber-500",
  respondida: "bg-sky-500/15 text-sky-500",
  aberta: "bg-emerald-500/15 text-emerald-500",
  fechada: "bg-muted text-muted-foreground",
};

const money = (value: number | null) =>
  value === null
    ? "—"
    : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

const priceToField = (price: number | null) =>
  price === null ? "" : maskMoneyBR(Math.round(Number(price) * 100).toString());

/** Lets the admin fix what a carrier sent (or what was agreed on WhatsApp) before hiring. */
function ProposalEditDialog({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    price: "",
    vehicle: "",
    mode: "",
    schedule: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!proposal) return;
    const details = parseProposalNotes(proposal.notes);
    setForm({
      name: proposal.carrier_name,
      phone: maskPhoneBR(proposal.carrier_phone),
      price: priceToField(proposal.price),
      vehicle: details.vehicle,
      mode: details.mode,
      schedule: details.schedule,
      notes: details.notes,
    });
  }, [proposal]);

  async function save() {
    if (!proposal) return;
    const price = Number(form.price.replace(/\./g, "").replace(",", "."));
    if (!form.name.trim()) return toast.error("Informe o nome da empresa");
    if (!Number.isFinite(price) || price <= 0) return toast.error("Informe o valor do frete");
    setSaving(true);
    const { error: updateError } = await supabase
      .from("freight_proposals" as never)
      .update({
        carrier_name: form.name.trim(),
        carrier_phone: form.phone.trim(),
        price,
        notes:
          buildProposalNotes({
            vehicle: form.vehicle,
            mode: form.mode,
            schedule: form.schedule,
            notes: form.notes,
          }) || null,
      } as never)
      .eq("id", proposal.id);
    setSaving(false);
    if (updateError) return toast.error(updateError.message);
    toast.success("Proposta atualizada");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={proposal !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar proposta</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="proposal-name">Empresa / freteiro</Label>
            <Input
              id="proposal-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-phone">WhatsApp</Label>
            <Input
              id="proposal-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: maskPhoneBR(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-price">Valor do frete (R$)</Label>
            <Input
              id="proposal-price"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: maskMoneyBR(e.target.value) })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-mode">Tipo de frete</Label>
            <select
              id="proposal-mode"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Não informado</option>
              {FREIGHT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-vehicle">Veículo</Label>
            <Input
              id="proposal-vehicle"
              list="freight-vehicle-options"
              value={form.vehicle}
              onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
            />
            <datalist id="freight-vehicle-options">
              {FREIGHT_VEHICLES.map((vehicle) => (
                <option key={vehicle} value={vehicle} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="proposal-schedule">Horário / data combinada</Label>
            <Input
              id="proposal-schedule"
              placeholder="Ex: coleta dia 12/11 às 8h"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="proposal-notes">Observações</Label>
            <Textarea
              id="proposal-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FreightQuotesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FreightQuoteRow | null>(null);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["freight-quotes"],
    queryFn: async () => {
      const [quotes, proposals] = await Promise.all([
        supabase
          .from("freight_quotes" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("freight_proposals" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (quotes.error) throw new Error(quotes.error.message);
      if (proposals.error) throw new Error(proposals.error.message);
      const quoteRows = (quotes.data ?? []) as unknown as FreightQuoteRow[];
      // Quotes with no cargo value yet take it from the order they came from.
      const orderIds = [
        ...new Set(
          quoteRows
            .filter((row) => row.cargo_value == null && row.order_id)
            .map((row) => row.order_id as string),
        ),
      ];
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, total, notes")
          .in("id", orderIds);
        const valueByOrder = new Map(
          ((orders ?? []) as Array<{ id: string; total: number; notes: string | null }>).map(
            (order) => [order.id, cargoValueFromOrder(order.total, order.notes)] as const,
          ),
        );
        for (const row of quoteRows) {
          if (row.cargo_value == null && row.order_id) {
            row.cargo_value = valueByOrder.get(row.order_id) ?? null;
          }
        }
      }
      return {
        quotes: quoteRows,
        proposals: (proposals.data ?? []) as unknown as Proposal[],
      };
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const proposalsByQuote = useMemo(() => {
    const map = new Map<string, Proposal[]>();
    for (const proposal of data?.proposals ?? []) {
      map.set(proposal.freight_quote_id, [...(map.get(proposal.freight_quote_id) ?? []), proposal]);
    }
    return map;
  }, [data?.proposals]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["freight-quotes"] });

  async function setStatus(row: FreightQuoteRow, status: "aberta" | "fechada") {
    const { error: updateError } = await supabase
      .from("freight_quotes" as never)
      .update({
        status,
        closed_at: status === "fechada" ? new Date().toISOString() : null,
      } as never)
      .eq("id", row.id);
    if (updateError) return toast.error(updateError.message);
    toast.success(status === "fechada" ? "Frete encerrado" : "Frete reaberto");
    refresh();
  }

  async function chooseCarrier(row: FreightQuoteRow, proposal: Proposal) {
    if (!row.dest_address) {
      toast.error(
        "Falta o endereço completo de entrega. Edite a cotação e preencha antes de enviar.",
      );
      return;
    }
    if (!proposal.chosen_at) {
      const { error: chooseError } = await supabase
        .from("freight_proposals" as never)
        .update({ chosen_at: new Date().toISOString() } as never)
        .eq("id", proposal.id);
      if (chooseError) return toast.error(chooseError.message);
      refresh();
    }
    window.open(
      customerWhatsappUrl(proposal.carrier_phone, chosenCarrierMessage(row, proposal.carrier_name)),
      "_blank",
      "noopener,noreferrer",
    );
  }

  // Hires this carrier: the link then tells everyone the freight is taken and stops new offers.
  async function contractProposal(row: FreightQuoteRow, proposal: Proposal) {
    const details = parseProposalNotes(proposal.notes);
    const missing = [!details.vehicle && "veículo", !details.mode && "tipo de frete"].filter(
      Boolean,
    );
    const warning = missing.length
      ? `\n\nAtenção: falta informar ${missing.join(" e ")} (use "Editar proposta"). O link mostrará só o que estiver preenchido.`
      : "";
    if (
      !window.confirm(
        `Contratar ${proposal.carrier_name} e encerrar o frete? O link passa a mostrar "Este frete já foi contratado" e deixa de receber ofertas.${warning}`,
      )
    )
      return;
    const { error: clearError } = await supabase
      .from("freight_proposals" as never)
      .update({ chosen_at: null } as never)
      .eq("freight_quote_id", row.id)
      .neq("id", proposal.id);
    if (clearError) return toast.error(clearError.message);
    if (!proposal.chosen_at) {
      const { error: chooseError } = await supabase
        .from("freight_proposals" as never)
        .update({ chosen_at: new Date().toISOString() } as never)
        .eq("id", proposal.id);
      if (chooseError) return toast.error(chooseError.message);
    }
    const { error: closeError } = await supabase
      .from("freight_quotes" as never)
      .update({ status: "fechada", closed_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (closeError) return toast.error(closeError.message);
    toast.success("Frete contratado e encerrado");
    refresh();
  }

  async function remove(row: FreightQuoteRow) {
    if (!window.confirm("Excluir esta cotação de frete e as propostas recebidas?")) return;
    const { error: deleteError } = await supabase
      .from("freight_quotes" as never)
      .delete()
      .eq("id", row.id);
    if (deleteError) return toast.error(deleteError.message);
    toast.success("Cotação excluída");
    refresh();
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cotações de frete</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie a cotação dentro do orçamento. Aqui você acompanha o formulário do cliente, publica o
          link para os freteiros e vê as propostas recebidas.
        </p>
      </div>

      <DashboardSection title="Fretes">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {data && data.quotes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma cotação ainda. Abra um orçamento, escolha entrega com frete e use "Pedir dados
            ao cliente" ou "Gerar cotação de frete".
          </p>
        )}
        <div className="space-y-4">
          {data?.quotes.map((row) => {
            const proposals = proposalsByQuote.get(row.id) ?? [];
            const units = totalUnits(Array.isArray(row.items) ? row.items : []);
            const published = row.status === "aberta" || row.status === "fechada";
            const publicQuote = rowToPublic(row);
            const route =
              row.dest_city && row.origin_city
                ? `${placeShort(publicQuote.origin)} → ${placeShort(publicQuote.destination)}`
                : row.origin_city
                  ? `${placeShort(publicQuote.origin)} → (destino a preencher)`
                  : "Rota a preencher";
            return (
              <article key={row.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">
                      {row.customer_label || "Sem nome"} ·{" "}
                      {loadSummary(Array.isArray(row.items) ? row.items : [])}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{route}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Criada em {new Date(row.created_at).toLocaleDateString("pt-BR")}
                      {row.customer_answered_at
                        ? ` · cliente respondeu em ${new Date(row.customer_answered_at).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[row.status]}`}
                  >
                    {FREIGHT_STATUS_LABEL[row.status]}
                  </span>
                </div>

                {row.status === "respondida" && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Entrega: {row.dest_address ? `${row.dest_address}, ` : ""}
                    {placeShort(publicQuote.destination)}
                    {row.dest_cep ? ` (CEP ${row.dest_cep})` : ""} ·{" "}
                    {row.loading_included
                      ? `com descarga · ${row.dest_floor === "terreo" ? "térreo" : "andar superior"} · ${row.dest_stairs ? "com escada" : "sem escada"}`
                      : "apenas frete"}
                    {row.access_notes ? ` · ${row.access_notes}` : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.form_token && !published && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copyText(freightFormUrl(row.form_token!), "Link do formulário")
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" /> Link do formulário
                      </Button>
                      {row.customer_phone && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={customerWhatsappUrl(
                              row.customer_phone,
                              customerFormMessage(
                                row.customer_label ?? undefined,
                                freightFormUrl(row.form_token),
                              ),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="mr-2 h-4 w-4" /> Reenviar no WhatsApp
                          </a>
                        </Button>
                      )}
                    </>
                  )}
                  {!published && (
                    <Button size="sm" onClick={() => setEditing(row)}>
                      {row.status === "rascunho" ? "Continuar rascunho" : "Completar e publicar"}
                    </Button>
                  )}
                  {published && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copyText(freightUrl(row.token), "Link")}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copyText(
                            freightPostText(publicQuote, freightUrl(row.token)),
                            "Texto do post",
                          )
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" /> Texto do post
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                        Editar
                      </Button>
                      {row.status === "aberta" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(row, "fechada")}
                        >
                          Encerrar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(row, "aberta")}
                        >
                          Reabrir
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void remove(row)}
                  >
                    Excluir
                  </Button>
                </div>

                {published && (
                  <div className="mt-4 border-t border-border pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Propostas ({proposals.length})
                    </h4>
                    {proposals.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border">
                        {[...proposals]
                          .sort((a, b) => Number(a.price ?? Infinity) - Number(b.price ?? Infinity))
                          .map((proposal) => (
                            <li
                              key={proposal.id}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                            >
                              <div>
                                <strong className="text-foreground">{proposal.carrier_name}</strong>
                                {proposal.chosen_at && (
                                  <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                                    Escolhido
                                  </span>
                                )}
                                <span className="ml-2 text-muted-foreground">
                                  {money(proposal.price)}
                                </span>
                                {proposal.notes && (
                                  <p className="whitespace-pre-line text-xs text-muted-foreground">
                                    {proposal.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingProposal(proposal)}
                                >
                                  Editar proposta
                                </Button>
                                <Button size="sm" variant="outline" asChild>
                                  <a
                                    href={customerWhatsappUrl(
                                      proposal.carrier_phone,
                                      `Olá, ${proposal.carrier_name}! Sobre sua cotação de frete (ref. ${row.token}).`,
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" /> Negociar
                                  </a>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void chooseCarrier(row, proposal)}
                                >
                                  {proposal.chosen_at
                                    ? "Reenviar endereços"
                                    : "Escolher e enviar endereços"}
                                </Button>
                                {row.status === "aberta" || !proposal.chosen_at ? (
                                  <Button
                                    size="sm"
                                    onClick={() => void contractProposal(row, proposal)}
                                  >
                                    Contratar e encerrar
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </DashboardSection>

      <ProposalEditDialog
        proposal={editingProposal}
        onClose={() => setEditingProposal(null)}
        onSaved={refresh}
      />

      <FreightQuoteEditor
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        items={editing?.items ?? []}
        existing={editing ?? undefined}
        onSaved={refresh}
      />
    </>
  );
}
