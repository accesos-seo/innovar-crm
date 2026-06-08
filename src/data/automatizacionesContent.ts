export type AutomatizacionStatus = 'activa' | 'pausada' | 'en_desarrollo' | 'deprecada';
export type AutomatizacionTipo = 'cron' | 'webhook' | 'manual' | 'realtime';
export type AutomatizacionCanal = 'slack' | 'whatsapp' | 'email' | 'supabase' | 'interno';

export type AutomatizacionCategoria =
  | 'operacional'
  | 'comunicacion'
  | 'comercial'
  | 'notificaciones';

export const categoriaLabel: Record<AutomatizacionCategoria, string> = {
  operacional: 'Operacional',
  comunicacion: 'Comunicación',
  comercial: 'Motor Comercial',
  notificaciones: 'Notificaciones',
};

export interface FlowNode {
  tipo: 'trigger' | 'proceso' | 'ia' | 'api' | 'decision' | 'output';
  label: string;
  sublabel?: string;
}

export interface Metrica {
  valor: string;
  etiqueta: string;
}

export interface CambioHistorial {
  fecha: string;
  descripcion: string;
  autor: string;
}

export interface AutomatizacionDoc {
  slug: string;
  nombre: string;
  descripcion: string;
  descripcion_larga: string;
  problema_que_resuelve: string;
  beneficios: string[];
  casos_de_uso: string[];
  metricas: Metrica[];
  flujo_visual: FlowNode[];
  categoria: AutomatizacionCategoria;
  status: AutomatizacionStatus;
  tipo: AutomatizacionTipo;
  frecuencia: string;
  fuente_datos: string;
  canal_salida: AutomatizacionCanal[];
  n8n_workflow_id: string;
  supabase_proyecto: string;
  responsable: string;
  ultima_revision: string;
  pasos: string[];
  notas: string;
  historial: CambioHistorial[];
  rutas_codigo?: string[];
}

