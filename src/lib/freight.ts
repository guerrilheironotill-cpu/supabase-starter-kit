export type FreightItem = {
  /** Catalog product, used to pull its photo into the public page. */
  product_id?: string | null;
  /** Filled on the server for the public page; never stored. */
  image_url?: string | null;
  name: string;
  quantity: number;
  size?: string | null;
  height?: number | null;
  width?: number | null;
  length?: number | null;
  /** Catalog size this line came from (lets the weight be saved back to the product). */
  size_id?: string | null;
  /** Unit weight in kg used in this quote. */
  weight_kg?: number | null;
  /** Unit weight registered on the product size when the quote was created. */
  catalog_weight_kg?: number | null;
};

export type FreightPlace = {
  cep: string | null;
  district: string | null;
  city: string;
  state: string;
  floor: "terreo" | "superior";
  stairs: boolean;
};

/** What the public page shows. Never contains customer name, street address or prices. */
export type PublicFreightQuote = {
  token: string;
  status: "aberta" | "fechada";
  createdAt: string;
  origin: FreightPlace;
  destination: FreightPlace;
  items: FreightItem[];
  loadDetails: string | null;
  loadingIncluded: boolean;
  photoNote: string | null;
  /** True when the items come from the catalog, so photos are shown automatically. */
  hasPhotos: boolean;
  emptyLoad: boolean;
  pickupDate: string | null;
  pickupFlexible: boolean;
  notes: string | null;
};

export type FreightStatus = "aguardando_cliente" | "respondida" | "aberta" | "fechada";

export const FREIGHT_STATUS_LABEL: Record<FreightStatus, string> = {
  aguardando_cliente: "Aguardando cliente",
  respondida: "Cliente respondeu",
  aberta: "Aberta para cotações",
  fechada: "Encerrada",
};

export type FreightQuoteRow = {
  id: string;
  token: string;
  form_token: string | null;
  order_id: string | null;
  status: FreightStatus;
  customer_label: string | null;
  customer_phone: string | null;
  customer_answered_at: string | null;
  access_notes: string | null;
  origin_address: string | null;
  dest_address: string | null;
  origin_cep: string | null;
  origin_district: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_floor: "terreo" | "superior";
  origin_stairs: boolean;
  dest_cep: string | null;
  dest_district: string | null;
  dest_city: string | null;
  dest_state: string | null;
  dest_floor: "terreo" | "superior";
  dest_stairs: boolean;
  items: FreightItem[];
  load_details: string | null;
  loading_included: boolean;
  photo_note: string | null;
  empty_load: boolean;
  pickup_date: string | null;
  pickup_flexible: boolean;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
};

export function newFreightToken() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function freightUrl(token: string) {
  return `${window.location.origin}/frete/${token}`;
}

export function freightFormUrl(formToken: string) {
  return `${window.location.origin}/frete-cliente/${formToken}`;
}

/** wa.me link that opens a chat with the customer's own number. */
export function customerWhatsappUrl(phone: string, message: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function rowToPublic(row: FreightQuoteRow): PublicFreightQuote {
  return {
    token: row.token,
    status: row.status === "fechada" ? "fechada" : "aberta",
    createdAt: row.created_at,
    origin: {
      cep: row.origin_cep,
      district: row.origin_district,
      city: row.origin_city ?? "",
      state: row.origin_state ?? "",
      floor: row.origin_floor,
      stairs: row.origin_stairs,
    },
    destination: {
      cep: row.dest_cep,
      district: row.dest_district,
      city: row.dest_city ?? "",
      state: row.dest_state ?? "",
      floor: row.dest_floor,
      stairs: row.dest_stairs,
    },
    // Only what carriers need: no catalog ids, no customer data.
    items: (Array.isArray(row.items) ? row.items : []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      size: item.size ?? null,
      height: item.height ?? null,
      width: item.width ?? null,
      length: item.length ?? null,
      weight_kg: item.weight_kg ?? null,
    })),
    loadDetails: row.load_details,
    loadingIncluded: row.loading_included,
    photoNote: row.photo_note,
    hasPhotos: (Array.isArray(row.items) ? row.items : []).some((item) =>
      Boolean(item.product_id || item.size_id),
    ),
    emptyLoad: row.empty_load,
    pickupDate: row.pickup_date,
    pickupFlexible: row.pickup_flexible,
    // access_notes and the street addresses stay private (chosen carrier only).
    notes: row.notes,
  };
}

export function floorLabel(place: Pick<FreightPlace, "floor" | "stairs">) {
  const floor = place.floor === "terreo" ? "Térreo" : "Andar superior";
  return `${floor} · ${place.stairs ? "com escada" : "sem escada"}`;
}

/** "Jurerê/Florianópolis" (district + city), or just "Florianópolis/SC" without a district. */
export function placeShort(place: Pick<FreightPlace, "district" | "city" | "state">) {
  return place.district ? `${place.district}/${place.city}` : `${place.city}/${place.state}`;
}

export function mapsUrl(place: Pick<FreightPlace, "cep" | "city" | "state">) {
  const query = place.cep ?? `${place.city} ${place.state}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function formatPickupDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}` : value;
}

