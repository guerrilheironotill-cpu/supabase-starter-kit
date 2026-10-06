import { useEffect, useState } from "react";
import { Copy, MessageCircle, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import {
  customerWhatsappUrl,
  freightFormUrl,
  freightPostText,
  freightUrl,
  lookupCep,
  maskCep,
  newFreightToken,
  pickupDateFromDeadline,
  rowToPublic,
  totalUnits,
  totalWeightKg,
  type FreightItem,
  type FreightQuoteRow,
} from "@/lib/freight";

type PlaceForm = {
  cep: string;
  /** Street, number and complement. Private: only the chosen carrier receives it. */
  address: string;
  district: string;
  city: string;
  state: string;
  floor: "terreo" | "superior";
  stairs: boolean;
};

const emptyPlace: PlaceForm = {
  cep: "",
  address: "",
  district: "",
  city: "",
  state: "",
  floor: "terreo",
  stairs: false,
};

const ORIGIN_STORAGE_KEY = "arteno:freight-origin";

function loadSavedOrigin(): PlaceForm {
  try {
    const raw = localStorage.getItem(ORIGIN_STORAGE_KEY);
    if (raw) return { ...emptyPlace, ...(JSON.parse(raw) as Partial<PlaceForm>) };
  } catch {
    /* storage unavailable */
  }
  return emptyPlace;
}

function saveOrigin(origin: PlaceForm) {
  try {
    localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origin));
  } catch {
    /* storage unavailable */
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

function PlaceFields({
  title,
  value,
  onChange,
  showAccess,
}: {
  title: string;
  value: PlaceForm;
  onChange: (next: PlaceForm) => void;
  showAccess: boolean;
}) {
  const [lookingUp, setLookingUp] = useState(false);

  async function handleCep(raw: string) {
    const cep = maskCep(raw);
    onChange({ ...value, cep });
    if (cep.length !== 9) return;
    setLookingUp(true);
    const found = await lookupCep(cep);
    setLookingUp(false);
    if (found) {
      onChange({
        ...value,
        cep,
        city: found.city,
        state: found.state,
        district: found.district,
        address: value.address || (found.street ? `${found.street}, ` : ""),
      });
    }
  }

  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <div>
          <Label className="text-xs">CEP</Label>
          <Input
            inputMode="numeric"
            placeholder="00000-000"
            value={value.cep}
            onChange={(e) => void handleCep(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Bairro {lookingUp ? "(buscando…)" : ""}</Label>
          <Input
            value={value.district}
            onChange={(e) => onChange({ ...value, district: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_80px]">
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">UF</Label>
          <Input
            maxLength={2}
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Endereço completo (privado: só vai ao freteiro escolhido)</Label>
        <Input
          placeholder="Rua, número, complemento"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
        />
      </div>
      {showAccess && (
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <select
          value={value.floor}
          onChange={(e) => onChange({ ...value, floor: e.target.value as PlaceForm["floor"] })}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-label={`${title}: térreo ou superior`}
        >
          <option value="terreo">Térreo</option>
          <option value="superior">Andar superior</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.stairs}
            onChange={(e) => onChange({ ...value, stairs: e.target.checked })}
          />
          Tem escada
        </label>
      </div>
      )}
    </fieldset>
  );
}

const rowToPlace = (
  row: FreightQuoteRow | undefined,
  side: "origin" | "dest",
): PlaceForm | null => {
  if (!row) return null;
  return {
    cep: (side === "origin" ? row.origin_cep : row.dest_cep) ?? "",
    address: (side === "origin" ? row.origin_address : row.dest_address) ?? "",
    district: (side === "origin" ? row.origin_district : row.dest_district) ?? "",
    city: (side === "origin" ? row.origin_city : row.dest_city) ?? "",
    state: (side === "origin" ? row.origin_state : row.dest_state) ?? "",
    floor: side === "origin" ? row.origin_floor : row.dest_floor,
    stairs: side === "origin" ? row.origin_stairs : row.dest_stairs,
  };
};

/**
 * Builds or completes a freight quote and publishes the carrier page. With `existing`
 * (a quote the customer already answered, or an open one) it updates that row instead.
 */
export function FreightQuoteEditor({
  open,
  onOpenChange,
  items,
  orderId,
  customerLabel,
  existing,
  deadlineText,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FreightItem[];
  orderId?: string | null;
  customerLabel?: string;
  existing?: FreightQuoteRow;
  /** Production deadline of the quote, used to suggest the pickup date. */
  deadlineText?: string;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState<PlaceForm>(emptyPlace);
  const [destination, setDestination] = useState<PlaceForm>(emptyPlace);
  const [loadDetails, setLoadDetails] = useState("");
  const [loadingIncluded, setLoadingIncluded] = useState(false);
  const [emptyLoad, setEmptyLoad] = useState(true);
  const [photoNote, setPhotoNote] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupFlexible, setPickupFlexible] = useState(true);
  const [notes, setNotes] = useState("");
  const [weights, setWeights] = useState<string[]>([]);
  const [saveWeights, setSaveWeights] = useState(true);
  const [created, setCreated] = useState<{ link: string; post: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    const savedOrigin = rowToPlace(existing, "origin");
    setOrigin(savedOrigin && savedOrigin.city ? savedOrigin : loadSavedOrigin());
    setDestination(rowToPlace(existing, "dest") ?? emptyPlace);
    setLoadDetails(existing?.load_details ?? "");
    setLoadingIncluded(existing?.loading_included ?? false);
    setEmptyLoad(existing?.empty_load ?? true);
    setPhotoNote(existing?.photo_note ?? "");
    setPickupDate(existing?.pickup_date ?? pickupDateFromDeadline(deadlineText) ?? "");
    setPickupFlexible(existing?.pickup_flexible ?? true);
    setNotes(existing?.notes ?? "");
    setWeights(
      (existing ? existing.items : items).map((item) => (item.weight_kg ? String(item.weight_kg) : "")),
    );
    // Reset only when the dialog opens for a different quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const baseItems = existing ? existing.items : items;
  const quoteItems = baseItems.map((item, index) => ({
    ...item,
    weight_kg: Number(weights[index]?.replace(",", ".")) || null,
  }));
  const units = totalUnits(quoteItems);
  const totalWeight = totalWeightKg(quoteItems);

  async function save() {
    if (quoteItems.length === 0) {
      return toast.error("Adicione itens ao orçamento antes de gerar o frete");
    }
    for (const [label, place] of [
      ["retirada", origin],
      ["entrega", destination],
    ] as const) {
      if (!place.city.trim() || place.state.trim().length !== 2) {
        return toast.error(`Informe cidade e UF da ${label} (ou um CEP válido)`);
      }
    }
    if (totalWeight === null) {
      return toast.error("Informe o peso unitário de todos os itens");
    }
    setSaving(true);
    const fields = {
      origin_cep: origin.cep || null,
      origin_district: origin.district.trim() || null,
      origin_city: origin.city.trim(),
      origin_state: origin.state.trim().toUpperCase(),
      origin_floor: origin.floor,
      origin_stairs: origin.stairs,
      origin_address: origin.address.trim() || null,
      dest_address: destination.address.trim() || null,
      dest_cep: destination.cep || null,
      dest_district: destination.district.trim() || null,
      dest_city: destination.city.trim(),
      dest_state: destination.state.trim().toUpperCase(),
      dest_floor: destination.floor,
      dest_stairs: destination.stairs,
      load_details: loadDetails.trim() || null,
      loading_included: loadingIncluded,
      photo_note: photoNote.trim() || null,
      empty_load: emptyLoad,
      pickup_date: pickupDate || null,
      pickup_flexible: pickupFlexible,
      notes: notes.trim() || null,
    };
    const token = existing?.token ?? newFreightToken();
    const status = existing?.status === "fechada" ? "fechada" : "aberta";
    const query = supabase.from("freight_quotes" as never);
    const { data, error } = existing
      ? await query.update({ ...fields, status } as never).eq("id", existing.id).select("*").single()
      : await query
          .insert({
            ...fields,
            token,
            status,
            order_id: orderId ?? null,
            customer_label: customerLabel?.trim() || null,
            items: quoteItems,
          } as never)
          .select("*")
          .single();
    setSaving(false);
    if (error || !data) {
      return toast.error(`Não foi possível salvar a cotação: ${error?.message ?? "sem resposta"}`);
    }
    saveOrigin(origin);
    if (saveWeights) {
      // Weights typed here become the product size's default for the next quotes.
      const changed = quoteItems.filter(
        (item) =>
          item.size_id &&
          item.weight_kg &&
          Number(item.weight_kg) !== Number(item.catalog_weight_kg ?? 0),
      );
      const results = await Promise.all(
        changed.map((item) =>
          supabase
            .from("product_sizes" as never)
            .update({ weight_kg: item.weight_kg } as never)
            .eq("id", item.size_id as string),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) toast.error(`Peso não salvo no produto: ${failed.error.message}`);
      else if (changed.length) toast.success("Peso salvo no cadastro dos tamanhos");
    }
    const link = freightUrl(token);
    setCreated({ link, post: freightPostText(rowToPublic(data as unknown as FreightQuoteRow), link) });
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{created ? "Cotação de frete publicada" : "Cotação de frete"}</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Link para os grupos</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={created.link} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" onClick={() => void copyText(created.link, "Link")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Texto pronto para colar no grupo</Label>
              <Textarea
                readOnly
                rows={14}
                value={created.post}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => void copyText(created.post, "Texto")}>
                <Copy className="mr-2 h-4 w-4" /> Copiar texto completo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {units} vaso{units === 1 ? "" : "s"} no frete. O freteiro vê somente cidade, bairro e
              CEP, sem o endereço completo nem o nome do cliente.
            </p>
            {existing?.status === "respondida" && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <p className="font-medium">O cliente já preencheu os dados de entrega:</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>
                    {[existing.dest_address, existing.dest_district, existing.dest_city && `${existing.dest_city}/${existing.dest_state}`, existing.dest_cep && `CEP ${existing.dest_cep}`]
                      .filter(Boolean)
                      .join(", ")}
                  </li>
                  <li>
                    {existing.loading_included
                      ? `Com descarga · ${existing.dest_floor === "terreo" ? "térreo" : "andar superior"} · ${existing.dest_stairs ? "com escada" : "sem escada"}`
                      : "Apenas o frete (sem descarga)"}
                  </li>
                  {existing.access_notes && <li>{existing.access_notes}</li>}
                </ul>
                <p className="mt-1">Os campos abaixo já vêm preenchidos. Complete o que falta.</p>
              </div>
            )}
            <PlaceFields
              title="Retirada"
              value={origin}
              onChange={setOrigin}
              showAccess={loadingIncluded}
            />
            <PlaceFields
              title="Entrega"
              value={destination}
              onChange={setDestination}
              showAccess={loadingIncluded}
            />

            <fieldset className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Peso por item (kg, unitário)</legend>
              {baseItems.map((item, index) => (
                <div key={index} className="grid items-center gap-2 sm:grid-cols-[1fr_130px]">
                  <span className="text-sm">
                    {item.quantity}× {item.name}
                    {item.size ? <span className="text-muted-foreground"> · {item.size}</span> : null}
                  </span>
                  <Input
                    inputMode="decimal"
                    placeholder="kg"
                    value={weights[index] ?? ""}
                    onChange={(e) =>
                      setWeights((current) => current.map((w, i) => (i === index ? e.target.value : w)))
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Peso total: {totalWeight === null ? "preencha todos os itens" : `± ${totalWeight.toLocaleString("pt-BR")} kg`}
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={saveWeights}
                  onChange={(e) => setSaveWeights(e.target.checked)}
                />
                Salvar os pesos preenchidos no cadastro dos tamanhos dos produtos
              </label>
            </fieldset>
            <div>
              <Label className="text-xs">Outras informações da carga (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ex: O maior modelo tem 50x50 cm e pesa ± 60 kg (11 unidades). Os demais são menores e mais leves"
                value={loadDetails}
                onChange={(e) => setLoadDetails(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">
                Fotos: as fotos dos produtos do catálogo entram sozinhas na página. Aviso opcional
              </Label>
              <Input
                placeholder="Ex: Sem foto: os vasos ainda serão produzidos"
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
              />
            </div>
            <div className="grid items-end gap-2 sm:grid-cols-[180px_1fr]">
              <div>
                <Label className="text-xs">
                  Data de coleta{deadlineText ? ` (prazo: ${deadlineText})` : ""}
                </Label>
                <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={pickupFlexible}
                  onChange={(e) => setPickupFlexible(e.target.checked)}
                />
                Aceita data próxima
              </label>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={loadingIncluded}
                  onChange={(e) => setLoadingIncluded(e.target.checked)}
                />
                Inclui carga e descarga
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={emptyLoad}
                  onChange={(e) => setEmptyLoad(e.target.checked)}
                />
                Vasos vazios, sem plantas
              </label>
            </div>
            <div>
              <Label className="text-xs">Observações (aparecem para o freteiro)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "Salvando…" : existing ? "Salvar e publicar" : "Gerar link e texto"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Message the admin sends to the customer asking for the delivery data. */
export function customerFormMessage(name: string | undefined, link: string) {
  const first = name?.trim().split(/\s+/)[0];
  return [
    `Olá${first ? `, ${first}` : ""}! Para cotar o frete do seu pedido, preciso de alguns dados de entrega.`,
    "Preencha rapidinho neste link (leva menos de 1 minuto):",
    link,
  ].join("\n");
}

/**
 * Buttons used inside the quote editor: ask the customer for the delivery data
 * (form link by WhatsApp) or fill everything right away.
 */
export function FreightQuoteActions({
  items,
  orderId,
  customerLabel,
  customerPhone,
  deadlineText,
}: {
  items: FreightItem[];
  orderId?: string | null;
  customerLabel?: string;
  customerPhone?: string;
  deadlineText?: string;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [request, setRequest] = useState<{ link: string; message: string } | null>(null);

  async function askCustomer() {
    if (items.length === 0) return toast.error("Adicione itens ao orçamento antes de gerar o frete");
    setRequesting(true);
    const origin = loadSavedOrigin();
    const formToken = newFreightToken();
    const { error } = await supabase.from("freight_quotes" as never).insert({
      token: newFreightToken(),
      form_token: formToken,
      status: "aguardando_cliente",
      order_id: orderId ?? null,
      customer_label: customerLabel?.trim() || null,
      customer_phone: customerPhone?.trim() || null,
      origin_cep: origin.cep || null,
      origin_district: origin.district || null,
      origin_city: origin.city || null,
      origin_state: origin.state || null,
      origin_floor: origin.floor,
      origin_stairs: origin.stairs,
      // Calculated from the production deadline; the admin can edit it when publishing.
      pickup_date: pickupDateFromDeadline(deadlineText),
      pickup_flexible: true,
      items,
    } as never);
    setRequesting(false);
    if (error) return toast.error(`Não foi possível criar o formulário: ${error.message}`);
    const link = freightFormUrl(formToken);
    setRequest({ link, message: customerFormMessage(customerLabel, link) });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void askCustomer()} disabled={requesting}>
          <Send className="mr-2 h-4 w-4" />
          {requesting ? "Criando…" : "Pedir dados ao cliente"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
          <Truck className="mr-2 h-4 w-4" /> Gerar cotação de frete
        </Button>
      </div>

      <FreightQuoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        items={items}
        orderId={orderId}
        customerLabel={customerLabel}
        deadlineText={deadlineText}
      />

      <Dialog open={request !== null} onOpenChange={(next) => !next && setRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Formulário para o cliente</DialogTitle>
          </DialogHeader>
          {request && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O cliente preenche CEP, andar/escada e observações de acesso. Quando responder, a
                cotação aparece em <strong>Cotações de frete</strong> com o status "Cliente
                respondeu", pronta para você completar e publicar.
              </p>
              <Textarea readOnly rows={5} value={request.message} className="text-sm" />
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => void copyText(request.message, "Mensagem")}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar mensagem
                </Button>
                {customerPhone?.replace(/\D/g, "") ? (
                  <Button asChild>
                    <a
                      href={customerWhatsappUrl(customerPhone, request.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" /> Enviar no WhatsApp do cliente
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem telefone no orçamento: copie a mensagem e envie manualmente.
                  </p>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
