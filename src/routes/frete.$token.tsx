import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, PackageCheck } from "lucide-react";
import { useState } from "react";
import { getPublicFreight } from "@/lib/freight-server";
import { absoluteUrl } from "@/lib/site-config";
import {
  floorLabel,
  formatPickupDate,
  itemDimensions,
  mapsUrl,
  placeShort,
  totalUnits,
  totalWeightKg,
  type FreightPlace,
} from "@/lib/freight";

export const Route = createFileRoute("/frete/$token")({
  // Loaded on the server so the link preview (WhatsApp, Facebook) already carries the freight data.
  loader: async ({ params }) => getPublicFreight({ data: params.token }),
  head: ({ loaderData, params }) => {
    const quote = loaderData?.quote ?? null;
    const units = quote ? totalUnits(quote.items) : 0;
    const weight = quote ? totalWeightKg(quote.items) : null;
    const title = quote
      ? `Frete: ${units} vaso${units === 1 ? "" : "s"} de concreto · ${quote.origin.district ?? quote.origin.city} → ${quote.destination.district ?? quote.destination.city}`
      : "Cotação de frete — Arteno";
    const description = quote
      ? [
          `Retirada em ${placeShort(quote.origin)}, entrega em ${placeShort(quote.destination)}.`,
          weight !== null ? `Peso total ± ${weight.toLocaleString("pt-BR")} kg.` : null,
          quote.status === "fechada" ? "Frete encerrado." : "Veja os detalhes e envie sua cotação.",
        ]
          .filter(Boolean)
          .join(" ")
      : "Detalhes do frete e envio de cotação.";
    const image =
      quote?.items.find((item) => item.image_url)?.image_url ?? absoluteUrl("/images/og-arteno.jpg");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow, noarchive" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl(`/frete/${params.token}`) },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: FreightQuotePage,
});

const inputClass =
  "w-full border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

function PlaceBlock({
  title,
  place,
  showAccess,
}: {
  title: string;
  place: FreightPlace;
  showAccess: boolean;
}) {
  return (
    <div className="border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 font-display text-xl text-primary">{placeShort(place)}</p>
      {place.cep && <p className="mt-1 text-sm text-muted-foreground">CEP {place.cep}</p>}
      {showAccess && <p className="mt-1 text-sm text-muted-foreground">{floorLabel(place)}</p>}
      <a
        href={mapsUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        Ver no Google Maps
      </a>
    </div>
  );
}

function FreightQuotePage() {
  const { token } = Route.useParams();
  const { quote, error: loadError } = Route.useLoaderData();
  const state = loadError ? "error" : quote ? "ready" : "notfound";
  const [formOpen, setFormOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    price: "",
    notes: "",
    website: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/freight/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price.replace(",", ".")) }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; whatsappUrl?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Não foi possível enviar sua cotação.");
        return;
      }
      if (data.whatsappUrl) {
        setSentUrl(data.whatsappUrl);
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      } else {
        setSentUrl("");
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  const wrapper = (children: React.ReactNode) => (
    <main className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">{children}</div>
    </main>
  );

  if (state === "notfound" || state === "error" || !quote) {
    return wrapper(
      <div className="border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl text-primary">
          {state === "notfound" ? "Cotação não encontrada" : "Não foi possível carregar"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {state === "notfound"
            ? "Confira se o link está completo ou peça um novo link."
            : "Tente novamente em alguns instantes."}
        </p>
      </div>,
    );
  }

  const closed = quote.status === "fechada";
  const pickup = formatPickupDate(quote.pickupDate);
  const units = totalUnits(quote.items);
  const weight = totalWeightKg(quote.items);

  return wrapper(
    <div className="border border-border bg-card p-6 sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Cotação de frete · Ref. {quote.token}
      </p>
      <h1 className="mt-3 font-display text-3xl text-primary sm:text-4xl">
        Transporte de {units} vaso{units === 1 ? "" : "s"} de concreto
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        A Arteno procura transportador para esta carga. Confira os detalhes e, se tiver interesse,
        envie sua cotação.
      </p>

      {closed && (
        <div className="mt-6 border border-border bg-muted px-4 py-3 text-sm font-medium text-foreground">
          Este frete já foi encerrado e não recebe mais cotações.
        </div>
      )}

      <section className="mt-8 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <PlaceBlock title="Coleta" place={quote.origin} showAccess={quote.loadingIncluded} />
        <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <PlaceBlock
          title="Entrega"
          place={quote.destination}
          showAccess={quote.loadingIncluded}
        />
      </section>

      <section className="mt-8 border-y border-border py-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Carga
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="border border-border bg-white p-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Quantidade</p>
            <p className="mt-1 font-display text-2xl text-primary">
              {units} vaso{units === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border border-border bg-white p-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Peso total</p>
            <p className="mt-1 font-display text-2xl text-primary">
              {weight !== null ? `± ${weight.toLocaleString("pt-BR")} kg` : "—"}
            </p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {quote.items.map((item, index) => {
            const measures = itemDimensions(item);
            const code = (item.size ?? "").split("—")[0].trim();
            return (
              <li key={`${item.name}-${index}`} className="flex items-center gap-4 py-4">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    loading="lazy"
                    className="h-24 w-24 shrink-0 border border-border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg text-foreground">
                    {item.name}
                    {code && <span className="ml-2 text-sm text-muted-foreground">{code}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold text-foreground">
                    {measures && (
                      <span className="border border-primary/30 bg-primary/5 px-2.5 py-1">
                        📏 {measures}
                      </span>
                    )}
                    {item.weight_kg ? (
                      <span className="border border-primary/30 bg-primary/5 px-2.5 py-1">
                        ⚖️ ± {item.weight_kg.toLocaleString("pt-BR")} kg cada
                      </span>
                    ) : null}
                  </div>
                </div>
                <strong className="shrink-0 text-lg text-foreground">{item.quantity} un.</strong>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Condições
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          <li>
            🚛{" "}
            {quote.loadingIncluded ? (
              <>Frete <strong>com carga/descarga</strong></>
            ) : (
              <>Somente o frete, <strong>sem carga/descarga</strong></>
            )}
          </li>
          {quote.photoNote && <li>📷 {quote.photoNote}</li>}
          {weight !== null && (
            <li>
              ⚖️ Peso total: <strong>± {weight.toLocaleString("pt-BR")} kg</strong>
            </li>
          )}
          {quote.loadDetails && <li className="whitespace-pre-line">📐 {quote.loadDetails}</li>}
          {pickup && (
            <li>
              📅 Data de coleta: <strong>{pickup}</strong>
              {quote.pickupFlexible ? " ou próxima" : ""}
            </li>
          )}
          <li>
            {quote.sharedLoad ? (
              <>🤝 <strong>Pode ser carga compartilhada</strong></>
            ) : (
              <>🚫 <strong>Carga exclusiva</strong>, sem compartilhar</>
            )}
          </li>
          {quote.emptyLoad && <li>🌿 Os vasos vão vazios, sem plantas</li>}
          {quote.notes && <li className="whitespace-pre-line">📝 {quote.notes}</li>}
        </ul>
      </section>

      {!closed && sentUrl === null && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="mt-8 flex w-full items-center justify-center gap-3 bg-[#1f8f4e] px-6 py-5 text-center font-medium text-white transition hover:bg-[#197a42]"
        >
          <PackageCheck className="h-6 w-6" />
          Enviar cotação
        </button>
      )}

      {!closed && sentUrl === null && formOpen && (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <h2 className="font-display text-2xl text-primary">Sua cotação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Nome ou empresa
              </span>
              <input
                required
                maxLength={120}
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                WhatsApp com DDD
              </span>
              <input
                required
                type="tel"
                inputMode="tel"
                maxLength={30}
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Valor do frete (R$)
              </span>
              <input
                required
                inputMode="decimal"
                className={inputClass}
                placeholder="Ex: 2500,00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Observações (opcional)
            </span>
            <textarea
              rows={3}
              maxLength={1000}
              className={inputClass}
              placeholder="Tipo de veículo, ajudante para descarga, seguro…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="flex w-full items-center justify-center gap-3 bg-[#1f8f4e] px-6 py-4 font-medium text-white transition hover:bg-[#197a42] disabled:opacity-60"
          >
            <MessageCircle className="h-5 w-5" />
            {sending ? "Enviando…" : "Enviar cotação e falar no WhatsApp"}
          </button>
        </form>
      )}

      {sentUrl !== null && (
        <div className="mt-8 border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Cotação enviada!</p>
          <p className="mt-1">
            Registramos sua proposta. A conversa no WhatsApp deve abrir automaticamente para
            combinarmos os detalhes.
          </p>
          {sentUrl && (
            <a
              href={sentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 font-medium underline"
            >
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
            </a>
          )}
        </div>
      )}
    </div>,
  );
}
