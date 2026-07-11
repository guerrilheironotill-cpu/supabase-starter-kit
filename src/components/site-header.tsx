import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, FileText, Menu, Search, X } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const hydrated = useHydrated();
  const count = useQuoteStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0),
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const whatsappHref =
    "https://wa.me/5500000000000?text=" +
    encodeURIComponent("Olá! Gostaria de solicitar um orçamento.");

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    window.location.href = `/?q=${encodeURIComponent(q)}`;
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "border-b border-white/10 backdrop-blur-md shadow-sm"
          : "border-b border-transparent bg-background",
      )}
      style={
        scrolled
          ? { backgroundColor: "color-mix(in oklab, #2a2f2c 85%, transparent)" }
          : undefined
      }
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="https://arteno.com.br/wp-content/uploads/2025/03/Ativo-8-e1782929111841.png"
            alt="Casa & Jardim"
            className="h-10 w-auto object-contain"
          />
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
                    "group/nav relative inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
                    scrolled
                      ? "text-white/90 hover:text-white"
                      : "text-foreground/80 hover:text-foreground",
                    isOpen && (scrolled ? "text-white" : "text-foreground"),
                  )}
                  onClick={(e) => {
                    if (hasChildren) {
                      e.preventDefault();
                      setOpenMenu(isOpen ? null : cat.slug);
                    }
                  }}
                >
                  <span className="relative">
                    {cat.name}
                    <span
                      className={cn(
                        "pointer-events-none absolute -bottom-1 left-0 h-[2px] w-0 bg-secondary transition-all duration-300 group-hover/nav:w-full",
                        isOpen && "w-full",
                      )}
                    />
                  </span>
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
                    className="absolute left-0 top-full min-w-52 origin-top pt-2 dropdown-enter"
                  >
                    <div className="overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                      <ul className="py-1">
                        {cat.children!.map((sub) => (
                          <li key={sub.slug}>
                            <Link
                              to="/"
                              className="group/sub relative block px-4 py-2 text-sm text-popover-foreground transition-colors hover:text-primary"
                              onClick={() => setOpenMenu(null)}
                            >
                              <span className="relative inline-block">
                                {sub.name}
                                <span className="pointer-events-none absolute -bottom-0.5 left-0 h-[2px] w-0 bg-secondary transition-all duration-300 group-hover/sub:w-full" />
                              </span>
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

        <div className="flex items-center gap-3">
          {/* Quote count indicator (outside the button) */}
          <Link
            to="/orcamento"
            aria-label="Ver orçamento"
            className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-0.5"
          >
            <FileText
              className={cn(
                "h-5 w-5 transition-colors",
                scrolled ? "text-white" : "text-primary",
              )}
            />
            <span
              key={hydrated ? count : "x"}
              className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-primary animate-scale-in"
            >
              {hydrated ? count : 0}
            </span>
          </Link>

          {/* WhatsApp quote request button */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-secondary"
            aria-label="Solicitar orçamento pelo WhatsApp"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform group-hover:scale-110"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.15-3.43-8.44ZM12.07 21.8h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.22-3.76.99 1-3.66-.23-.38a9.9 9.9 0 0 1-1.51-5.27c0-5.46 4.44-9.9 9.92-9.9 2.65 0 5.14 1.03 7.01 2.9a9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.44 9.91-9.91 9.91Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
            </svg>
            <span className="hidden sm:inline">Solicitar orçamento</span>
          </a>

          {/* Search (lupa) — no bg, primary icon; white on scroll */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-0.5",
              scrolled ? "text-white hover:text-secondary" : "text-primary hover:text-secondary",
            )}
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            type="button"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary transition-all duration-300 hover:bg-primary hover:text-secondary md:hidden",
            )}
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

      {searchOpen && (
        <div
          className={cn(
            "border-t animate-fade-in",
            scrolled ? "border-white/10" : "border-border bg-background",
          )}
          style={
            scrolled
              ? { backgroundColor: "color-mix(in oklab, #2a2f2c 90%, transparent)" }
              : undefined
          }
        >
          <form
            onSubmit={onSearchSubmit}
            className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8"
          >
            <Search
              className={cn(
                "h-4 w-4",
                scrolled ? "text-white" : "text-primary",
              )}
            />
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className={cn(
                "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
                scrolled ? "text-white placeholder:text-white/60" : "text-foreground",
              )}
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className={cn(
                "rounded-full p-1 transition-colors",
                scrolled
                  ? "text-white/80 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Fechar busca"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

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