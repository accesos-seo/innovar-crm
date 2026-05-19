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

// Recovery automático de sesión rota: si N requests consecutivos a Supabase se
// abortan por timeout sin ninguna respuesta exitosa intermedia, asumimos que el
// cliente quedó atrapado en un refresh-loop de JWT que no emite el evento explícito
// "Refresh Token Not Found". En ese caso forzamos signOut() — el authStore captará
// SIGNED_OUT y ProtectedRoute redirigirá a /login, recuperando la sesión sin que el
// usuario tenga que recargar la pestaña manualmente.
const STALE_TIMEOUT_THRESHOLD = 3;
let consecutiveTimeouts = 0;
let staleRecoveryInProgress = false;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
  return fetch(input as any, { ...init, signal: controller.signal })
    .then((response) => {
      // Cualquier respuesta HTTP (200/4xx/5xx) significa red OK + backend responde.
      // El cliente NO está roto — reset del contador de stale-recovery.
      consecutiveTimeouts = 0;
      return response;
    })
    .catch((err) => {
      // AbortError = nuestro AbortController canceló por timeout interno.
      if (err?.name === 'AbortError') {
        consecutiveTimeouts++;
        if (consecutiveTimeouts >= STALE_TIMEOUT_THRESHOLD && !staleRecoveryInProgress) {
          staleRecoveryInProgress = true;
          console.warn(
            `⚠️ ${consecutiveTimeouts} timeouts consecutivos a Supabase — sesión cliente ` +
              `posiblemente atrapada en refresh-loop. Forzando signOut() para recuperar.`,
          );
          consecutiveTimeouts = 0;
          try {
            localStorage.removeItem('innovar-auth-token');
          } catch {
            /* ignore */
          }
          // Diferimos al siguiente tick para garantizar que `supabase` esté inicializado
          // (fetchWithTimeout se define ANTES de createClient).
          setTimeout(() => {
            if (typeof supabase !== 'undefined' && supabase?.auth?.signOut) {
              supabase.auth.signOut().catch(() => {
                /* ignore */
              });
            }
            // Re-armar el flag tras un tiempo prudente: si el usuario hace login y vuelve
            // a quedar atrapado en otro refresh-loop, queremos poder disparar de nuevo.
            setTimeout(() => {
              staleRecoveryInProgress = false;
            }, 10000);
          }, 0);
        }
      }
      throw err;
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
      consecutiveTimeouts = 0;
      staleRecoveryInProgress = false;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      // Login exitoso o refresh exitoso del token: definitivamente no estamos rotos.
      consecutiveTimeouts = 0;
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
