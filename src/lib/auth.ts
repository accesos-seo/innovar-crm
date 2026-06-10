import { supabase } from "@/lib/supabaseClient";
import { hashPassword, verifyPassword } from "@/lib/passwordUtils";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_admin" | "comercial" | "diseno" | "produccion";
};

const AUTH_KEY = "auth_user";

export function saveAuth(user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function readAuth(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export async function loginWithEmailPassword(email: string, password: string) {
  const { data: userData, error } = await supabase
    .from("users")
    .select("id, email, full_name, password_hash, role_id, roles!inner(name)")
    .eq("email", email)
    .single();

  if (error || !userData) throw new Error("Usuario no encontrado");

  const { valid, isLegacy } = await verifyPassword(password, userData.password_hash);
  if (!valid) throw new Error("Credenciales inválidas");

  const authUser: AuthUser = {
    id: userData.id,
    email: userData.email,
    full_name: userData.full_name,
    role: (userData.roles as any)?.name as any,
  };
  saveAuth(authUser);

  // Puente JWT para RLS
  let bridgeSessionOk = false;
  try {
    const { error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
    if (!sessionError) bridgeSessionOk = true;
  } catch {
    /* no crítico */
  }

  // Migración bcrypt silenciosa
  if (isLegacy && bridgeSessionOk) {
    try {
      const newHash = await hashPassword(password);
      await supabase.rpc("update_my_password_hash", { new_hash: newHash });
    } catch {
      /* no crítico */
    }
  }

  window.dispatchEvent(new Event("auth-changed"));
  return authUser;
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function handleGoogleCallback(): Promise<AuthUser> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data || !data.session) throw new Error("No hay sesión activa");

  const { user: supabaseUser } = data.session;
  if (!supabaseUser.email) throw new Error("Sin email de Google");

  // Upsert en public.users
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, full_name, role_id, roles!inner(name)")
    .eq("email", supabaseUser.email)
    .single();

  let userData = existing;
  if (!existing) {
    // Obtener rol default para nuevos usuarios OAuth
    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "comercial")
      .single();

    if (roleError || !roleData) throw new Error("No se pudo asignar rol default");

    const { data: newUser, error: createErr } = await supabase
      .from("users")
      .insert({
        id: supabaseUser.id,
        email: supabaseUser.email,
        password_hash: "",
        full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
        role_id: roleData.id,
      })
      .select("id, email, full_name, role_id, roles!inner(name)")
      .single();

    if (createErr) throw createErr;
    userData = newUser;
  }

  if (!userData) throw new Error("No se pudo crear/cargar el perfil de usuario");

  const authUser: AuthUser = {
    id: userData.id,
    email: userData.email,
    full_name: userData.full_name,
    role: (userData.roles as any)?.name as any,
  };
  saveAuth(authUser);
  window.dispatchEvent(new Event("auth-changed"));
  return authUser;
}

export function logout() {
  clearAuth();
  supabase.auth.signOut().catch(() => {});
  window.dispatchEvent(new Event("auth-changed"));
}