export const automatizaciones: AutomatizacionDoc[] = [
  {
    slug: 'notificacion-cliente-cotizacion',
    nombre: 'Notificación Cliente — Nueva Cotización',
    descripcion: 'Envía automáticamente una notificación por WhatsApp al cliente cuando se crea una cotización.',
    descripcion_larga: `Cuando un usuario crea una cotización en el sistema, automáticamente se registra un evento que dispara una notificación por WhatsApp al cliente.

La notificación incluye un resumen breve de la cotización con un botón para ver los detalles. Si el cliente está integrado, se usa su número de teléfono del perfil. La automatización respeta horarios de no-molestia y agrupa notificaciones para no saturar.

El flujo es transparente: el usuario ve cuando se envió la notificación en la interfaz, y si hay errores de entrega, se registran para auditoría.`,
    problema_que_resuelve: 'Clientes esperando saber cuándo está lista la cotización, sin actualización automática.',
    beneficios: [
      'Cliente se entera al instante de su cotización',
      'Reduce demoras en comunicación',
      'Mejora percepción de rapidez del servicio',
      'El usuario sabe si se envió correctamente',
    ],
    casos_de_uso: [
      'Usuario crea cotización en panel → cliente recibe WhatsApp al instante',
      'Usuario exporta cotización → notificación automática al cliente',
    ],
    metricas: [
      { valor: '~2s', etiqueta: 'Latencia de notificación' },
      { valor: '95%+', etiqueta: 'Tasa de entrega' },
      { valor: '0', etiqueta: 'Acciones manuales' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Usuario crea cotización', sublabel: 'Evento en Supabase' },
      { tipo: 'proceso', label: 'Obtener número cliente', sublabel: 'Lookup en base datos' },
      { tipo: 'api', label: 'Enviar WhatsApp', sublabel: 'Meta API' },
      { tipo: 'output', label: 'Registrar entrega', sublabel: 'Log en DB' },
    ],
    categoria: 'comunicacion',
    status: 'en_desarrollo',
    tipo: 'webhook',
    frecuencia: 'Cada cotización creada',
    fuente_datos: 'Supabase — tabla quotations',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: 'TBD',
    supabase_proyecto: 'innovar',
    responsable: 'Equipo Innovar',
    ultima_revision: '2026-06-08T00:00:00Z',
    pasos: [
      'Webhook dispara en create/update de quotations',
      'Obtener teléfono del cliente',
      'Construir mensaje con template Meta aprobado',
      'Enviar vía Meta WhatsApp API',
      'Registrar evento en outbox + run_events',
    ],
    notas: 'Templates Meta pendientes de aprobación. DRY_RUN obligatorio hasta confirmación.',
    historial: [
      { fecha: '2026-06-08T00:00:00Z', descripcion: 'Creación inicial del flujo', autor: 'IA' },
    ],
    rutas_codigo: ['src/pages/QuotationCreate.tsx', 'supabase/functions/quotation-webhook/'],
  },
  {
    slug: 'motor-comercial-seguimiento',
    nombre: 'Motor Comercial — Seguimiento Automático',
    descripcion: 'Monitorea oportunidades y ejecuta acciones automáticas según su estado.',
    descripcion_larga: `El Motor Comercial es un sistema inteligente que rastrea todas las oportunidades de venta. Analiza el histórico de interacción, detecta cuándo algo se está demorando, y sugiere o ejecuta acciones automáticas.

Por ejemplo: si una cotización ha estado "en revisión" por más de 3 días, el motor puede sugerir al vendedor que haga seguimiento. Si un cliente no ha respondido a una primera reunión, puede registrar automáticamente una tarea de seguimiento.

Es como tener un asistente vendedor que nunca se distrae.`,
    problema_que_resuelve: 'Oportunidades que se pierden por falta de seguimiento sistemático.',
    beneficios: [
      'Ninguna oportunidad se olvida',
      'Seguimiento consistente según reglas',
      'Tiempo de venta reducido',
      'Visibilidad total del pipeline',
    ],
    casos_de_uso: [
      'Cotización sin respuesta → motor genera tarea de seguimiento',
      'Cliente con 5+ interacciones → motor sugiere cerrar o descartar',
      'Nuevo cliente → motor programa primera reunión automáticamente',
    ],
    metricas: [
      { valor: '+30%', etiqueta: 'Incremento en conversión' },
      { valor: '-15d', etiqueta: 'Reducción en ciclo de venta' },
      { valor: '100%', etiqueta: 'Cobertura de pipeline' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cambio de estado', sublabel: 'Oportunidad actualizada' },
      { tipo: 'ia', label: 'Evaluar contexto', sublabel: 'Días en estado, historial' },
      { tipo: 'decision', label: '¿Ejecutar acción?', sublabel: 'Reglas del motor' },
      { tipo: 'output', label: 'Crear tarea o notificación', sublabel: 'Panel visible' },
    ],
    categoria: 'comercial',
    status: 'activa',
    tipo: 'realtime',
    frecuencia: 'Cada cambio de estado',
    fuente_datos: 'Supabase — tabla opportunities + interactions',
    canal_salida: ['supabase', 'interno'],
    n8n_workflow_id: 'motor-comercial-realtime',
    supabase_proyecto: 'innovar',
    responsable: 'Equipo Innovar',
    ultima_revision: '2026-06-08T00:00:00Z',
    pasos: [
      'Trigger en update de opportunities',
      'Cargar historial de interacciones',
      'Evaluar reglas (días en estado, cambios, etc)',
      'Determinar acción (tarea, notificación, escalada)',
      'Crear registro en DB + notificar al vendedor',
    ],
    notas: 'Motor activo en producción. Configurable por usuario en Settings.',
    historial: [
      { fecha: '2026-06-08T00:00:00Z', descripcion: 'Integración en vivo', autor: 'IA' },
    ],
    rutas_codigo: ['src/pages/MotorComercial.tsx'],
  },
  {
    slug: 'tareas-recordatorio-reuniones',
    nombre: 'Recordatorio de Reuniones — Notificación Previa',
    descripcion: 'Notifica al equipo 30 minutos antes de una reunión programada.',
    descripcion_larga: `Antes de que comience una reunión, el sistema envía recordatorios al equipo. Un recordatorio llega 30 minutos antes con un resumen de:
- Quién participa
- Dónde se reúnen (presencial, Zoom, etc.)
- Agenda (si está documentada)
- Link de acceso si es virtual

Reduce olvidos y garantiza asistencia puntual. Integra con Google Calendar y Supabase.`,
    problema_que_resuelve: 'Reuniones con baja asistencia o atrasos por olvido.',
    beneficios: [
      'Asistencia más puntual',
      'Menos confusión sobre horarios',
      'Reducción de reuniones perdidas',
    ],
    casos_de_uso: [
      'Reunión con cliente en 30 min → notificación al equipo',
      'Agenda de reuniones para hoy → resumen por la mañana',
    ],
    metricas: [
      { valor: '95%', etiqueta: 'Asistencia puntual' },
      { valor: '30min', etiqueta: 'Anticipación' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron diario', sublabel: '9:00am Bogotá' },
      { tipo: 'proceso', label: 'Buscar reuniones hoy', sublabel: 'Google Calendar + Supabase' },
      { tipo: 'proceso', label: 'Filtrar 30min antes', sublabel: 'Cálculo de tiempo' },
      { tipo: 'output', label: 'Enviar notificación', sublabel: 'Slack/Email/WA' },
    ],
    categoria: 'notificaciones',
    status: 'activa',
    tipo: 'cron',
    frecuencia: 'Cron cada 5 minutos',
    fuente_datos: 'Google Calendar API + Supabase reuniones',
    canal_salida: ['slack', 'email'],
    n8n_workflow_id: 'reuniones-recordatorio-cron',
    supabase_proyecto: 'innovar',
    responsable: 'Equipo Innovar',
    ultima_revision: '2026-06-08T00:00:00Z',
    pasos: [
      'Cron dispara cada 5 minutos',
      'Listar reuniones en Google Calendar para HOY',
      'Filtrar las que comienzan en 30 ±2 minutos',
      'Obtener participantes de Supabase.reuniones',
      'Construir mensaje resumen',
      'Enviar a canal Slack del equipo',
    ],
    notas: 'Active integración Google Calendar en Settings. Horario Bogotá UTC-5.',
    historial: [
      { fecha: '2026-06-08T00:00:00Z', descripcion: 'Activado en producción', autor: 'IA' },
    ],
    rutas_codigo: ['src/pages/Reuniones.tsx', 'src/pages/Agenda.tsx'],
  },
];
