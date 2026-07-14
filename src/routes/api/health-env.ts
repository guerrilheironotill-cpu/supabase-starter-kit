import { createFileRoute } from "@tanstack/react-router";

const present = (v: string | undefined) => Boolean(v && v.length > 0);

export const Route = createFileRoute("/api/health-env")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            SUPABASE_URL: present(process.env.SUPABASE_URL),
            VITE_SUPABASE_PUBLISHABLE_KEY: present(
              process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
                process.env.SUPABASE_PUBLISHABLE_KEY,
            ),
            SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});