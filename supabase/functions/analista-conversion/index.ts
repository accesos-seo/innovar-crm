// supabase/functions/analista-conversion/index.ts
//
// Edge Function: Analista de Conversión — Agente Capa 05
//
// Genera reporte semanal de KPIs de conversión y cuellos de botella.
// Notifica al admin via WhatsApp con el resumen.
// Llamado desde n8n los lunes a las 9 AM (no usa pg_cron).
//
// Config: verify_jwt=false
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

interface WeeklyMetrics {
  semana_inicio: string;
  semana_fin: string;
  leads_nuevos: number;
  oportunidades_creadas: number;
  cotizaciones_enviadas: number;
  cotizaciones_aprobadas: number;
  leads_avanzaron: number;
}

interface Bottleneck {
  cuello: string;
  cantidad: number;
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
      .in("key", ["analista_dry_run", "analista_admin_phone", "analista_admin_name"]);

    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => { cfg[s.key] = s.value; });

    const DRY_RUN   = cfg.analista_dry_run === "true";
    const adminPhone: string | null = cfg.analista_admin_phone || null;
    const adminName  = cfg.analista_admin_name  || "Admin";

    if (!adminPhone && !DRY_RUN) {
      await safeLogJob(supabase, jobStart, 0, "partial");
      return new Response(
        JSON.stringify({ ok: false, reason: "analista_admin_phone no configurado" }),
        { status: 200 }
      );
    }

    // 2. Métricas semanales
    const { data: metricsRows, error: mErr } = await supabase
      .from("vw_pipeline_weekly_metrics")
      .select("*")
      .limit(1);

    if (mErr) throw mErr;
    const metrics = (metricsRows ?? [])[0] as WeeklyMetrics | undefined;

    // 3. Cuellos de botella
    const { data: bottlenecks, error: bErr } = await supabase
      .from("vw_bottleneck_detection")
      .select("*");

    if (bErr) throw bErr;
    const bots = (bottlenecks ?? []) as Bottleneck[];

    // 4. Calcular tasa de conversión
    const cotizacionesEnviadas  = metrics?.cotizaciones_enviadas  ?? 0;
    const cotizacionesAprobadas = metrics?.cotizaciones_aprobadas ?? 0;
    const tasaConversion = cotizacionesEnviadas > 0
      ? Math.round((cotizacionesAprobadas / cotizacionesEnviadas) * 100)
      : 0;

    const semanaLabel = metrics?.semana_inicio
      ? new Date(metrics.semana_inicio).toLocaleDateString("es-CO", { day: "numeric", month: "long" })
      : "semana anterior";

    if (DRY_RUN) {
      console.log("[DRY_RUN] Reporte semanal:", JSON.stringify({ metrics, bots }));
      await safeLogJob(supabase, jobStart, 1, "success");
      return new Response(JSON.stringify({ ok: true, dry_run: true, metrics, bots }));
    }

    // adminPhone validado arriba — solo llega aquí si no es null
    const recipientPhone = adminPhone as string;

    // 5. Notificación KPIs al admin
    await supabase.from("notification_queue").insert({
      event_type: "analytics.weekly_report",
      entity_type: "system",
      event_reference_id: null,
      recipient_phone: recipientPhone,
      channel: "whatsapp",
      provider: "meta_whatsapp",
      template_name: "reporte_semanal_kpi_v1",
      template_language: "es",
      template_parameters: [
        String(metrics?.leads_nuevos ?? 0),
        String(metrics?.oportunidades_creadas ?? 0),
        String(cotizacionesEnviadas),
        String(cotizacionesAprobadas),
        String(tasaConversion) + "%",
        semanaLabel,
      ],
      dedup_key: `analista:kpi:${new Date().toISOString().slice(0, 10)}`,
      status: "pending",
    });

    // 6. Alertas de cuellos de botella si hay > 0
    const alertas = bots.filter((b) => b.cantidad > 0);
    if (alertas.length > 0) {
      const alertaTextos = alertas.map((a) => `${a.cuello}: ${a.cantidad}`);
      const pad = (arr: string[], len: number, fill = "—") =>
        arr.concat(Array(Math.max(0, len - arr.length)).fill(fill));

      await supabase.from("notification_queue").insert({
        event_type: "analytics.weekly_alerts",
        entity_type: "system",
        event_reference_id: null,
        recipient_phone: recipientPhone,
        channel: "whatsapp",
        provider: "meta_whatsapp",
        template_name: "reporte_semanal_alertas_v1",
        template_language: "es",
        template_parameters: [adminName, ...pad(alertaTextos, 3)],
        dedup_key: `analista:alertas:${new Date().toISOString().slice(0, 10)}`,
        status: "pending",
      });
    }

    await safeLogJob(supabase, jobStart, 1, "success");
    return new Response(JSON.stringify({ ok: true, metrics, alertas: alertas.length }));
  } catch (err) {
    await safeLogJob(supabase, jobStart, 0, "error", [String(err)]);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});

// Nunca lanza: errores de logging no deben romper el flujo principal ni el catch
async function safeLogJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  try {
    await supabase.from("scheduled_job_log").insert({
      job_name: "analista-conversion",
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
