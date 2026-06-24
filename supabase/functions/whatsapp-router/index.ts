// supabase/functions/whatsapp-router/index.ts
//
// Edge Function: ASISTENTE DE WHATSAPP DE ENRUTAMIENTO para INNOVAR — "Elena".
//
// NO usa inteligencia artificial. Es una máquina de estados determinista que
// enruta al cliente por palabras clave / botones hacia 3 caminos:
//   1) Cotización / precios   2) Agendar visita técnica   3) Hablar con asesor
//
// Lo invoca `meta-whatsapp-webhook` (fire-and-forget) tras guardar cada mensaje
// entrante de texto/botón/interactivo. Responde con mensajes de SESIÓN (free-form,
// dentro de la ventana de 24h) → NO requiere plantillas aprobadas por Meta.
//
// Config + COMPUERTA DE SEGURIDAD: system_settings.whatsapp_router_config
//   - enabled=false               → no responde nada (solo bandeja de entrada).
//   - mode='allowlist'            → solo responde a los teléfonos de prueba.
//   - mode='live'                 → responde a cualquier cliente (activación humana).
//   - dry_run=true                → arma la respuesta y la registra, pero NO llama a Meta.
//
// Secrets (Vault):
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   - META_WABA_ACCESS_TOKEN / META_PHONE_NUMBER_ID  (mismos que process-whatsapp-notifications)
//   - WHATSAPP_ROUTER_SECRET   (shared secret: el caller debe mandar x-internal-secret)

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const META_GRAPH_VERSION = "v21.0";
const COUNTRY_CODE = "57";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────
interface RouterConfig {
  enabled: boolean;
  mode: "allowlist" | "live";
  dry_run?: boolean;
  allowlist: string[];
  assistant_name: string;
  brand_greeting: string;
  advisor_name: string;
  advisor_phone: string;
  advisor_hours: string;
  cities: string[];
  prices_per_ml: { basica: number; intermedia: number; alta: number };
  booking_base_url: string;
  session_idle_minutes: number;
}

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  step: string;
  data: Record<string, unknown>;
  intent: string | null;
  opportunity_id: string | null;
  client_id: string | null;
  human_handoff: boolean;
  handoff_at: string | null;
  last_outbound_at: string | null;
  message_count: number;
}

interface Incoming {
  wamid: string;
  from_phone: string;
  from_name?: string | null;
  message_type?: string;
  message_body?: string | null;
  reply_id?: string | null; // id de botón/lista interactiva si aplica
}

// ──────────────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────────────
const fmtCOP = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });

// Normaliza a dígitos E.164 sin '+'. "‪+57 318...‬" → "57318...".
function digits(phone: string): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}
function phone12(phone: string): string {
  const d = digits(phone);
  if (d.length === 10) return COUNTRY_CODE + d;
  return d;
}
function phone10(phone: string): string {
  const d = digits(phone);
  if (d.startsWith(COUNTRY_CODE) && d.length === 12) return d.slice(2);
  return d;
}

// Quita acentos y baja a minúsculas para matching de keywords.
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

type Intent = "quote" | "schedule" | "advisor" | "menu" | "unknown";

// Enrutamiento determinista: primero id de botón, luego palabras clave / número.
function detectIntent(inc: Incoming): Intent {
  const id = (inc.reply_id ?? "").toLowerCase();
  if (id === "opt_quote") return "quote";
  if (id === "opt_schedule") return "schedule";
  if (id === "opt_advisor") return "advisor";
  if (id === "opt_menu") return "menu";

  const t = norm(inc.message_body ?? "");
  if (!t) return "unknown";

  // Saludos → menú limpio (no "no le entendí")
  if (/^(hola!?|hey|buenas?|buenos|buen dia|buen tarde|saludos|hi|hello|que tal|que hay|ola)/.test(t)) return "menu";

  if (/\b(menu|menú|inicio|empezar|volver|opciones)\b/.test(t)) return "menu";
  if (/(precio|costo|valor|cotiz|cuanto|gama|metro|presupuesto)/.test(t) || t === "1") return "quote";
  if (/(agend|cita|visita|medir|medici|reserv|agenda)/.test(t) || t === "2") return "schedule";
  if (/(asesor|persona|humano|llam|hablar|atend|martha|contact)/.test(t) || t === "3") return "advisor";
  return "unknown";
}

