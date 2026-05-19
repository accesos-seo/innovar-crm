import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://xdzbjptozeqcbnaqhtye.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemJqcHRvemVxY2JuYXFodHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDU3MTQsImV4cCI6MjA5MTY4MTcxNH0.M4-nl-r-M3sMNGUoJoyRXar8dwdnUkAJGR9YGkV5bNk';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
  || process.env.VITE_SUPABASE_URL
  || FALLBACK_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || process.env.VITE_SUPABASE_ANON_KEY
  || FALLBACK_KEY;

// No lanzamos error aquí para evitar que la aplicación colapse por completo al cargar el módulo.
// En su lugar, verificamos la configuración y exportamos el cliente solo si es válido.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Configuración de Supabase incompleta. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en los Secrets.');
}

// Timeout global por petición HTTP. Si Supabase no responde en 8s, falla rápido.
// Los reintentos los maneja React Query en niveles superiores (retry: 2 con backoff).
const GLOBAL_TIMEOUT_MS = 8000;

// Recovery automático de sesión rota — se dispara en 2 escenarios:
//   1. El endpoint /auth/v1/token responde 400/401/403 (refresh falló o credenciales
//      no aceptadas). Esto sale rápido y es la señal más confiable de sesión rota.
//   2. N timeouts a queries de Supabase dentro de una ventana de tiempo móvil. Esto
//      cubre el caso donde el SDK Supabase está colgado por dentro y las queries
//      timean masivamente. Las queries exitosas (de notificaciones del TopBar, p.ej.)
//      NO resetean el contador — solo SIGNED_IN/TOKEN_REFRESHED lo hacen, porque son
//      la única señal fuerte de que la auth está sana.
// En ambos casos forzamos signOut() — el authStore captará SIGNED_OUT y el
// ProtectedRoute redirigirá a /login, sin que el usuario tenga que recargar.
const STALE_TIMEOUT_THRESHOLD = 3;
const TIMEOUT_WINDOW_MS = 30000;
let recentTimeoutTimestamps: number[] = [];
let staleRecoveryInProgress = false;

function triggerStaleRecovery(reason: string): void {
  if (staleRecoveryInProgress) return;
  staleRecoveryInProgress = true;
  console.warn(
    `⚠️ Sesión cliente posiblemente rota (${reason}). Forzando signOut() para recuperar.`,
  );
  recentTimeoutTimestamps = [];
  try {
    localStorage.removeItem('innovar-auth-token');
  } catch {
    /* ignore */
  }
  // Diferimos al siguiente tick para garantizar que `supabase` esté inicializado.
  setTimeout(() => {
    if (typeof supabase !== 'undefined' && supabase?.auth?.signOut) {
      supabase.auth.signOut().catch(() => {
        /* ignore */
      });
    }
    // Hard fallback: si signOut no completa en 3s (porque el endpoint /auth/v1/logout
    // también está colgado), forzar redirect manual a /login. NO redirigir si ya
    // estamos en /login (evita loops de recarga durante login fresh).
    setTimeout(() => {
      if (
        staleRecoveryInProgress &&
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        console.warn('⚠️ signOut tardó >3s — forzando redirect manual a /login.');
        try {
          window.location.href = '/login';
        } catch {
          /* ignore */
        }
      }
    }, 3000);
    // Re-armar el flag tras 15s para permitir nuevo recovery si vuelve a pasar.
    setTimeout(() => {
      staleRecoveryInProgress = false;
    }, 15000);
  }, 0);
}

// Exportadas para que App.tsx (QueryCache.onError) las invoque al detectar
// "Operation timed out" — esos timeouts vienen del wrapper `withTimeout` externo,
// no del fetch interno, así que no pasan por `fetchWithTimeout`.
export function recordSupabaseTimeout(): void {
  const now = Date.now();
  // Mantener solo timestamps dentro de la ventana móvil.
  recentTimeoutTimestamps = recentTimeoutTimestamps.filter(
    (t) => now - t < TIMEOUT_WINDOW_MS,
  );
  recentTimeoutTimestamps.push(now);
  console.warn(
    `[supabase-timeout] count=${recentTimeoutTimestamps.length}/${STALE_TIMEOUT_THRESHOLD} ` +
      `(ventana ${TIMEOUT_WINDOW_MS / 1000}s)`,
  );
  if (recentTimeoutTimestamps.length >= STALE_TIMEOUT_THRESHOLD) {
    triggerStaleRecovery(
      `${recentTimeoutTimestamps.length} timeouts en ${TIMEOUT_WINDOW_MS / 1000}s`,
    );
  }
}

// Mantenida por compatibilidad con App.tsx aunque ya NO resetea el contador
// (las queries exitosas pueden coexistir con el cliente roto).
export function recordSupabaseSuccess(): void {
  /* no-op intencional — ver comentario arriba */
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
  const urlString =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  return fetch(input as any, { ...init, signal: controller.signal })
    .then((response) => {
      // Señal directa de sesión rota: 400/401/403 al endpoint /auth/v1/token CON
      // grant_type=refresh_token. NO disparar para grant_type=password — eso es
      // un login fresh (el usuario tipeó mal su contraseña) y debe manejarlo el
      // formulario, no nuestro recovery automático.
      if (urlString.includes('/auth/v1/token') && response.status >= 400 && response.status < 500) {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const isRefresh =
          urlString.includes('grant_type=refresh_token') ||
          bodyStr.includes('grant_type=refresh_token');
        if (isRefresh) {
          triggerStaleRecovery(`refresh_token respondió ${response.status}`);
        }
      }
      return response;
    })
    .finally(() => clearTimeout(timer));
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        storageKey: 'innovar-auth-token',
      },
      global: {
        fetch: fetchWithTimeout,
      },
    })
  : null as any;

// Listener global para purgar estado corrupto si Supabase emite un error de Refresh Token
if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('innovar-auth-token');
      // Reset de contadores de recovery — la próxima sesión arranca limpia.
      recentTimeoutTimestamps = [];
      staleRecoveryInProgress = false;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      // Login exitoso o refresh exitoso del token: definitivamente no estamos rotos.
      recentTimeoutTimestamps = [];
      staleRecoveryInProgress = false;
    }
  });

  // Interceptar la consola para detectar refresh-token inválido y forzar logout LIMPIO.
  // ANTES: solo borraba localStorage, pero el authStore zustand seguía pensando que el
  // usuario estaba autenticado → queries iban anónimas → RLS retornaba [] → UI con tabla
  // vacía sin razón aparente.
  // AHORA: invoca signOut() para emitir SIGNED_OUT → authStore.onAuthStateChange limpia
  // user/profile → ProtectedRoute redirige a /login.
  const originalError = console.error;
  let staleTokenHandled = false;
  console.error = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('Refresh Token Not Found') || msg.includes('Invalid Refresh Token')) {
      if (!staleTokenHandled) {
        staleTokenHandled = true;
        localStorage.removeItem('innovar-auth-token');
        originalError('⚠️ Sesión expirada — cerrando sesión y redirigiendo a /login.');
        // Forzar logout limpio (signOut emite SIGNED_OUT → authStore actualiza user=null)
        supabase!.auth.signOut().catch(() => { /* ignore */ });
      }
      return;
    }
    originalError(...args);
  };
}
