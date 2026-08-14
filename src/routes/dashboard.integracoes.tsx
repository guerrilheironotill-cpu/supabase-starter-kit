import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Save,
  ShieldAlert,
  BarChart3,
  Facebook,
  ShoppingBag,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardIntegrationsPage,
});

function DashboardIntegrationsPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [ga4, setGa4] = useState("");
  const [metaPixel, setMetaPixel] = useState("");
  const [fbCatalogId, setFbCatalogId] = useState("");
  const [integSaved, setIntegSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("integrations");
      if (raw) {
        const p = JSON.parse(raw);
        setGa4(p.ga4 ?? "");
        setMetaPixel(p.metaPixel ?? "");
        setFbCatalogId(p.fbCatalogId ?? "");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      setIsAdmin(!error && !!data);
      setChecking(false);
    })();
  }, [navigate]);

  function saveIntegrations(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(
      "integrations",
      JSON.stringify({ ga4, metaPixel, fbCatalogId }),
    );
    setIntegSaved(true);
    setTimeout(() => setIntegSaved(false), 2500);
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-start gap-3 border border-border bg-card p-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu usuário não tem permissão de administrador.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Voltar para home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        Integrações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole aqui os IDs quando estiverem prontos. Cada bloco tem o passo a passo
        para obter o valor.
      </p>

      <form
        onSubmit={saveIntegrations}
        className="mt-6 space-y-6 border border-border bg-card p-6"
      >
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <Search className="mt-0.5 h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Google Search Console
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                Conectado
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Conta autorizada via OAuth. Cliques, impressões e top páginas já
              aparecem na Visão geral.
            </p>
          </div>
        </div>

        <IntegrationField
          icon={<BarChart3 className="h-4 w-4" />}
          label="Google Analytics 4 — Measurement ID"
          placeholder="G-XXXXXXXXXX"
          value={ga4}
          onChange={setGa4}
          validate={(v) => /^G-[A-Z0-9]{6,12}$/.test(v.trim())}
          hint="Formato esperado: G- seguido de 6 a 12 letras/números maiúsculos."
          steps={[
            "Acesse analytics.google.com e faça login com a conta do site.",
            "No menu inferior esquerdo, clique em Administrador (engrenagem).",
            "Em Propriedade, escolha a propriedade GA4 do site.",
            "Clique em Fluxos de dados → selecione o fluxo Web do domínio.",
            "Copie o valor de ID da métrica (começa com G-) e cole ao lado.",
          ]}
        />

        <IntegrationField
          icon={<Facebook className="h-4 w-4" />}
          label="Meta Pixel — Pixel ID"
          placeholder="1234567890123456"
          value={metaPixel}
          onChange={setMetaPixel}
          validate={(v) => /^\d{15,16}$/.test(v.trim())}
          hint="Formato esperado: 15 ou 16 dígitos numéricos."
          steps={[
            "Acesse business.facebook.com e entre no Gerenciador de Negócios.",
            "Vá em Gerenciador de Eventos (Events Manager) no menu lateral.",
            "Selecione o Pixel usado no site atual (ou crie um novo em Conectar fontes de dados → Web).",
            "Copie o número de 15–16 dígitos que aparece abaixo do nome do Pixel.",
            "Cole ao lado — é só o número, sem prefixo.",
          ]}
        />

        <IntegrationField
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Catálogo do Facebook — Catalog ID"
          placeholder="9876543210987654"
          value={fbCatalogId}
          onChange={setFbCatalogId}
          validate={(v) => /^\d{10,20}$/.test(v.trim())}
          hint="Formato esperado: 10 a 20 dígitos numéricos."
          steps={[
            "Acesse business.facebook.com → Gerenciador de Comércio (Commerce Manager).",
            "Selecione o catálogo existente do site atual (ou crie um novo do tipo E-commerce).",
            "Em Configurações do catálogo, copie o ID do catálogo (número longo).",
            "Depois de colar aqui, avise para eu ativar o feed em /feeds/facebook-catalog.xml.",
            "No Commerce Manager, vá em Fontes de dados → Adicionar itens → Feed de dados → Feed programado e cole a URL do feed.",
          ]}
        />

        {integSaved && (
          <p className="text-xs text-primary">Integrações salvas localmente.</p>
        )}

        <button
          type="submit"
          className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Save className="h-4 w-4" />
          Salvar integrações
        </button>
      </form>
    </div>
  );
}

function IntegrationField({
  icon,
  label,
  placeholder,
  value,
  onChange,
  steps,
  validate,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  steps: string[];
  validate: (v: string) => boolean;
  hint?: string;
}) {
  const filled = value.trim().length > 0;
  const connected = filled && validate(value);
  const invalid = filled && !connected;
  return (
    <div className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <label className="flex-1 min-w-[260px]">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <span className="text-primary">{icon}</span>
            {label}
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${
                connected
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                    : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                }`}
              />
              {connected ? "Conectado" : invalid ? "Formato inválido" : "Não conectado"}
            </span>
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`mt-2 block w-full max-w-md border bg-transparent px-3 py-2 text-sm outline-none ${
              invalid
                ? "border-red-500 focus:border-red-500"
                : "border-border focus:border-primary"
            }`}
          />
          {invalid && hint && (
            <span className="mt-1 block text-[11px] text-red-600">{hint}</span>
          )}
        </label>
      </div>
      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">
          Como obter — passo a passo
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
