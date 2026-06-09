// supabase/functions/ask-innovar/index.ts
//
// Edge Function: asistente ejecutivo NOVA para Álvaro Ríos (Cocinas Innovar).
//
// Arquitectura mixta:
//   1. classifyIntent() → keyword matching (sin costo de IA)
//   2. queryData()      → SQL contra Supabase con service_role
//   3. callDeepSeek()   → DeepSeek V3 vía OpenRouter formatea la respuesta
//
// Config:
//   - verify_jwt: false (la auth se valida manualmente)
//   - Deploy: supabase functions deploy ask-innovar --no-verify-jwt
//   - Secrets requeridos en Vault: OPENROUTER_API_KEY
//   - Auto-inyectados: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY      = Deno.env.get("OPENROUTER_API_KEY")!;
const MODEL                   = "deepseek/deepseek-chat";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Intent =
  | "daily_summary"
  | "critical_pending"
  | "financial_summary_month"
  | "payments_pending_verification"
  | "quotations_approved_no_payment"
  | "quotations_pending_response"
  | "pipeline_summary"
  | "leads_without_followup"
  | "projects_in_progress"
  | "projects_delayed"
  | "tasks_overdue"
  | "agenda_today"
  | "team_workload"
  | "warranty_claims_open"
  | "unknown";

// ─────────────────────────────────────────────
// Clasificador de intents (sin costo de IA)
// ─────────────────────────────────────────────

function classifyIntent(raw: string): Intent {
  const m = raw.toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (/resumen.*(dia|hoy)|como.*va.*hoy|que.*pasa.*hoy/.test(m))         return "daily_summary";
  if (/pendientes.*(criticos?|urgentes?)|critico|urgente/.test(m))        return "critical_pending";
  if (/pago.*sin.*(verif|cobrar)|sin verif|verif.*pago/.test(m))         return "payments_pending_verification";
  if (/(cotizac).*(aprobad).*(sin pago|cobrar)/.test(m))                 return "quotations_approved_no_payment";
  if (/(cotizac).*(sin respuesta|esperando|pendiente)/.test(m))          return "quotations_pending_response";
  if (/finanz|financiero|ingreso|factur|cobrado|ganancia|margen|rentab/.test(m)) return "financial_summary_month";
  if (/pipeline|embudo|funnel|lead|comercial|prospecto/.test(m))         return "pipeline_summary";
  if (/lead.*(sin seguimiento|sin.*(seguim))|sin seguimiento.*lead/.test(m)) return "leads_without_followup";
  if (/proyecto.*(atrasado|retraso|demorado)|atrasado/.test(m))          return "projects_delayed";
  if (/proyecto.*(activo|curso|estado)|estado.*proyecto/.test(m))        return "projects_in_progress";
  if (/tarea.*(vencid|atrasad|pendiente)|vencida/.test(m))               return "tasks_overdue";
  if (/agenda|visita.*(hoy|dia)|cita.*(hoy|dia)|programad.*hoy/.test(m)) return "agenda_today";
  if (/equipo|carga.*trabajo|quien.*tiene|cuantas.*tarea/.test(m))       return "team_workload";
  if (/garantia|reclamo/.test(m))                                        return "warranty_claims_open";

  return "unknown";
}

// ─────────────────────────────────────────────
// Consultas SQL por intent
// ─────────────────────────────────────────────

