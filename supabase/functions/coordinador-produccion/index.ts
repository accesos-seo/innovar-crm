// supabase/functions/coordinador-produccion/index.ts
//
// Edge Function: Coordinador de Producción — Agente Capa 03
//
// Llamada por trigger trg_fabrication_started cuando projects.status → 'en_produccion'.
// Lee la ficha técnica del proyecto y notifica al taller via WhatsApp.
//
// Config: verify_jwt=false (llamado por trigger PL/pgSQL vía pg_net)
//
// Env vars:
//   DRY_RUN=true → loguea sin enviar notificaciones
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

const DRY_RUN = Deno.env.get("DRY_RUN") === "true";

interface FichaTecnica {
  project_id: string;
  project_name: string;
  client_name: string;
  client_phone: string | null;
  delivery_date: string | null;
  fabrication_days: number;
  items: Array<{
    description: string;
    quantity: number;
    material: string | null;
    finish: string | null;
    dimensions: string | null;
  }> | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let projectId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    projectId = body.project_id ?? null;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id requerido" }), { status: 400 });
    }

    // 1. Leer configuración del taller
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["workshop_whatsapp", "crm_base_url"]);

    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => { cfg[s.key] = s.value; });

    const workshopPhone: string | null = cfg.workshop_whatsapp || null;
    if (!workshopPhone && !DRY_RUN) {
      return new Response(
        JSON.stringify({ ok: false, reason: "workshop_whatsapp no configurado en system_settings" }),
        { status: 200 }
      );
    }

    // 2. Leer ficha técnica del proyecto via RPC
    const { data: fichaData, error: rpcErr } = await supabase
      .rpc("get_project_ficha_tecnica", { p_project_id: projectId });

    if (rpcErr) throw rpcErr;
    if (!fichaData) {
      return new Response(JSON.stringify({ ok: false, reason: "proyecto no encontrado" }), { status: 200 });
    }

    const ficha = fichaData as FichaTecnica;

    // 3. Construir resumen de items para el mensaje
    const items = ficha.items ?? [];
    const itemsResumen = items.length > 0
      ? items.slice(0, 5).map((it) => {
          const dim = it.dimensions ? ` (${it.dimensions})` : "";
          return `• ${it.description}${dim}`;
        }).join("\n")
      : "Sin ítems registrados";

    const deliveryLabel = ficha.delivery_date
      ? new Date(ficha.delivery_date).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
      : `${ficha.fabrication_days} días hábiles`;

    const dedup = `coordinador-prod:${projectId}:inicio_produccion`;

    if (DRY_RUN) {
      console.log(`[DRY_RUN] Ficha taller | ${ficha.project_name} | entrega ${deliveryLabel}`);
      return new Response(JSON.stringify({ ok: true, dry_run: true, project_id: projectId }));
    }

    // 4. Encolar notificación al taller
    const { error: queueErr } = await supabase.from("notification_queue").insert({
      event_type: "project.fabrication_started",
      entity_type: "project",
      event_reference_id: projectId,
      recipient_phone: workshopPhone,
      channel: "whatsapp",
      provider: "meta_whatsapp",
      template_name: "ficha_taller_v1",
      template_language: "es",
      template_parameters: [ficha.project_name, ficha.client_name, deliveryLabel, itemsResumen],
      dedup_key: dedup,
      status: "pending",
    });

    if (queueErr && !queueErr.code?.includes("23505") && !queueErr.message?.includes("duplicate")) {
      throw queueErr;
    }

    return new Response(JSON.stringify({ ok: true, project_id: projectId, delivery: deliveryLabel }));
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err), project_id: projectId }),
      { status: 500 }
    );
  }
});
