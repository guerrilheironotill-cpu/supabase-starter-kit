import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Plus, Trash2, Share2, Link as LinkIcon, FileDown, MessageCircle, Mail } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardSection } from "@/components/dashboard-layout";
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

export const Route = createFileRoute("/dashboard/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
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
};

type ItemDraft = {
  kind: "catalog" | "custom";
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
};

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  em_contato: "Em contato",
  proposta: "Proposta",
  aprovado: "Aprovado",
  pago: "Pago",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  orcamento: "bg-primary/15 text-primary",
  em_contato: "bg-amber-500/15 text-amber-400",
  proposta: "bg-sky-500/15 text-sky-400",
  aprovado: "bg-violet-500/15 text-violet-400",
  pago: "bg-emerald-500/15 text-emerald-400",
  entregue: "bg-emerald-500/15 text-emerald-400",
  cancelado: "bg-red-500/15 text-red-400",
};

const currency = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n ?? 0),
  );

function DashboardQuotesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as never)
        .select(
          "id, status, origin, customer_name, customer_phone, customer_email, total, items, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.warn("[orders] fetch failed:", error.message);
        return [] as OrderRow[];
      }
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Orçamentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orçamentos e pedidos do site, WhatsApp, Instagram e manuais.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo orçamento
            </Button>
          </DialogTrigger>
          <NewQuoteDialog
            onCreated={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["orders"] });
              qc.invalidateQueries({ queryKey: ["crm-leads"] });
            }}
          />
        </Dialog>
      </div>

      <DashboardSection title="Últimos orçamentos">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum orçamento ainda. Clique em "Novo orçamento" para criar.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">
                    #{o.id.slice(0, 6)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{o.customer_name}</div>
                    {o.customer_phone && (
                      <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                    {o.origin}
                  </td>
                  <td className="px-4 py-3">{currency(o.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[o.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-3 w-3" />
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
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

function NewQuoteDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [origin, setOrigin] = useState<"manual" | "instagram" | "whatsapp" | "site">(
    "instagram",
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { kind: "custom", name: "", quantity: 1, price: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .order("name")
        .limit(500);
      if (error) return [] as Array<{ id: string; name: string }>;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0),
    [items],
  );

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = (kind: "catalog" | "custom") =>
    setItems((prev) => [...prev, { kind, name: "", quantity: 1, price: 0 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
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
        }));

      // 1) create a lead so it also appears in CRM
      const interest = cleanItems.map((i) => `${i.quantity}x ${i.name}`).join(", ");
      const { error: leadErr } = await supabase.from("leads" as never).insert({
        name,
        phone: phone || null,
        email: email || null,
        items: interest,
        source: origin,
      } as never);
      if (leadErr) console.warn("[lead insert]", leadErr.message);

      // 2) create the order
      const { error: orderErr } = await supabase.from("orders" as never).insert({
        status: "orcamento",
        origin,
        customer_name: name,
        customer_phone: phone || null,
        customer_email: email || null,
        items: cleanItems,
        total,
        notes: notes || null,
      } as never);
      if (orderErr) throw orderErr;

      toast.success("Orçamento criado");
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao criar orçamento: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo orçamento</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome do cliente *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as typeof origin)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Itens</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addItem("catalog")}>
                + Catálogo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addItem("custom")}>
                + Personalizado
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                  <span>{it.kind === "catalog" ? "Do catálogo" : "Personalizado"}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {it.kind === "catalog" ? (
                  <Select
                    value={it.product_id ?? ""}
                    onValueChange={(v) => {
                      const p = products.find((x) => x.id === v);
                      updateItem(idx, { product_id: v, name: p?.name ?? "" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold">{currency(total)}</span>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Salvando…" : "Criar orçamento"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
