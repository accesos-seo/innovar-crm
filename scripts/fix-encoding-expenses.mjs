// Fix encoding for expenses and accounting_closures seed data
// All strings here are UTF-8 (file saved as UTF-8 by Write tool)

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Falta SUPABASE_ACCESS_TOKEN en el entorno (.env de Innovar)'); process.exit(1); }
const URL   = 'https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query';

async function sql(query) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

// ── Expenses: correct descriptions and notes ──────────────────────────────────
const expenseUpdates = [
  // First curl batch (corrupted by Windows shell)
  { id: '629ab441-606e-4048-b9a6-8dbef099f91e',
    description: 'Láminas melamina 18mm blanco mate x20 unidades — Cocina Juan Pérez',
    notes: 'Proveedor: Madecor Pereira' },
  { id: 'dfdbd3e1-603f-43d8-88b4-7fccc43b6b76',
    description: 'Mármol Carrara importado 3m² — Mesón cocina María Gómez',
    notes: 'Pagado con transferencia Bancolombia' },
  { id: 'dac3c396-5718-47bf-8e9b-ce9bc4028e0a',
    description: 'Pintura laca blanca 4L x6 + catalizador — Proyecto Virona',
    notes: null },
  { id: '82dcd3d7-96fa-49c4-9ba6-47c4f87f916f',
    description: 'Tornillería, silicona neutra y accesorios instalación mes mayo',
    notes: 'Compra mensual ferretería' },
  // Second curl batch
  { id: 'f230a47e-7534-4437-971c-1ac82fdb9bc8',
    description: 'Papelería, impresiones planos y folders cotizaciones mes mayo',
    notes: null },
  { id: 'd3782a8b-c8ac-4f4f-8fc2-2cadb36599e2',
    description: 'Quincena instaladores equipo Pereira — 01 al 15 mayo',
    notes: null },
  { id: '6c35f9de-fa05-4fb8-8cb8-6304b169cb41',
    description: 'Quincena instaladores equipo Pereira — 16 al 31 mayo',
    notes: null },
  { id: 'f4a874e7-c30e-416b-b160-12aac76db866',
    description: 'Honorarios diseñadora gráfica mayo',
    notes: 'Factura pendiente de recibir' },
  { id: '47ceaeea-24d4-467e-be12-d69be9a63305',
    description: 'Fletes entrega materiales bodega a obra Juan Pérez',
    notes: null },
  { id: 'e8cbeda1-3422-4ddf-b7b8-169978309ccd',
    description: 'Transporte mármol Carrara y materiales pesados — María Gómez',
    notes: null },
  // Node batch — added without accents intentionally, now correcting
  { id: '4060f500-dfa2-41e7-b9e6-7ed8b382f946',
    description: 'Router fresadora CNC — reparación y mantenimiento preventivo',
    notes: null },
  { id: '82f2510e-0b71-4329-b9a7-a995b0d01801',
    description: 'Factura energía eléctrica taller mayo',
    notes: null },
  { id: '64afb82c-4149-410d-9688-637d12999375',
    description: 'Internet + telefonía oficina mayo',
    notes: null },
  { id: '89226480-1a7b-456a-91ab-2341fa6f3e93',
    description: 'Instalación mesón granito subcontrato maestro especializado Virona',
    notes: 'Pendiente factura Camilo Restrepo' },
  { id: '3f54bc81-9470-41cf-af1e-894796994fea',
    description: 'Refrigerios visita técnica cliente VIP',
    notes: 'Cortesía Alvaro Ríos' },
];

// ── Accounting closures: correct notes ────────────────────────────────────────
const closureUpdates = [
  { id: '33462116-05bf-4eb3-844e-2778355c2f20',
    notes: 'Cierre parcial semana 1 — materiales y herrajes liquidados' },
  { id: 'c9106f2c-2826-4b73-989d-e98adc890041',
    notes: 'Proyecto terminado — margen excelente por mármol importado' },
  { id: 'c498e9bc-0a0b-4e45-9c12-df9c4ff0ff62',
    notes: 'Incluye subcontrato mesón granito pendiente de factura' },
  { id: '7382a911-2117-4de8-b23a-d907aab58b80',
    notes: 'Borrador pendiente aprobación gerencia' },
  { id: '42600366-3299-461a-bcba-0b0d59f30ec7',
    notes: 'Cierre completo mes abril — Proyecto Juan Pérez fase 1' },
];

// ── Run updates ───────────────────────────────────────────────────────────────
console.log('🔧 Fixing expense descriptions and notes...');
for (const u of expenseUpdates) {
  const notesClause = u.notes
    ? `, notes = '${u.notes.replace(/'/g, "''")}'`
    : '';
  const q = `UPDATE expenses SET description = '${u.description.replace(/'/g, "''")}' ${notesClause} WHERE id = '${u.id}' RETURNING id, description;`;
  const res = await sql(q);
  if (res[0]) {
    console.log(`  ✅ ${res[0].id.slice(0,8)} → ${res[0].description.slice(0,60)}`);
  } else {
    console.log(`  ⚠️  No row updated for ${u.id} — check ID`);
    console.log('     Response:', JSON.stringify(res));
  }
}

console.log('\n🔧 Fixing closure notes...');
for (const u of closureUpdates) {
  const q = `UPDATE accounting_closures SET notes = '${u.notes.replace(/'/g, "''")}' WHERE id = '${u.id}' RETURNING id, notes;`;
  const res = await sql(q);
  if (res[0]) {
    console.log(`  ✅ ${res[0].id.slice(0,8)} → ${res[0].notes}`);
  } else {
    console.log(`  ⚠️  No row for ${u.id}`);
  }
}

console.log('\n✅ Done. All special characters fixed.');
