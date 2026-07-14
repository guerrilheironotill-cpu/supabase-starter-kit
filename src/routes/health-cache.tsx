import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/health-cache")({
  head: () => ({
    meta: [
      { title: "Health Cache" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HealthCache,
});

type Result = {
  url: string;
  status: number;
  headers: Record<string, string>;
  serviceWorkers: Array<{ scope: string; scriptURL: string; state: string }>;
  caches: string[];
  userAgent: string;
  timestamp: string;
};

function HealthCache() {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => (headers[k] = v));

        const swRegs =
          "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistrations()
            : [];
        const serviceWorkers = swRegs.map((r) => ({
          scope: r.scope,
          scriptURL: r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "",
          state: r.active?.state ?? r.installing?.state ?? r.waiting?.state ?? "unknown",
        }));

        const cacheNames =
          typeof caches !== "undefined" ? await caches.keys() : [];

        setData({
          url: res.url,
          status: res.status,
          headers,
          serviceWorkers,
          caches: cacheNames,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const unregisterAll = async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">/health-cache</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Diagnóstico de cache e service worker do site.
      </p>
      <button
        onClick={unregisterAll}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Limpar service workers + caches e recarregar
      </button>
      {error && (
        <pre className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </pre>
      )}
      {data ? (
        <pre className="mt-4 overflow-auto rounded-md border border-border bg-muted p-4 text-xs whitespace-pre-wrap text-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        !error && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      )}
    </div>
  );
}