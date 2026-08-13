import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl } from "@/lib/site-config";

export function DashboardHeader() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function copyCatalogLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl("/catalogo-pdf"));
      toast.success("Link do catálogo copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <header className="dark dashboard-scope sticky top-0 z-40 w-full border-b border-white/10 bg-background text-foreground">
      <div className="mx-auto flex h-[72px] w-full items-center justify-between gap-6 px-4 sm:px-8 lg:px-[50px]">
        <Link
          to="/"
          className="block h-11 w-[181px] shrink-0"
          aria-label="Casa & Jardim — página inicial"
        >
          <img
            src="/images/logo-header-scroll.svg"
            alt="Casa & Jardim"
            className="h-full w-full object-contain object-left"
          />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyCatalogLink()}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copiar link do catálogo</span>
            <span className="sm:hidden">Catálogo</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
