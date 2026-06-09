// supabase/functions/vigia-pagos/index.ts
//
// Edge Function: Vigía de Pagos — Agente Capa 01 (Cierre)
//
// Revisa cotizaciones aprobadas sin pago verificado.
// Envía recordatorios escalonados: D+1 → D+7 → D+14 → expira D+21.
//
// Trigger: pg_cron 'vigia-pagos-check' L-V 14:00 UTC (9 AM Colombia)
// Config: verify_jwt=false
//
// Env vars:
//   VIGIA_DRY_RUN=true → solo loguea, sin cambios en DB ni WhatsApp
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → inyectados por Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

const DRY_RUN = Deno.env.get("VIGIA_DRY_RUN") === "true";

interface QuotationRow {
  quotation_id: string;
  client_name: string;
  client_phone: string | null;
  commercial_phone: string | null;
  commercial_name: string | null;
  total_amount: number;
  days_since_approval: number;
  vigia_stage: string | null;
  has_verified_payment: boolean;
}

interface Action {
  nextStage: string;
  templateName: string;
  templateParams: string[];
  targetPhone: string | null; // null = sin destinatario válido
  expireQuotation: boolean;
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
    // 1. Leer configuración bancaria y admin
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["bank_name", "bank_account", "bank_account_holder", "admin_whatsapp_phone"]);

    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: { key: string; value: string }) => { cfg[s.key] = s.value; });
    const bankInfo = `${cfg.bank_name ?? "Bancolombia"} · ${cfg.bank_account ?? ""} · ${cfg.bank_account_holder ?? ""}`;
    const adminPhone: string | null = cfg.admin_whatsapp_phone || null;

    // 2. Cotizaciones aprobadas sin pago
    const { data: quotations, error: qErr } = await supabase
      .from("v_quotations_pending_payment")
      .select("*")
      .eq("has_verified_payment", false);

    if (qErr) throw qErr;
    if (!quotations || quotations.length === 0) {
      await logJob(supabase, jobStart, 0, "success");
      return new Response(JSON.stringify({ ok: true, processed: 0, dry_run: DRY_RUN }));
    }

    for (const row of quotations as QuotationRow[]) {
      const action = resolveAction(row, cfg, bankInfo, adminPhone);

      if (!action) continue; // no hay acción todavía

      if (!action.targetPhone) {
        errors.push(`sin_phone:${row.quotation_id}:${action.nextStage}`);
        // Si es expiración, aun sin teléfono actualizamos el estado de la cotización
        if (action.expireQuotation && !DRY_RUN) {
          await supabase.from("quotations")
            .update({ vigia_stage: "expired", vigia_last_action_at: new Date().toISOString(), status: "expired" })
            .eq("id", row.quotation_id);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY_RUN] ${action.nextStage} | ${row.client_name} | día ${row.days_since_approval}`);
        rowsProcessed++;
        continue;
      }

      // Encolar notificación WhatsApp
      const { error: queueErr } = await supabase.from("notification_queue").insert({
        event_type: "quotation.payment_reminder",
        entity_type: "quotation",
        event_reference_id: row.quotation_id,
        recipient_phone: action.targetPhone,
        channel: "whatsapp",
        provider: "meta_whatsapp",
        template_name: action.templateName,
        template_language: "es",
        template_parameters: action.templateParams,
        dedup_key: `vigia-pagos:${row.quotation_id}:${action.nextStage}`,
        status: "pending",
      });

      // Si el error NO es un duplicado de dedup_key, registrar y saltar actualización
      const isDuplicate = queueErr && (
        queueErr.message.includes("duplicate") ||
        queueErr.message.includes("unique") ||
        queueErr.code === "23505"
      );
      if (queueErr && !isDuplicate) {
        errors.push(`queue:${row.quotation_id}:${queueErr.message}`);
        continue; // no avanzar el stage si la notificación falló
      }

      // Actualizar stage (y status si es expiración)
      // Se ejecuta tanto en inserción nueva como en duplicado (idempotente)
      const update: Record<string, unknown> = {
        vigia_stage: action.nextStage,
        vigia_last_action_at: new Date().toISOString(),
      };
      if (action.expireQuotation) {
        update.status = "expired";
      }
      await supabase.from("quotations").update(update).eq("id", row.quotation_id);
      rowsProcessed++;
    }

    await logJob(supabase, jobStart, rowsProcessed, errors.length > 0 ? "partial" : "success", errors);
    return new Response(JSON.stringify({ ok: true, processed: rowsProcessed, dry_run: DRY_RUN, errors }));
  } catch (err) {
    await logJob(supabase, jobStart, rowsProcessed, "error", [String(err)]);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});

// Determina la acción según stage actual y días transcurridos.
// targetPhone: null cuando no hay destinatario válido (la llamadora decide si igual expira).
function resolveAction(
  row: QuotationRow,
  cfg: Record<string, string>,
  bankInfo: string,
  adminPhone: string | null,
): Action | null {
  const days = row.days_since_approval ?? 0;
  const stage = row.vigia_stage;

  const clientPhone = row.client_phone || null;
  const commercialPhone = row.commercial_phone || null;

  if (stage === null && days >= 1) {
    return {
      nextStage: "d1_sent",
      templateName: "payment_request_v1",
      targetPhone: clientPhone,
      templateParams: [
        row.client_name,
        cfg.bank_name ?? "Bancolombia",
        cfg.bank_account ?? "",
        cfg.bank_account_holder ?? "",
        formatAmount(row.total_amount),
      ],
      expireQuotation: false,
    };
  }

  if (stage === "d1_sent" && days >= 7) {
    return {
      nextStage: "d7_sent",
      templateName: "payment_followup_d7_v1",
      targetPhone: clientPhone,
      templateParams: [
        row.client_name,
        row.quotation_id.slice(-8).toUpperCase(),
        String(days),
        bankInfo,
      ],
      expireQuotation: false,
    };
  }

  if (stage === "d7_sent" && days >= 14) {
    return {
      nextStage: "d14_sent",
      templateName: "payment_escalation_d14_v1",
      targetPhone: adminPhone ?? commercialPhone ?? clientPhone,
      templateParams: [
        row.commercial_name ?? "Admin",
        row.client_name,
        row.quotation_id.slice(-8).toUpperCase(),
        String(days),
      ],
      expireQuotation: false,
    };
  }

  if (stage === "d14_sent" && days >= 21) {
    return {
      nextStage: "expired",
      templateName: "admin_quotation_expired_v1",
      targetPhone: adminPhone ?? commercialPhone ?? clientPhone,
      templateParams: [
        row.commercial_name ?? "Admin",
        row.client_name,
        row.quotation_id.slice(-8).toUpperCase(),
        String(days),
      ],
      expireQuotation: true,
    };
  }

  return null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

async function logJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  await supabase.from("scheduled_job_log").insert({
    job_name: "vigia-pagos",
    started_at: start.toISOString(),
    finished_at: new Date().toISOString(),
    status,
    rows_affected: rows,
    ...(errors.length > 0 ? { error_msg: errors.slice(0, 5).join(" | ") } : {}),
  });
}
