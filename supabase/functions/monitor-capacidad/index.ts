// supabase/functions/monitor-capacidad/index.ts
//
// Edge Function: Monitor de Capacidad — Agente Capa 05
//
// Cuenta proyectos activos en taller (en_produccion + entregado) y
// alerta al admin si se superan los umbrales amarillo/rojo.
//
// Trigger: pg_cron 'monitor-capacidad-daily' cada día 13:00 UTC (8 AM Colombia)
// Config: verify_jwt=false
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

interface ProjectCapacity {
  id: string;
  name: string | null;
  status: string;
  delivery_date: string | null;
  clients: { name: string } | null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const jobStart = new Date();

  try {
    // 1. Configuración
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "capacity_monitor_dry_run",
        "capacity_yellow_threshold",
        "capacity_red_threshold",
        "capacity_monitor_admin_phone",
        "capacity_monitor_admin_name",
      ]);

    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => { cfg[s.key] = s.value; });

    const DRY_RUN      = cfg.capacity_monitor_dry_run === "true";
    const yellowLimit  = parseInt(cfg.capacity_yellow_threshold ?? "4", 10);
    const redLimit     = parseInt(cfg.capacity_red_threshold    ?? "7", 10);
    const adminPhone   = cfg.capacity_monitor_admin_phone || null;
    const adminName    = cfg.capacity_monitor_admin_name  || "Admin";

    // 2. Proyectos activos en taller (statuses reales en español)
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select(`
        id, name, status, delivery_date,
        clients!projects_client_id_fkey(name)
      `)
      .in("status", ["en_produccion", "entregado"])
      .is("deleted_at", null);

    if (projErr) throw projErr;

    const activeCount = (projects ?? []).length;
    const activeProjects = (projects ?? []) as unknown as ProjectCapacity[];

    // 3. Determinar nivel de alerta
    const alertLevel = activeCount >= redLimit
      ? "rojo"
      : activeCount >= yellowLimit
        ? "amarillo"
        : "verde";

    if (DRY_RUN) {
      console.log(`[DRY_RUN] capacidad=${activeCount} nivel=${alertLevel}`);
      await logJob(supabase, jobStart, activeCount, "success", alertLevel);
      return new Response(JSON.stringify({ ok: true, dry_run: true, count: activeCount, level: alertLevel }));
    }

    if (alertLevel === "verde") {
      await logJob(supabase, jobStart, activeCount, "success", alertLevel);
      return new Response(JSON.stringify({ ok: true, count: activeCount, level: "verde" }));
    }

    if (!adminPhone) {
      await logJob(supabase, jobStart, activeCount, "partial", alertLevel);
      return new Response(
        JSON.stringify({ ok: false, reason: "capacity_monitor_admin_phone no configurado" }),
        { status: 200 }
      );
    }

    // 4. Construir lista de proyectos activos (máx 5 para el template)
    const listadoLineas = activeProjects.slice(0, 5).map((p) => {
      const nombre = p.name ?? p.clients?.name ?? "Proyecto";
      const fecha  = p.delivery_date
        ? new Date(p.delivery_date).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" })
        : "s/f";
      return `• ${nombre} (${fecha})`;
    });
    const listado = listadoLineas.join("\n");

    const threshold = alertLevel === "rojo" ? redLimit : yellowLimit;
    const templateName = alertLevel === "rojo"
      ? "alerta_capacidad_roja_v1"
      : "alerta_capacidad_amarilla_v1";

    const today = new Date().toISOString().slice(0, 10);
    const dedup = `monitor-capacidad:${alertLevel}:${today}`;

    const { error: qErr } = await supabase.from("notification_queue").insert({
      event_type: "capacity.alert",
      entity_type: "system",
      event_reference_id: null,
      recipient_phone: adminPhone,
      channel: "whatsapp",
      provider: "meta_whatsapp",
      template_name: templateName,
      template_language: "es",
      template_parameters: [adminName, String(activeCount), String(threshold), listado],
      dedup_key: dedup,
      status: "pending",
    });

    if (qErr && !isDedup(qErr)) throw qErr;

    await logJob(supabase, jobStart, activeCount, "success", alertLevel);
    return new Response(JSON.stringify({ ok: true, count: activeCount, level: alertLevel }));
  } catch (err) {
    await logJob(supabase, jobStart, 0, "error", "error");
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

async function logJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  alertLevel: string
) {
  await supabase.from("scheduled_job_log").insert({
    job_name: "monitor-capacidad",
    started_at: start.toISOString(),
    finished_at: new Date().toISOString(),
    status,
    rows_affected: rows,
    metadata: { alert_level: alertLevel },
  });
}
