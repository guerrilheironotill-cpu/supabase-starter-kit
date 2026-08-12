import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, PackagePlus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AdminEditBarProps = {
  label: string;
  to:
    | "/dashboard/produtos"
    | "/dashboard/editar-produto/$productId"
    | "/dashboard/categorias"
    | "/dashboard/acabamentos"
    | "/dashboard/cores"
    | "/dashboard/paginas"
    | "/dashboard/paginas/home"
    | "/dashboard/midia"
    | "/dashboard/seo"
    | "/dashboard/configuracoes";
  search?: Record<string, string>;
  params?: Record<string, string>;
};

export function AdminEditBar({ label, to, search, params }: AdminEditBarProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (!cancelled) setReady(true);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!cancelled) {
        setIsAdmin(!error && !!data);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const root = document.documentElement;
    root.style.setProperty("--admin-bar-h", "40px");
    const prevPadding = document.body.style.paddingTop;
    document.body.style.paddingTop = "40px";
    return () => {
      root.style.removeProperty("--admin-bar-h");
      document.body.style.paddingTop = prevPadding;
    };
  }, [isAdmin]);

  if (!ready || !isAdmin) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-10 border-b border-white/10 bg-[#1c211d] text-white shadow-sm">
      <div className="mx-auto flex h-full w-full items-center justify-between gap-3 px-4 sm:px-8 lg:px-[50px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Modo admin
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            to="/dashboard/produtos"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cadastrar produto</span>
          </Link>
          <Link
            to={to}
            search={search as never}
            params={params as never}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            {label}
          </Link>
        </div>
      </div>
    </div>
  );
}
