import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/supabase-check")({
  component: SupabaseCheck,
});

type Check = { name: string; status: "ok" | "fail" | "warn" | "pending"; detail: string };

function SupabaseCheck() {
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    const run = async () => {
      const results: Check[] = [];
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

      results.push({
        name: "1. VITE_SUPABASE_URL",
        status: url ? "ok" : "fail",
        detail: url ? url : "Variável ausente no build (.env / Vercel env vars).",
      });
      results.push({
        name: "2. VITE_SUPABASE_PUBLISHABLE_KEY",
        status: key ? "ok" : "fail",
        detail: key ? `${key.slice(0, 12)}… (${key.length} chars)` : "Variável ausente.",
      });

      // Test 3: reach Supabase auth endpoint
      try {
        const { error } = await supabase.auth.getSession();
        results.push({
          name: "3. Conexão com Supabase Auth",
          status: error ? "fail" : "ok",
          detail: error ? error.message : "Endpoint /auth/v1 respondeu com sucesso.",
        });
      } catch (e) {
        results.push({
          name: "3. Conexão com Supabase Auth",
          status: "fail",
          detail: (e as Error).message,
        });
      }

      // Test 4: query products table (may not exist yet)
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true });
        if (error) {
          const missing = /relation .* does not exist|not find the table/i.test(error.message);
          results.push({
            name: "4. Tabela public.products",
            status: missing ? "warn" : "fail",
            detail: missing
              ? "Conexão OK, mas a tabela ainda não foi criada (rode o SQL do passo 3)."
              : error.message,
          });
        } else {
          results.push({
            name: "4. Tabela public.products",
            status: "ok",
            detail: `Query executou. Registros: ${data ?? 0}.`,
          });
        }
      } catch (e) {
        results.push({
          name: "4. Tabela public.products",
          status: "fail",
          detail: (e as Error).message,
        });
      }

      setChecks(results);
    };
    void run();
  }, []);

  const color = (s: Check["status"]) =>
    s === "ok" ? "#16a34a" : s === "warn" ? "#ca8a04" : s === "fail" ? "#dc2626" : "#6b7280";

  return (
    <div style={{ maxWidth: 720, margin: "3rem auto", padding: "1.5rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Diagnóstico Supabase</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Rota temporária. Delete <code>src/routes/supabase-check.tsx</code> quando terminar.
      </p>
      {checks.length === 0 ? (
        <p>Executando testes…</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {checks.map((c) => (
            <li
              key={c.name}
              style={{
                border: `1px solid ${color(c.status)}`,
                borderRadius: 8,
                padding: "0.75rem 1rem",
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 600, color: color(c.status) }}>
                [{c.status.toUpperCase()}] {c.name}
              </div>
              <div style={{ fontSize: 14, marginTop: 4, wordBreak: "break-all" }}>{c.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}