import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://xdzbjptozeqcbnaqhtye.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemJqcHRvemVxY2JuYXFodHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDU3MTQsImV4cCI6MjA5MTY4MTcxNH0.M4-nl-r-M3sMNGUoJoyRXar8dwdnUkAJGR9YGkV5bNk';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
  || process.env.VITE_SUPABASE_URL
  || FALLBACK_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || process.env.VITE_SUPABASE_ANON_KEY
  || FALLBACK_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Configuración de Supabase incompleta. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

// Limpieza idempotente del token huérfano legacy. Versiones antiguas del cliente
// no usaban `storageKey` custom y dejaban `sb-{ref}-auth-token` en localStorage.
// Si se queda ahí vencido, el SDK lo lee internamente y se cuelga. Esta línea
// resuelve definitivamente ese vector. Cero impacto en sesiones limpias.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sb-xdzbjptozeqcbnaqhtye-auth-token');
  }
} catch {
  /* ignore */
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        storageKey: 'innovar-auth-token',
      },
    })
  : null as any;

// Exports legacy mantenidos para que App.tsx y authStore.ts compilen sin tocarlos
// en esta fase. En Fase 2/3 se eliminan los callsites y entonces se borran.
export function recordSupabaseTimeout(): void { /* no-op */ }
export function recordSupabaseSuccess(): void { /* no-op */ }
export function resetTimeoutTracking(): void { /* no-op */ }
