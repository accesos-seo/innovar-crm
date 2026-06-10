// supabase/functions/postventa-engine/index.ts
//
// Edge Function: Motor de Postventa (PRD-postventa-garantias.md)
//
// Cron diario (8:00 AM Bogotá = 13:00 UTC). Pasos, todos idempotentes:
//   1. Expira garantías vencidas (active → expired).
//   2. Envía encuestas pendientes (espera survey_delay_days tras la entrega;
//      template encuesta_satisfaccion_v1 con link /encuesta/:token).
//   3. Expira encuestas enviadas sin respuesta (sent → expired).
//   4. Recuerda reclamos estancados (open/in_progress sin update > 5 días,
//      máx. 1 aviso por semana por reclamo al postventa_alert_phone).
//
// DRY_RUN: system_settings.postventa_dry_run = 'true' (default) → loguea en
// project_postventa_log con dry_run=true y NO encola mensajes. Solo se activa
// con aprobación explícita del usuario.
//
// Config: verify_jwt=false (⚠️ cada deploy lo resetea — corregir vía PATCH
// Management API, igual que public-project-tracking).
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

interface SurveyRow {
  id: string;
  project_id: string;
  client_id: string | null;
  public_token: string;
  created_at: string;
  projects: {
    name: string;
    delivered_at: string | null;
    delivery_date: string | null;
  } | null;
  clients: { name: string | null; whatsapp_phone: string | null } | null;
}

interface ClaimRow {
  id: string;
  claim_number: string | null;
  updated_at: string;
  warranties: { projects: { name: string } | null } | null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const jobStart = new Date();
  const errors: string[] = [];
  const summary = {
    warranties_expired: 0,
    surveys_sent: 0,
    surveys_expired: 0,
    stale_claim_reminders: 0,
    dry_run: true,
  };

