import { z } from 'zod';

/**
 * Esquema versionado de `visits.measurements` (jsonb). Versión 1.
 *
 * El trigger `validate_visit_completion` exige que `measurements != '{}'` y
 * `photos.length >= 3` para permitir status='realizada'. Este schema valida
 * la SHAPE del lado cliente antes del UPDATE — la integridad de invariantes
 * la sigue garantizando la DB.
 *
 * Si en el futuro se agregan campos, ir a `version: 2` con backfill explícito.
 */

const espacioSchema = z.object({
  largo_cm: z.coerce.number().positive('Debe ser mayor a 0'),
  ancho_cm: z.coerce.number().positive('Debe ser mayor a 0'),
  alto_cm: z.coerce.number().positive('Debe ser mayor a 0'),
  forma: z.enum(['lineal', 'L', 'U', 'isla', 'peninsula']),
});

const conexionesSchema = z.object({
  agua: z.object({
    ubicacion: z.string().min(1, 'Ubicación requerida'),
  }),
  gas: z.object({
    tipo: z.enum(['natural', 'propano', 'ninguno']),
    ubicacion: z.string().default(''),
  }),
  voltaje: z.enum(['110', '220', 'ambos']),
  desague: z.object({
    ubicacion: z.string().min(1, 'Ubicación requerida'),
  }),
});

const estadoSchema = z.object({
  remover_cocina_actual: z.boolean().default(false),
  tipo_pared: z.enum(['drywall', 'mamposteria', 'mixto']),
  tipo_piso: z.string().min(1, 'Tipo de piso requerido'),
});

const servicioSchema = z.object({
  incluido: z.boolean().default(false),
  notas: z.string().default(''),
});

const serviciosSchema = z
  .record(z.string(), servicioSchema)
  .refine(
    (s) => Object.values(s).some((v) => v?.incluido === true),
    { message: 'Al menos un servicio debe estar incluido' }
  );

export const visitMeasurementsV1Schema = z.object({
  version: z.literal(1).default(1),
  espacio: espacioSchema,
  conexiones: conexionesSchema,
  estado: estadoSchema,
  servicios: serviciosSchema,
  notas: z.string().default(''),
});

export type VisitMeasurementsV1 = z.infer<typeof visitMeasurementsV1Schema>;

/** Catálogo de servicios soportados en v1. Sincronizado con `opportunities.services`. */
export const VISIT_SERVICE_KEYS = [
  'cocina_integral',
  'mesones',
  'closets',
  'tv_center',
  'puertas',
  'acabados',
] as const;

export type VisitServiceKey = (typeof VISIT_SERVICE_KEYS)[number];

export const VISIT_SERVICE_LABELS: Record<VisitServiceKey, string> = {
  cocina_integral: 'Cocina integral',
  mesones: 'Mesones',
  closets: 'Closets',
  tv_center: 'TV center',
  puertas: 'Puertas',
  acabados: 'Acabados',
};

/** Valor inicial vacío del formulario (usado por react-hook-form `defaultValues`). */
export function emptyVisitMeasurementsV1(): VisitMeasurementsV1 {
  const servicios = Object.fromEntries(
    VISIT_SERVICE_KEYS.map((k) => [k, { incluido: false, notas: '' }])
  ) as Record<VisitServiceKey, { incluido: boolean; notas: string }>;

  return {
    version: 1,
    espacio: { largo_cm: 0, ancho_cm: 0, alto_cm: 0, forma: 'lineal' },
    conexiones: {
      agua: { ubicacion: '' },
      gas: { tipo: 'ninguno', ubicacion: '' },
      voltaje: '110',
      desague: { ubicacion: '' },
    },
    estado: { remover_cocina_actual: false, tipo_pared: 'drywall', tipo_piso: '' },
    servicios,
    notas: '',
  };
}
