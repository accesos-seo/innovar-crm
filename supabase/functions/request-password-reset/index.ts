import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REDIRECT_URL = 'https://crm-innovar-app-2026.vercel.app/reset-password';
const SENDER_EMAIL = 'noreply@cocinasintegralespereira.co';
const SENDER_NAME = 'Innovar CRM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok() {
  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function buildEmailHtml(actionLink: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Recupera tu contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
      style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Innovar CRM</h1>
        <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">Recupera tu contraseña</p>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón.
        </p>
        <p style="margin:0 0 32px;color:#64748b;font-size:13px;line-height:1.6;">
          Si no solicitaste este cambio, puedes ignorar este correo.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
          <tr><td align="center" style="background:#3b82f6;border-radius:8px;">
            <a href="${actionLink}"
              style="display:inline-block;padding:14px 36px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">
              Restablecer contraseña
            </a>
          </td></tr>
        </table>
        <p style="margin:0;text-align:center;">
          <a href="${actionLink}" style="color:#3b82f6;font-size:11px;word-break:break-all;">${actionLink}</a>
        </p>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">Este enlace es válido por 1 hora y solo puede usarse una vez.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function sendViaResend(to: string, actionLink: string): Promise<void> {
  const body = {
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: to,
    subject: 'Restablece tu contraseña',
    html: buildEmailHtml(actionLink),
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend error ${res.status}: ${error}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    let email: string | undefined;
    try {
      const body = await req.json() as Record<string, unknown>;
      email = body.email as string | undefined;
    } catch {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Strict email regex: local part prohibits consecutive dots/hyphens/underscores
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'email inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Verificar que el email exista (respuesta genérica si no — anti-enumeration)
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .single();
    if (!user) return ok();

    // Asegurar que el usuario exista en auth.users
    const { error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
    });

    const msg = createErr?.message ?? '';
    if (createErr && !msg.includes('already registered') && !msg.includes('already exists')) {
      console.error('[request-password-reset] createUser error:', msg);
    }

    // Generar recovery link
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: REDIRECT_URL },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: 'No se pudo generar el enlace' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const actionLink = linkData.properties.action_link;

    // Validar que sea HTTPS
    let parsed: URL;
    try {
      parsed = new URL(actionLink);
    } catch {
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const LOCAL_HOSTS = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
    if (parsed.protocol !== 'https:' || !parsed.hostname || LOCAL_HOSTS.test(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    await sendViaResend(normalizedEmail, actionLink);
    return ok();
  } catch (err) {
    console.error('[request-password-reset] unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
