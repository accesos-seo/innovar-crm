// public-project-tracking — Portal del Cliente "Mi Proyecto" (PRD-portal-cliente.md)
//
// GET ?token=<uuid>  →  payload público del proyecto (timeline, fotos firmadas,
// pagos, instalación, contacto). Sin login: el token (projects.tracking_token)
// es la credencial. Desplegar con --no-verify-jwt.
//
// Privacidad: solo expone el primer nombre del cliente; nunca email/teléfono/dirección.
// Anti-enumeración: token inexistente, proyecto archivado o eliminado → 404 genérico.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rate limit blando en memoria: 30 req/min por IP (se resetea en cada cold start).
const RATE_LIMIT = 30;
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

// Orden real del enum project_status en prod (validado 2026-06-10).
const STATUS_ORDER = [
  'contacto', 'cotizacion_aprobada', 'en_diseno', 'aprobacion_final',
  'en_produccion', 'listo_instalacion', 'entregado', 'completado',
] as const;

// Fases visibles para el cliente (contacto y completado quedan fuera).
const TIMELINE_PHASES: { key: string; label: string }[] = [
  { key: 'cotizacion_aprobada', label: 'Cotización aprobada' },
  { key: 'en_diseno', label: 'Diseño en progreso' },
  { key: 'aprobacion_final', label: 'Diseño aprobado' },
  { key: 'en_produccion', label: 'En fabricación' },
  { key: 'listo_instalacion', label: 'Listo para instalar' },
  { key: 'entregado', label: 'Instalado y entregado' },
];

function err(status: number, code: string) {
  return new Response(JSON.stringify({ error: code }), { status, headers: JSON_HEADERS });
}

function buildWhatsAppUrl(rawPhone: string | null): string | null {
  if (!rawPhone) return null;
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) digits = '57' + digits; // celular colombiano sin indicativo
  return `https://wa.me/${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return err(405, 'method_not_allowed');

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) return err(429, 'rate_limited');

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!UUID_RE.test(token)) return err(400, 'invalid_token');

  try {
    const { data: project, error: projErr } = await admin
      .from('projects')
      .select(`
        id, name, work_type, status, total_amount, advance_amount, balance_due,
        is_fully_paid, client_approved_at, design_delivered_at, modelado_approved_at,
        renders_approved_at, fabrication_started_at, installation_scheduled_at,
        scheduled_install_date, estimated_install_date, install_duration_days,
        delivered_at, clients ( name )
      `)
      .eq('tracking_token', token)
      .is('deleted_at', null)
      .eq('is_archived', false)
      .maybeSingle();

    if (projErr) {
      console.error('[public-project-tracking] query error:', projErr.message);
      return err(500, 'internal');
    }
    if (!project) return err(404, 'not_found');

    // --- Timeline ---
    const statusIdx = STATUS_ORDER.indexOf(project.status as typeof STATUS_ORDER[number]);
    if (statusIdx === -1) {
      // Enum nuevo en prod no reflejado acá → mejor fallar visible que mostrar timeline corrupta.
      console.error('[public-project-tracking] status desconocido:', project.status);
      return err(500, 'internal');
    }
    const allDone = project.status === 'entregado' || project.status === 'completado';
    const reachedAt: Record<string, string | null> = {
      cotizacion_aprobada: project.client_approved_at,
      en_diseno: project.design_delivered_at,
      aprobacion_final: project.renders_approved_at ?? project.modelado_approved_at,
      en_produccion: project.fabrication_started_at,
      listo_instalacion: project.installation_scheduled_at ?? project.scheduled_install_date,
      entregado: project.delivered_at,
    };
    const timeline = TIMELINE_PHASES.map((phase) => {
      const phaseIdx = STATUS_ORDER.indexOf(phase.key as typeof STATUS_ORDER[number]);
      let state: 'done' | 'current' | 'pending';
      if (allDone || phaseIdx < statusIdx) state = 'done';
      else if (phaseIdx === statusIdx) state = 'current';
      else state = 'pending';
      return {
        key: phase.key,
        label: phase.label,
        reached_at: state === 'pending' ? null : (reachedAt[phase.key] ?? null),
        state,
      };
    });

    // --- Fotos con signed URLs (TTL 1h) ---
    const { data: photoRows, error: photoErr } = await admin
      .from('project_photos')
      .select('stage, photo_url, caption, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });
    // Decisión intencional: si la query de fotos falla, el portal degrada a "sin fotos"
    // (timeline y pagos siguen visibles) en vez de tumbar toda la página del cliente.
    if (photoErr) console.error('[public-project-tracking] photos query error:', photoErr.message);

    const photos: { stage: string; url: string; caption: string | null; created_at: string }[] = [];
    for (const row of photoRows ?? []) {
      if (!row.photo_url) continue;
      let url = row.photo_url;
      if (!/^https?:\/\//.test(url)) {
        const { data: signed } = await admin.storage
          .from('project-photos')
          .createSignedUrl(url, 3600);
        if (!signed?.signedUrl) continue;
        url = signed.signedUrl;
      }
      photos.push({ stage: row.stage, url, caption: row.caption, created_at: row.created_at });
    }

    // --- Contacto ---
    const { data: phoneSetting } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'portal_contact_phone')
      .maybeSingle();
    // portal_contact_phone se seedea como string JSONB ("3002826317")
    const contactPhone = typeof phoneSetting?.value === 'string' ? phoneSetting.value : null;

    const clientName = (project.clients as unknown as { name: string | null } | null)?.name;
    const firstName = (clientName ?? 'Cliente').trim().split(/\s+/)[0];

    const payload = {
      project: {
        name: project.name,
        work_type: project.work_type,
        status: project.status,
        client_first_name: firstName,
      },
      timeline,
      photos,
      payments: {
        total: project.total_amount ?? 0,
        advance_paid: project.advance_amount ?? 0,
        balance_due: project.balance_due ?? 0,
        is_fully_paid: project.is_fully_paid ?? false,
      },
      installation: {
        scheduled_at: project.scheduled_install_date ?? null,
        estimated_date: project.estimated_install_date ?? null,
        duration_days: project.install_duration_days ?? null,
      },
      contact: {
        label: '¿Dudas? Escríbenos',
        whatsapp_url: buildWhatsAppUrl(contactPhone),
      },
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    console.error('[public-project-tracking] unexpected error:', e);
    return err(500, 'internal');
  }
});
