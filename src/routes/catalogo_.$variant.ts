import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CATALOG_BUCKET, CATALOG_PATHS, catalogVariantFromSlug } from "@/lib/catalog-paths";

// Stable share link sent to leads: always points at the current catalog layout.
export const Route = createFileRoute("/catalogo_/$variant")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const variant = catalogVariantFromSlug(params.variant);
        const fallback = new URL("/catalogo-pdf", request.url).toString();
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        if (!variant || !supabaseUrl) return Response.redirect(fallback, 302);

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/${CATALOG_BUCKET}/${CATALOG_PATHS[variant]}`;
        const head = await fetch(fileUrl, { method: "HEAD" }).catch(() => null);
        if (!head?.ok) return Response.redirect(fallback, 302);

        return new Response(null, {
          status: 302,
          headers: { location: fileUrl, "cache-control": "no-store" },
        });
      },
    },
  },
});
