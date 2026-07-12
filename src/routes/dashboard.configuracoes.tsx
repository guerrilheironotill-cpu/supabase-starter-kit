import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/lib/site-settings";
import { Loader2, Save, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/dashboard/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardSettingsPage,
});

function DashboardSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSiteSettings();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

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

  useEffect(() => {
    if (settings?.whatsapp_number) setWhatsapp(settings.whatsapp_number);
  }, [settings?.whatsapp_number]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings?.id) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("site_settings" as never)
      .update({ whatsapp_number: whatsapp })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setMsg({ kind: "ok", text: "Salvo com sucesso." });
    qc.invalidateQueries({ queryKey: ["site-settings"] });
  }

  if (checking || isLoading) {
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
        Configurações do site
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ajuste as informações de contato usadas em todo o site.
      </p>

      <form
        onSubmit={save}
        className="mt-8 space-y-5 border border-border bg-card p-6"
      >
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Número de WhatsApp
          </span>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="5548988486279"
            className="mt-2 block w-full max-w-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Formato internacional, apenas números (ex.: 5548988486279).
          </span>
        </label>

        {msg && (
          <p
            className={`text-xs ${
              msg.kind === "ok" ? "text-primary" : "text-destructive"
            }`}
          >
            {msg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </button>
      </form>
    </div>
  );
}