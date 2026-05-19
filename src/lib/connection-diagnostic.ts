/**
 * Diagnóstico de conexión a Supabase.
 *
 * Se ejecuta en mount de App (solo en dev). Reporta a consola:
 *   - Estado de la sesión auth
 *   - Latencia y resultado de queries básicas a tablas clave
 *   - Si las queries retornan datos o array vacío (= RLS bloqueando)
 *
 * Pega el output en el chat para diagnosticar el problema.
 */

import { supabase } from './supabaseClient';

interface DiagStep {
  name:     string;
  durationMs: number;
  ok:       boolean;
  detail:   string;
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<DiagStep & { result?: T }> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    return { name, durationMs, ok: true, detail: 'OK', result };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    return { name, durationMs, ok: false, detail: err?.message ?? String(err) };
  }
}

export async function runConnectionDiagnostic(): Promise<void> {
  const banner = `
╔══════════════════════════════════════════════════════════════╗
║  🔬 DIAGNÓSTICO DE CONEXIÓN INNOVAR — copiar y pegar al chat ║
╚══════════════════════════════════════════════════════════════╝`;
  console.log(banner);

  if (!supabase) {
    console.error('❌ supabase client es null. Verifica VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
    return;
  }

  console.log(`📍 URL: ${(supabase as any).supabaseUrl ?? '(unknown)'}`);
  console.log(`🔑 Anon key prefix: ${String((supabase as any).supabaseKey ?? '').slice(0, 20)}...`);

  const steps: DiagStep[] = [];

  // 1. ¿Hay sesión activa?
  const session = await timed('auth.getSession', async () => {
    const { data, error } = await supabase!.auth.getSession();
    if (error) throw error;
    return data.session;
  });
  steps.push({
    name:       session.name,
    durationMs: session.durationMs,
    ok:         session.ok,
    detail:     session.ok
      ? (session.result
          ? `user=${session.result.user.email} exp=${new Date(session.result.expires_at! * 1000).toISOString()}`
          : 'NO SESSION (anónimo)')
      : session.detail,
  });

  // 2. ¿Hay usuario en localStorage?
  const lsToken = localStorage.getItem('innovar-auth-token');
  steps.push({
    name:       'localStorage["innovar-auth-token"]',
    durationMs: 0,
    ok:         !!lsToken,
    detail:     lsToken ? `present (len=${lsToken.length})` : 'NO TOKEN',
  });

  // 3. Test query simple a clients (HEAD, solo cuenta)
  const clientsCount = await timed('clients HEAD count', async () => {
    const { data, error, count } = await supabase!
      .from('clients')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { count, hasData: !!data };
  });
  steps.push({
    name:       clientsCount.name,
    durationMs: clientsCount.durationMs,
    ok:         clientsCount.ok,
    detail:     clientsCount.ok
      ? `count=${clientsCount.result?.count ?? 'null'}`
      : clientsCount.detail,
  });

  // 4. Test query SELECT real a clients (1 row)
  const clientsRow = await timed('clients SELECT 1', async () => {
    const { data, error } = await supabase!
      .from('clients')
      .select('id, name')
      .limit(1);
    if (error) throw error;
    return data;
  });
  steps.push({
    name:       clientsRow.name,
    durationMs: clientsRow.durationMs,
    ok:         clientsRow.ok,
    detail:     clientsRow.ok
      ? (clientsRow.result?.length ? `1 fila: ${JSON.stringify(clientsRow.result[0])}` : 'array vacío — RLS o tabla vacía')
      : clientsRow.detail,
  });

  // 5. Test query a otra tabla (projects)
  const projectsRow = await timed('projects SELECT 1', async () => {
    const { data, error } = await supabase!
      .from('projects')
      .select('id, status')
      .limit(1);
    if (error) throw error;
    return data;
  });
  steps.push({
    name:       projectsRow.name,
    durationMs: projectsRow.durationMs,
    ok:         projectsRow.ok,
    detail:     projectsRow.ok
      ? (projectsRow.result?.length ? `1 fila` : 'array vacío')
      : projectsRow.detail,
  });

  // 6-11. Test queries a las tablas que el usuario reporta como ROTAS.
  // Hipótesis: RLS con recursión infinita en estas tablas específicas.
  const brokenTables = [
    'pricing_catalog',
    'projects',
    'quotations',
    'materials',
    'holidays',
  ];

  for (const table of brokenTables) {
    const res = await timed(`${table} SELECT 1`, async () => {
      const { data, error } = await supabase!
        .from(table)
        .select('*')
        .limit(1);
      if (error) throw error;
      return data;
    });
    steps.push({
      name:       res.name,
      durationMs: res.durationMs,
      ok:         res.ok,
      detail:     res.ok
        ? (res.result?.length ? `1 fila` : 'array vacío (RLS o tabla vacía)')
        : res.detail,
    });
  }

  // Reporte tabular
  console.table(steps);

  // Diagnóstico interpretado
  console.log('───────────────────────────────────────────────');
  console.log('📊 INTERPRETACIÓN:');

  const sessionOk    = steps[0].ok && steps[0].detail.startsWith('user=');
  const clientsRowOk = steps[3].ok && steps[3].detail.includes('1 fila');

  if (!sessionOk) {
    console.warn('🚨 SIN SESIÓN ACTIVA — necesitas hacer login. Las queries van como anónimo, RLS bloquea todo.');
    console.warn('   Fix sugerido: ir a /login, autenticarse.');
  } else if (sessionOk && !clientsRowOk && steps[3].detail.includes('array vacío')) {
    console.warn('🚨 SESIÓN OK PERO RLS DEVUELVE VACÍO en clients — el usuario autenticado no puede ver clients.');
  }

  // Identificar qué tablas específicas cuelgan o fallan
  const tableTests = steps.slice(5); // Las 5 tablas problemáticas
  const slowTables   = tableTests.filter(s => s.ok && s.durationMs > 5000).map(s => s.name);
  const failedTables = tableTests.filter(s => !s.ok).map(s => `${s.name} (${s.detail})`);

  if (failedTables.length) {
    console.error('🚨 TABLAS QUE FALLAN:');
    failedTables.forEach(t => console.error('   •', t));
    console.error('   → Probable RLS con recursión infinita o policy mal escrita.');
    console.error('   → Para inspeccionar, ejecuta en Supabase Dashboard > SQL Editor:');
    console.error(`
       SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('projects', 'quotations', 'materials', 'holidays', 'pricing_catalog')
       ORDER BY tablename, policyname;
    `);
  }
  if (slowTables.length) {
    console.warn('🐢 TABLAS LENTAS (>5s):', slowTables.join(', '));
  }

  if (!failedTables.length && !slowTables.length && clientsRowOk) {
    console.log('✅ TODO OK — todas las tablas responden bien.');
  }
  console.log('───────────────────────────────────────────────');
}
