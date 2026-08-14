import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "contato@arteno.com.br";
const EMAIL_FROM =
  Deno.env.get("EMAIL_FROM") ?? "Arteno Vaso & Decor <orcamentos@envios.arteno.com.br>";
const REPLY_TO = Deno.env.get("REPLY_TO") ?? ADMIN_EMAIL;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://novo.arteno.com.br").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type QuoteItem = {
  name?: string;
  quantity?: number;
  price?: number;
  size_name?: string | null;
  dimensions?: string | null;
  finish?: string | null;
  color?: string | null;
  product_url?: string | null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function formatItemDetails(item: QuoteItem) {
  const rows: string[] = [];
  if (item.size_name) rows.push(`<strong>Tamanho:</strong> ${escapeHtml(item.size_name)}`);
  if (item.dimensions) {
    const values = String(item.dimensions).match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (values.length >= 3) {
      rows.push(
        `<strong>Altura:</strong> ${escapeHtml(values[0])} cm &nbsp; <strong>Largura:</strong> ${escapeHtml(values[1])} cm &nbsp; <strong>Comprimento:</strong> ${escapeHtml(values[2])} cm`,
      );
    } else {
      rows.push(`<strong>Medidas:</strong> ${escapeHtml(item.dimensions)}`);
    }
  }
  if (item.finish) rows.push(`<strong>Acabamento:</strong> ${escapeHtml(item.finish)}`);
  if (item.color) rows.push(`<strong>Cor:</strong> ${escapeHtml(item.color)}`);
  return rows.length ? `<div style="color:#666;font-size:13px;line-height:1.7;margin-top:5px">${rows.join("<br>")}</div>` : "";
}

