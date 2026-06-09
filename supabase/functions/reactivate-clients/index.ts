// supabase/functions/reactivate-clients/index.ts
//
// Edge Function: Reactivador de Clientes — Agente Capa 04 (Retención)
//
// Mensualmente identifica clientes con proyectos completados hace 3-12 meses
// y envía mensaje de reactivación. Statuses reales: 'entregado', 'completado'.
//
// Trigger: pg_cron 'reactivar-clientes-mensual' el día 1 de cada mes, 14:00 UTC
// Config: verify_jwt=false
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

interface ProjectRow {
  id: string;
  status: string;
  delivery_date: string | null;
  client_id: string;
  clients: { name: string; whatsapp_phone: string | null } | null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const jobStart = new Date();
  let rowsProcessed = 0;
  const errors: string[] = [];

  try {
    // 1. Configuración
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "reactivador_clientes_dry_run",
        "reactivador_clientes_min_months_ago",
        "reactivador_clientes_max_months_ago",
      ]);

    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => { cfg[s.key] = s.value; });

    const DRY_RUN   = cfg.reactivador_clientes_dry_run === "true";
    const minMonths = parseInt(cfg.reactivador_clientes_min_months_ago ?? "3", 10);
    const maxMonths = parseInt(cfg.reactivador_clientes_max_months_ago ?? "12", 10);

    const now     = new Date();
    const minDate = new Date(now); minDate.setMonth(minDate.getMonth() - maxMonths);
    const maxDate = new Date(now); maxDate.setMonth(maxDate.getMonth() - minMonths);

    // 2. Proyectos entregados/completados en la ventana de tiempo
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select(`
        id, status, delivery_date, client_id,
        clients!projects_client_id_fkey(name, whatsapp_phone)
      `)
      .in("status", ["entregado", "completado"])
      .gte("delivery_date", minDate.toISOString().split("T")[0])
      .lte("delivery_date", maxDate.toISOString().split("T")[0])
      .is("deleted_at", null);

    if (projErr) throw projErr;
    if (!projects || projects.length === 0) {
      await safeLogJob(supabase, jobStart, 0, "success");
      return new Response(JSON.stringify({ ok: true, processed: 0, dry_run: DRY_RUN }));
    }

    // 3. Clientes ya notificados este mes (dedup)
    const currentMonth = now.toISOString().slice(0, 7);
    const { data: alreadyNotified } = await supabase
      .from("client_reactivation_log")
      .select("client_id")
      .gte("notified_at", `${currentMonth}-01`)
      .eq("dry_run", false);

    const notifiedSet = new Set(
      (alreadyNotified ?? []).map((r: { client_id: string }) => r.client_id)
    );

    for (const proj of projects as unknown as ProjectRow[]) {
      const client = proj.clients;
      if (!client) continue;

      const phone = client.whatsapp_phone || null;
      const name  = client.name;

      if (notifiedSet.has(proj.client_id)) continue;

      // Validar delivery_date antes de calcular meses
      if (!proj.delivery_date) {
        errors.push(`sin_delivery_date:${proj.id}`);
        continue;
      }
      const deliveryMs = new Date(proj.delivery_date).getTime();
      if (isNaN(deliveryMs)) {
        errors.push(`delivery_date_invalida:${proj.id}:${proj.delivery_date}`);
        continue;
      }
      const monthsAgo = Math.floor((now.getTime() - deliveryMs) / (1000 * 60 * 60 * 24 * 30));

      if (DRY_RUN) {
        console.log(`[DRY_RUN] reactivar | ${name} | ${monthsAgo} meses`);
        rowsProcessed++;
        continue;
      }

      if (!phone) {
        errors.push(`sin_phone:${proj.client_id}`);
        continue;
      }

      const dedup = `reactivador:${proj.client_id}:${currentMonth}`;

      const { data: queued, error: qErr } = await supabase
        .from("notification_queue")
        .insert({
          event_type: "client.reactivation",
          entity_type: "client",
          event_reference_id: proj.client_id,
          recipient_phone: phone,
          channel: "whatsapp",
          provider: "meta_whatsapp",
          template_name: "reactivacion_remodelacion_v1",
          template_language: "es",
          template_parameters: [name, String(monthsAgo)],
          dedup_key: dedup,
          status: "pending",
        })
        .select("id")
        .single();

      if (qErr && !isDedup(qErr)) {
        errors.push(`queue:${proj.client_id}:${qErr.message}`);
        continue;
      }

      // Si es duplicado (ya enviado en este run), solo agregar al set y seguir
      if (qErr && isDedup(qErr)) {
        notifiedSet.add(proj.client_id);
        continue;
      }

      // Registrar en log (ignorar conflicto único si ya existe para este mes)
      const { error: logErr } = await supabase.from("client_reactivation_log").insert({
        client_id:   proj.client_id,
        project_id:  proj.id,
        notified_at: now.toISOString(),
        queue_id:    queued?.id ?? null,
        dry_run:     false,
      });

      if (logErr && !isDedup(logErr)) {
        errors.push(`log:${proj.client_id}:${logErr.message}`);
      }

      notifiedSet.add(proj.client_id);
      rowsProcessed++;
    }

    await safeLogJob(supabase, jobStart, rowsProcessed, errors.length > 0 ? "partial" : "success", errors);
    return new Response(JSON.stringify({ ok: true, processed: rowsProcessed, dry_run: DRY_RUN, errors }));
  } catch (err) {
    await safeLogJob(supabase, jobStart, rowsProcessed, "error", [String(err)]);
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
      job_name: "reactivate-clients",
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
