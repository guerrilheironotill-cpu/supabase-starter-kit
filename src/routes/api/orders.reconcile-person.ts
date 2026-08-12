import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const paidStatuses = new Set(["processing", "completed", "refunded"]);

export const Route = createFileRoute("/api/orders/reconcile-person")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !serviceKey || !anonKey)
          return Response.json({ ok: false, error: "Supabase indisponível." }, { status: 500 });
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const user = createClient(url, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: auth } = await user.auth.getUser(token);
        if (!auth.user)
          return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
        const { data: isAdmin } = await user.rpc("has_role", {
          _user_id: auth.user.id,
          _role: "admin",
        });
        if (!isAdmin) return Response.json({ ok: false, error: "Acesso negado." }, { status: 403 });
        const { orderId, status: requestedStatus } = (await request.json()) as {
          orderId?: string;
          status?: string;
        };
        const admin = createClient(url, serviceKey);
        const { data: order, error } = await admin
          .from("app_orders")
          .select("*")
          .eq("id", orderId ?? "")
          .single();
        if (error || !order)
          return Response.json(
            { ok: false, error: error?.message ?? "Pedido não encontrado." },
            { status: 404 },
          );

        const nextStatus = requestedStatus || order.status;
        const approved = paidStatuses.has(nextStatus);
        const document = digits(order.customer_document);
        const email = String(order.customer_email ?? "")
          .trim()
          .toLowerCase();
        const phone = digits(order.customer_phone);
        const name = String(order.customer_name ?? "").trim() || `Cliente ${order.number}`;

        if (approved) {
          const { data: rows } = await admin
            .from("customers")
            .select("id, cpf, cnpj, email, phone")
            .limit(5000);
          let person = (rows ?? []).find((row) =>
            Boolean(
              (document && digits(row.cpf || row.cnpj) === document) ||
              (email && String(row.email ?? "").toLowerCase() === email) ||
              (phone && digits(row.phone) === phone),
            ),
          );
          if (!person) {
            const parts = name.split(/\s+/);
            const { data, error: insertError } = await admin
              .from("customers")
              .insert({
                first_name: parts.shift() || "Cliente",
                last_name: parts.join(" "),
                email: email || null,
                phone: order.customer_phone || null,
                cpf: document.length === 11 ? document : null,
                cnpj: document.length === 14 ? document : null,
                status: "active",
                origin: order.origin || "site",
              })
              .select("id")
              .single();
            if (insertError)
              return Response.json({ ok: false, error: insertError.message }, { status: 500 });
            person = data;
          }
          const { error: linkError } = await admin
            .from("app_orders")
            .update({ customer_id: person.id, lead_id: null, status: nextStatus })
            .eq("id", order.id);
          if (linkError)
            return Response.json({ ok: false, error: linkError.message }, { status: 500 });
          return Response.json({ ok: true, kind: "customer", id: person.id });
        }

        const { data: rows } = await admin
          .from("leads")
          .select("id, email, phone, contact_info")
          .limit(5000);
        let person = (rows ?? []).find((row) => {
          const info = (
            row.contact_info && typeof row.contact_info === "object" ? row.contact_info : {}
          ) as Record<string, unknown>;
          return Boolean(
            (document && digits(info.document ?? info.cpf ?? info.cnpj) === document) ||
            (email && String(row.email ?? "").toLowerCase() === email) ||
            (phone && digits(row.phone) === phone),
          );
        });
        if (!person) {
          const { data, error: insertError } = await admin
            .from("leads")
            .insert({
              name,
              email: email || null,
              phone: order.customer_phone || null,
              source: order.origin || "site",
              items: [],
              contact_info: {
                document: document || null,
                document_type:
                  document.length === 11 ? "cpf" : document.length === 14 ? "cnpj" : null,
                app_order_id: order.id,
              },
            })
            .select("id")
            .single();
          if (insertError)
            return Response.json({ ok: false, error: insertError.message }, { status: 500 });
          person = data;
        }
        const { error: linkError } = await admin
          .from("app_orders")
          .update({ lead_id: person.id, status: nextStatus })
          .eq("id", order.id);
        if (linkError)
          return Response.json({ ok: false, error: linkError.message }, { status: 500 });
        return Response.json({ ok: true, kind: "lead", id: person.id });
      },
    },
  },
});