// ──────────────────────────────────────────────────────────────────────────
// Envío a Meta (mensajes de sesión free-form — sin plantilla)
// ──────────────────────────────────────────────────────────────────────────
async function metaSend(
  payload: Record<string, unknown>,
  token: string,
  phoneId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    const id = data?.messages?.[0]?.id;
    return id ? { ok: true, id } : { ok: false, error: "Meta no devolvió message id" };
  } catch (err) {
    return { ok: false, error: `Fetch error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function textMsg(to: string, body: string) {
  return { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } };
}
function buttonsMsg(to: string, body: string, buttons: { id: string; title: string }[]) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  };
}
function listMsg(to: string, body: string, button: string, rows: { id: string; title: string; description?: string }[]) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: button.slice(0, 20),
        sections: [{ rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: r.description?.slice(0, 72) })) }],
      },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const META_TOKEN = Deno.env.get("META_WABA_ACCESS_TOKEN") ?? "";
  const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
  const ROUTER_SECRET = Deno.env.get("WHATSAPP_ROUTER_SECRET") ?? "";

  // Auth: shared secret (el webhook y los tests lo mandan en x-internal-secret).
  if (ROUTER_SECRET && req.headers.get("x-internal-secret") !== ROUTER_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "missing supabase secrets" }, 500);

  let inc: Incoming;
  try {
    inc = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!inc?.from_phone || !inc?.wamid) return json({ error: "from_phone and wamid required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Config + compuerta de seguridad ----------------------------------------
  const { data: cfgRow } = await admin
    .from("system_settings").select("value").eq("key", "whatsapp_router_config").maybeSingle();
  const cfg = (cfgRow?.value ?? null) as RouterConfig | null;
  if (!cfg || !cfg.enabled) return json({ skipped: "router_disabled" });

  const fromDigits = digits(inc.from_phone);
  const inAllowlist = (cfg.allowlist ?? []).map(digits).includes(fromDigits);
  if (cfg.mode === "allowlist" && !inAllowlist) {
    return json({ skipped: "not_in_allowlist", phone: fromDigits });
  }
  const dryRun = cfg.dry_run === true;

  // 2. Idempotencia: ¿ya respondimos a este wamid? ----------------------------
  const { data: dup } = await admin
    .from("whatsapp_router_outbound_log").select("id").eq("in_reply_to_wamid", inc.wamid).limit(1).maybeSingle();
  if (dup) return json({ skipped: "already_processed", wamid: inc.wamid });

  // 3. Cargar / crear conversación --------------------------------------------
  const { data: convRow } = await admin
    .from("whatsapp_conversations").select("*").eq("phone", fromDigits).maybeSingle();

  let conv: Conversation;
  if (convRow) {
    conv = convRow as Conversation;
  } else {
    const { data: created, error: cErr } = await admin
      .from("whatsapp_conversations")
      .insert({ phone: fromDigits, contact_name: inc.from_name ?? null, step: "new", data: {} })
      .select("*").single();
    if (cErr || !created) return json({ error: `conv insert: ${cErr?.message}` }, 500);
    conv = created as Conversation;
  }

  await admin.from("whatsapp_conversations")
    .update({ last_inbound_at: new Date().toISOString(), message_count: (conv.message_count ?? 0) + 1, contact_name: inc.from_name ?? conv.contact_name })
    .eq("id", conv.id);

  // human_handoff se gestiona dentro de advance() para permitir escape por "menú".

  // 4. Avanzar la máquina de estados ------------------------------------------
  const ctx: Ctx = { admin, cfg, conv, inc, to: phone12(inc.from_phone), dryRun, metaToken: META_TOKEN, metaPhoneId: META_PHONE_ID };
  const result = await advance(ctx);

  return json({ ok: true, dry_run: dryRun, phone: fromDigits, ...result });
});

// ──────────────────────────────────────────────────────────────────────────
// Motor de la conversación
// ──────────────────────────────────────────────────────────────────────────
interface Ctx {
  admin: SupabaseClient;
  cfg: RouterConfig;
  conv: Conversation;
  inc: Incoming;
  to: string;
  dryRun: boolean;
  metaToken: string;
  metaPhoneId: string;
}

// Envía un mensaje y lo registra en la bitácora; persiste el nuevo step/data.
async function reply(
  ctx: Ctx,
  payload: Record<string, unknown>,
  nextStep: string,
  patch: Partial<Conversation> = {},
): Promise<{ status: string; provider_id?: string; error?: string }> {
  const kind = payload.type === "interactive" ? "interactive" : "text";
  let status = "dry_run", providerId: string | undefined, error: string | undefined;

  if (!ctx.dryRun) {
    if (!ctx.metaToken || !ctx.metaPhoneId) {
      status = "failed"; error = "missing META secrets";
    } else {
      const r = await metaSend(payload, ctx.metaToken, ctx.metaPhoneId);
      if (r.ok) { status = "sent"; providerId = r.id; } else { status = "failed"; error = r.error; }
    }
  }

  await ctx.admin.from("whatsapp_router_outbound_log").insert({
    phone: digits(ctx.inc.from_phone),
    conversation_id: ctx.conv.id,
    in_reply_to_wamid: ctx.inc.wamid,
    step_from: ctx.conv.step,
    step_to: nextStep,
    message_kind: kind,
    payload,
    provider_message_id: providerId ?? null,
    status,
    error: error ?? null,
  });

  await ctx.admin.from("whatsapp_conversations")
    .update({
      step: nextStep,
      data: patch.data ?? ctx.conv.data,
      intent: patch.intent ?? ctx.conv.intent,
      opportunity_id: patch.opportunity_id ?? ctx.conv.opportunity_id,
      client_id: patch.client_id ?? ctx.conv.client_id,
      human_handoff: patch.human_handoff ?? ctx.conv.human_handoff,
      handoff_at: patch.human_handoff === true ? new Date().toISOString()
                : patch.human_handoff === false ? null
                : undefined,
      last_outbound_at: new Date().toISOString(),
    })
    .eq("id", ctx.conv.id);

  return { status, provider_id: providerId, error };
}

// Menú principal con 3 botones de respuesta.
async function sendMenu(ctx: Ctx, prefix = "") {
  const c = ctx.cfg;
  const body =
    (prefix ? prefix + "\n\n" : "") +
    `${c.brand_greeting}\n\nSoy ${c.assistant_name}, su asistente. ¿En qué le puedo ayudar?`;
  return reply(
    ctx,
    buttonsMsg(ctx.to, body, [
      { id: "opt_quote", title: "Precios y gamas" },
      { id: "opt_schedule", title: "Agendar visita" },
      { id: "opt_advisor", title: "Hablar con asesor" },
    ]),
    "awaiting_menu",
    { intent: null },
  );
}

async function advance(ctx: Ctx): Promise<{ step: string; status?: string }> {
  const intent = detectIntent(ctx.inc);
  const step = ctx.conv.step;

  // "menú" escapa de cualquier estado, incluyendo handoff humano.
  if (intent === "menu") {
    if (ctx.conv.human_handoff) {
      // Retomar control del bot: limpiar el flag para que reply() no lo restaure.
      await ctx.admin.from("whatsapp_conversations")
        .update({ human_handoff: false, handoff_at: null })
        .eq("id", ctx.conv.id);
      ctx.conv.human_handoff = false;
    }
    const r = await sendMenu(ctx);
    return { step: "awaiting_menu", status: r.status };
  }

  // Handoff activo: un recordatorio único (step 'human_handoff'), luego silencio
  // (step 'human_handoff_reminded'). La escritura del nuevo step es el tracking.
  if (ctx.conv.human_handoff) {
    if (ctx.conv.step === "human_handoff_reminded") {
      return { step: "human_handoff_reminded", status: "silent" };
    }
    const r = await reply(
      ctx,
      textMsg(ctx.to, `*${ctx.cfg.advisor_name}* le atenderá pronto (${ctx.cfg.advisor_hours}). 🙂\n\nSi desea volver al asistente, escriba *"menú"*.`),
      "human_handoff_reminded",
    );
    return { step: "human_handoff_reminded", status: r.status };
  }

  switch (step) {
    case "new":
    case "awaiting_menu":
    case "quote_followup":
    case "lead_created": {
      if (intent === "quote") return finishWith(ctx, await showPrices(ctx));
      if (intent === "schedule") return finishWith(ctx, await startCapture(ctx));
      if (intent === "advisor") return finishWith(ctx, await handoff(ctx));
      // primer contacto o no entendimos → menú
      if (step === "new" || step === "awaiting_menu") {
        const r = await sendMenu(ctx, step === "awaiting_menu" ? "Disculpe, no le entendí. 🙂" : "");
        return { step: "awaiting_menu", status: r.status };
      }
      const r = await sendMenu(ctx, "¿Le ayudo con algo más?");
      return { step: "awaiting_menu", status: r.status };
    }

    case "cap_name":   return finishWith(ctx, await captureName(ctx));
    case "cap_city":   return finishWith(ctx, await captureCity(ctx, intent));
    case "cap_work":   return finishWith(ctx, await captureWork(ctx, intent));
    case "cap_address":return finishWith(ctx, await captureAddress(ctx));

    default: {
      const r = await sendMenu(ctx);
      return { step: "awaiting_menu", status: r.status };
    }
  }
}

function finishWith(_ctx: Ctx, r: { step: string; status: string }) {
  return { step: r.step, status: r.status };
}

// ── Camino 1: Precios / gamas ───────────────────────────────────────────────
async function showPrices(ctx: Ctx): Promise<{ step: string; status: string }> {
  const p = ctx.cfg.prices_per_ml;
  const body =
    `Con gusto. Estos son nuestros precios por *metro lineal* 📐:\n\n` +
    `• Gama básica: ${fmtCOP(p.basica)}\n` +
    `• Gama intermedia: ${fmtCOP(p.intermedia)}\n` +
    `• Gama alta: ${fmtCOP(p.alta)}\n\n` +
    `El valor final depende de las medidas y los acabados. Para darle una *cotización exacta y sin compromiso*, agendamos una visita técnica. ¿Lo hacemos?`;
  const r = await reply(
    ctx,
    buttonsMsg(ctx.to, body, [
      { id: "opt_schedule", title: "Sí, agendar visita" },
      { id: "opt_advisor", title: "Hablar con asesor" },
      { id: "opt_menu", title: "Volver al menú" },
    ]),
    "quote_followup",
    { intent: "quote" },
  );
  return { step: "quote_followup", status: r.status };
}

// ── Camino 2: Captura de datos → lead → link de agendamiento ─────────────────
async function startCapture(ctx: Ctx): Promise<{ step: string; status: string }> {
  const r = await reply(
    ctx,
    textMsg(ctx.to, `¡Perfecto! Para agendar su visita técnica necesito unos datos. 📝\n\nPrimero, ¿me confirma su *nombre completo*, por favor?`),
    "cap_name",
    { intent: "schedule" },
  );
  return { step: "cap_name", status: r.status };
}

async function captureName(ctx: Ctx): Promise<{ step: string; status: string }> {
  const name = (ctx.inc.message_body ?? "").trim();
  if (name.length < 2) {
    const r = await reply(ctx, textMsg(ctx.to, "¿Me ayuda con su nombre completo, por favor?"), "cap_name");
    return { step: "cap_name", status: r.status };
  }
  const data = { ...ctx.conv.data, name };
  const r = await reply(
    ctx,
    listMsg(
      ctx.to,
      `Gracias, ${name.split(" ")[0]}. ¿En qué *ciudad* está el proyecto?`,
      "Ver ciudades",
      ctx.cfg.cities.map((c, i) => ({ id: `city_${i}`, title: c })),
    ),
    "cap_city",
    { data },
  );
  return { step: "cap_city", status: r.status };
}

async function captureCity(ctx: Ctx, _intent: Intent): Promise<{ step: string; status: string }> {
  // Acepta selección de lista (id city_N) o texto libre que coincida con una ciudad.
  let city: string | null = null;
  const id = (ctx.inc.reply_id ?? "").toLowerCase();
  const m = id.match(/^city_(\d+)$/);
  if (m) city = ctx.cfg.cities[Number(m[1])] ?? null;
  if (!city) {
    const t = norm(ctx.inc.message_body ?? "");
    city = ctx.cfg.cities.find((c) => norm(c) === t || t.includes(norm(c))) ?? null;
  }
  if (!city) {
    const r = await reply(
      ctx,
      listMsg(
        ctx.to,
        `Por ahora atendemos en estas ciudades. ¿En cuál se encuentra? Si está en otra, puedo pasarle con un asesor.`,
        "Ver ciudades",
        [...ctx.cfg.cities.map((c, i) => ({ id: `city_${i}`, title: c }))],
      ),
      "cap_city",
    );
    return { step: "cap_city", status: r.status };
  }
  const data = { ...ctx.conv.data, city };
  const r = await reply(
    ctx,
    buttonsMsg(
      ctx.to,
      `Anotado: ${city}. ¿Qué trabajo necesita?`,
      [
        { id: "work_cocina", title: "Cocina" },
        { id: "work_closet", title: "Clóset" },
        { id: "work_otro", title: "Otro mueble" },
      ],
    ),
    "cap_work",
    { data },
  );
  return { step: "cap_work", status: r.status };
}

async function captureWork(ctx: Ctx, _intent: Intent): Promise<{ step: string; status: string }> {
  const id = (ctx.inc.reply_id ?? "").toLowerCase();
  let work = "";
  if (id === "work_cocina") work = "Cocina";
  else if (id === "work_closet") work = "Clóset";
  else if (id === "work_otro") work = "Otro mueble";
  else work = (ctx.inc.message_body ?? "").trim();
  if (!work) work = "Cocina";

  const data = { ...ctx.conv.data, work_type: work };
  const r = await reply(
    ctx,
    textMsg(ctx.to, `Listo. ¿Cuál es la *dirección* donde haríamos la visita? (calle, barrio y un punto de referencia)`),
    "cap_address",
    { data },
  );
  return { step: "cap_address", status: r.status };
}

// Resuelve el nombre del asesor asignado; cae al cfg.advisor_name si no se encuentra.
async function resolveAdvisorName(ctx: Ctx, assignedTo: string | null): Promise<string> {
  if (!assignedTo) return ctx.cfg.advisor_name;
  const { data } = await ctx.admin.from("profiles").select("full_name").eq("id", assignedTo).maybeSingle();
  return (data?.full_name as string | null) || ctx.cfg.advisor_name;
}

async function captureAddress(ctx: Ctx): Promise<{ step: string; status: string }> {
  const address = (ctx.inc.message_body ?? "").trim();
  if (address.length < 4) {
    const r = await reply(ctx, textMsg(ctx.to, "¿Me confirma la dirección completa, por favor?"), "cap_address");
    return { step: "cap_address", status: r.status };
  }
  const data = { ...ctx.conv.data, address };

  // Crear lead (cliente + oportunidad) y obtener el link público de agendamiento.
  const lead = await createLead(ctx, data);

  if (!lead.ok) {
    // No bloquear al cliente: pasarlo con la asesora. El motivo queda en los logs.
    console.error(`createLead failed for ${digits(ctx.inc.from_phone)}: ${lead.error}`);
    const r = await reply(
      ctx,
      textMsg(ctx.to, `¡Gracias! Tomé sus datos. En un momento *${ctx.cfg.advisor_name}*, su asesora, le confirma la visita. Horario de atención: ${ctx.cfg.advisor_hours}`),
      "lead_created",
      { data, human_handoff: true },
    );
    await notifyAdvisor(ctx, data, null, null, null);
    return { step: "lead_created", status: r.status };
  }

  const advisorName = await resolveAdvisorName(ctx, lead.assigned_to);
  const bookingUrl = `${ctx.cfg.booking_base_url.replace(/\/$/, "")}/v/${lead.short_code}`;
  const firstName = String(data.name ?? "").split(" ")[0] || "";
  const body =
    `¡Gracias${firstName ? ", " + firstName : ""}! 🙌 Ya registré su solicitud.\n\n` +
    `Para *cerrar la visita técnica* en el día y la hora que más le convenga, ingrese aquí y elija su espacio disponible:\n${bookingUrl}\n\n` +
    `Si prefiere que la llamemos, escríbame "asesor" y *${advisorName}* le contacta en el horario de atención (${ctx.cfg.advisor_hours}).`;
  const r = await reply(
    ctx,
    textMsg(ctx.to, body),
    "lead_created",
    { data, opportunity_id: lead.opportunity_id, client_id: lead.client_id },
  );

  // Avisar a la asesora del nuevo interesado.
  await notifyAdvisor(ctx, data, bookingUrl, lead.assigned_to, lead.opportunity_id);

  return { step: "lead_created", status: r.status };
}

// ── Camino 3: Hablar con asesor (handoff humano) ─────────────────────────────
async function handoff(ctx: Ctx): Promise<{ step: string; status: string }> {
  const c = ctx.cfg;
  const r = await reply(
    ctx,
    textMsg(
      ctx.to,
      `Con gusto. *${c.advisor_name}*, su asesora personal, le atenderá directamente. 🙋‍♀️\n\nHorario de atención: ${c.advisor_hours}\n\nSi me deja su *nombre* y *ciudad*, agilizo su atención.`,
    ),
    "human_handoff",
    { intent: "advisor", human_handoff: true },
  );
  await notifyAdvisor(ctx, ctx.conv.data, null, null, ctx.conv.opportunity_id);
  return { step: "human_handoff", status: r.status };
}

// ── Aviso a la asesora del nuevo interesado ─────────────────────────────────
// (1) Notificación IN-APP al asesor asignado (siempre, seguro, sin mensaje externo).
// (2) WhatsApp a la asesora vía notification_queue — SOLO si la plantilla ya está
//     aprobada y registrada (config.advisor_wa_template_ready). El worker existente
//     respeta wa_test_phone_override, así que en QA va al número de prueba.
async function notifyAdvisor(
  ctx: Ctx,
  data: Record<string, unknown>,
  bookingUrl: string | null,
  assignedTo: string | null,
  opportunityId: string | null,
) {
  const c = ctx.cfg;
  const phone = digits(ctx.inc.from_phone);
  const name = String(data.name ?? ctx.conv.contact_name ?? "Interesado WhatsApp");
  const city = (data.city as string) ?? "—";
  const work = (data.work_type as string) ?? "—";

  const bodyLines = [
    `WhatsApp: +${phone}`,
    `Ciudad: ${city}`,
    `Trabajo: ${work}`,
    data.address ? `Dirección: ${data.address}` : null,
    bookingUrl ? `Agendamiento: ${bookingUrl}` : `Pidió que un asesor lo contacte.`,
  ].filter(Boolean).join("\n");

  // (1) Notificación in-app al asesor (asignado o, en su defecto, el visitador por defecto).
  try {
    let targetUser = assignedTo;
    if (!targetUser) {
      const { data: dv } = await ctx.admin
        .from("system_settings").select("value").eq("key", "default_visitor_id").maybeSingle();
      targetUser = (dv?.value as { id?: string } | null)?.id ?? null;
    }
    if (targetUser) {
      await ctx.admin.from("notifications").insert({
        user_id: targetUser,
        title: `🆕 Nuevo interesado por WhatsApp: ${name}`,
        body: bodyLines,
        notification_type: "lead",
        priority: 1,
        related_table: opportunityId ? "opportunities" : "whatsapp_conversations",
        related_id: opportunityId ?? ctx.conv.id,
        action_url: opportunityId ? `/leads` : null,
      });
    }
  } catch (_e) { /* no fatal */ }

  // (2) WhatsApp a la asesora (gateado por plantilla aprobada).
  if (c.advisor_wa_template_ready === true && c.advisor_phone) {
    try {
      await ctx.admin.from("notification_queue").insert({
        event_type: "whatsapp_router_new_lead",
        event_reference_id: ctx.conv.id,
        recipient_name: c.advisor_name,
        recipient_phone: c.advisor_phone,
        template_name: "nuevo_lead_asesor_v1",
        template_language: "es",
        template_parameters: { "1": name, "2": city, "3": work, "4": bookingUrl ?? "Pidió llamada" },
        status: "pending",
        dedup_key: `router_lead_${ctx.conv.id}`,
      });
    } catch (_e) { /* no fatal */ }
  }
}

// ── Crear lead: cliente + oportunidad (service_role salta RLS) ───────────────
async function createLead(
  ctx: Ctx,
  data: Record<string, unknown>,
): Promise<{ ok: true; client_id: string; opportunity_id: string; short_code: string; assigned_to: string | null } | { ok: false; error: string }> {
  const admin = ctx.admin;
  const p12 = phone12(ctx.inc.from_phone);
  const p10 = phone10(ctx.inc.from_phone);
  const name = String(data.name ?? ctx.conv.contact_name ?? "Interesado WhatsApp");
  const city = (data.city as string) ?? null;
  const address = (data.address as string) ?? null;
  const work = (data.work_type as string) ?? "Cocina";

  try {
    // 1. Cliente: reusar CUALQUIER fila con ese teléfono (incl. soft-deleted) para no
    //    chocar con el índice único whatsapp_phone. limit(1) — nunca maybeSingle (puede
    //    haber duplicados → maybeSingle lanza error).
    let clientId = ctx.conv.client_id;
    if (!clientId) {
      const { data: rows } = await admin
        .from("clients").select("id")
        .in("whatsapp_phone", [p12, p10])
        .order("created_at", { ascending: false })
        .limit(1);
      if (rows && rows.length > 0) {
        clientId = rows[0].id;
        await admin.from("clients").update({ name, city, address, deleted_at: null }).eq("id", clientId);
      } else {
        const { data: ins, error } = await admin
          .from("clients")
          .insert({ name, whatsapp_phone: p12, city, address, services: work, status: "lead" })
          .select("id").single();
        if (error || !ins) return { ok: false, error: `client: ${error?.message}` };
        clientId = ins.id;
      }
    }

    // 2. Oportunidad (los triggers asignan short_code + asesor round-robin)
    const notes = `Lead generado por el asistente de WhatsApp (Elena). Trabajo: ${work}.`;
    const { data: opp, error: oErr } = await admin
      .from("opportunities")
      .insert({
        client_id: clientId,
        status: "new",
        services: [work],
        priority: "SHORT", // opportunities_priority_check permite solo ASAP/SHORT/LON
        data_origin: "whatsapp", // 'whatsapp_bot' lo rechaza opportunities_data_origin_check; el marcador del bot va en notes
        notes,
        city,
        address,
      })
      .select("id, short_code, assigned_to").single();
    if (oErr || !opp) return { ok: false, error: `opportunity: ${oErr?.message}` };

    // El short_code lo pone un trigger BEFORE INSERT; si llegara null, releer.
    let shortCode = opp.short_code as string | null;
    if (!shortCode) {
      const { data: re } = await admin.from("opportunities").select("short_code").eq("id", opp.id).single();
      shortCode = re?.short_code ?? null;
    }
    if (!shortCode) return { ok: false, error: "short_code no generado" };

    return { ok: true, client_id: clientId!, opportunity_id: opp.id, short_code: shortCode, assigned_to: (opp.assigned_to as string | null) ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
