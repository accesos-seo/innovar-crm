// supabase/functions/detector-abandono/index.ts
//
// Edge Function: Detector de Abandono — Agente Capa 01
//
// Detecta oportunidades sin actividad >= 5 días, crea tarea urgente en CRM
// y notifica al comercial responsable via WhatsApp.
//
// Trigger: pg_cron 'detector-abandono-diario' → L-V 9am Bogotá (14:00 UTC)
// Config: verify_jwt=false (llamado por cron sin JWT)
//
// Env vars:
//   DETECTOR_ABANDONO_DRY_RUN=true  → solo loguea, no inserta nada
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

const DRY_RUN = Deno.env.get("DETECTOR_ABANDONO_DRY_RUN") === "true";

interface Oportunidad {
  id: string;
  client_id: string;
  status: string;
  assigned_to: string;
  last_activity_at: string;
  dias_inactivo: number;
  comercial_nombre: string;
  comercial_phone: string;
  cliente_nombre: string;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jobStart = new Date();
  let rowsAffected = 0;
  const errors: string[] = [];

  try {
    // 1. Oportunidades con >= 5 días de inactividad
    const { data: opps, error: queryErr } = await supabase
      .from("opportunities")
      .select(`
        id,
        client_id,
        status,
        assigned_to,
        last_activity_at,
        profiles!opportunities_assigned_to_fkey(full_name, whatsapp_phone),
        clients!opportunities_client_id_fkey(name)
      `)
      .is("deleted_at", null)
      .not("status", "in", "(lost,client_approved)")
      .not("assigned_to", "is", null)
      .lt("last_activity_at", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString());

    if (queryErr) throw queryErr;
    if (!opps || opps.length === 0) {
      await logJob(supabase, jobStart, 0, "ok");
      return new Response(JSON.stringify({ ok: true, oportunidades_procesadas: 0, dry_run: DRY_RUN }));
    }

    const hoy = new Date().toISOString().split("T")[0];

    for (const opp of opps as unknown as (typeof opps[0] & { profiles: { full_name: string; whatsapp_phone: string }; clients: { name: string } })[]) {
      const diasInactivo = Math.floor(
        (Date.now() - new Date(opp.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const etapa = diasInactivo >= 10 ? "d10" : "d5";

      const comercialNombre = opp.profiles?.full_name ?? "Comercial";
      const comercialPhone = opp.profiles?.whatsapp_phone;
      const clienteNombre = opp.clients?.name ?? "Cliente";

      if (!comercialPhone) {
        errors.push(`sin_phone:${opp.id}:${comercialNombre}`);
        continue;
      }

      // 2. Dedup: ¿ya se alertó hoy para esta etapa?
      const { data: existing } = await supabase
        .from("abandonment_log")
        .select("id")
        .eq("opportunity_id", opp.id)
        .eq("etapa", etapa)
        .eq("fecha_alerta", hoy)
        .maybeSingle();

      if (existing) continue;

      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] ${etapa.toUpperCase()} | ${diasInactivo}d | ${clienteNombre} → ${comercialNombre} (${comercialPhone})`
        );
        rowsAffected++;
        continue;
      }

      // 3. Crear tarea urgente en el CRM
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          title: `Seguimiento urgente — oportunidad sin actividad: ${clienteNombre}`,
          assigned_to: opp.assigned_to,
          client_id: opp.client_id,
          due_date: hoy,
          status: "pendiente",
          priority: etapa === "d5" ? 1 : 2,
          task_category: "seguimiento",
        })
        .select("id")
        .single();

      if (taskErr) {
        errors.push(`task:${opp.id}:${taskErr.message}`);
        continue;
      }

      // 4. Encolar notificación WhatsApp al comercial
      const fechaLegible = new Date().toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const dedupKey = `detector-abandono:${opp.id}:${etapa}:${hoy}`;

      const { data: queued, error: queueErr } = await supabase
        .from("notification_queue")
        .insert({
          event_type: "opportunity.abandoned",
          entity_type: "opportunity",
          event_reference_id: opp.id,
          recipient_phone: comercialPhone,
          channel: "whatsapp",
          provider: "meta_whatsapp",
          template_name: "task_assigned",
          template_language: "es",
          template_parameters: [
            comercialNombre,
            `Seguimiento urgente — ${diasInactivo} días sin actividad`,
            fechaLegible,
            clienteNombre,
          ],
          dedup_key: dedupKey,
          status: "pending",
        })
        .select("id")
        .single();

      if (queueErr && !queueErr.message.includes("duplicate")) {
        errors.push(`queue:${opp.id}:${queueErr.message}`);
        continue;
      }

      // 5. Registrar en abandonment_log (dedup persistent)
      await supabase.from("abandonment_log").insert({
        opportunity_id: opp.id,
        etapa,
        fecha_alerta: hoy,
        dias_inactivo: diasInactivo,
        task_id: task.id,
        queue_id: queued?.id ?? null,
      });

      rowsAffected++;
    }

    await logJob(supabase, jobStart, rowsAffected, errors.length > 0 ? "partial" : "ok", errors);

    return new Response(
      JSON.stringify({
        ok: true,
        oportunidades_procesadas: rowsAffected,
        dry_run: DRY_RUN,
        errors,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logJob(supabase, jobStart, rowsAffected, "error", [String(err)]);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function logJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  await supabase.from("scheduled_job_log").insert({
    job_name: "detector-abandono",
    started_at: start.toISOString(),
    finished_at: new Date().toISOString(),
    status,
    rows_affected: rows,
    ...(errors.length > 0 ? { error_msg: errors.slice(0, 5).join(" | ") } : {}),
  });
}