async function queryData(
  sb: ReturnType<typeof createClient>,
  intent: Intent,
): Promise<{ label: string; data: unknown }> {
  const now   = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";
  const cutoff48h  = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff3d   = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  switch (intent) {

    case "daily_summary": {
      const [v, t, p] = await Promise.all([
        sb.from("visits")
          .select("id, scheduled_at, status, modality, duration_minutes")
          .gte("scheduled_at", today + "T00:00:00")
          .lte("scheduled_at", today + "T23:59:59")
          .order("scheduled_at"),
        sb.from("tasks")
          .select("id, title, status, due_date, priority, profiles(full_name)")
          .lt("due_date", today)
          .not("status", "in", '("completado","cancelado")')
          .order("due_date")
          .limit(10),
        sb.from("payments")
          .select("id, amount, payment_method, clients(name)")
          .eq("verification_status", "pendiente")
          .limit(5),
      ]);
      return {
        label: "Resumen del día",
        data: {
          fecha: today,
          visitas_hoy: v.data ?? [],
          tareas_vencidas: t.data ?? [],
          pagos_sin_verificar: p.data ?? [],
        },
      };
    }

    case "critical_pending": {
      const [t, p] = await Promise.all([
        sb.from("tasks")
          .select("id, title, due_date, priority, profiles(full_name), projects(name)")
          .lt("due_date", today)
          .not("status", "in", '("completado","cancelado")')
          .order("due_date")
          .limit(15),
        sb.from("payments")
          .select("id, amount, payment_method, received_at, clients(name)")
          .eq("verification_status", "pendiente")
          .order("received_at"),
      ]);
      const totalPendiente = (p.data ?? []).reduce(
        (s: number, x: { amount?: number }) => s + (x.amount ?? 0), 0,
      );
      return {
        label: "Pendientes críticos",
        data: {
          tareas_vencidas: t.data ?? [],
          pagos_sin_verificar: p.data ?? [],
          total_pesos_sin_verificar: totalPendiente,
        },
      };
    }

    case "financial_summary_month": {
      const [pay, exp] = await Promise.all([
        sb.from("payments")
          .select("id, amount, payment_method, verification_status, received_at")
          .eq("verification_status", "verificado")
          .gte("received_at", monthStart),
        sb.from("expenses")
          .select("id, amount, category, expense_date")
          .gte("expense_date", monthStart),
      ]);
      const pagos    = pay.data ?? [];
      const gastos   = exp.data ?? [];
      const ingresos = pagos.reduce((s: number, x: { amount?: number }) => s + (x.amount ?? 0), 0);
      const egresos  = gastos.reduce((s: number, x: { amount?: number }) => s + (x.amount ?? 0), 0);
      const gastosPorCategoria: Record<string, number> = {};
      for (const g of gastos as Array<{ category?: string; amount?: number }>) {
        const cat = g.category ?? "otro";
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] ?? 0) + (g.amount ?? 0);
      }
      return {
        label: "Resumen financiero del mes",
        data: {
          mes: today.slice(0, 7),
          total_cobrado: ingresos,
          total_gastos: egresos,
          margen_bruto: ingresos - egresos,
          num_pagos_verificados: pagos.length,
          gastos_por_categoria: gastosPorCategoria,
        },
      };
    }

    case "payments_pending_verification": {
      const { data } = await sb
        .from("payments")
        .select("id, amount, payment_method, received_at, clients(name), projects(name)")
        .eq("verification_status", "pendiente")
        .order("received_at", { ascending: false });
      const total = (data ?? []).reduce(
        (s: number, x: { amount?: number }) => s + (x.amount ?? 0), 0,
      );
      return {
        label: "Pagos sin verificar",
        data: { pagos: data ?? [], total_pesos: total },
      };
    }

    case "quotations_approved_no_payment": {
      const { data } = await sb
        .from("quotations")
        .select("id, quotation_number, total_amount, updated_at, clients(name)")
        .eq("status", "client_approved")
        .order("updated_at", { ascending: false });
      return {
        label: "Cotizaciones aprobadas sin pago registrado",
        data: { cotizaciones: data ?? [], total: (data ?? []).length },
      };
    }

    case "quotations_pending_response": {
      const { data } = await sb
        .from("quotations")
        .select("id, quotation_number, total_amount, updated_at, clients(name)")
        .eq("status", "sent")
        .lt("updated_at", cutoff48h)
        .order("updated_at");
      return {
        label: "Cotizaciones enviadas sin respuesta (+48h)",
        data: { cotizaciones: data ?? [], total: (data ?? []).length },
      };
    }

    case "pipeline_summary": {
      const [cli, opp, quot] = await Promise.all([
        sb.from("clients").select("id, status").gte("created_at", monthStart),
        sb.from("opportunities").select("id, status"),
        sb.from("quotations").select("id, status, total_amount").gte("created_at", monthStart),
      ]);
      const quotes = (quot.data ?? []).filter(
        (q): q is { status: string; total_amount?: number } => {
          if (q === null || typeof q !== "object") return false;
          const r = q as Record<string, unknown>;
          if (typeof r.status !== "string") return false;
          if (r.total_amount !== undefined && typeof r.total_amount !== "number") return false;
          return true;
        },
      );
      return {
        label: "Pipeline comercial del mes",
        data: {
          mes: today.slice(0, 7),
          leads_nuevos: (cli.data ?? []).length,
          oportunidades_activas: (opp.data ?? []).length,
          cotizaciones_enviadas:  quotes.filter(q => q.status === "sent").length,
          cotizaciones_aprobadas: quotes.filter(q => ["client_approved", "approved"].includes(q.status)).length,
          cotizaciones_rechazadas: quotes.filter(q => q.status === "rejected").length,
          valor_pipeline: quotes
            .filter(q => q.status === "sent")
            .reduce((s, q) => s + (q.total_amount ?? 0), 0),
        },
      };
    }

    case "leads_without_followup": {
      const { data } = await sb
        .from("clients")
        .select("id, name, created_at, status, profiles(full_name)")
        .not("status", "in", '("ganado","perdido","descartado")')
        .lt("created_at", cutoff3d + "T00:00:00")
        .order("created_at")
        .limit(10);
      return {
        label: "Leads sin actividad (más de 3 días)",
        data: { leads: data ?? [], total: (data ?? []).length },
      };
    }

    case "projects_in_progress": {
      const { data } = await sb
        .from("projects")
        .select("id, name, status, total_amount, estimated_install_date, clients(name)")
        .not("status", "in", '("entregado","cancelado")')
        .order("status");
      const grouped: Record<string, unknown[]> = {};
      for (const p of (data ?? []) as Array<{ status?: string }>) {
        const s = p.status ?? "sin_estado";
        if (!grouped[s]) grouped[s] = [];
        grouped[s].push(p);
      }
      return {
        label: "Proyectos en curso",
        data: { por_estado: grouped, total: (data ?? []).length },
      };
    }

    case "projects_delayed": {
      const { data } = await sb
        .from("projects")
        .select("id, name, status, estimated_install_date, clients(name)")
        .not("status", "in", '("entregado","cancelado")')
        .lt("estimated_install_date", today)
        .not("estimated_install_date", "is", null)
        .order("estimated_install_date");
      return {
        label: "Proyectos atrasados",
        data: { proyectos: data ?? [], total: (data ?? []).length },
      };
    }

    case "tasks_overdue": {
      const { data } = await sb
        .from("tasks")
        .select("id, title, due_date, priority, task_category, profiles(full_name), projects(name)")
        .lt("due_date", today)
        .not("status", "in", '("completado","cancelado")')
        .order("due_date")
        .limit(20);
      return {
        label: "Tareas vencidas",
        data: { tareas: data ?? [], total: (data ?? []).length },
      };
    }

    case "agenda_today": {
      const { data } = await sb
        .from("visits")
        .select("id, scheduled_at, status, modality, duration_minutes")
        .gte("scheduled_at", today + "T00:00:00")
        .lte("scheduled_at", today + "T23:59:59")
        .order("scheduled_at");
      return {
        label: "Agenda de hoy",
        data: { fecha: today, visitas: data ?? [], total: (data ?? []).length },
      };
    }

    case "team_workload": {
      const { data } = await sb
        .from("tasks")
        .select("assigned_to, profiles(full_name)")
        .not("status", "in", '("completado","cancelado")')
        .not("assigned_to", "is", null);
      const workload: Record<string, { nombre: string; tareas_activas: number }> = {};
      for (const t of (data ?? []) as Array<{ assigned_to?: string; profiles?: { full_name?: string } }>) {
        const id = t.assigned_to;
        if (!id) continue;
        if (!workload[id]) workload[id] = { nombre: t.profiles?.full_name ?? id, tareas_activas: 0 };
        workload[id].tareas_activas++;
      }
      return {
        label: "Carga de trabajo del equipo",
        data: { equipo: Object.values(workload) },
      };
    }

    case "warranty_claims_open": {
      const { data } = await sb
        .from("warranty_claims")
        .select("id, description, severity, status, created_at")
        .not("status", "in", '("cerrado","resuelto")')
        .order("severity", { ascending: false });
      return {
        label: "Reclamos de garantía abiertos",
        data: { reclamos: data ?? [], total: (data ?? []).length },
      };
    }

    default:
      return { label: "Consulta general", data: null };
  }
}

