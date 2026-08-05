import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "l.felipevogel@gmail.com";
const ADMIN_WHATSAPP = Deno.env.get("ADMIN_WHATSAPP") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { customer_name, customer_phone, customer_email, items, total, notes } = body;

    // Parse items
    const itemList = Array.isArray(items) ? items : [];
    const itemLines = itemList
      .map((i: { quantity: number; name: string; price: number }) =>
        `• ${i.quantity}x ${i.name} — R$ ${Number(i.price * i.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      )
      .join("\n");

    // Parse notes/meta
    let address = "Retirar na fábrica";
    try {
      const meta = JSON.parse(notes ?? "{}");
      if (meta.address) address = meta.address;
    } catch { /* ignore */ }

    const totalFormatted = `R$ ${Number(total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    const emailBody = `
Novo orçamento solicitado pelo site!

Cliente: ${customer_name}
Telefone: ${customer_phone ?? "—"}
Email: ${customer_email ?? "—"}

Produtos:
${itemLines}

Entrega: ${address}
Total estimado: ${totalFormatted}

Acesse o dashboard para visualizar: https://arteno.com.br/dashboard/orcamentos
    `.trim();

    const htmlBody = `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f7;">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e0;">
    <h1 style="font-size:20px;margin:0 0 4px;color:#1a1a1a;">🪴 Novo Orçamento — Arteno</h1>
    <p style="color:#888;font-size:13px;margin:0 0 24px;">Solicitado pelo site</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;font-size:13px;width:120px;">Cliente</td><td style="padding:8px 0;font-weight:600;color:#1a1a1a;">${customer_name}</td></tr>
      ${customer_phone ? `<tr><td style="padding:8px 0;color:#666;font-size:13px;">Telefone</td><td style="padding:8px 0;color:#1a1a1a;">${customer_phone}</td></tr>` : ""}
      ${customer_email ? `<tr><td style="padding:8px 0;color:#666;font-size:13px;">Email</td><td style="padding:8px 0;color:#1a1a1a;">${customer_email}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Entrega</td><td style="padding:8px 0;color:#1a1a1a;">${address}</td></tr>
    </table>

    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin:0 0 12px;">Produtos</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${itemList.map((i: { quantity: number; name: string; price: number }) => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;font-size:14px;color:#1a1a1a;">${i.quantity}× ${i.name}</td>
          <td style="padding:10px 0;font-size:14px;color:#1a1a1a;text-align:right;">R$ ${Number((i.price ?? 0) * (i.quantity ?? 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join("")}
      <tr>
        <td style="padding:16px 0 0;font-weight:700;font-size:16px;color:#1a1a1a;">Total estimado</td>
        <td style="padding:16px 0 0;font-weight:700;font-size:16px;color:#1a1a1a;text-align:right;">${totalFormatted}</td>
      </tr>
    </table>

    <a href="https://arteno.com.br/dashboard/orcamentos" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
      Ver no dashboard →
    </a>
  </div>
</div>
    `.trim();

    // Send email via Resend
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Arteno <orcamentos@arteno.com.br>",
          to: [ADMIN_EMAIL],
          subject: "Arteno - Orçamento Solicitado",
          text: emailBody,
          html: htmlBody,
        }),
      });
    }

    // Send WhatsApp notification to admin via Evolution API or simple wa.me link (log only here)
    // If you have Evolution API configured, add EVOLUTION_API_URL and EVOLUTION_API_KEY env vars
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_API_INSTANCE");

    if (evolutionUrl && evolutionKey && evolutionInstance && ADMIN_WHATSAPP) {
      const waMessage = `🪴 *Novo Orçamento — Arteno*\n\n*Cliente:* ${customer_name}\n*Telefone:* ${customer_phone ?? "—"}\n*Email:* ${customer_email ?? "—"}\n\n*Produtos:*\n${itemLines}\n\n*Entrega:* ${address}\n*Total:* ${totalFormatted}\n\nhttps://arteno.com.br/dashboard/orcamentos`;

      await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: ADMIN_WHATSAPP,
          text: waMessage,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[notify-new-order]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});