async function sendEmail(message: Record<string, unknown>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(message),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result?.message === "string"
        ? result.message
        : `Resend respondeu com HTTP ${response.status}`,
    );
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return Response.json(
      { error: "O serviço de e-mail ainda não foi configurado." },
      { status: 503, headers: corsHeaders },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let orderId = "";
  try {
    const body = await req.json();
    orderId = typeof body.order_id === "string" ? body.order_id : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (!orderId || !token) {
      return Response.json(
        { error: "Identificação do orçamento inválida." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: order, error: findError } = await supabase
      .from("orders")
      .select(
        "id,customer_name,customer_phone,customer_email,items,total,notes,email_notification_status,customer_email_sent_at,admin_email_sent_at",
      )
      .eq("id", orderId)
      .eq("email_notification_token", token)
      .maybeSingle();
    if (findError) throw findError;
    if (!order) {
      return Response.json(
        { error: "Orçamento não encontrado ou link expirado." },
        { status: 404, headers: corsHeaders },
      );
    }
    if (!order.customer_email) {
      return Response.json(
        { error: "O orçamento não possui um e-mail válido para confirmação." },
        { status: 422, headers: corsHeaders },
      );
    }
    if (order.email_notification_status === "sent") {
      return Response.json({ ok: true, already_sent: true }, { headers: corsHeaders });
    }
    if (order.email_notification_status === "sending") {
      return Response.json(
        { error: "O envio deste orçamento já está em andamento." },
        { status: 409, headers: corsHeaders },
      );
    }

    const { data: claimed, error: claimError } = await supabase
      .from("orders")
      .update({ email_notification_status: "sending", email_notification_error: null })
      .eq("id", orderId)
      .neq("email_notification_status", "sending")
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      return Response.json(
        { error: "O envio deste orçamento já está em andamento." },
        { status: 409, headers: corsHeaders },
      );
    }

    const items = (Array.isArray(order.items) ? order.items : []) as QuoteItem[];
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(order.notes ?? "{}") as Record<string, unknown>;
    } catch {
      meta = {};
    }
    const dashboardUrl = `${SITE_URL}/dashboard/orcamentos?orcamento=${encodeURIComponent(order.id)}`;
    const itemRows = items
      .map((item) => {
        const details = formatItemDetails(item);
        const link = item.product_url
          ? `<br><a href="${escapeHtml(item.product_url)}" style="color:#315c49">Ver produto</a>`
          : "";
        return `<tr style="border-bottom:1px solid #ecece7"><td style="padding:12px 0"><strong>${Number(item.quantity ?? 1)}× ${escapeHtml(item.name)}</strong>${details}${link}</td><td style="padding:12px 0;text-align:right">${money(Number(item.price ?? 0) * Number(item.quantity ?? 1))}</td></tr>`;
      })
      .join("");

    const shell = (content: string) =>
      `<div style="font-family:Arial,sans-serif;background:#f5f5f1;padding:28px"><div style="max-width:640px;margin:auto;background:white;border:1px solid #e5e5df;padding:30px"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#777">Arteno Vaso & Decor</div>${content}</div></div>`;

    let customerSent = Boolean(order.customer_email_sent_at);
    let adminSent = Boolean(order.admin_email_sent_at);
    const failures: string[] = [];

    if (!customerSent) {
      try {
        await sendEmail({
          from: EMAIL_FROM,
          to: [order.customer_email],
          reply_to: REPLY_TO,
          subject: `Recebemos seu orçamento — Arteno Vaso & Decor`,
          html: shell(
            `<h1 style="font-size:25px;color:#273b32">Olá, ${escapeHtml(order.customer_name)}.</h1><p>Recebemos sua solicitação de orçamento <strong>#${escapeHtml(order.id.slice(0, 8))}</strong>.</p><p>Nossa equipe entrará em contato para combinar o frete, o prazo de produção e as condições de pagamento.</p><table style="width:100%;border-collapse:collapse;margin:22px 0">${itemRows}<tr><td style="padding-top:16px"><strong>Subtotal</strong></td><td style="padding-top:16px;text-align:right"><strong>${money(order.total)}</strong></td></tr></table><p style="color:#666;font-size:13px">Este e-mail confirma o recebimento da solicitação e ainda não representa a aprovação final do orçamento.</p>`,
          ),
        });
        customerSent = true;
        await supabase
          .from("orders")
          .update({ customer_email_sent_at: new Date().toISOString() })
          .eq("id", orderId);
      } catch (error) {
        failures.push(`cliente: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!adminSent) {
      try {
        await sendEmail({
          from: EMAIL_FROM,
          to: [ADMIN_EMAIL],
          reply_to: order.customer_email,
          subject: `Novo orçamento por e-mail — ${order.customer_name}`,
          html: shell(
            `<h1 style="font-size:25px;color:#273b32">Novo orçamento recebido</h1><p><strong>Cliente:</strong> ${escapeHtml(order.customer_name)}<br><strong>E-mail:</strong> ${escapeHtml(order.customer_email)}<br><strong>Telefone:</strong> ${escapeHtml(order.customer_phone || "—")}<br><strong>Entrega:</strong> ${escapeHtml(meta.address || "Não informada")}</p><table style="width:100%;border-collapse:collapse;margin:22px 0">${itemRows}<tr><td style="padding-top:16px"><strong>Subtotal</strong></td><td style="padding-top:16px;text-align:right"><strong>${money(order.total)}</strong></td></tr></table><a href="${dashboardUrl}" style="display:inline-block;background:#273b32;color:white;padding:13px 20px;text-decoration:none">Abrir orçamento no dashboard</a>`,
          ),
        });
        adminSent = true;
        await supabase
          .from("orders")
          .update({ admin_email_sent_at: new Date().toISOString() })
          .eq("id", orderId);
      } catch (error) {
        failures.push(`administrador: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const status =
      customerSent && adminSent ? "sent" : customerSent || adminSent ? "partial" : "failed";
    await supabase
      .from("orders")
      .update({
        email_notification_status: status,
        email_notification_error: failures.length ? failures.join(" | ") : null,
      })
      .eq("id", orderId);

    if (status !== "sent") throw new Error(failures.join(" | ") || "Falha no envio dos e-mails.");
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (orderId) {
      await supabase
        .from("orders")
        .update({ email_notification_status: "failed", email_notification_error: message })
        .eq("id", orderId)
        .eq("email_notification_status", "sending");
    }
    console.error("[notify-new-order]", message);
    return Response.json(
      { error: "Não foi possível enviar os e-mails agora. Tente novamente." },
      { status: 500, headers: corsHeaders },
    );
  }
});