/** Sum of unit weight x quantity; null when any line has no weight yet. */
export function totalWeightKg(items: FreightItem[]) {
  if (items.length === 0) return null;
  let total = 0;
  for (const item of items) {
    const weight = Number(item.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) return null;
    total += weight * (Number(item.quantity) || 0);
  }
  return Math.round(total * 10) / 10;
}

export function totalUnits(items: FreightItem[]) {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

export function itemDimensions(item: FreightItem) {
  if (item.height && item.width && item.length) {
    return `${item.height} × ${item.width} × ${item.length} cm`;
  }
  return null;
}

export async function lookupCep(cep: string) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await response.json()) as {
      localidade?: string;
      uf?: string;
      bairro?: string;
      logradouro?: string;
      erro?: boolean;
    };
    if (data.erro || !data.localidade || !data.uf) return null;
    return {
      city: data.localidade,
      state: data.uf,
      district: data.bairro ?? "",
      street: data.logradouro ?? "",
    };
  } catch {
    return null;
  }
}

/** Ready-to-paste text for the Facebook groups, in the same format used manually before. */
export function freightPostText(quote: PublicFreightQuote, link: string) {
  const units = totalUnits(quote.items);
  const date = formatPickupDate(quote.pickupDate);
  const weight = totalWeightKg(quote.items);
  // Floor and stairs only matter when the carrier also has to unload.
  const place = (title: string, emoji: string, p: FreightPlace) =>
    [
      `${emoji} *${title}:* ${p.cep ? `CEP ${p.cep} – ` : ""}${placeShort(p)}`,
      `🗺️ ${mapsUrl(p)}`,
      quote.loadingIncluded ? `🏠 ${floorLabel(p)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  const rules = [
    quote.loadingIncluded
      ? "🚛 Frete *com carga/descarga*"
      : "🚛 Somente o frete, *sem carga/descarga*",
    quote.photoNote || quote.hasPhotos
      ? `📷 ${quote.photoNote ?? "Fotos dos vasos na página do link"}`
      : null,
    weight !== null ? `⚖️ Peso total: *± ${weight.toLocaleString("pt-BR")} kg*` : null,
    quote.loadDetails ? `📐 ${quote.loadDetails}` : null,
    date ? `📅 Data: *${date}*${quote.pickupFlexible ? " ou próxima" : ""}` : null,
    quote.emptyLoad ? "🪴 Os vasos vão vazios, sem plantas" : null,
    quote.notes ? `📝 ${quote.notes}` : null,
  ].filter(Boolean) as string[];
  const separator = "━━━━━━━━━━━━━━━";
  return [
    "🚚 *PRECISO DE FRETE* 🚚",
    `Transporte de ${units} vaso${units === 1 ? "" : "s"} de concreto`,
    `📍 ${quote.origin.district ?? quote.origin.city} ➡️ ${quote.destination.district ?? quote.destination.city}`,
    "",
    place("Retirada", "📦", quote.origin),
    "",
    place("Entrega", "🏁", quote.destination),
    "",
    separator,
    "",
    ...rules.map((rule, index) => `${index + 1}️⃣ ${rule}`),
    "",
    separator,
    "",
    `👉 Para ver os detalhes e enviar sua cotação: ${link}`,
  ].join("\n");
}

/** Message for the chosen carrier only: the one place the full addresses are shared. */
export function chosenCarrierMessage(row: FreightQuoteRow, carrierName: string) {
  const date = formatPickupDate(row.pickup_date);
  const addressLine = (cep: string | null, address: string | null, district: string | null, city: string | null, state: string | null) =>
    [address, district, [city, state].filter(Boolean).join("/"), cep ? `CEP ${cep}` : null]
      .filter(Boolean)
      .join(", ");
  return [
    `Olá, ${carrierName}! Fechamos o frete (ref. ${row.token}). Seguem os endereços completos:`,
    "",
    `📦 *Retirada:* ${addressLine(row.origin_cep, row.origin_address, row.origin_district, row.origin_city, row.origin_state)}`,
    `🏁 *Entrega:* ${addressLine(row.dest_cep, row.dest_address, row.dest_district, row.dest_city, row.dest_state)}`,
    row.loading_included
      ? `🏠 Entrega: ${floorLabel({ floor: row.dest_floor, stairs: row.dest_stairs })}`
      : null,
    row.access_notes ? `📝 ${row.access_notes}` : null,
    date ? `📅 Coleta: ${date}${row.pickup_flexible ? " ou próxima" : ""}` : null,
    "",
    "Pode confirmar o horário?",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Pickup date from a free-text production deadline such as "15 dias úteis", "10 a 15 dias"
 * or "3 semanas": today plus the (largest) number found. Business days skip weekends.
 * Returns yyyy-mm-dd, or null when no number is found.
 */
export function pickupDateFromDeadline(text: string | null | undefined, from = new Date()) {
  const numbers = (text ?? "").match(/\d+/g)?.map(Number) ?? [];
  const amount = numbers.length ? Math.max(...numbers) : 0;
  if (!amount) return null;
  const normalized = (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const weeks = /semana/.test(normalized);
  const businessDays = /util|uteis/.test(normalized);
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (businessDays) {
    let remaining = weeks ? amount * 5 : amount;
    while (remaining > 0) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
  } else {
    date.setDate(date.getDate() + (weeks ? amount * 7 : amount));
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
