// supabase/functions/meta-whatsapp-webhook/index.ts
//
// Edge Function: recibe los webhooks de Meta WhatsApp Cloud API.
//   - GET  → handshake de verificación de Meta.
//   - POST → mensajes entrantes (los guarda en whatsapp_incoming_messages) y
//            eventos de estado (los registra en whatsapp_message_log).
//
// NUEVO (asistente de enrutamiento "Elena"): tras guardar un mensaje entrante de
// texto/botón/interactivo, dispara la Edge Function `whatsapp-router` para que
// responda de forma determinista. La llamada va con un timeout corto y NUNCA
// bloquea ni rompe la bandeja de entrada (el mensaje ya quedó guardado antes).
//
// verify_jwt: false (Meta no manda JWT).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          META_WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_ROUTER_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";

const verifyToken    = Deno.env.get("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";
const supabaseUrl    = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const routerSecret   = Deno.env.get("WHATSAPP_ROUTER_SECRET") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Tipos de mensaje que el asistente de enrutamiento sabe manejar.
const ROUTABLE_TYPES = new Set(["text", "button", "interactive"]);

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET: Meta webhook verification challenge
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (!verifyToken) return new Response("not configured", { status: 500 });
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified by Meta");
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload;
  try { payload = await req.json(); } catch { return jsonR({ error: "Invalid JSON" }, 400); }

  if (payload?.object !== "whatsapp_business_account") {
    return jsonR({ ok: true, skipped: "not_whatsapp_business_account" });
  }

  const results = { incoming_messages: 0, status_updates: 0, routed: 0, errors: [] as string[] };

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages") continue;
      const value = change?.value ?? {};

      for (const msg of value?.messages ?? []) {
        try {
          await handleIncoming(msg, value?.contacts ?? []);
          results.incoming_messages++;
          // Disparar el asistente de enrutamiento (no bloquea la bandeja).
          if (ROUTABLE_TYPES.has(msg?.type ?? "text")) {
            const ok = await routeToBot(msg, value?.contacts ?? []);
            if (ok) results.routed++;
          }
        } catch (e) {
          console.error("Error incoming:", e);
          results.errors.push(String(e));
        }
      }

      for (const status of value?.statuses ?? []) {
        try {
          await handleStatus(status);
          results.status_updates++;
        } catch (e) {
          console.error("Error status:", e);
          results.errors.push(String(e));
        }
      }
    }
  }

  return jsonR({ ok: true, ...results });
});

async function handleIncoming(msg, contacts) {
  const wamid     = msg?.id;
  const fromPhone = msg?.from;
  const msgType   = msg?.type ?? "text";
  const contact   = contacts.find((c) => c?.wa_id === fromPhone);
  const fromName  = contact?.profile?.name ?? null;

  if (!wamid || !fromPhone) return;

  let messageBody = null, mediaId = null, mediaMimeType = null, mediaCaption = null;
  let latitude = null, longitude = null, locationName = null;

  switch (msgType) {
    case "text":
      messageBody = msg?.text?.body ?? null; break;
    case "image": case "video": case "audio": case "document": case "sticker":
      mediaId       = msg?.[msgType]?.id ?? null;
      mediaMimeType = msg?.[msgType]?.mime_type ?? null;
      mediaCaption  = msg?.[msgType]?.caption ?? null;
      messageBody   = mediaCaption ?? "[" + msgType + "]"; break;
    case "location":
      latitude     = msg?.location?.latitude ?? null;
      longitude    = msg?.location?.longitude ?? null;
      locationName = msg?.location?.name ?? null;
      messageBody  = locationName ?? "[location]"; break;
    case "button":
      messageBody = msg?.button?.text ?? null; break;
    case "interactive":
      messageBody = msg?.interactive?.button_reply?.title
        ?? msg?.interactive?.list_reply?.title
        ?? "[interactive]"; break;
    default:
      messageBody = "[" + msgType + "]";
  }

  const normalizedPhone = fromPhone.replace(/^[+]/, "");
  // limit(1) + leer el primer elemento — nunca .single()/.maybeSingle() (pueden lanzar
  // excepción si hay teléfonos duplicados y romperían el guardado en bandeja).
  const { data: clientRows } = await supabase
    .from("clients").select("id")
    .or("whatsapp_phone.eq." + normalizedPhone + ",whatsapp_phone.eq." + normalizedPhone.replace(/^57/, ""))
    .limit(1);
  const clientData = Array.isArray(clientRows) && clientRows.length > 0 ? clientRows[0] : null;

  const { error } = await supabase.from("whatsapp_incoming_messages").upsert({
    wamid,
    from_phone:      fromPhone,
    from_name:       fromName,
    message_type:    msgType,
    message_body:    messageBody,
    media_id:        mediaId,
    media_mime_type: mediaMimeType,
    media_caption:   mediaCaption,
    latitude,
    longitude,
    location_name:   locationName,
    raw_payload:     msg,
    client_id:       clientData?.id ?? null,
    status:          "unread",
  }, { onConflict: "wamid", ignoreDuplicates: true });

  if (error) throw new Error(error.message);
  console.log("Saved incoming [" + msgType + "] from " + fromPhone + ": " + (messageBody ?? "").substring(0, 60));
}

// Dispara el asistente de enrutamiento. Devuelve true si el router respondió OK.
// Con timeout corto; cualquier fallo se traga (el mensaje ya quedó en la bandeja).
async function routeToBot(msg, contacts): Promise<boolean> {
  if (!routerSecret) return false; // sin secret configurado, no enrutar
  const fromPhone = msg?.from;
  const msgType   = msg?.type ?? "text";
  const contact   = contacts.find((c) => c?.wa_id === fromPhone);
  const fromName  = contact?.profile?.name ?? null;

  // id de botón/lista interactiva (para enrutamiento determinista por id).
  let replyId: string | null = null;
  let body: string | null = null;
  if (msgType === "interactive") {
    replyId = msg?.interactive?.button_reply?.id ?? msg?.interactive?.list_reply?.id ?? null;
    body    = msg?.interactive?.button_reply?.title ?? msg?.interactive?.list_reply?.title ?? null;
  } else if (msgType === "button") {
    replyId = msg?.button?.payload ?? null;
    body    = msg?.button?.text ?? null;
  } else {
    body    = msg?.text?.body ?? null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-router`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": routerSecret },
      body: JSON.stringify({
        wamid:        msg?.id,
        from_phone:   fromPhone,
        from_name:    fromName,
        message_type: msgType,
        message_body: body,
        reply_id:     replyId,
      }),
      signal: controller.signal,
    });
    return res.ok;
  } catch (e) {
    console.error("routeToBot error:", e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function handleStatus(status) {
  const providerMessageId = status?.id;
  if (!providerMessageId) return;

  const patch = {
    status,
    status_timestamp: new Date(parseInt(status?.timestamp ?? "0") * 1000).toISOString(),
    raw_payload:      status,
  };
  if (status?.errors?.length)   patch.errors       = status.errors;
  if (status?.conversation)     patch.conversation  = status.conversation;
  if (status?.pricing)          patch.pricing       = status.pricing;

  const { error } = await supabase.from("whatsapp_message_log")
    .upsert({ provider_message_id: providerMessageId, ...patch },
             { onConflict: "provider_message_id" });

  if (error) console.warn("Status update warning: " + error.message);
  console.log("Status [" + status?.status + "] for " + providerMessageId);
}

function jsonR(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
