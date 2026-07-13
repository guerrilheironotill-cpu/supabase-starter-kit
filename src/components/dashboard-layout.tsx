import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  Search,
  Settings,
  ShieldAlert,
  Loader2,
  Users2,
  Bug,
  Image as ImageIcon,
  Gauge,
  Layers,
  Palette,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  to:
    | "/dashboard"
    | "/dashboard/orcamentos"
    | "/dashboard/produtos"
    | "/dashboard/categorias"
    | "/dashboard/acabamentos"
    | "/dashboard/cores"
    | "/dashboard/crm"
    | "/dashboard/debug"
    | "/dashboard/midia"
    | "/dashboard/seo"
    | "/dashboard/desempenho"
    | "/dashboard/configuracoes";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  child?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/dashboard/produtos", label: "Produtos", icon: Package },
  { to: "/dashboard/categorias", label: "Categorias", icon: Layers, child: true },
  { to: "/dashboard/acabamentos", label: "Acabamentos", icon: Sparkles, child: true },
  { to: "/dashboard/cores", label: "Cores", icon: Palette, child: true },
  { to: "/dashboard/crm", label: "CRM", icon: Users2 },
  { to: "/dashboard/debug", label: "Debug", icon: Bug },
  { to: "/dashboard/midia", label: "Mídia", icon: ImageIcon },
  { to: "/dashboard/seo", label: "SEO", icon: Search },
  { to: "/dashboard/desempenho", label: "Desempenho", icon: Gauge },
  { to: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

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
      setState(!error && !!data ? "ok" : "denied");
    })();
  }, [navigate]);

  if (state === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu usuário não tem permissão de administrador.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Voltar para home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark dashboard-scope">
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex w-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-background md:block">
        <div className="sticky top-[72px] px-4 py-6">
          <p className="px-2 pb-3 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Painel
          </p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    item.child && "ml-5 text-[12.5px]",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-[oklch(0.205_0_0)] px-4 py-8 sm:px-8 lg:px-[50px]">
        <div className="md:hidden mb-4 flex gap-2 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </main>
        </div>
      </div>
    </div>
  );
}

export function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}