import { supabase } from "./supabaseClient";

export const seedMockData = async () => {
  if (!supabase) {
    throw new Error("Supabase no está configurado");
  }

  console.log("Iniciando siembra de datos...");

  // 1. Materiales
  const { error: materialsError } = await supabase.from('materials').upsert([
    { category: 'herrajes', name: 'Bisagra 110º Cierre Lento', description: 'Bisagra bidimensional para puertas de cocina', photoUrl: 'https://picsum.photos/seed/hinge/400/300', price: 15000, unit: 'par', active: true, sortOrder: 1 },
    { category: 'cocinas', name: 'Tablero RH Blanco 15mm', description: 'Tablero resistente a la humedad para estructuras', photoUrl: 'https://picsum.photos/seed/board/400/300', price: 185000, unit: 'lámina', active: true, sortOrder: 2 },
    { category: 'accesorios', name: 'Manija Perfil Gola 3m', description: 'Perfil de aluminio para apertura sin manija', photoUrl: 'https://picsum.photos/seed/handle/400/300', price: 45000, unit: 'unidad', active: true, sortOrder: 3 },
  ], { onConflict: 'name' });

  if (materialsError) console.error("Error en materiales:", materialsError);

  // 2. Tarifario
  const { error: pricingError } = await supabase.from('pricing_catalog').upsert([
    { code: 'CB-STD-01', name: 'Mueble Base Estándar', category: 'cocina_base', description: 'Mueble inferior de 60cm en RH blanco', value: 485000, unit: 'ml', lastUpdated: '2026-04-14' },
    { code: 'MS-GRN-02', name: 'Mesón Granito Negro', category: 'mesones', description: 'Mesón en granito natural San Gabriel', value: 520000, unit: 'ml', lastUpdated: '2026-04-14' },
    { code: 'HJ-BLM-03', name: 'Bisagra Blum Clip Top', category: 'herrajes', description: 'Bisagra con sistema de cierre suave', value: 18500, unit: 'pieza', lastUpdated: '2026-04-14' },
    // Puertas y Tapas - Sección E
    { code: 'PUERTA_SUP_70', name: 'Puerta Superior 70cm', category: 'puertas', description: 'Hasta 70cm ancho', value: 120000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PUERTA_SUP_90', name: 'Puerta Superior 90cm', category: 'puertas', description: '70-90cm ancho', value: 150000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PUERTA_SUP_100', name: 'Puerta Superior 100cm+', category: 'puertas', description: 'Mayor a 100cm ancho', value: 180000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PUERTA_INF', name: 'Puerta Inferior', category: 'puertas', description: 'Estándar', value: 150000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PUERTA_ALACENA', name: 'Puerta Alacena', category: 'puertas', description: 'Alacena estándar', value: 180000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'TAPA_CAJON', name: 'Tapa Cajón', category: 'puertas', description: 'Cajón estándar', value: 90000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'TAPA_PEQUENA', name: 'Tapa Pequeña/Gola', category: 'puertas', description: 'Especiero o gola', value: 45000, unit: 'unidad', lastUpdated: '2026-04-17' },
    // Puertas Pintadas - Sección F
    { code: 'PINTADO_SUP', name: 'Puerta Superior Pintada', category: 'pintado', description: 'Alto brillo', value: 120000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PINTADO_INF', name: 'Puerta Inferior Pintada', category: 'pintado', description: 'Alto brillo', value: 150000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PINTADO_ALACENA', name: 'Puerta Alacena Pintada', category: 'pintado', description: 'Alto brillo', value: 250000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PINTADO_CAJON', name: 'Tapa Cajón Pintada', category: 'pintado', description: 'Alto brillo', value: 80000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PINTADO_ESPECIERO', name: 'Tapa Especiero Pintada', category: 'pintado', description: 'Alto brillo', value: 45000, unit: 'unidad', lastUpdated: '2026-04-17' },
    { code: 'PINTADO_GOLA', name: 'Tapa Gola Pintada', category: 'pintado', description: 'Alto brillo', value: 45000, unit: 'unidad', lastUpdated: '2026-04-17' },
  ], { onConflict: 'code' });

  if (pricingError) console.error("Error en tarifario:", pricingError);

  // 3. Festivos
  const { error: holidaysError } = await supabase.from('holidays').upsert([
    { date: '2026-05-01', name: 'Día del Trabajo', year: 2026 },
    { date: '2026-07-20', name: 'Día de la Independencia', year: 2026 },
    { date: '2026-08-07', name: 'Batalla de Boyacá', year: 2026 },
  ], { onConflict: 'date' });

  if (holidaysError) console.error("Error en festivos:", holidaysError);

  // 4. Auditoría (Mock)
  const { error: auditError } = await supabase.from('audit_logs').insert([
    { action: 'create', tableName: 'materials', changesSummary: 'Siembra inicial de datos de prueba', timestamp: new Date().toISOString() }
  ]);

  if (auditError) console.error("Error en auditoría:", auditError);

  console.log("Siembra de datos completada.");
  return { success: true };
};
