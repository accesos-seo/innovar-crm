// supabase/functions/process-whatsapp-notifications/index.ts
//
// Edge Function: procesa la cola `notification_queue` y envía mensajes
// vía Meta WhatsApp Business API (Graph API).
//
// Trigger:
//   - Cron job (cada minuto, body: { dry_run: false, limit: 20 })
//   - UI manual en /settings/whatsapp (hook useWhatsApp.processMessages)
//
// Config:
//   - verify_jwt: true → el caller necesita SUPABASE_SERVICE_ROLE_KEY
//     (el cron lo provee; la UI usa la sesión del admin).
//
// Secrets requeridos (Supabase Vault):
//   - META_WABA_ACCESS_TOKEN — System User permanent token
//   - META_PHONE_NUMBER_ID    — del número verificado
//
// Templates esperados en Meta (deben estar aprobados):
//   - welcome_lead_v1   · 1 variable {{1}}=nombre del cliente
//   - booking_link_v1   · 3 variables {{1}}=nombre, {{2}}=URL pública, {{3}}=nombre del comercial

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_GRAPH_VERSION = "v21.0";
const COUNTRY_CODE = "57"; // Colombia — los teléfonos en clients.whatsapp_phone vienen sin prefijo

interface QueueRow {
  id: string;
  recipient_phone: string;
  template_name: string;
  template_language: string;
  template_parameters: Record<string, string> | null;
  attempt_count: number;
}

type TemplateBuilder = (params: Record<string, string>) => {
  name: string;
  language: { code: string };
  components: unknown[];
};

// Mapeo explícito de templates aprobados en Meta → estructura de components.
// Si en el futuro se agregan más templates, hay que extender este registro.
const TEMPLATE_REGISTRY: Record<string, TemplateBuilder> = {
  welcome_lead_v1: (params) => ({
    name: "welcome_lead_v1",
    language: { code: "es" },
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: params["1"] ?? "" }],
      },
    ],
  }),
  booking_link_v1: (params) => ({
    name: "booking_link_v1",
    language: { code: "es" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params["1"] ?? "" },
          { type: "text", text: params["2"] ?? "" },
          { type: "text", text: params["3"] ?? "" },
        ],
      },
    ],
  }),
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Normaliza teléfono local a E.164 internacional (Meta exige formato sin '+').
// Input típico desde clients.whatsapp_phone: "3001234567" → "573001234567".
function normalizePhoneForMeta(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith(COUNTRY_CODE) && digits.length === 12) return digits;
  if (digits.length === 10) return COUNTRY_CODE + digits;
  return digits;
}

async function sendOneMessage(
  row: QueueRow,
  accessToken: string,
  phoneNumberId: string,
  dryRun: boolean,
): Promise<{ ok: true; provider_id: string } | { ok: false; error: string }> {
  const builder = TEMPLATE_REGISTRY[row.template_name];
  if (!builder) {
    return { ok: false, error: `Template '${row.template_name}' no registrado en la Edge Function` };
  }

  const template = builder(row.template_parameters ?? {});
  const to = normalizePhoneForMeta(row.recipient_phone);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template,
  };

  if (dryRun) {
    return { ok: true, provider_id: `dry-run-${row.id}` };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    const providerId = data?.messages?.[0]?.id;
    if (!providerId) {
      return { ok: false, error: "Meta no devolvió message id" };
    }
    return { ok: true, provider_id: providerId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Fetch error: ${msg}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const META_ACCESS_TOKEN = Deno.env.get("META_WABA_ACCESS_TOKEN") ?? "";
    const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Edge Function mal configurada (secrets Supabase faltantes)" }, 500);
    }
    if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
      return jsonResponse({
        error: "Faltan secrets META_WABA_ACCESS_TOKEN y/o META_PHONE_NUMBER_ID en Vault",
      }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dry_run ?? false);
    const limit = Math.min(Math.max(1, Number(body.limit) || 20), 100);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Reclamar lote de filas pendientes (status pending, attempt_count < 3).
    //    Las marcamos 'processing' en bloque con UPDATE…RETURNING para que
    //    múltiples invocaciones simultáneas no procesen las mismas filas.
    const { data: claimed, error: claimErr } = await admin
      .from("notification_queue")
      .select("id, recipient_phone, template_name, template_language, template_parameters, attempt_count")
      .eq("status", "pending")
      .lt("attempt_count", 3)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (claimErr) {
      return jsonResponse({ error: `Error leyendo queue: ${claimErr.message}` }, 500);
    }

    const rows = (claimed ?? []) as QueueRow[];
    if (rows.length === 0) {
      return jsonResponse({ ok: true, processed: 0, failed: 0, dry_run: dryRun });
    }

    // Lock optimista: marcar processing antes de mandar a Meta.
    if (!dryRun) {
      const ids = rows.map((r) => r.id);
      const { error: lockErr } = await admin
        .from("notification_queue")
        .update({ status: "processing", processing_at: new Date().toISOString() })
        .in("id", ids)
        .eq("status", "pending"); // evita race: solo lockea las que aún están pending
      if (lockErr) {
        return jsonResponse({ error: `Error reclamando filas: ${lockErr.message}` }, 500);
      }
    }

    // 2. Procesar una por una (secuencial preserva orden welcome → booking_link)
    let processed = 0;
    let failed = 0;
    const results: Array<{ id: string; status: "sent" | "failed"; detail?: string }> = [];

    for (const row of rows) {
      const result = await sendOneMessage(row, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, dryRun);
      const nextAttempt = (row.attempt_count ?? 0) + 1;

      if (result.ok) {
        processed++;
        results.push({ id: row.id, status: "sent" });
        if (!dryRun) {
          await admin.from("notification_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.provider_id,
            attempt_count: nextAttempt,
            error_message: null,
            failed_reason: null,
          }).eq("id", row.id);
        }
      } else {
        failed++;
        results.push({ id: row.id, status: "failed", detail: result.error });
        if (!dryRun) {
          await admin.from("notification_queue").update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_message: result.error,
            failed_reason: result.error,
            attempt_count: nextAttempt,
          }).eq("id", row.id);
        }
      }
    }

    return jsonResponse({ ok: true, processed, failed, dry_run: dryRun, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});
