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
//   Flujo public booking (Fase 2):
//   - welcome_lead_v1   · 1 var {{1}}=nombre del cliente
//   - booking_link_v1   · 3 vars {{1}}=nombre, {{2}}=URL pública, {{3}}=nombre del comercial
//
//   Fase 3 · Visita técnica en sitio (slices 3 y 5):
//   - visit_assigned_admin_v1        · 4 vars {{1}}=cliente, {{2}}=fecha, {{3}}=hora, {{4}}=dirección
//   - visit_reminder_24h_internal_v1 · 5 vars {{1}}=hora, {{2}}=cliente, {{3}}=dirección, {{4}}=tel, {{5}}=servicios
//   - visit_reminder_2h_client_v1    · 2 vars {{1}}=nombre, {{2}}=hora
//   - visit_reminder_2h_internal_v1  · 4 vars {{1}}=hora, {{2}}=cliente, {{3}}=dirección, {{4}}=tel
//   - visit_summary_client_v1        · 2 vars {{1}}=nombre, {{2}}=plazo_horas (S5)
//
//   Fase 4 · Slice 3 · Pago → Proyecto (migraciones 037 + 038):
//   - payment_request_v1             · 5 vars {{1}}=nombre cliente, {{2}}=banco, {{3}}=cuenta, {{4}}=titular, {{5}}=monto anticipo
//   - quotation_reactivation_admin_v1· 3 vars {{1}}=nombre admin, {{2}}=nombre cliente, {{3}}=número cotización
//   - payment_proof_rejected_v1      · 4 vars {{1}}=nombre cliente, {{2}}=número cotización, {{3}}=motivo, {{4}}=link reintento
//   - project_assigned_designer_v1   · 3 vars {{1}}=primer nombre diseñador, {{2}}=cliente, {{3}}=path proyecto
//   - project_fully_paid_v1          · 2 vars {{1}}=primer nombre cliente, {{2}}=nombre proyecto
//   - quotation_v2_sent_v1           · 3 vars {{1}}=cliente, {{2}}=número cotización, {{3}}=link
//   - admin_quotation_expired_v1     · 4 vars {{1}}=primer nombre admin, {{2}}=cliente, {{3}}=número cotización, {{4}}=días vencida

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

// Helper: builder body-only para templates de N variables de texto.
// `template_parameters` puede llegar como object con keys "1","2",... (formato Postgres
// jsonb_build_array convertido) o como array. Soportamos ambos.
function bodyBuilder(name: string, arity: number): TemplateBuilder {
  return (params) => {
    // jsonb_build_array(...) llega como array; jsonb_build_object("1",..) como objeto.
    const values: string[] = [];
    if (Array.isArray(params)) {
      for (let i = 0; i < arity; i++) values.push(String(params[i] ?? ""));
    } else {
      for (let i = 1; i <= arity; i++) values.push(String(params[String(i)] ?? ""));
    }
    return {
      name,
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: values.map((text) => ({ type: "text", text })),
        },
      ],
    };
  };
}

// Mapeo explícito de templates aprobados en Meta → estructura de components.
// Si en el futuro se agregan más templates, hay que extender este registro.
const TEMPLATE_REGISTRY: Record<string, TemplateBuilder> = {
  // — Flujo public booking (Fase 2) —
  welcome_lead_v1: bodyBuilder("welcome_lead_v1", 1),
  booking_link_v1: bodyBuilder("booking_link_v1", 3),

  // — Fase 3 · Visita técnica —
  visit_assigned_admin_v1: bodyBuilder("visit_assigned_admin_v1", 4),
  visit_reminder_24h_internal_v1: bodyBuilder("visit_reminder_24h_internal_v1", 5),
  visit_reminder_2h_client_v1: bodyBuilder("visit_reminder_2h_client_v1", 2),
  visit_reminder_2h_internal_v1: bodyBuilder("visit_reminder_2h_internal_v1", 4),
  visit_summary_client_v1: bodyBuilder("visit_summary_client_v1", 2),

  // — Fase 4 · Slice 3 · Pago → Proyecto —
  payment_request_v1: bodyBuilder("payment_request_v1", 5),
  quotation_reactivation_admin_v1: bodyBuilder("quotation_reactivation_admin_v1", 3),
  payment_proof_rejected_v1: bodyBuilder("payment_proof_rejected_v1", 4),
  project_assigned_designer_v1: bodyBuilder("project_assigned_designer_v1", 3),
  project_fully_paid_v1: bodyBuilder("project_fully_paid_v1", 2),
  quotation_v2_sent_v1: bodyBuilder("quotation_v2_sent_v1", 3),
  admin_quotation_expired_v1: bodyBuilder("admin_quotation_expired_v1", 4),
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

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dry_run ?? false);
    const limit = Math.min(Math.max(1, Number(body.limit) || 20), 100);

    // Meta secrets solo son obligatorios cuando vamos a llamar a la Graph API.
    // En dry_run validamos TEMPLATE_REGISTRY sin tocar Meta ni mutar la queue.
    if (!dryRun && (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID)) {
      return jsonResponse({
        error: "Faltan secrets META_WABA_ACCESS_TOKEN y/o META_PHONE_NUMBER_ID en Vault",
      }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Modo prueba: si `wa_test_phone_override` está en system_settings, todos los
    // mensajes se redirigen a ese número. Eliminar o poner NULL para producción.
    const { data: testPhoneSetting } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "wa_test_phone_override")
      .maybeSingle();
    const testPhoneOverride: string | null = testPhoneSetting?.value ?? null;

    // 1. Reclamar lote de filas pendientes (status pending, attempt_count < 3).
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
        .eq("status", "pending");
      if (lockErr) {
        return jsonResponse({ error: `Error reclamando filas: ${lockErr.message}` }, 500);
      }
    }

    let processed = 0;
    let failed = 0;
    const results: Array<{ id: string; status: "sent" | "failed"; detail?: string }> = [];

    for (const row of rows) {
      const effectiveRow = testPhoneOverride
        ? { ...row, recipient_phone: testPhoneOverride }
        : row;
      const result = await sendOneMessage(effectiveRow, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, dryRun);
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