// ─────────────────────────────────────────────
// DeepSeek V3 vía OpenRouter
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres NOVA, el asistente ejecutivo de Álvaro Ríos, director de Cocinas Innovar.

REGLAS:
1. Responde SOLO con datos del contexto. Nunca inventes cifras ni nombres.
2. Lenguaje directo y ejecutivo. Sin tecnicismos. Sin markdown (no uses **, ##, ni guiones de lista).
3. Máximo 5 líneas. Si hay muchos datos, prioriza los más críticos o urgentes.
4. Montos en pesos colombianos: $X.XXX.XXX.
5. Si los datos están vacíos, dilo con una frase positiva breve.
6. Cierra con una pregunta o sugerencia de acción concreta.
7. Si la consulta está fuera de alcance, indica exactamente qué puedes consultar: finanzas del mes, pagos pendientes, proyectos activos, pipeline comercial, tareas vencidas, agenda de hoy, carga del equipo, garantías abiertas.
Tono: conciso, orientado a decisiones.`;

async function callDeepSeek(userMessage: string, context: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer":  "https://cocinas-innovar.vercel.app",
      "X-Title":       "Innovar CRM - NOVA",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Consulta: "${userMessage}"\n\nDatos:\n${context}`,
        },
      ],
      max_tokens:  400,
      temperature: 0.25,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  return (json.choices?.[0]?.message?.content as string | undefined) ?? "(sin respuesta)";
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1. Verificar JWT
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonRes({ ok: false, error: "No autorizado" }, 401);

    const sb    = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const token = auth.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user?.id) return jsonRes({ ok: false, error: "Token inválido" }, 401);

    // 2. Verificar rol (solo admin / super_admin)
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = typeof profile?.role === "string" ? profile.role : "";
    if (!["super_admin", "admin"].includes(role)) {
      return jsonRes({ ok: false, error: "Acceso restringido al panel director" }, 403);
    }

    // 3. Parsear mensaje
    const body = await req.json().catch(() => ({})) as { message?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return jsonRes({ ok: false, error: "Mensaje vacío" }, 400);

    // 4. Clasificar intent + consultar datos
    const intent              = classifyIntent(message);
    const { label, data }     = await queryData(sb, intent);

    // 5. Construir contexto para DeepSeek
    const context = data != null
      ? `[${label}]\n${JSON.stringify(data, null, 2)}`
      : "No hay datos estructurados para esta consulta.";

    // 6. Generar respuesta con DeepSeek
    const reply = await callDeepSeek(message, context);

    return jsonRes({ ok: true, reply, intent });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ask-innovar]", msg);
    return jsonRes({ ok: false, error: "Error interno. Intenta de nuevo." }, 500);
  }
});
