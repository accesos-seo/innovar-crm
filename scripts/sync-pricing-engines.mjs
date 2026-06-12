/**
 * Sincroniza los motores de precios del server Express hacia la
 * Edge Function `calculate-item` (Deno), reescribiendo imports:
 *   - 'zod'                                → 'npm:zod@4'
 *   - '../../src/schemas/quotation.schema' → './quotation.schema.ts'
 *   - './kitchen.engine'                   → './kitchen.engine.ts'
 *
 * Fuente de verdad: server/services/*.engine.ts + src/schemas/quotation.schema.ts
 * Correr tras CUALQUIER cambio en un engine, y redesplegar la EF:
 *   node scripts/sync-pricing-engines.mjs
 *   supabase functions deploy calculate-item --project-ref <ref del proyecto, ver .env>

 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'supabase', 'functions', 'calculate-item');
mkdirSync(outDir, { recursive: true });

const sources = [
  'src/schemas/quotation.schema.ts',
  'server/services/kitchen.engine.ts',
  'server/services/tv-center.engine.ts',
  'server/services/special-finishes.engine.ts',
  'server/services/closets.engine.ts',
  'server/services/interior-doors.engine.ts',
  'server/services/mesones.engine.ts',
];

const HEADER = `// ⚠️ AUTO-GENERADO por scripts/sync-pricing-engines.mjs — NO EDITAR A MANO.\n// Fuente de verdad: el archivo homónimo en server/services/ (o src/schemas/).\n\n`;

for (const rel of sources) {
  const src = readFileSync(join(root, rel), 'utf8');
  const out = src
    .replace(/from 'zod'/g, "from 'npm:zod@4'")
    .replace(/from '\.\.\/\.\.\/src\/schemas\/quotation\.schema'/g, "from './quotation.schema.ts'")
    .replace(/from '\.\/kitchen\.engine'/g, "from './kitchen.engine.ts'");
  const dest = join(outDir, basename(rel));
  writeFileSync(dest, HEADER + out, 'utf8');
  console.log(`✔ ${rel} → supabase/functions/calculate-item/${basename(rel)}`);
}
console.log('Sync completo.');
