import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_TOKEN = Deno.env.get("META_WABA_ACCESS_TOKEN");
const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
const ADMIN_WA_PHONE = Deno.env.get("ADMIN_WA_PHONE");
const APP_URL = "https://crm-innovar-app-2026.vercel.app";

// Remitentes de la agencia: sus propios mensajes no generan alerta WA.
// El admin que recibe ADMIN_WA_PHONE es de la agencia — notificarle sus
// propios mensajes sería ruido.
const AGENCY_EMAIL_DOMAIN = "@seolabagency.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { message_id } = (await req.json()) as { message_id: number };

    if (!message_id) return json({ error: "message_id required" }, 400);

    const { data: message, error: mErr } = await supabase
      .from("ticket_messages")
      .select(
        "id, content, created_at, ticket_id, sender:profiles!sender_id(full_name, email, role), ticket:support_tickets!ticket_id(id, ticket_id, subject, ticket_type)"
      )
      .eq("id", message_id)
      .single();

    if (mErr || !message) {
      console.error("[ticket-message-created] message not found:", mErr);
      return json({ error: "message not found" }, 404);
    }

    const senderEmail: string = message.sender?.email ?? "";
    const senderName: string = message.sender?.full_name ?? "Usuario";

    if (senderEmail.toLowerCase().endsWith(AGENCY_EMAIL_DOMAIN)) {
      console.log(
        `[ticket-message-created] sender ${senderEmail} es de la agencia — sin alerta`
      );
      return json({ ok: true, skipped: "agency_sender" });
    }

    if (!META_TOKEN || !META_PHONE_ID || !ADMIN_WA_PHONE) {
      console.warn(
        "[ticket-message-created] WA skipped — missing META_TOKEN, META_PHONE_ID or ADMIN_WA_PHONE in Vault"
      );
      return json({ ok: true, skipped: "wa_not_configured" });
    }

    const ticket = message.ticket;
    const noun = ticket?.ticket_type === "solicitud" ? "solicitud" : "ticket";
    const waText =
      `💬 *Nuevo mensaje en ${noun} ${ticket?.ticket_id ?? ""}*\n\n` +
      `*De:* ${senderName}\n` +
      `*Asunto:* ${ticket?.subject ?? "—"}\n\n` +
      `${String(message.content ?? "").slice(0, 300)}` +
      `\n\n🔗 ${APP_URL}/soporte/${message.ticket_id}`;

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: ADMIN_WA_PHONE,
          type: "text",
          text: { body: waText, preview_url: false },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[ticket-message-created] WA error ${res.status}: ${body}`);
      return json({ ok: false, wa_status: res.status });
    }

    return json({ ok: true, notified: true });
  } catch (err) {
    console.error("[ticket-message-created] error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
