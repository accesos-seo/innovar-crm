// ============================================================
// Edge Function: lead-qualification-detector
// Cron: cada 30 min L-V (*/30 * * * 1-5)
// Detecta clientes con oportunidades nuevas sin contacto en 2h
// y encola el template WhatsApp lead_qualification_start_v1
//
// SCHEMA REAL: no existe tabla "leads" — se usa clients + opportunities
//   clients.status = 'PENDING' para oportunidades recientes sin asignar
//   clients.last_contacted_at  (columna nueva, migración 20260609000003)
//   clients.qualification_attempts (columna nueva)
//   opportunities.status = 'new' — oportunidad sin actividad
//
// Variables de entorno requeridas:
//   CALIFICADOR_LEADS_IA_DRY_RUN | QUALIFIER_DRY_RUN = "true"/"false"
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-inyectadas)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const DRY_RUN =
  Deno.env.get("CALIFICADOR_LEADS_IA_DRY_RUN") === "true" ||
  Deno.env.get("QUALIFIER_DRY_RUN") === "true";

const MAX_ATTEMPTS     = 2;   // máx intentos de contacto por cliente
const WAIT_HOURS       = 2;   // horas sin contacto antes de disparar
const MAX_PER_RUN      = 10;  // límite de seguridad por ejecución

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ error: "Missing env vars" }),
      { status: 500, headers: CORS },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const jobStart = new Date();

  try {
    // 1. Verificar ventana hábil (L-V 8-18 Bogotá)
    const { data: inHours, error: bizErr } = await supabase.rpc("is_business_hours");
    if (bizErr) {
      console.warn("is_business_hours RPC error:", bizErr.message);
    }
    if (!inHours) {
      return new Response(
        JSON.stringify({ skipped: "outside_business_hours", dry_run: DRY_RUN }),
        { status: 200, headers: CORS },
      );
    }

    // 2. Buscar clientes con oportunidades new creadas hace >WAIT_HOURS horas
    //    sin contacto previo del calificador y con teléfono disponible
    const cutoff = new Date(Date.now() - WAIT_HOURS * 60 * 60 * 1000).toISOString();

    // Traer oportunidades 'new' creadas antes del cutoff con su cliente
    const { data: candidates, error: queryErr } = await supabase
      .from("opportunities")
      .select(`
        id,
        client_id,
        assigned_to,
        created_at,
        clients!inner(
          id,
          name,
          whatsapp_phone,
          last_contacted_at,
          qualification_attempts
        )
      `)
      .eq("status", "new")
      .lte("created_at", cutoff)
      .is("deleted_at", null)
      .not("clients.whatsapp_phone", "is", null)
      .is("clients.last_contacted_at", null)
      .lt("clients.qualification_attempts", MAX_ATTEMPTS)
      .limit(MAX_PER_RUN);

    if (queryErr) throw new Error(`Query error: ${queryErr.message}`);

    const results: Array<Record<string, unknown>> = [];
    const today = new Date().toISOString().split("T")[0];

    for (const row of (candidates ?? [])) {
      const client     = (row as any).clients;
      const clientId   = row.client_id;
      const oppId      = row.id;
      const phone      = client?.whatsapp_phone as string;
      const clientName = (client?.name as string) ?? "cliente";
      const attempts   = (client?.qualification_attempts as number) ?? 0;

      if (!phone) {
        results.push({ client_id: clientId, action: "skipped_no_phone" });
        continue;
      }

      // 3. Verificar que no tenga conversación activa ya
      const { data: existingConv, error: convCheckErr } = await supabase
        .from("lead_conversations")
        .select("id")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (convCheckErr) {
        console.warn("conv check error for client", clientId, convCheckErr.message);
      }

      if (existingConv) {
        results.push({ client_id: clientId, action: "skipped_active_conversation" });
        continue;
      }

      if (DRY_RUN) {
        results.push({
          client_id: clientId,
          opp_id: oppId,
          action: "dry_run_would_send",
          phone,
          client_name: clientName,
        });
        continue;
      }

      // 4. Crear conversación
      const { data: conv, error: convCreateErr } = await supabase
        .from("lead_conversations")
        .insert({
          client_id:      clientId,
          opportunity_id: oppId,
          phone,
          status:         "active",
          phase:          "init",
          messages:       [],
          data_extracted: {},
        })
        .select("id")
        .single();

      if (convCreateErr) {
        results.push({
          client_id: clientId,
          action:    "error_creating_conversation",
          error:     convCreateErr.message,
        });
        continue;
      }

      // 5. Encolar mensaje WhatsApp (template proactivo)
      const dedupKey = `calificador-leads-ia:${clientId}:init:${today}`;
      const { error: qErr } = await supabase
        .from("notification_queue")
        .insert({
          recipient_phone:      phone,
          channel:              "whatsapp",
          provider:             "meta_whatsapp",
          template_name:        "lead_qualification_start_v1",
          template_language:    "es",
          template_parameters:  [clientName],
          status:               "pending",
          dedup_key:            dedupKey,
          event_type:           "lead_qualification_start",
          entity_type:          "opportunity",
          entity_reference_id:  oppId,
          recipient_name:       clientName,
        });

      if (qErr) {
        // Si es duplicado, no es un error real
        if (!qErr.message.includes("duplicate") && !qErr.message.includes("unique")) {
          results.push({ client_id: clientId, action: "error_enqueue", error: qErr.message });
          continue;
        }
      }

      // 6. Actualizar cliente: marcar como contactado
      const { error: updateErr } = await supabase
        .from("clients")
        .update({
          last_contacted_at:      new Date().toISOString(),
          qualification_attempts: attempts + 1,
        })
        .eq("id", clientId);

      if (updateErr) {
        console.warn("update client error:", updateErr.message);
      }

      results.push({
        client_id:  clientId,
        opp_id:     oppId,
        action:     "queued",
        phone,
        conv_id:    conv!.id,
        dedup_key:  dedupKey,
      });
    }

    // 7. Log de ejecución
    const queued = results.filter((r) => r.action === "queued").length;
    await supabase.from("scheduled_job_log").insert({
      job_name:     "lead-qualification-detector",
      started_at:   jobStart.toISOString(),
      finished_at:  new Date().toISOString(),
      rows_affected: queued,
      status:       "success",
    });

    return new Response(
      JSON.stringify({ dry_run: DRY_RUN, queued, total_evaluated: results.length, results }),
      { status: 200, headers: CORS },
    );

  } catch (err) {
    console.error("lead-qualification-detector error:", err);

    // Intentar loguear el error (best-effort, no lanzar)
    try {
      const supabaseLog = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
      await supabaseLog.from("scheduled_job_log").insert({
        job_name:      "lead-qualification-detector",
        started_at:    jobStart.toISOString(),
        finished_at:   new Date().toISOString(),
        rows_affected: 0,
        status:        "error",
        error_msg:     String(err).slice(0, 500),
      });
    } catch (logErr) {
      console.error("Failed to log error:", logErr);
    }

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: CORS },
    );
  }
});
