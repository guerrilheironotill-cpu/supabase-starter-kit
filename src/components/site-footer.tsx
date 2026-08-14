import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Instagram } from "lucide-react";
import { CatalogDownloadDialog, OPEN_CATALOG_EVENT } from "./catalog-download-dialog";
import { OPEN_COOKIE_PREFERENCES_EVENT } from "@/lib/cookie-consent";
import { useWhatsAppNumber, whatsappLinkFrom } from "@/lib/site-settings";

export const OPEN_WHATSAPP_EVENT = "arteno:open-whatsapp";

const LINKS: {
  label: string;
  to: string;
  params?: { slug: string };
  downloadIcon?: boolean;
}[] = [
  { label: "Catálogo (PDF)", to: "/catalogo", downloadIcon: true },
  { label: "Vasos", to: "/categoria/$slug", params: { slug: "vasos-de-concreto" } },
  { label: "Jardineiras", to: "/categoria/$slug", params: { slug: "jardineiras" } },
  { label: "Mesas", to: "/categoria/$slug", params: { slug: "mesas" } },
  { label: "Cubas e Pias", to: "/pias-e-cubas-de-concreto" },
  { label: "Mobiliário Urbano", to: "/mobiliario-urbano" },
  { label: "Projetos sob medida", to: "/projetos-personalizados" },
];

export function SiteFooter() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const adminWhatsAppUrl = whatsappLinkFrom(
    useWhatsAppNumber(),
    "Olá! Gostaria de falar com a equipe da Arteno.",
  );

  useEffect(() => {
    const openWhatsApp = () => window.open(adminWhatsAppUrl, "_blank", "noopener,noreferrer");
    const openCatalog = () => setCatalogOpen(true);
    window.addEventListener(OPEN_WHATSAPP_EVENT, openWhatsApp);
    window.addEventListener(OPEN_CATALOG_EVENT, openCatalog);
    return () => {
      window.removeEventListener(OPEN_WHATSAPP_EVENT, openWhatsApp);
      window.removeEventListener(OPEN_CATALOG_EVENT, openCatalog);
    };
  }, [adminWhatsAppUrl]);
  return (
    <>
      <footer className="bg-[#1c211d] pb-[64px] text-white lg:pb-0">
        <div className="mx-auto flex w-full flex-col gap-8 px-4 py-12 sm:px-8 lg:px-[50px]">
          <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
            <Link to="/" className="flex items-center">
              <img
                width={181}
                height={44}
                src="/images/logo-header-scroll.svg"
                alt="Arteno"
                className="h-11 w-[181px] object-contain"
              />
            </Link>
            <nav aria-label="Navegação do rodapé" className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {LINKS.map((l) =>
                l.downloadIcon ? (
                  <button
                    key={l.label}
                    type="button"
                    onClick={() => setCatalogOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-secondary"
                  >
                    {l.label}
                    <Download className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link
                    key={l.label}
                    to={l.to as never}
                    params={l.params as never}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-secondary"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram da Arteno (abre em nova aba)"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-secondary text-secondary transition-colors hover:bg-secondary hover:text-primary"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>

          <div className="h-px w-full bg-white/15" />

          <div className="flex flex-col items-center justify-between gap-3 text-xs text-white/70 sm:flex-row">
            <p>
              © ARTENO VASO & DECOR {new Date().getFullYear()}
              <br />
              Todos os direitos reservados.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link to="/politica-de-cookies" className="hover:text-secondary hover:underline">
                Política de Cookies
              </Link>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}
                className="hover:text-secondary hover:underline"
              >
                Preferências de cookies
              </button>
            </div>
            <p className="inline-flex items-center gap-1.5">
              <span>Desenvolvido por:</span>
              <span className="font-semibold text-secondary">
                StudioVogel
              </span>
            </p>
          </div>
        </div>
      </footer>

      <a
        href={adminWhatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Solicitar orçamento pelo WhatsApp (abre em nova aba)"
        className="fixed bottom-5 right-5 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-300 hover:-translate-y-0.5 hover:scale-105 lg:inline-flex"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.15-3.43-8.44ZM12.07 21.8h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.22-3.76.99 1-3.66-.23-.38a9.9 9.9 0 0 1-1.51-5.27c0-5.46 4.44-9.9 9.92-9.9 2.65 0 5.14 1.03 7.01 2.9a9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.44 9.91-9.91 9.91Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      </a>

      <a
        href={adminWhatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Solicitar orçamento personalizado"
        className="fixed inset-x-0 bottom-0 z-40 inline-flex h-14 items-center justify-center gap-2 bg-secondary text-sm font-semibold text-primary shadow-[0_-6px_20px_-8px_rgba(0,0,0,0.25)] transition-colors hover:bg-primary hover:text-secondary lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.15-3.43-8.44Z" />
        </svg>
        Orçamento personalizado
      </a>

      <CatalogDownloadDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
    </>
  );
}
