import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT_URL = 'https://crm-innovar-app-2026.vercel.app/reset-password';

// Cliente con service_role para consultas admin
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cliente anon para resetPasswordForEmail (usa el SMTP configurado en el proyecto)
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .single();
    if (userError || !user) return ok();

    // Asegurar que el usuario exista en auth.users (necesario para generateLink)
    const { error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
    });
    const msg = createErr?.message ?? '';
    if (createErr && !msg.includes('already registered') && !msg.includes('already exists')) {
      console.error('[request-password-reset] createUser error:', msg);
    }

    // Enviar email de recuperación via SMTP configurado del proyecto (Resend)
    // El template HTML se configuró via Management API en mailer_templates_recovery_content
    const { error: resetErr } = await supabaseClient.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: REDIRECT_URL }
    );

    if (resetErr) {
      console.error('[request-password-reset] resetPasswordForEmail error:', resetErr.message);
      return new Response(JSON.stringify({ error: 'No se pudo enviar el enlace' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return ok();
  } catch (err) {
    console.error('[request-password-reset] unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
