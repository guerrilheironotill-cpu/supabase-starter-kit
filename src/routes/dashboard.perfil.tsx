import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, ShieldAlert, UserCog, Mail, KeyRound } from "lucide-react";

export const Route = createFileRoute("/dashboard/perfil")({
  head: () => ({
    meta: [{ title: "Meu perfil — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardProfilePage,
});

type Msg = { kind: "ok" | "err"; text: string } | null;

function DashboardProfilePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.user.id);
      setCurrentEmail(data.user.email ?? "");
      setNewEmail(data.user.email ?? "");
      const meta = (data.user.user_metadata ?? {}) as { full_name?: string };
      setFullName(meta.full_name ?? "");
      setChecking(false);
    })();
  }, [navigate]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    setProfileSaving(false);
    if (error) {
      setProfileMsg({ kind: "err", text: error.message });
      return;
    }
    setProfileMsg({ kind: "ok", text: "Perfil atualizado." });
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || newEmail === currentEmail) {
      setEmailMsg({ kind: "err", text: "Informe um e-mail diferente do atual." });
      return;
    }
    setEmailSaving(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) {
      setEmailMsg({ kind: "err", text: error.message });
      return;
    }
    setEmailMsg({
      kind: "ok",
      text: "Enviamos um link de confirmação para o novo e-mail. Clique nele para concluir a alteração.",
    });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwdMsg({ kind: "err", text: "A senha deve ter ao menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ kind: "err", text: "As senhas não coincidem." });
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwdMsg({
        kind: "err",
        text: "Use ao menos uma letra maiúscula, uma minúscula e um número.",
      });
      return;
    }
    setPwdSaving(true);
    setPwdMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwdSaving(false);
    if (error) {
      setPwdMsg({ kind: "err", text: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPwdMsg({ kind: "ok", text: "Senha atualizada com sucesso." });
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-start gap-3 border border-border bg-card p-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Sessão expirada</h1>
            <Link
              to="/auth"
              className="mt-4 inline-flex bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Entrar novamente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize seus dados pessoais, e-mail de acesso e senha.
        </p>
      </div>

      <form onSubmit={saveProfile} className="space-y-5 border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-primary">
          <UserCog className="h-4 w-4" /> Dados pessoais
        </h2>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Nome completo
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 block w-full max-w-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {profileMsg && (
          <p
            className={`text-xs ${profileMsg.kind === "ok" ? "text-primary" : "text-destructive"}`}
          >
            {profileMsg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={profileSaving}
          className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {profileSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar perfil
        </button>
      </form>

      <form onSubmit={saveEmail} className="space-y-5 border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-primary">
          <Mail className="h-4 w-4" /> E-mail de acesso
        </h2>
        <p className="text-xs text-muted-foreground">
          Atual: <span className="font-mono">{currentEmail}</span>
        </p>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Novo e-mail <span className="text-destructive">*</span>
          </span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="mt-2 block w-full max-w-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {emailMsg && (
          <p className={`text-xs ${emailMsg.kind === "ok" ? "text-primary" : "text-destructive"}`}>
            {emailMsg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={emailSaving}
          className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {emailSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Alterar e-mail
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-5 border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-primary">
          <KeyRound className="h-4 w-4" /> Senha
        </h2>
        <p className="text-xs text-muted-foreground">
          Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número. A alteração vale
          imediatamente.
        </p>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Nova senha <span className="text-destructive">*</span>
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="mt-2 block w-full max-w-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Confirmar nova senha <span className="text-destructive">*</span>
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="mt-2 block w-full max-w-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        {pwdMsg && (
          <p className={`text-xs ${pwdMsg.kind === "ok" ? "text-primary" : "text-destructive"}`}>
            {pwdMsg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={pwdSaving}
          className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Trocar senha
        </button>
      </form>
    </div>
  );
}
