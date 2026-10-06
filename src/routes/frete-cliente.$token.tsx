import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { lookupCep, maskCep } from "@/lib/freight";

export const Route = createFileRoute("/frete-cliente/$token")({
  head: () => ({
    meta: [
      { title: "Dados de entrega — Arteno Vaso & Decor" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomerFreightFormPage,
});

const inputClass =
  "w-full border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground";

type FormInfo = { open: boolean; units: number; customerName: string | null; answered: boolean };

function CustomerFreightFormPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [form, setForm] = useState({
    service: "" as "" | "frete" | "descarga",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    floor: "terreo",
    stairs: false,
    accessNotes: "",
    website: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/freight-form/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) return setState("notfound");
        setInfo((await response.json()) as FormInfo);
        setState("ready");
      })
      .catch(() => !cancelled && setState("notfound"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCep(raw: string) {
    const cep = maskCep(raw);
    setForm((current) => ({ ...current, cep }));
    if (cep.length !== 9) return;
    setLookingUp(true);
    const found = await lookupCep(cep);
    setLookingUp(false);
    if (found) {
      setForm((current) => ({ ...current, ...found, street: found.street || current.street }));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!form.service) return setError("Escolha se precisa apenas do frete ou também de descarga.");
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/freight-form/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, needsUnloading: form.service === "descarga" }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) return setError(data.error ?? "Não foi possível enviar.");
      setDone(true);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  const wrapper = (children: React.ReactNode) => (
    <main className="min-h-[calc(100vh-96px)] bg-white py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">{children}</div>
    </main>
  );

  if (state === "loading") {
    return wrapper(<p className="text-center text-muted-foreground">Carregando…</p>);
  }
  if (state === "notfound" || !info) {
    return wrapper(
      <div className="border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl text-primary">Link não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Confira se o link está completo ou peça um novo à Arteno.
        </p>
      </div>,
    );
  }
  if (done || !info.open) {
    return wrapper(
      <div className="border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#1f8f4e]" />
        <h1 className="mt-4 font-display text-3xl text-primary">
          {done ? "Dados recebidos!" : "Formulário encerrado"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {done
            ? "Obrigado! Com essas informações a Arteno já cota o frete e retorna para você."
            : "Já recebemos seus dados e o frete está em cotação. Qualquer dúvida, fale com a Arteno."}
        </p>
      </div>,
    );
  }

  return wrapper(
    <div className="border border-border bg-card p-6 sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Frete do seu pedido
      </p>
      <h1 className="mt-3 font-display text-3xl text-primary sm:text-4xl">
        {info.customerName ? `${info.customerName.split(" ")[0]}, para onde vamos entregar?` : "Para onde vamos entregar?"}
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Precisamos de poucas informações para cotar o frete
        {info.units > 0 ? ` de ${info.units} vaso${info.units === 1 ? "" : "s"}` : ""}. Leva menos de
        um minuto.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <fieldset>
          <legend className={labelClass}>O que você precisa?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["frete", "Apenas o frete", "Você recebe e descarrega por conta própria."],
                ["descarga", "Frete e descarga", "O transportador também ajuda a descarregar."],
              ] as const
            ).map(([value, title, hint]) => (
              <label
                key={value}
                className={`cursor-pointer border p-4 transition ${
                  form.service === value ? "border-primary bg-primary/5" : "border-border bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  value={value}
                  checked={form.service === value}
                  onChange={() => setForm({ ...form, service: value })}
                  className="sr-only"
                />
                <span className="block font-medium text-foreground">{title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <label className="block">
            <span className={labelClass}>CEP de entrega</span>
            <input
              required
              inputMode="numeric"
              placeholder="00000-000"
              className={inputClass}
              value={form.cep}
              onChange={(e) => void handleCep(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Bairro {lookingUp ? "(buscando…)" : ""}</span>
            <input
              className={inputClass}
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
          <label className="block">
            <span className={labelClass}>Cidade</span>
            <input
              required
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>UF</span>
            <input
              required
              maxLength={2}
              className={inputClass}
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <label className="block">
            <span className={labelClass}>Rua</span>
            <input
              required
              className={inputClass}
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Número</span>
            <input
              required
              className={inputClass}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Complemento (opcional)</span>
          <input
            className={inputClass}
            placeholder="Apto, bloco, casa, condomínio…"
            value={form.complement}
            onChange={(e) => setForm({ ...form, complement: e.target.value })}
          />
        </label>

        {form.service === "descarga" && (
        <div className="space-y-5 border-l-2 border-primary/30 pl-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Local da entrega</span>
            <select
              className={inputClass}
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            >
              <option value="terreo">Térreo</option>
              <option value="superior">Andar superior</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.stairs}
              onChange={(e) => setForm({ ...form, stairs: e.target.checked })}
            />
            Tem escada até o local
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Observações de acesso (opcional)</span>
          <textarea
            rows={3}
            maxLength={500}
            className={inputClass}
            placeholder="Condomínio, horário de recebimento, rua estreita, guincho…"
            value={form.accessNotes}
            onChange={(e) => setForm({ ...form, accessNotes: e.target.value })}
          />
        </label>
        </div>
        )}

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
          className="w-full bg-[#1f8f4e] px-6 py-4 font-medium text-white transition hover:bg-[#197a42] disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Enviar dados de entrega"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Seu endereço completo fica restrito à Arteno e só é repassado ao transportador escolhido.
        </p>
      </form>
    </div>,
  );
}
