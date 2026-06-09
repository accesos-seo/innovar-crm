// supabase/functions/schedule-visit-reminder/index.ts
//
// Edge Function: Orquestador de Agenda — recordatorios de visitas
//
// Llamada por cron 'orquestador-agenda-daily' cada día a las 14:00 UTC (9 AM Colombia).
// Revisa visitas próximas en las siguientes 24-26h y 2-3h,
// encola recordatorios y actualiza los flags reminder_*_sent_at.
//
// Config: verify_jwt=false
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

interface VisitRow {
  id: string;
  scheduled_at: string;
  client_id: string;
  assigned_to: string | null;
  address: string | null;
  services: string | null;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  clients: { name: string; whatsapp_phone: string | null } | null;
  profiles: { full_name: string; whatsapp_phone: string | null } | null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const jobStart = new Date();
  let sent24h = 0;
  let sent2h = 0;
  const errors: string[] = [];

  try {
    const now = new Date();
    const window24hStart = new Date(now.getTime() + 23 * 3600 * 1000);
    const window24hEnd   = new Date(now.getTime() + 26 * 3600 * 1000);
    const window2hStart  = new Date(now.getTime() +  1.5 * 3600 * 1000);
    const window2hEnd    = new Date(now.getTime() +  3 * 3600 * 1000);

    // 1. Visitas en ventana 24h sin recordatorio enviado
    const { data: visits24h, error: err24 } = await supabase
      .from("visits")
      .select(`
        id, scheduled_at, client_id, assigned_to, address, services,
        reminder_24h_sent_at, reminder_2h_sent_at,
        clients!visits_client_id_fkey(name, whatsapp_phone),
        profiles!visits_assigned_to_fkey(full_name, whatsapp_phone)
      `)
      .in("status", ["agendada", "confirmada", "reagendada"])
      .is("deleted_at", null)
      .is("reminder_24h_sent_at", null)
      .gte("scheduled_at", window24hStart.toISOString())
      .lte("scheduled_at", window24hEnd.toISOString());

    if (err24) throw err24;

    for (const visit of (visits24h ?? []) as unknown as VisitRow[]) {
      const comercialPhone = visit.profiles?.whatsapp_phone ?? null;
      const clientName     = visit.clients?.name ?? "Cliente";
      const fecha          = formatDateTime(visit.scheduled_at);

      if (!comercialPhone) {
        errors.push(`24h:sin_phone:${visit.id}`);
        continue;
      }

      const { error: qErr } = await supabase.from("notification_queue").insert({
        event_type: "visit.reminder_24h",
        entity_type: "visit",
        event_reference_id: visit.id,
        recipient_phone: comercialPhone,
        channel: "whatsapp",
        provider: "meta_whatsapp",
        template_name: "visit_reminder_24h_internal_v1",
        template_language: "es",
        template_parameters: [
          fecha.hora,
          clientName,
          visit.address ?? "Por confirmar",
          visit.clients?.whatsapp_phone ?? "",
          visit.services ?? "Cotización de cocina",
        ],
        dedup_key: `orquestador-agenda:${visit.id}:24h`,
        status: "pending",
      });

      if (qErr && !isDedup(qErr)) {
        errors.push(`24h:queue:${visit.id}:${qErr.message}`);
        continue;
      }

      // Marcar flag DESPUÉS de confirmar que la notificación fue encolada (o ya existía)
      const { error: updErr } = await supabase.from("visits")
        .update({ reminder_24h_sent_at: now.toISOString() })
        .eq("id", visit.id);

      if (updErr) {
        errors.push(`24h:update:${visit.id}:${updErr.message}`);
        continue;
      }

      sent24h++;
    }

    // 2. Visitas en ventana 2h — recordatorio al cliente
    const { data: visits2h, error: err2 } = await supabase
      .from("visits")
      .select(`
        id, scheduled_at, client_id,
        reminder_2h_sent_at,
        clients!visits_client_id_fkey(name, whatsapp_phone)
      `)
      .in("status", ["agendada", "confirmada", "reagendada"])
      .is("deleted_at", null)
      .is("reminder_2h_sent_at", null)
      .gte("scheduled_at", window2hStart.toISOString())
      .lte("scheduled_at", window2hEnd.toISOString());

    if (err2) throw err2;

    for (const visit of (visits2h ?? []) as unknown as VisitRow[]) {
      const clientPhone = visit.clients?.whatsapp_phone ?? null;
      const clientName  = visit.clients?.name ?? "Cliente";

      if (!clientPhone) {
        errors.push(`2h:sin_phone:${visit.id}`);
        continue;
      }

      const fecha = formatDateTime(visit.scheduled_at);

      const { error: qErr } = await supabase.from("notification_queue").insert({
        event_type: "visit.reminder_2h",
        entity_type: "visit",
        event_reference_id: visit.id,
        recipient_phone: clientPhone,
        channel: "whatsapp",
        provider: "meta_whatsapp",
        template_name: "visit_reminder_2h_client_v1",
        template_language: "es",
        template_parameters: [clientName, fecha.hora],
        dedup_key: `orquestador-agenda:${visit.id}:2h`,
        status: "pending",
      });

      if (qErr && !isDedup(qErr)) {
        errors.push(`2h:queue:${visit.id}:${qErr.message}`);
        continue;
      }

      const { error: updErr } = await supabase.from("visits")
        .update({ reminder_2h_sent_at: now.toISOString() })
        .eq("id", visit.id);

      if (updErr) {
        errors.push(`2h:update:${visit.id}:${updErr.message}`);
        continue;
      }

      sent2h++;
    }

    await safeLogJob(supabase, jobStart, sent24h + sent2h, errors.length > 0 ? "partial" : "success", errors);
    return new Response(JSON.stringify({ ok: true, sent_24h: sent24h, sent_2h: sent2h, errors }));
  } catch (err) {
    await safeLogJob(supabase, jobStart, sent24h + sent2h, "error", [String(err)]);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});

function isDedup(err: { message?: string; code?: string }): boolean {
  return (
    (err.message?.includes("duplicate") ?? false) ||
    (err.message?.includes("unique") ?? false) ||
    err.code === "23505"
  );
}

function formatDateTime(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }),
    hora:  d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

// Nunca lanza: los errores de logging no deben romper el flujo principal
async function safeLogJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  try {
    await supabase.from("scheduled_job_log").insert({
      job_name: "orquestador-agenda",
      started_at: start.toISOString(),
      finished_at: new Date().toISOString(),
      status,
      rows_affected: rows,
      ...(errors.length > 0 ? { error_msg: errors.slice(0, 5).join(" | ") } : {}),
    });
  } catch (_logErr) {
    // silencioso: fallo de logging no debe romper la respuesta
  }
}
