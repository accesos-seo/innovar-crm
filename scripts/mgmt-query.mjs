// Helper: ejecuta SQL contra prod vía Management API.
// Uso: node scripts/mgmt-query.mjs "SELECT 1" | node scripts/mgmt-query.mjs --file ruta.sql
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) { console.error('SUPABASE_ACCESS_TOKEN no encontrado en .env'); process.exit(1); }

const arg = process.argv[2];
const query = arg === '--file' ? readFileSync(process.argv[3], 'utf8') : arg;

const res = await fetch('https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const body = await res.text();
if (!res.ok) { console.error(`HTTP ${res.status}: ${body}`); process.exit(1); }
console.log(body);
