import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, FileText, Menu, X } from "lucide-react";
import { useQuoteStore } from "@/lib/quote-store";
import { cn } from "@/lib/utils";

type Category = {
  slug: string;
  name: string;
  children?: { slug: string; name: string }[];
};

const CATEGORIES: Category[] = [
  { slug: "vasos", name: "Vasos" },
  { slug: "jardineiras", name: "Jardineiras" },
  {
    slug: "outros-produtos",
    name: "Outros Produtos",
    children: [
      { slug: "mesas", name: "Mesas" },
      { slug: "bancos", name: "Bancos" },
      { slug: "fontes", name: "Fontes" },
      { slug: "cubas", name: "Cubas" },
    ],
  },
  { slug: "acabamentos", name: "Acabamentos" },
];

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useHydrated();
  const count = useQuoteStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0),
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">
            Casa &amp; Jardim
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {CATEGORIES.map((cat) => {
            const hasChildren = !!cat.children?.length;
            const isOpen = openMenu === cat.slug;
            return (
              <div
                key={cat.slug}
                className="relative"
                onMouseEnter={() => hasChildren && setOpenMenu(cat.slug)}
                onMouseLeave={() => hasChildren && setOpenMenu(null)}
              >
                <Link
                  to="/"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
                    isOpen && "bg-accent text-foreground",
                  )}
                  onClick={(e) => {
                    if (hasChildren) {
                      e.preventDefault();
                      setOpenMenu(isOpen ? null : cat.slug);
                    }
                  }}
                >
                  {cat.name}
                  {hasChildren && (
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  )}
                </Link>

                {hasChildren && isOpen && (
                  <div
                    className="absolute left-0 top-full min-w-52 origin-top pt-2"
                    style={{ animation: "fade-in 0.2s ease-out" }}
                  >
                    <div className="overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-scale-in">
                      <ul className="py-1">
                        {cat.children!.map((sub) => (
                          <li key={sub.slug}>
                            <Link
                              to="/"
                              className="block px-4 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                              onClick={() => setOpenMenu(null)}
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/orcamento"
            className="group relative inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-all hover:border-primary/40 hover:bg-accent"
            aria-label="Orçamento"
          >
            <FileText className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">Orçamento</span>
            {hydrated && count > 0 && (
              <span
                key={count}
                className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground animate-scale-in"
              >
                {count}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden animate-fade-in">
          <ul className="mx-auto max-w-7xl divide-y divide-border px-4 py-2 sm:px-6">
            {CATEGORIES.map((cat) => (
              <li key={cat.slug} className="py-1">
                <Link
                  to="/"
                  className="block rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  onClick={() => setMobileOpen(false)}
                >
                  {cat.name}
                </Link>
                {cat.children && (
                  <ul className="ml-3 border-l border-border">
                    {cat.children.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          to="/"
                          className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={() => setMobileOpen(false)}
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}