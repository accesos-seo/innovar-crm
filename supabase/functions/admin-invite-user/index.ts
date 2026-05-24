// supabase/functions/admin-invite-user/index.ts
//
// Edge Function: invitar usuarios via Supabase Auth admin API.
//
// Flujo:
//   1. Recibe { email, full_name, role, phone } del frontend.
//   2. Verifica que el caller (JWT en Authorization header) sea admin
//      o super_admin en la tabla profiles.
//   3. Llama a auth.admin.inviteUserByEmail() — Supabase manda el email
//      de invitación con magic link.
//   4. El trigger handle_new_user crea la fila en profiles con role
//      default 'comercial' → acá la pisamos con el rol elegido +
//      whatsapp_phone + full_name.
//
// Config:
//   - verify_jwt: false (la auth la hace esta función manualmente
//     para que el preflight CORS no se rompa).
//   - Secrets autoinyectados por Supabase: SUPABASE_URL,
//     SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_ROLES = ["admin", "comercial", "diseno", "produccion", "super_admin"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Edge Function mal configurada (secrets faltantes)" }, 500);
    }

    // 1. Identificar al caller con su JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Falta token de autorización" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Sesión inválida" }, 401);
    }
    const caller = userData.user;

    // 2. Admin client con service_role
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Verificar rol del caller
    const { data: callerProfile, error: roleErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (roleErr || !callerProfile) {
      return jsonResponse({ error: "Perfil del caller no encontrado" }, 403);
    }
    if (!["admin", "super_admin"].includes(callerProfile.role)) {
      return jsonResponse({
        error: "No autorizado: solo admin/super_admin pueden invitar usuarios",
      }, 403);
    }

    // 4. Validar input
    const payload = await req.json();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const full_name = String(payload.full_name ?? "").trim();
    const role = String(payload.role ?? "").trim();
    const phone = payload.phone ? String(payload.phone).trim() : null;

    if (!email || !full_name || !role) {
      return jsonResponse({
        error: "Faltan campos requeridos: email, full_name, role",
      }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({
        error: `Rol inválido. Válidos: ${VALID_ROLES.join(", ")}`,
      }, 400);
    }

    // 5. Invitar (Supabase manda email con magic link)
    const { data: invited, error: inviteErr } = await adminClient.auth.admin
      .inviteUserByEmail(email, {
        data: { full_name },
      });
    if (inviteErr) {
      return jsonResponse({ error: `Error invitando: ${inviteErr.message}` }, 400);
    }
    if (!invited?.user) {
      return jsonResponse({ error: "Auth API no devolvió user" }, 500);
    }

    // 6. Pisar role/full_name/whatsapp_phone que dejó el trigger
    const { error: updErr } = await adminClient
      .from("profiles")
      .update({
        role,
        full_name,
        whatsapp_phone: phone || null,
      })
      .eq("id", invited.user.id);

    if (updErr) {
      return jsonResponse({
        partial: true,
        error: `Usuario invitado, pero falló asignar rol/teléfono: ${updErr.message}`,
        user_id: invited.user.id,
      }, 207);
    }

    return jsonResponse({
      success: true,
      user_id: invited.user.id,
      email,
    }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});
