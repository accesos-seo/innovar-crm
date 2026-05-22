import { create } from "zustand";
import { User } from "@supabase/supabase-js";
import { supabase, resetTimeoutTracking } from "@/lib/supabaseClient";
import { UserRole, UserProfile } from "@/types/auth";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

/**
 * Default role for auto-created profiles.
 *
 * IMPORTANT: previously this was 'admin' which is a privilege escalation
 * risk — any new auth user would have admin rights automatically.
 *
 * New users must be explicitly promoted by an existing admin via
 * /settings/users. This matches the principle of least privilege.
 */
const DEFAULT_AUTO_ROLE: UserRole = "comercial";

/** Format a user's full name from email if no metadata is available. */
function deriveFullName(authUser: User): string {
  const metaName = (authUser.user_metadata as any)?.full_name;
  if (metaName && typeof metaName === "string") return metaName;

  const base = (authUser.email?.split("@")[0] || "Usuario").replace(/[._-]+/g, " ");
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Fetch the public.profiles row for an auth user. If missing, auto-create it
 * with the minimum default role. Returns null if auto-creation is blocked by RLS.
 */
async function ensureProfile(authUser: User): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (existing) return existing as UserProfile;

  // Auto-create with minimum-privilege role.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      id: authUser.id,
      email: authUser.email || "",
      full_name: deriveFullName(authUser),
      role: DEFAULT_AUTO_ROLE,
    })
    .select()
    .single();

  if (error) {
    console.warn("[authStore] Could not auto-create profile (RLS?):", error.message);
    return null;
  }

  console.log(`[authStore] Auto-created profile for ${authUser.email} as '${DEFAULT_AUTO_ROLE}'`);
  return created as UserProfile;
}

/** Build a minimal fallback profile when DB lookup/insert fails. */
function fallbackProfile(authUser: User): UserProfile {
  return {
    id: authUser.id,
    full_name: deriveFullName(authUser),
    email: authUser.email || "",
    role: DEFAULT_AUTO_ROLE,
    created_at: authUser.created_at,
  };
}

/** True if the error is a stale/invalid refresh token that needs sign-out. */
function isStaleTokenError(error: unknown): boolean {
  const msg = (error as any)?.message || "";
  return (
    msg.includes("Refresh Token Not Found") ||
    msg.includes("invalid_refresh_token") ||
    msg.includes("Refresh Token")
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  initialized: false,

  initializeAuth: async () => {
    if (get().initialized) return;

    if (!supabase) {
      console.error("Supabase client not initialized. Check environment variables.");
      set({ initialized: true, isLoading: false });
      return;
    }

    try {
      set({ isLoading: true });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        if (isStaleTokenError(sessionError)) {
          console.warn("Sesión expirada o token inválido, cerrando sesión...");
          await supabase.auth.signOut();
          set({ user: null, profile: null, initialized: true });
          return;
        }
        throw sessionError;
      }

      if (session?.user) {
        const profile = (await ensureProfile(session.user)) || fallbackProfile(session.user);
        set({ user: session.user, profile, initialized: true });
      } else {
        set({ initialized: true });
      }

      // Subscribe to auth state changes (login/logout/token-refresh).
      // ÚNICO listener de la app — antes había otro en supabaseClient.ts que
      // peleaba con este por race condition. Ahora éste invoca
      // resetTimeoutTracking() para limpiar el estado del cliente Supabase.
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || event === "USER_DELETED") {
          try {
            localStorage.removeItem("innovar-auth-token");
          } catch {
            /* ignore */
          }
          resetTimeoutTracking();
          set({ user: null, profile: null });
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          resetTimeoutTracking();
        }

        if (session?.user) {
          const profile = (await ensureProfile(session.user)) || fallbackProfile(session.user);
          set({ user: session.user, profile });
        }
      });
    } catch (error: any) {
      console.error("Error initializing auth:", error);
      if (isStaleTokenError(error)) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
      }
      set({ initialized: true });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // onAuthStateChange will populate user/profile.
    set({ isLoading: false });
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during Supabase signOut:", error);
    } finally {
      set({ user: null, profile: null, isLoading: false });
    }
  },
}));
