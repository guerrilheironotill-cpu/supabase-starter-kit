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
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1 style={{ fontFamily: "sans-serif" }}>/health-cache</h1>
      <p style={{ fontFamily: "sans-serif" }}>
        Diagnóstico de cache e service worker do site.
      </p>
      <button
        onClick={unregisterAll}
        style={{
          padding: "8px 12px",
          marginBottom: 16,
          cursor: "pointer",
          fontFamily: "sans-serif",
        }}
      >
        Limpar service workers + caches e recarregar
      </button>
      {error && <pre style={{ color: "red" }}>{error}</pre>}
      {data ? (
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        !error && <p>Carregando…</p>
      )}
    </div>
  );
}