  try {
    // ── Configuración ──────────────────────────────────────────────────────
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "postventa_dry_run",
        "survey_delay_days",
        "postventa_alert_phone",
        "public_app_base_url",
      ]);

    const cfg: Record<string, unknown> = {};
    (settings ?? []).forEach((s: { key: string; value: unknown }) => {
      cfg[s.key] = s.value;
    });

    const DRY_RUN = cfg.postventa_dry_run === "true" || cfg.postventa_dry_run == null;
    summary.dry_run = DRY_RUN;
    const delayDays = parseInt(String(cfg.survey_delay_days ?? "2"), 10) || 2;
    const alertPhone = String(cfg.postventa_alert_phone ?? "").trim();
    // public_app_base_url es JSONB {"url": "..."} (validado en prod)
    const baseUrlRaw = cfg.public_app_base_url as { url?: string } | string | null;
    const baseUrl = (
      typeof baseUrlRaw === "object" && baseUrlRaw !== null
        ? baseUrlRaw.url ?? ""
        : String(baseUrlRaw ?? "")
    ).replace(/\/+$/, "");

    const now = new Date();

    // ── 1. Expirar garantías vencidas ──────────────────────────────────────
    {
      const { data, error } = await supabase
        .from("warranties")
        .update({ status: "expired" })
        .eq("status", "active")
        .lt("expires_at", now.toISOString())
        .select("id");
      if (error) errors.push(`warranties_expire:${error.message}`);
      else summary.warranties_expired = data?.length ?? 0;
    }

    // ── 2. Enviar encuestas pendientes (delay post-entrega) ────────────────
    {
      const { data: pending, error } = await supabase
        .from("satisfaction_surveys")
        .select(`
          id, project_id, client_id, public_token, created_at,
          projects!satisfaction_surveys_project_id_fkey(name, delivered_at, delivery_date),
          clients!satisfaction_surveys_client_id_fkey(name, whatsapp_phone)
        `)
        .eq("status", "pending");

      if (error) {
        errors.push(`surveys_fetch:${error.message}`);
      } else {
        const cutoff = now.getTime() - delayDays * 24 * 60 * 60 * 1000;

        for (const s of (pending ?? []) as unknown as SurveyRow[]) {
          // Fecha de entrega efectiva: delivered_at → delivery_date → created_at
          const deliveredRaw =
            s.projects?.delivered_at ?? s.projects?.delivery_date ?? s.created_at;
          const deliveredMs = new Date(deliveredRaw).getTime();
          if (isNaN(deliveredMs) || deliveredMs > cutoff) continue; // aún en espera

          const phone = s.clients?.whatsapp_phone?.trim() || null;
          const firstName = (s.clients?.name ?? "Cliente").split(" ")[0];

          if (DRY_RUN) {
            console.log(`[DRY_RUN] encuesta | ${firstName} | survey=${s.id}`);
            await logPostventa(supabase, s.project_id, true, []);
            summary.surveys_sent++;
            continue;
          }

          if (!phone) {
            errors.push(`survey_sin_phone:${s.id}`);
            continue;
          }
          if (!baseUrl) {
            errors.push("missing_public_app_base_url");
            break;
          }

          const link = `${baseUrl}/encuesta/${s.public_token}`;

          // enqueue_notification normaliza el teléfono y deduplica por
          // template:event_reference_id:phone → un solo envío por encuesta.
          const { data: queueId, error: qErr } = await supabase.rpc(
            "enqueue_notification",
            {
              p_event_type: "survey.request",
              p_event_reference_id: s.id,
              p_entity_type: "satisfaction_survey",
              p_entity_reference_id: s.id,
              p_recipient_type: "client",
              p_recipient_reference_id: s.client_id ?? "unknown",
              p_recipient_name: firstName,
              p_recipient_phone: phone,
              p_template_name: "encuesta_satisfaccion_v1",
              p_template_language: "es",
              p_template_parameters: [firstName, link],
              p_payload: { survey_id: s.id, project_id: s.project_id },
            }
          );

          if (qErr) {
            errors.push(`survey_queue:${s.id}:${qErr.message}`);
            continue;
          }

          // Marcar enviada + refrescar ventana de respuesta (30 días)
          const { error: updErr } = await supabase
            .from("satisfaction_surveys")
            .update({
              status: "sent",
              sent_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", s.id)
            .eq("status", "pending");
          if (updErr) errors.push(`survey_mark_sent:${s.id}:${updErr.message}`);

          await logPostventa(supabase, s.project_id, false, queueId ? [queueId] : []);
          summary.surveys_sent++;
        }
      }
    }

    // ── 3. Expirar encuestas enviadas sin respuesta ────────────────────────
    {
      const { data, error } = await supabase
        .from("satisfaction_surveys")
        .update({ status: "expired" })
        .eq("status", "sent")
        .lt("expires_at", now.toISOString())
        .select("id");
      if (error) errors.push(`surveys_expire:${error.message}`);
      else summary.surveys_expired = data?.length ?? 0;
    }

    // ── 4. Reclamos estancados (> 5 días sin actividad) ────────────────────
    if (alertPhone) {
      const staleCutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const { data: stale, error } = await supabase
        .from("warranty_claims")
        .select(`
          id, claim_number, updated_at,
          warranties!warranty_claims_warranty_id_fkey(
            projects!warranties_project_id_fkey(name)
          )
        `)
        .in("status", ["open", "in_progress"])
        .lt("updated_at", staleCutoff.toISOString());

      if (error) {
        errors.push(`claims_fetch:${error.message}`);
      } else {
        const week = isoWeek(now); // dedup: máx. 1 recordatorio por semana
        for (const c of (stale ?? []) as unknown as ClaimRow[]) {
          if (DRY_RUN) {
            console.log(`[DRY_RUN] reclamo estancado | ${c.claim_number ?? c.id}`);
            summary.stale_claim_reminders++;
            continue;
          }

          // Reutiliza garantia_reclamo_admin_v1 ({{3}} = estado del recordatorio)
          const { error: qErr } = await supabase.rpc("enqueue_notification", {
            p_event_type: "warranty.claim_stale",
            p_event_reference_id: `${c.id}:stale:${week}`,
            p_entity_type: "warranty_claim",
            p_entity_reference_id: c.id,
            p_recipient_type: "staff",
            p_recipient_reference_id: "postventa_alert",
            p_recipient_name: "Equipo Innovar",
            p_recipient_phone: alertPhone,
            p_template_name: "garantia_reclamo_admin_v1",
            p_template_language: "es",
            p_template_parameters: [
              c.claim_number ?? c.id,
              c.warranties?.projects?.name ?? "Proyecto",
              "Sin actividad +5 días",
            ],
            p_payload: { claim_id: c.id, stale_week: week },
          });

          if (qErr) errors.push(`claim_stale_queue:${c.id}:${qErr.message}`);
          else summary.stale_claim_reminders++;
        }
      }
    }

    await safeLogJob(
      supabase, jobStart,
      summary.surveys_sent + summary.warranties_expired + summary.surveys_expired + summary.stale_claim_reminders,
      errors.length > 0 ? "partial" : "success",
      errors
    );
    return new Response(JSON.stringify({ ok: true, ...summary, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await safeLogJob(supabase, jobStart, 0, "error", [String(err)]);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Semana ISO YYYY-Www para claves de dedup semanales
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// project_postventa_log tiene índice único parcial (project_id WHERE NOT dry_run);
// los conflictos se tragan — el log es best-effort.
async function logPostventa(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  dryRun: boolean,
  queueIds: string[]
) {
  try {
    await supabase.from("project_postventa_log").insert({
      project_id: projectId,
      triggered_at: new Date().toISOString(),
      dry_run: dryRun,
      queue_ids: queueIds,
    });
  } catch (_e) {
    // silencioso
  }
}

// Nunca lanza: errores de logging no deben romper el flujo principal
async function safeLogJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  try {
    await supabase.from("scheduled_job_log").insert({
      job_name: "postventa-engine",
      started_at: start.toISOString(),
      finished_at: new Date().toISOString(),
      status,
      rows_affected: rows,
      ...(errors.length > 0 ? { error_msg: errors.slice(0, 5).join(" | ") } : {}),
    });
  } catch (_logErr) {
    // silencioso
  }
}
