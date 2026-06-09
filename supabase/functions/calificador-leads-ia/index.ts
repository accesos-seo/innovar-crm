// ============================================================
// Edge Function: calificador-leads-ia
// Rol: orquestador / health-check del agente calificador
//
// Este EF actúa como punto de entrada unificado y health-check.
// Los tres sub-agentes están en sus propias EFs:
//   - lead-qualification-detector  (cron cada 30 min L-V)
//   - lead-qualification-webhook   (webhook Meta — mensajes entrantes)
//   - lead-qualification-finalizer (cierra conversación y alerta comercial)
//
// Variables de entorno requeridas en Supabase Vault:
//   CALIFICADOR_LEADS_IA_DRY_RUN   = "true" | "false"
//   QUALIFIER_DRY_RUN              = "true" | "false"  (alias para sub-EFs)
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN  = "<token aleatorio>"
//   WHATSAPP_TOKEN                 = "<Meta API token>"
//   WHATSAPP_PHONE_NUMBER_ID       = "<Meta phone number id>"
//   OPENROUTER_API_KEY             = "<OpenRouter key>"
//
// BLOQUEANTE: NO deployar hasta que Meta apruebe el template
//   lead_qualification_start_v1
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DRY_RUN =
  Deno.env.get("CALIFICADOR_LEADS_IA_DRY_RUN") === "true" ||
  Deno.env.get("QUALIFIER_DRY_RUN") === "true";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Validar variables de entorno requeridas
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // ── GET: health-check del sistema ────────────────────────
    if (req.method === "GET") {
      const [
        { count: activeConvs, error: e1 },
        { count: pendingQueue, error: e2 },
        { data: lastJob, error: e3 },
        { data: inBusinessHours, error: e4 },
      ] = await Promise.all([
        supabase
          .from("lead_conversations")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("notification_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .like("dedup_key", "calificador-leads-ia:%"),
        supabase
          .from("scheduled_job_log")
          .select("started_at, status, rows_affected")
          .eq("job_name", "lead-qualification-detector")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("is_business_hours"),
      ]);

      // Loguear errores de DB sin bloquear el health-check
      if (e1) console.warn("health-check activeConvs error:", e1.message);
      if (e2) console.warn("health-check pendingQueue error:", e2.message);
      if (e3) console.warn("health-check lastJob error:", e3.message);
      if (e4) console.warn("health-check isBusinessHours error:", e4.message);

      return jsonResponse({
        agent: "calificador-leads-ia",
        dry_run: DRY_RUN,
        status: "ok",
        in_business_hours: inBusinessHours ?? null,
        active_conversations: activeConvs ?? 0,
        pending_whatsapp_queue: pendingQueue ?? 0,
        last_detector_run: lastJob ?? null,
        sub_functions: [
          "lead-qualification-detector",
          "lead-qualification-webhook",
          "lead-qualification-finalizer",
        ],
        blockers: [
          "Requiere aprobación Meta del template lead_qualification_start_v1 antes de activar en producción",
        ],
      });
    }

    // ── POST: invocar el detector manualmente ────────────────
    if (req.method === "POST") {
      const detectorUrl = `${SUPABASE_URL}/functions/v1/lead-qualification-detector`;

      let detectorResult: unknown = null;
      let detectorStatus = 0;

      try {
        const response = await fetch(detectorUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "calificador-leads-ia/manual" }),
        });

        detectorStatus = response.status;

        const rawText = await response.text();
        try {
          detectorResult = JSON.parse(rawText);
        } catch {
          detectorResult = { raw: rawText };
        }
      } catch (fetchErr) {
        return jsonResponse({
          agent: "calificador-leads-ia",
          dry_run: DRY_RUN,
          error: `Failed to reach detector: ${String(fetchErr)}`,
        }, 502);
      }

      return jsonResponse({
        agent: "calificador-leads-ia",
        dry_run: DRY_RUN,
        detector_response: detectorResult,
        detector_status: detectorStatus,
      });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

  } catch (err) {
    console.error("calificador-leads-ia unhandled error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
