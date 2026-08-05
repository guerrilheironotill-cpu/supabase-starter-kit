import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  OPEN_COOKIE_PREFERENCES_EVENT,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = readCookieConsent();
    if (current) {
      setAnalytics(current.analytics);
      setMarketing(current.marketing);
    } else {
      setVisible(true);
    }
    const openPreferences = () => {
      const saved = readCookieConsent();
      setAnalytics(saved?.analytics ?? false);
      setMarketing(saved?.marketing ?? false);
      setPreferencesOpen(true);
      setVisible(false);
    };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences);
  }, []);

  const choose = (nextAnalytics: boolean, nextMarketing: boolean) => {
    saveCookieConsent({ analytics: nextAnalytics, marketing: nextMarketing });
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setVisible(false);
    setPreferencesOpen(false);
  };

  return (
    <>
      {visible && (
        <section
          role="region"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-16 z-[60] mx-auto max-w-4xl border border-primary/15 bg-white p-5 text-primary shadow-2xl lg:bottom-5"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="font-display text-xl">Sua privacidade importa</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-primary/75">
                Usamos recursos necessários para o funcionamento do site e, com sua autorização,
                tecnologias de análise e publicidade. Você pode alterar sua escolha quando quiser.{" "}
                <Link to="/politica-de-cookies" className="font-medium underline underline-offset-2">
                  Política de Cookies
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button type="button" onClick={() => choose(false, false)} className="border border-primary px-4 py-2 text-sm font-medium hover:bg-primary/5">
                Recusar não essenciais
              </button>
              <button type="button" onClick={() => { setPreferencesOpen(true); setVisible(false); }} className="border border-primary px-4 py-2 text-sm font-medium hover:bg-primary/5">
                Personalizar
              </button>
              <button type="button" onClick={() => choose(true, true)} className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Aceitar todos
              </button>
            </div>
          </div>
        </section>
      )}

      {preferencesOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            className="w-full max-w-lg bg-white p-6 text-primary shadow-2xl"
          >
            <h2 id="cookie-preferences-title" className="font-display text-2xl">Preferências de cookies</h2>
            <p className="mt-2 text-sm leading-relaxed text-primary/70">
              Escolha quais categorias opcionais podem ser utilizadas. Os recursos necessários
              permanecem ativos para garantir o funcionamento e a segurança do site.
            </p>
            <div className="mt-5 divide-y divide-primary/10 border-y border-primary/10">
              <PreferenceRow
                title="Necessários"
                description="Login, segurança, preferências essenciais e funcionamento do site."
                checked
                disabled
                onChange={() => undefined}
              />
              <PreferenceRow
                title="Análise"
                description="Ajuda a entender visitas e desempenho, como o Google Analytics."
                checked={analytics}
                onChange={setAnalytics}
              />
              <PreferenceRow
                title="Publicidade"
                description="Medição de campanhas e anúncios personalizados, como Meta Pixel e Google Ads."
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => choose(false, false)} className="border border-primary px-4 py-2 text-sm font-medium">
                Recusar não essenciais
              </button>
              <button type="button" onClick={() => choose(analytics, marketing)} className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Salvar preferências
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function PreferenceRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 py-4">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-primary/65">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
    </label>
  );
}
