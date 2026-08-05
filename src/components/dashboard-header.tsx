import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function DashboardHeader() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
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
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </header>
  );
}