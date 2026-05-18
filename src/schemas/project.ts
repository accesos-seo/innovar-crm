import { z } from 'zod';

// Esquema para mediciones iniciales
export const initialMeasurementsSchema = z.object({
  ancho_pared_a: z.number().positive().optional(),
  ancho_pared_b: z.number().positive().optional(),
  altura: z.number().positive().optional(),
  profundidad_max: z.number().positive().optional(),
  notas: z.string().max(500).optional(),
  tomado_por: z.string().uuid().optional(),
  fecha_levantamiento: z.string().datetime().optional(),
}).default({});

// Esquema para archivos 3D
export const design3DFileSchema = z.object({
  url: z.string().url(),
  nombre: z.string().min(1).max(255),
  version: z.number().int().min(1).default(1),
  subido_en: z.string().datetime(),
  subido_por: z.string().uuid(),
});

// Esquema para archivos de despiece
export const despieceFileSchema = z.object({
  url: z.string().url(),
  tipo: z.enum(['corte_cnc', 'optimizacion', 'manual']).or(z.string()),
  generado_en: z.string().datetime(),
});

// Esquema base de proyecto (para forms)
export const projectSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(255),
  client_id: z.string().uuid('Cliente requerido'),
  work_type: z.enum(['cocina', 'closet', 'puertas', 'centro_tv']),
  status: z.enum([
    'contacto', 'medicion_tomada', 'cotizacion_enviada', 'cotizacion_aprobada',
    'en_diseno', 'modelado_listo', 'renders_listos', 'aprobacion_cliente',
    'en_produccion', 'instalacion_programada', 'instalando', 'entregado', 'garantia'
  ]).default('contacto'),
  
  // Campos opcionales
  designer_id: z.string().uuid().nullable().optional(),
  approved_quotation_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  
  // Financiero
  total_amount: z.number().positive().nullable().optional(),
  advance_amount: z.number().positive().nullable().optional(),
  
  // Fechas críticas
  design_deadline: z.string().datetime().nullable().optional(),
  design_delivered_at: z.string().datetime().nullable().optional(),
  estimated_install_date: z.string().datetime().nullable().optional(),
  scheduled_install_date: z.string().datetime().nullable().optional(),
  install_duration_days: z.number().int().positive().nullable().optional(),
  delivered_at: z.string().datetime().nullable().optional(),
  
  // Auditoría y otros
  client_approved_at: z.string().datetime().nullable().optional(),
  client_approval_notes: z.string().nullable().optional(),
  modelado_approved_at: z.string().datetime().nullable().optional(),
  renders_approved_at: z.string().datetime().nullable().optional(),
  modelado_revision_number: z.number().int().min(0).default(0),
  render_revision_number: z.number().int().min(0).default(0),
  quotation_pdf_url: z.string().url().nullable().optional(),
  data_origin: z.enum(['manual', 'system']).default('system'),
  
  // JSONB
  initial_measurements: initialMeasurementsSchema,
  design_3d_files: z.array(design3DFileSchema).default([]),
  despiece_files: z.array(despieceFileSchema).default([]),
  
  // Flags
  skip_design_process: z.boolean().default(false),
  is_archived: z.boolean().default(false),
});

// Esquema de inserción (extends con campos automáticos)
export const projectInsertSchema = projectSchema.omit({ 
  status: true // opcional, tiene default
}).extend({
  created_by: z.string().uuid(), // Del auth store
  data_origin: z.literal('system').default('system'),
});

// Esquema de update (todos opcionales excepto id)
export const projectUpdateSchema = projectSchema.partial().extend({
  id: z.string().uuid(),
  // Campos de auditoría que el frontend puede actualizar
  client_approved_at: z.string().datetime().nullable().optional(),
  client_approval_notes: z.string().nullable().optional(),
  design_delivered_at: z.string().datetime().nullable().optional(),
  modelado_approved_at: z.string().datetime().nullable().optional(),
  renders_approved_at: z.string().datetime().nullable().optional(),
  modelado_revision_number: z.number().int().min(0).optional(),
  render_revision_number: z.number().int().min(0).optional(),
  delivered_at: z.string().datetime().nullable().optional(),
  quotation_pdf_url: z.string().url().nullable().optional(),
});

// Validación de negocio: advance <= total
export const validateProjectFinance = (data: { total_amount?: number | null; advance_amount?: number | null }) => {
  if (data.total_amount && data.advance_amount && data.advance_amount > data.total_amount) {
    return { valid: false, error: 'El anticipo no puede ser mayor al monto total' };
  }
  return { valid: true };
};

// Tipos inferidos
export type Project = z.infer<typeof projectSchema> & {
  id: string;
  tracking_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  accounting_closure_id: string | null;
};

export type ProjectInsert = z.infer<typeof projectInsertSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
