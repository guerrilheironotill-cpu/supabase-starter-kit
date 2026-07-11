import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/health")({
  component: HealthPage,
});

type Check = { name: string; ok: boolean | null; detail?: string };

function HealthPage() {
  const [checks, setChecks] = useState<Check[]>([
    { name: "ENV variables", ok: null },
    { name: "Auth session", ok: null },
    { name: "SELECT profiles", ok: null },
    { name: "RPC has_role(admin)", ok: null },
  ]);

  useEffect(() => {
    (async () => {
      const next: Check[] = [];

      // 1. ENV
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      next.push({
        name: "ENV variables",
        ok: Boolean(url && key),
        detail: url ? `URL: ${url}` : "missing VITE_SUPABASE_URL",
      });

      // 2. Session
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;
      next.push({
        name: "Auth session",
        ok: Boolean(user) && !userErr,
        detail: user ? `user: ${user.email}` : userErr?.message ?? "no session — sign in at /auth",
      });

      // 3. SELECT profiles
      const { error: selErr } = await supabase.from("profiles").select("id").limit(1);
      next.push({
        name: "SELECT profiles",
        ok: !selErr,
        detail: selErr?.message,
      });

      // 4. RPC has_role admin
      if (user) {
        const { data: roleData, error: rpcErr } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        next.push({
          name: "RPC has_role(admin)",
          ok: roleData === true && !rpcErr,
          detail: rpcErr?.message ?? `returned: ${String(roleData)}`,
        });
      } else {
        next.push({
          name: "RPC has_role(admin)",
          ok: false,
          detail: "requires signed-in user",
        });
      }

      setChecks(next);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Health check</h1>
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.name} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className={c.ok ? "text-green-600" : c.ok === false ? "text-destructive" : "text-muted-foreground"}>
                {c.ok === null ? "…" : c.ok ? "✔" : "✘"}
              </span>
            </div>
            {c.detail && <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}