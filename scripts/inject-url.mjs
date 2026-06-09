/**
 * inject-url.mjs — Inyecta supabase_functions_base_url en system_settings.
 * Lee el .env del proyecto directamente (fs) para no depender de variables
 * de entorno del shell que puedan sobreescribir los valores del proyecto.
 * Uso: node scripts/inject-url.mjs   (desde D:\Agents-automations\04-Innovar\)
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

// Parse .env manually to avoid shell-env overrides
function parseEnv(filePath) {
  const vars = {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    vars[key] = val;
  }
  return vars;
}

const env = parseEnv(envPath);
const TOKEN = env['SUPABASE_ACCESS_TOKEN'];
const SUPABASE_URL = env['SUPABASE_URL'];

if (!TOKEN || !SUPABASE_URL) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN o SUPABASE_URL no encontrados en', envPath);
  process.exit(1);
}

const PROJECT = new URL(SUPABASE_URL).hostname.split('.')[0];
const BASE_URL = `${SUPABASE_URL}/functions/v1`;

console.log('Project:', PROJECT);
console.log('Base URL:', BASE_URL);

function runSQL(label, sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const ok = res.statusCode === 200 || res.statusCode === 201;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        console.log(`${label} -> ${res.statusCode} ${ok ? 'OK' : 'FAIL'}`);
        if (!ok) console.error(String(data).slice(0, 400));
        resolve(ok ? parsed : null);
      });
    });
    req.on('error', (e) => { console.error('ERR:', e.message); resolve(null); });
    req.write(body);
    req.end();
  });
}

(async () => {
  // Use dollar-quoting to safely embed the URL without SQL injection risk
  const sql = `UPDATE public.system_settings
    SET value = ('"' || $url$${BASE_URL}$url$ || '"')::jsonb
    WHERE key = 'supabase_functions_base_url';`;

  const r1 = await runSQL('INJECT-URL', sql);
  if (r1 === null) { process.exit(1); }

  // Verify the stored value
  const r2 = await runSQL('VERIFY', `SELECT key, value FROM public.system_settings WHERE key = 'supabase_functions_base_url';`);
  if (r2) console.log('Stored:', JSON.stringify(r2));
})();
