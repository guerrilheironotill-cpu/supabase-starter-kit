import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { DashboardHeader } from "../components/dashboard-header";
import { useRouterState } from "@tanstack/react-router";
import { useApplySiteSeo } from "../lib/site-seo-store";
import { absoluteUrl, IS_STAGING, SITE_NAME, SITE_URL } from "../lib/site-config";
import { CookieConsentBanner } from "../components/cookie-consent-banner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Arteno - Vasos de concreto e mobiliário estilo industrial" },
      {
        name: "description",
        content: "Peças artesanais em concreto e mobiliário estilo industrial com design autoral.",
      },
      {
        property: "og:title",
        content: "Arteno - Vasos de concreto e mobiliário estilo industrial",
      },
      {
        property: "og:description",
        content: "Peças artesanais em concreto e mobiliário estilo industrial com design autoral.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Arteno" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: absoluteUrl("/images/og-arteno.jpg") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Arteno Vaso & Decor" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: absoluteUrl("/images/og-arteno.jpg") },
      ...(IS_STAGING ? [{ name: "robots", content: "noindex, nofollow, noarchive" }] : []),
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": ["Organization", "FurnitureStore"],
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: SITE_URL,
              logo: absoluteUrl("/images/logo-arteno-header-site.svg"),
              image: absoluteUrl("/images/og-arteno.jpg"),
              telephone: "+55 48 98848-6279",
              email: "contato@arteno.com.br",
              sameAs: ["https://www.instagram.com/artenovasodecor"],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Florianópolis",
                addressRegion: "SC",
                addressCountry: "BR",
              },
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: SITE_NAME,
              publisher: { "@id": `${SITE_URL}/#organization` },
              inLanguage: "pt-BR",
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/busca?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboard = pathname.startsWith("/dashboard");
  // The dashboard setting is the homepage fallback. Route-specific metadata
  // must remain authoritative on catalog, category and product pages.
  useApplySiteSeo(pathname === "/");

  return (
    <QueryClientProvider client={queryClient}>
      <div
        suppressHydrationWarning
        className="flex min-h-screen flex-col"
        style={
          isDashboard
            ? undefined
            : {
                background:
                  "linear-gradient(to bottom, #ffffff 0, #ffffff calc(100px + 28vh), #eaf3dd calc(100px + 28vh), #eaf3dd 100%)",
              }
        }
      >
        {isDashboard ? <DashboardHeader /> : <SiteHeader />}
        <main className="flex-1" suppressHydrationWarning>
          <Outlet />
        </main>
        {!isDashboard && <SiteFooter />}
      </div>
      {!isDashboard && <CookieConsentBanner />}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
