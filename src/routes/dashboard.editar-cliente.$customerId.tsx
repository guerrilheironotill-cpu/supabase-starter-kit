import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCnpj, maskCpf } from "@/lib/masks";

type Customer = {
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
  notes: string | null;
  status: string;
  customer_type: string;
  commercial_status: string;
  professional_type: string | null;
  commercial_approved_at: string | null;
  commercial_notes: string | null;
};
type Order = {
  id: string;
  number: number;
  external_number: string | null;
  status: string;
  total: number;
  created_at: string;
};

export const Route = createFileRoute("/dashboard/editar-cliente/$customerId")({
  head: () => ({
    meta: [{ title: "Editar cliente — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers" as never)
        .select("*")
        .eq("id", customerId)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as Customer;
    },
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_orders" as never)
        .select("id,number,external_number,status,total,created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Order[];
    },
  });
  useEffect(() => {
    if (customer) {
      setForm({
        ...customer,
        cpf: customer.cpf ? maskCpf(customer.cpf) : null,
        cnpj: customer.cnpj ? maskCnpj(customer.cnpj) : null,
      });
    }
  }, [customer]);
  const set = (key: keyof Customer, value: string | null) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true);
    try {
      const effectiveCommercialStatus =
        form.customer_type === "final" ? "pending" : form.commercial_status || "pending";
      const patch = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        cpf: form.cpf?.replace(/\D/g, "") || null,
        cnpj: form.cnpj?.replace(/\D/g, "") || null,
        address_1: form.address_1 || null,
        city: form.city || null,
        state: form.state || null,
        postcode: form.postcode || null,
        notes: form.notes || null,
        status: form.status || "active",
        customer_type: form.customer_type || "final",
        commercial_status: effectiveCommercialStatus,
        professional_type:
          form.customer_type === "professional" ? form.professional_type || null : null,
        commercial_approved_at:
          effectiveCommercialStatus === "approved"
            ? form.commercial_approved_at || new Date().toISOString()
            : null,
        commercial_notes: form.commercial_notes || null,
      };
      const { error } = await supabase
        .from("customers" as never)
        .update(patch as never)
        .eq("id", customerId);
      if (error) throw error;
      const customerName = `${form.first_name ?? ""} ${form.last_name ?? ""}`.trim();
      const customerDocument = (form.cpf || form.cnpj || "").replace(/\D/g, "") || null;
      const { error: orderSyncError } = await supabase
        .from("app_orders" as never)
        .update({
          customer_name: customerName || null,
          customer_email: form.email || null,
          customer_phone: form.phone || null,
          customer_document: customerDocument,
        } as never)
        .eq("customer_id", customerId);
      if (orderSyncError) throw orderSyncError;
      await qc.invalidateQueries({ queryKey: ["local-customers"] });
      toast.success("Cliente atualizado.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !window.confirm("Excluir este cliente? Pedidos vinculados serão preservados sem o vínculo.")
    )
      return;
    await supabase
      .from("app_orders" as never)
      .update({ customer_id: null } as never)
      .eq("customer_id", customerId);
    const { error } = await supabase
      .from("customers" as never)
      .delete()
      .eq("id", customerId);
    if (error) return toast.error(error.message);
    void navigate({ to: "/dashboard/clientes" });
  }
  if (isLoading || !customer)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Link
          to="/dashboard/clientes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para clientes
        </Link>
        <button
          onClick={remove}
          className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Excluir cliente
        </button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Editar cliente</h1>
        <p className="text-sm text-muted-foreground">
          Dados cadastrais, condição comercial e pedidos realizados.
        </p>
      </div>
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold">Cadastro</h2>
        {(
          [
            ["first_name", "Nome"],
            ["last_name", "Sobrenome"],
            ["email", "E-mail"],
            ["phone", "Telefone"],
            ["cpf", "CPF"],
            ["cnpj", "CNPJ"],
            ["address_1", "Endereço"],
            ["city", "Cidade"],
            ["state", "Estado"],
            ["postcode", "CEP"],
          ] as Array<[keyof Customer, string]>
        ).map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={String(form[key] ?? "")}
            onChange={(value) =>
              set(key, key === "cpf" ? maskCpf(value) : key === "cnpj" ? maskCnpj(value) : value)
            }
          />
        ))}
        <label className="grid gap-1 text-sm">
          Status
          <select
            value={form.status ?? "active"}
            onChange={(e) => set("status", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>
        <label className="md:col-span-2 grid gap-1 text-sm">
          Observações
          <textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold">Condição comercial</h2>
        <label className="grid gap-1 text-sm">
          Tipo de cliente
          <select
            value={form.customer_type ?? "final"}
            onChange={(e) => set("customer_type", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="final">Cliente final</option>
            <option value="professional">Profissional / Especificador</option>
            <option value="reseller">Revendedor / Lojista</option>
          </select>
        </label>
        {form.customer_type === "final" ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">Status comercial: não se aplica</div>
            <div className="text-xs text-muted-foreground">
              Cliente final utiliza preços públicos e não exige aprovação comercial.
            </div>
          </div>
        ) : (
          <label className="grid gap-1 text-sm">
            Status comercial
            <select
              value={form.commercial_status ?? "pending"}
              onChange={(e) => set("commercial_status", e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="suspended">Suspenso</option>
            </select>
          </label>
        )}
        {form.customer_type === "professional" && (
          <label className="grid gap-1 text-sm">
            Profissão
            <select
              value={form.professional_type ?? ""}
              onChange={(e) => set("professional_type", e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Selecione</option>
              <option value="architect">Arquiteto</option>
              <option value="landscaper">Paisagista</option>
              <option value="interior_designer">Designer de interiores</option>
              <option value="gardener">Jardineiro</option>
              <option value="other">Outro</option>
            </select>
          </label>
        )}
        <label className="md:col-span-2 grid gap-1 text-sm">
          Observações comerciais
          <textarea
            rows={3}
            value={form.commercial_notes ?? ""}
            onChange={(e) => set("commercial_notes", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ShoppingCart className="h-5 w-5" /> Pedidos realizados ({orders.length})
        </h2>
        {orders.length ? (
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <Link
                key={order.id}
                to="/dashboard/editar-pedido/$orderId"
                params={{ orderId: order.id }}
                className="flex items-center justify-between gap-3 py-3 hover:text-primary"
              >
                <span className="font-medium">#{order.external_number || order.number}</span>
                <span className="text-sm text-muted-foreground">
                  {order.status} · {new Date(order.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span>
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    order.total,
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum pedido vinculado.</p>
        )}
      </section>
      <div className="flex justify-end">
        <button
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Salvar cliente
        </button>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
}
