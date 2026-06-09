// supabase/functions/whatsapp-webhook/index.ts
//
// Edge Function: recibe webhooks de Meta WhatsApp Cloud API.
//
// Eventos manejados:
//   - GET con hub.mode=subscribe → handshake de verificación inicial.
//   - POST con statuses[] → eventos de delivery (sent/delivered/read/failed).
//
// Config requerida:
//   - verify_jwt: false  (Meta no manda JWT — la auth es vía HMAC del payload)
//
// Secrets requeridos (Supabase Vault):
//   - META_WEBHOOK_VERIFY_TOKEN — string que también se configura en
//     Meta App Dashboard → WhatsApp → Configuration → Webhook.
//   - META_APP_SECRET — secreto de la app, para validar X-Hub-Signature-256.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Verifica firma HMAC-SHA256 del payload contra META_APP_SECRET.
// Header: X-Hub-Signature-256: sha256=<hex>
async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const actual = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (actual.length !== expected.length) return false;
  // Comparación constant-time
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Mapea status de Meta → columna timestamp en notification_queue
function timestampColumnForStatus(status: string): string | null {
  switch (status) {
    case "sent": return "sent_at";
    case "delivered": return "delivered_at";
    case "read": return "read_at";
    case "failed": return "failed_at";
    default: return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // -------- 1. GET handshake de verificación --------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";
    if (mode === "subscribe" && verifyToken && verifyToken === expectedToken && challenge) {
      return textResponse(challenge, 200);
    }
    return textResponse("Forbidden", 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // -------- 2. POST: validar firma + parsear eventos --------
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !META_APP_SECRET) {
      return jsonResponse({ error: "Edge Function mal configurada (secrets faltantes)" }, 500);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const valid = await verifySignature(rawBody, signature, META_APP_SECRET);
    if (!valid) {
      return jsonResponse({ error: "Firma inválida" }, 401);
    }

    const payload = JSON.parse(rawBody);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // payload.entry[].changes[].value.statuses[]
    const statuses: any[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const values = change?.value?.statuses ?? [];
        for (const s of values) statuses.push(s);
      }
    }

    if (statuses.length === 0) {
      return jsonResponse({ ok: true, processed: 0 });
    }

    let inserted = 0;
    for (const s of statuses) {
      const providerId = s.id;
      const status = s.status;
      const tsSec = Number(s.timestamp);
      const tsIso = !Number.isNaN(tsSec) ? new Date(tsSec * 1000).toISOString() : new Date().toISOString();

      // 1. Log del evento crudo (idempotente por provider_message_id+status+ts)
      const { error: evtErr } = await admin.from("meta_whatsapp_status_events").insert({
        provider_message_id: providerId,
        recipient_id: s.recipient_id ?? null,
        status,
        status_timestamp: tsIso,
        raw_payload: s,
        errors: s.errors ?? null,
        conversation: s.conversation ?? null,
        pricing: s.pricing ?? null,
      });
      if (evtErr) {
        // No fatal; seguimos con los siguientes
        console.warn("meta_whatsapp_status_events insert error:", evtErr.message);
        continue;
      }
      inserted++;

      // 2. Actualizar notification_queue: el timestamp de su status + delivery_status
      const tsCol = timestampColumnForStatus(status);
      const updatePayload: Record<string, unknown> = {
        delivery_status: status,
        last_delivery_status_at: tsIso,
      };
      if (tsCol) updatePayload[tsCol] = tsIso;
      if (status === "failed") {
        const errMsg = s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? "failed";
        updatePayload.error_message = errMsg;
      }

      await admin.from("notification_queue")
        .update(updatePayload)
        .eq("provider_message_id", providerId);
    }

    return jsonResponse({ ok: true, processed: inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});
