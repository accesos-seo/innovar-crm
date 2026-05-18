import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY no están configuradas.');
  console.log('Por favor, agrégalas a tus Secrets en el menú de Herramientas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('🚀 Iniciando siembra de datos (Seed)...');

  // 1. Obtener algunos clientes existentes
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .limit(5);

  if (clientError || !clients || clients.length === 0) {
    console.error('❌ Error: No se encontraron clientes. Debes tener clientes para crear cotizaciones.');
    process.exit(1);
  }

  console.log(`✅ Encontrados ${clients.length} clientes. procediendo a insertar cotizaciones...`);

  const statuses = ['draft', 'sent', 'negotiation', 'approved', 'rejected', 'expired'];
  
  const quotations = clients.flatMap((client, idx) => {
    // Crear 2 cotizaciones por cliente
    return [
      {
        client_id: client.id,
        subtotal: 5000000 + (idx * 1000000),
        transport_cost: 150000,
        total_amount: 5150000 + (idx * 1000000),
        status: statuses[idx % statuses.length],
        version_number: 1,
        notes: `Presupuesto inicial para proyecto de ${client.name}`,
        is_locked: statuses[idx % statuses.length] === 'approved',
        discount_type: 'none',
        discount_value: 0
      },
      {
        client_id: client.id,
        subtotal: 8500000 + (idx * 500000),
        transport_cost: 200000,
        total_amount: 8700000 + (idx * 500000),
        status: statuses[(idx + 1) % statuses.length],
        version_number: 1,
        notes: `Propuesta de remodelación integral`,
        is_locked: statuses[(idx + 1) % statuses.length] === 'approved',
        discount_type: 'none',
        discount_value: 0
      }
    ];
  });

  const { data, error } = await supabase
    .from('quotations')
    .insert(quotations)
    .select();

  if (error) {
    console.error('❌ Error insertando cotizaciones:', error);
  } else {
    console.log(`✨ Éxito: Se han insertado ${data.length} cotizaciones ficticias.`);
    console.log('Ahora puedes ver los datos en el módulo de Cotizaciones.');
  }
}

seed();
