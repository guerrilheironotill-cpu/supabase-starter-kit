import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AdminEditBarProps = {
  label: string;
} & (
  | { to: "/dashboard/produtos" | "/dashboard/categorias" | "/dashboard/acabamentos" | "/dashboard/cores" | "/dashboard/paginas" | "/dashboard/paginas/home" | "/dashboard/midia" | "/dashboard/seo" | "/dashboard/configuracoes"; params?: undefined }
);

export function AdminEditBar({ label, to }: AdminEditBarProps) {
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

  if (!ready || !isAdmin) return null;

  return (
    <div className="sticky top-[112px] z-30 border-y border-white/10 bg-[#1c211d] text-white shadow-sm">
      <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-2 sm:px-8 lg:px-[50px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Modo admin
        </span>
        <Link
          to={to}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-white"
        >
          <Pencil className="h-3.5 w-3.5" />
          {label}
        </Link>
      </div>
    </div>
  );
}