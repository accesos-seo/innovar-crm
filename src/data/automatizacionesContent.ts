export type AutomatizacionStatus = 'activa' | 'pausada' | 'en_desarrollo' | 'deprecada';
export type AutomatizacionTipo = 'cron' | 'webhook' | 'manual' | 'realtime';
export type AutomatizacionCanal = 'slack' | 'whatsapp' | 'email' | 'supabase' | 'interno';
export type AutomatizacionVisibilidad = 'visible' | 'silente' | 'n8n';

export const visibilidadConfig: Record<AutomatizacionVisibilidad, { label: string; sublabel: string; color: string; icon: string }> = {
  visible: { label: 'Visibles',          sublabel: 'Tienen pantalla, panel o portal — las ves y las controlas',  color: '#44ddc1', icon: '🖥️' },
  silente: { label: 'Motor Silencioso',  sublabel: 'Trabajan 24/7 sin que tengas que hacer nada',                color: '#a78bfa', icon: '⚙️' },
  n8n:     { label: 'N8n',              sublabel: 'Orquestadas en n8n — flujos externos con triggers y APIs',    color: '#f97316', icon: '⚡' },
};

export type AutomatizacionCategoria =
  | 'operacional'
  | 'comunicacion'
  | 'comercial'
  | 'notificaciones';

export const categoriaLabel: Record<AutomatizacionCategoria, string> = {
  operacional:   'Operacional',
  comunicacion:  'Comunicación',
  comercial:     'Motor Comercial',
  notificaciones:'Notificaciones',
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
  visibilidad: AutomatizacionVisibilidad;
}

export const automatizaciones: AutomatizacionDoc[] = [

  // ─── 1. RECEPTOR DE LEADS ────────────────────────────────────────────────────
  {
    slug: 'receptor-de-leads',
    nombre: 'Receptor de Leads',
    descripcion: 'Captura leads de cualquier canal, crea la oportunidad de venta y asigna al comercial disponible en menos de 1 segundo.',
    descripcion_larga: `Cuando un nuevo contacto llega al sistema —desde el formulario del sitio web, un WhatsApp directo, una referencia o la sala de exhibición— el Receptor de Leads actúa de inmediato sin esperar a que nadie esté en la oficina.

Primero crea el registro del lead con todos sus datos en la base de datos y genera automáticamente una oportunidad de venta vinculada con estado "Nuevo". Luego asigna la oportunidad al comercial principal configurado en el sistema (actualmente Álvaro Ríos), garantizando una asignación consistente y predecible.

Al mismo tiempo calcula el próximo slot de visita disponible —preferiblemente martes o jueves— y deja ese dato listo para que el Notificador de Bienvenida se lo comunique al cliente en su primer mensaje.

El resultado: en menos de un segundo el lead ya tiene registro, oportunidad, comercial asignado y fecha propuesta. Todo sin que nadie tenga que hacer nada manualmente.`,
    problema_que_resuelve: 'Cuando los leads llegan por múltiples canales sin un sistema centralizado, es fácil que algunos se pierdan o lleguen tarde. El Receptor los captura todos al instante y los asigna de forma consistente al comercial responsable.',
    beneficios: [
      'Ningún lead se pierde: todos quedan registrados automáticamente al instante',
      'Asignación directa al comercial principal (Álvaro Ríos) sin intervención manual',
      'Propone el primer slot de visita disponible desde el primer momento',
      'Crea la oportunidad vinculada lista para seguimiento sin trabajo manual',
      'Funciona 24/7, incluso fuera del horario de la oficina',
    ],
    casos_de_uso: [
      'Un cliente completa el formulario del sitio a las 11pm. En menos de 1 segundo el lead está registrado, asignado a Álvaro Ríos y tiene una fecha de visita propuesta para el próximo martes disponible.',
      'Un visitante en la sala de exhibición entrega su número. El asesor lo registra en el CRM y en ese mismo momento el sistema crea la oportunidad, asigna al comercial principal y calcula el slot disponible.',
    ],
    metricas: [
      { valor: '<1s',  etiqueta: 'Tiempo de respuesta' },
      { valor: '100%', etiqueta: 'Leads registrados' },
      { valor: '0',    etiqueta: 'Acciones manuales' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Lead llega',      sublabel: 'Cualquier canal' },
      { tipo: 'proceso', label: 'Crear registro',  sublabel: 'leads + opportunity' },
      { tipo: 'proceso', label: 'Asignar comercial', sublabel: 'Álvaro Ríos (principal)' },
      { tipo: 'proceso', label: 'Calcular slot',   sublabel: 'Próxima disponibilidad' },
      { tipo: 'output',  label: 'Lead asignado',   sublabel: 'Listo para bienvenida' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada nuevo lead registrado en el sistema (evento en tiempo real)',
    fuente_datos: 'Supabase — tablas leads + opportunities + availability_slots',
    canal_salida: ['supabase', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-01T00:00:00Z',
    pasos: [
      'INSERT en tabla leads con datos del canal de origen',
      'Trigger PostgreSQL fn_create_opportunity_on_new_lead se activa automáticamente',
      'Función fn_assign_commercial_round_robin asigna al comercial principal configurado en el sistema (Álvaro Ríos)',
      'Función fn_propose_next_visit_slot calcula el próximo martes o jueves disponible',
      'Estado de la oportunidad queda en "nuevo", listo para que Notificador de Bienvenida actúe',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-01T00:00:00Z', descripcion: 'Sistema de captura multi-canal implementado', autor: 'Robert Virona' },
      { fecha: '2026-05-15T00:00:00Z', descripcion: 'Trigger de asignación comercial principal agregado (migración 010)', autor: 'Robert Virona' },
      { fecha: '2026-06-01T00:00:00Z', descripcion: 'Cálculo de slot de visita integrado al flujo de recepción', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Asignación cambiada de round-robin a pin fijo (Álvaro Ríos, migración 022)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/008_lead_to_project_schema.sql',
      'db/migrations/010_lead_to_project_triggers.sql',
    ],
  },

  // ─── 2. NOTIFICADOR DE BIENVENIDA ────────────────────────────────────────────
  {
    slug: 'notificador-de-bienvenida',
    nombre: 'Notificador de Bienvenida',
    descripcion: 'Envía un WhatsApp personalizado al nuevo lead con el nombre del comercial asignado y la fecha propuesta de visita, segundos después de su llegada al sistema.',
    descripcion_larga: `Es el primer toque que recibe el cliente — completamente automático, pero con nombre y datos reales.

Tan pronto como el Receptor de Leads registra el contacto y le asigna un comercial, el Notificador actúa. Lee el nombre del cliente, el comercial asignado y el slot de visita propuesto, y construye dos mensajes con las plantillas aprobadas por Meta:

El primero es un saludo de bienvenida que menciona al cliente por su nombre y le presenta al asesor que lo va a atender. El segundo incluye el enlace de agendamiento con la fecha sugerida, para que el cliente pueda confirmar directamente desde su WhatsApp.

Ambos mensajes se agregan a la cola de salida (notification_queue) y son enviados por el Worker de Notificaciones en el siguiente ciclo, típicamente en menos de 60 segundos. Si el envío falla (por ejemplo, si Meta tiene una interrupción), el sistema reintenta automáticamente hasta 3 veces antes de marcar el mensaje como fallido.`,
    problema_que_resuelve: 'Los clientes que contactan a una empresa esperan respuesta inmediata. Una demora de horas o días genera desconfianza y aumenta el abandono. El Notificador responde en segundos, en el momento exacto en que el interés del cliente está en su punto más alto.',
    beneficios: [
      'El cliente se siente atendido de inmediato, aumentando la confianza desde el primer contacto',
      'El comercial asignado queda presentado antes de su primera llamada, reduciendo la fricción',
      'La fecha de visita propuesta llega automáticamente sin que el equipo tenga que redactar nada',
      'Usa plantillas aprobadas por Meta: los mensajes no caen en spam y cumplen las normas de la API',
      'Reintenta automáticamente hasta 3 veces si hay fallos de entrega',
    ],
    casos_de_uso: [
      'Son las 8:30pm y un lead llega por el formulario web. El Notificador envía el WhatsApp de bienvenida en menos de 60 segundos — mucho antes de que cualquier persona del equipo se entere del nuevo contacto.',
      'Un cliente referido llega solo con nombre y teléfono. Recibe bienvenida personalizada con el nombre del asesor y una propuesta de fecha concreta, sin que el asesor haya tenido que escribir ni una palabra.',
    ],
    metricas: [
      { valor: '<60s', etiqueta: 'Tiempo hasta primer mensaje' },
      { valor: '2',    etiqueta: 'Mensajes automáticos' },
      { valor: '3',    etiqueta: 'Reintentos máximos' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Lead asignado',    sublabel: 'Por Receptor de Leads' },
      { tipo: 'proceso', label: 'Leer contexto',    sublabel: 'Nombre, comercial, slot' },
      { tipo: 'proceso', label: 'Armar mensajes',   sublabel: 'Templates Meta' },
      { tipo: 'api',     label: 'Encolar WA',       sublabel: 'notification_queue' },
      { tipo: 'output',  label: 'Bienvenida enviada', sublabel: 'Cliente notificado' },
    ],
    categoria: 'comunicacion',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Inmediatamente después de cada nuevo lead registrado',
    fuente_datos: 'Supabase — tablas leads + opportunities + profiles (comercial)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-21T00:00:00Z',
    pasos: [
      'Trigger trg_notify_lead_followup_flow detecta nuevo lead con comercial asignado',
      'Función encola mensaje 1 con template welcome_lead_v1 (variable: nombre del cliente)',
      'Función encola mensaje 2 con template booking_link_v1 (nombre, URL de agenda, nombre del comercial)',
      'Worker WhatsApp procesa la cola en el siguiente ciclo (máx. 60s) y envía a Meta API',
      'Estado de entrega registrado en notification_queue para auditoría completa',
    ],
    notas: 'Los templates welcome_lead_v1 y booking_link_v1 deben estar aprobados en Meta Business Manager. Si no lo están, los mensajes quedan en estado "failed" en la cola pero pueden reintentarse cuando se aprueben sin perder la cola.',
    historial: [
      { fecha: '2026-05-14T00:00:00Z', descripcion: 'Trigger de seguimiento y bienvenida implementado (migración 014)', autor: 'Robert Virona' },
      { fecha: '2026-05-21T00:00:00Z', descripcion: 'Templates welcome_lead_v1 y booking_link_v1 enviados a revisión Meta', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/014_whatsapp_lead_followup_flow.sql',
      'supabase/functions/process-whatsapp-notifications/index.ts',
    ],
  },

  // ─── 3. AGENDADOR DE VISITAS ─────────────────────────────────────────────────
  {
    slug: 'agendador-de-visitas',
    nombre: 'Agendador de Visitas',
    descripcion: 'Gestiona el ciclo completo de agendamiento: confirma la fecha, bloquea el slot en el calendario y programa recordatorios automáticos 24 horas y 2 horas antes de la visita.',
    descripcion_larga: `Una visita técnica es el paso más crítico del pipeline comercial de Innovar. El Agendador asegura que cada visita quede confirmada, bloqueada en el sistema y comunicada correctamente, sin riesgo de doble reserva ni de olvidos.

Cuando el cliente confirma la fecha propuesta (o el comercial agenda manualmente desde el CRM), el sistema hace tres cosas en paralelo: registra la visita en la tabla de visitas, bloquea el slot en el calendario de disponibilidad para que ese horario no pueda asignarse a otro cliente, y envía al cliente un WhatsApp de confirmación con todos los detalles.

Además, programa automáticamente dos recordatorios que llegarán en el momento exacto: uno 24 horas antes de la visita (para cliente y comercial) y otro 2 horas antes (para ambos). Estos recordatorios se disparan independientemente por un cron job y no requieren ninguna acción manual.`,
    problema_que_resuelve: 'La gestión manual de visitas técnicas genera conflictos de horario, citas olvidadas y clientes que no aparecen. El Agendador elimina estos problemas bloqueando el slot automáticamente y enviando recordatorios precisos a tiempo.',
    beneficios: [
      'Imposible reservar el mismo slot dos veces: el bloqueo es instantáneo y atómico',
      'El cliente recibe confirmación por WhatsApp inmediatamente después de agendar',
      'Recordatorios automáticos 24h y 2h antes reducen drásticamente las ausencias',
      'El comercial también recibe recordatorio con dirección, teléfono y servicios solicitados',
      'Libera al equipo administrativo de coordinar citas manualmente',
    ],
    casos_de_uso: [
      'El cliente confirma por WhatsApp que el jueves a las 10am está disponible. En segundos el slot queda bloqueado, el cliente recibe confirmación con todos los detalles, y el sistema ya programó los recordatorios del miércoles y del jueves en la mañana.',
      'El comercial agenda directamente desde el CRM después de hablar con el cliente. El sistema envía el WhatsApp de confirmación automáticamente, sin que el asesor tenga que escribir nada adicional.',
    ],
    metricas: [
      { valor: '0',    etiqueta: 'Dobles reservas posibles' },
      { valor: '2',    etiqueta: 'Recordatorios por visita' },
      { valor: '<30s', etiqueta: 'Confirmación al cliente' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Fecha confirmada',    sublabel: 'Cliente o comercial' },
      { tipo: 'proceso', label: 'Bloquear slot',        sublabel: 'availability_slots' },
      { tipo: 'proceso', label: 'Confirmar cliente',    sublabel: 'WhatsApp confirmación' },
      { tipo: 'proceso', label: 'Programar 24h',        sublabel: 'pg_cron schedule' },
      { tipo: 'proceso', label: 'Programar 2h',         sublabel: 'pg_cron schedule' },
      { tipo: 'output',  label: 'Visita agendada',      sublabel: 'Sistema y cliente informados' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'visible',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se confirma o agenda una visita técnica',
    fuente_datos: 'Supabase — tablas visits + availability_slots + opportunities',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-26T00:00:00Z',
    pasos: [
      'INSERT en tabla visits al confirmar la fecha (trigger o acción manual del comercial)',
      'Función fn_block_visit_slot reserva el horario en availability_slots',
      'Trigger trg_notify_visit_assigned_admin encola WhatsApp al comercial (template visit_assigned_admin_v1)',
      'Cron wa-recordatorio-24h-daily (09:00 UTC) encola recordatorios del día siguiente',
      'Cron visit-reminders-2h (cada 30 min) detecta visitas en las próximas 2 horas y encola recordatorios',
      'Worker WhatsApp procesa la cola y envía todos los mensajes a Meta API',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-20T00:00:00Z', descripcion: 'Sistema de bloqueo de slots implementado', autor: 'Robert Virona' },
      { fecha: '2026-05-26T00:00:00Z', descripcion: 'Recordatorios 24h y 2h agregados (migración 026)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/026_visit_whatsapp_triggers.sql',
      'db/migrations/018_fix_visit_to_task_mirror_availability.sql',
    ],
  },

  // ─── 4. MONITOR DE INACTIVIDAD ───────────────────────────────────────────────
  {
    slug: 'monitor-de-inactividad',
    nombre: 'Monitor de Inactividad',
    descripcion: 'Escanea diariamente todos los leads activos y cambia su estado automáticamente cuando detecta inactividad prolongada: 30 días sin movimiento → Dormido; 60 días dormido → Perdido.',
    descripcion_larga: `Un pipeline comercial limpio es más fácil de gestionar y más honesto con la realidad del negocio. El Monitor de Inactividad se encarga de que el CRM refleje siempre el estado real de cada oportunidad, sin que el equipo tenga que revisarla manualmente.

Todos los días a medianoche, el monitor revisa todas las oportunidades activas del sistema. Para cada una, calcula cuánto tiempo ha pasado desde la última actividad registrada (mensaje enviado, visita agendada, cotización modificada, etc.). Si esa última actividad tiene más de 30 días, la oportunidad pasa automáticamente a estado "Dormido", indicando que el interés del cliente probablemente está frío.

Si el lead lleva 60 días en estado dormido sin ningún movimiento, el monitor lo cierra definitivamente como "Perdido". Esto mantiene el pipeline limpio y permite que el equipo enfoque su energía en leads con actividad real.

Todos los cambios quedan registrados en el audit_log con el motivo, para que el historial de la oportunidad sea siempre trazable.`,
    problema_que_resuelve: 'Los pipelines con leads "fantasma" —contactos que llevan meses sin actividad pero siguen apareciendo como activos— distorsionan las métricas y distraen al equipo. El Monitor limpia el pipeline automáticamente y mantiene las cifras honestas.',
    beneficios: [
      'Pipeline siempre limpio y actualizado sin esfuerzo manual del equipo',
      'Las métricas de conversión reflejan la realidad, no leads que ya no responden',
      'Reglas claras y consistentes: 30 días dormido, 60 días perdido',
      'Historial completo: cada cambio de estado queda registrado con fecha y motivo',
      'Libera capacidad mental del equipo para enfocarse en oportunidades reales',
    ],
    casos_de_uso: [
      'Un lead llegó hace 45 días. Se envió WhatsApp de bienvenida pero nunca respondió. El monitor lo marca automáticamente como "Dormido" en el día 30 y como "Perdido" en el día 90, sin que ningún comercial tenga que hacer nada.',
      'Al revisar el reporte de conversión, el gerente ve que hay 12 oportunidades activas con actividad real en los últimos 7 días. Sabe que ese número es exacto porque el monitor ya depuró los leads inactivos.',
    ],
    metricas: [
      { valor: '24h',  etiqueta: 'Frecuencia de escaneo' },
      { valor: '30d',  etiqueta: 'Umbral para Dormido' },
      { valor: '60d',  etiqueta: 'Umbral para Perdido' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron diario',          sublabel: 'Medianoche UTC' },
      { tipo: 'proceso', label: 'Escanear leads',        sublabel: 'Última actividad' },
      { tipo: 'decision', label: '+30 días sin acción?', sublabel: 'Regla inactividad' },
      { tipo: 'proceso', label: 'Marcar Dormido',        sublabel: 'Update + audit_log' },
      { tipo: 'decision', label: '+60 días dormido?',    sublabel: 'Regla cierre' },
      { tipo: 'output',  label: 'Marcar Perdido',        sublabel: 'Pipeline limpio' },
    ],
    categoria: 'operacional',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Cron diario a medianoche (00:00 UTC = 19:00 hora Colombia)',
    fuente_datos: 'Supabase — tabla opportunities + interactions',
    canal_salida: ['supabase', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-15T00:00:00Z',
    pasos: [
      'pg_cron dispara función fn_scan_inactive_opportunities a medianoche',
      'Consulta oportunidades con status activo y last_activity_at < NOW() - INTERVAL 30 days',
      'UPDATE status = dormido para leads con 30+ días de inactividad, INSERT en audit_log',
      'Consulta oportunidades con status = dormido y updated_at < NOW() - INTERVAL 60 days',
      'UPDATE status = perdido para leads con 60+ días dormidos, INSERT en audit_log',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-15T00:00:00Z', descripcion: 'Monitor de inactividad implementado (migración 009)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/009_lead_to_project_functions.sql',
      'db/migrations/010_lead_to_project_triggers.sql',
    ],
  },

  // ─── 5. GESTOR DE COTIZACIONES ───────────────────────────────────────────────
  {
    slug: 'gestor-de-cotizaciones',
    nombre: 'Gestor de Cotizaciones',
    descripcion: 'Envía el link único de cotización al cliente por WhatsApp, gestiona sus tres respuestas posibles (aprobar, pedir ajustes, rechazar) y controla la expiración automática a los 30 días.',
    descripcion_larga: `El momento en que el cliente recibe y responde su cotización es el instante más crítico del proceso de venta. El Gestor de Cotizaciones lo automatiza por completo: desde el envío hasta la gestión de cualquier respuesta posible.

Cuando el diseñador o el admin marca la cotización como lista para enviar, el sistema genera un código único (short code) y construye un link personalizado que lleva al cliente a una vista pública con los detalles completos de su cotización. Ese link se envía automáticamente por WhatsApp con el número y el nombre del proyecto.

En la vista pública, el cliente puede hacer tres cosas: aprobar, pedir ajustes (con comentarios) o rechazar (con motivo). Cada acción dispara una notificación automática al admin y al comercial asignado, actualizando el estado en el CRM en tiempo real.

Si el cliente no responde en 30 días, la cotización expira automáticamente. El sistema notifica al admin con el motivo para que el equipo pueda decidir si envía una nueva versión o cierra la oportunidad.`,
    problema_que_resuelve: 'Sin un proceso estructurado, los presupuestos se envían por correo o WhatsApp de manera informal y es difícil rastrear si el cliente los vio, qué respondió y cuándo. El Gestor centraliza todo el flujo en un link trazable con respuestas en tiempo real.',
    beneficios: [
      'El cliente recibe un link profesional con su cotización completa, no un PDF adjunto',
      'Las tres respuestas posibles (aprobación, ajustes, rechazo) quedan registradas con timestamp',
      'El equipo recibe notificación instantánea cuando el cliente toma una decisión',
      'La expiración automática a los 30 días mantiene el pipeline actualizado',
      'Cada cotización tiene un short code único, imposible de confundir',
    ],
    casos_de_uso: [
      'El diseñador termina el presupuesto el viernes a las 6pm y lo marca como listo. El cliente recibe el link por WhatsApp y el lunes lo aprueba. El comercial recibe la notificación en segundos y arranca el proceso de pago.',
      'Un cliente pide ajustes con un comentario específico. El comercial ve la nota en el CRM, hace la revisión y envía la nueva versión. El historial de versiones queda guardado para auditoría.',
    ],
    metricas: [
      { valor: '30d',  etiqueta: 'Ventana de respuesta' },
      { valor: '3',    etiqueta: 'Respuestas posibles' },
      { valor: '<5s',  etiqueta: 'Notificación al equipo' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cotización lista',     sublabel: 'Admin/diseñador confirma' },
      { tipo: 'proceso', label: 'Generar short code',   sublabel: 'Link único público' },
      { tipo: 'api',     label: 'Enviar por WA',        sublabel: 'Meta API' },
      { tipo: 'decision', label: '¿Respuesta cliente?', sublabel: 'Aprobar / Ajustes / Rechazar' },
      { tipo: 'proceso', label: 'Notificar equipo',     sublabel: 'WhatsApp admin/comercial' },
      { tipo: 'output',  label: 'CRM actualizado',      sublabel: 'Estado en tiempo real' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'visible',
    tipo: 'webhook',
    frecuencia: 'Cada cotización marcada como lista para enviar',
    fuente_datos: 'Supabase — tablas quotations + opportunities + profiles',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-28T00:00:00Z',
    pasos: [
      'Función RPC generate_quotation_short_code crea código único y actualiza quotations.short_code',
      'Trigger encola WhatsApp al cliente con template quotation_v2_sent_v1 (nombre, n° cotización, link)',
      'Cliente accede al link público /c/<short_code> y puede aprobar, pedir ajustes o rechazar',
      'Trigger fn_notify_quotation_acceptance o fn_notify_quotation_rejection detecta la respuesta',
      'Sistema encola WhatsApps al admin y comercial notificando la decisión con motivo',
      'Cron slice3-expire-accepted-quotations-daily marca expiradas las cotizaciones sin respuesta tras 30 días',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-22T00:00:00Z', descripcion: 'Short codes y link público de cotización implementados (migración 035a)', autor: 'Robert Virona' },
      { fecha: '2026-05-28T00:00:00Z', descripcion: 'Notificaciones WA en aceptar/ajustes/rechazar (migración 035b)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/035a_phase4_quotation_short_code.sql',
      'db/migrations/035b_phase4_admin_wa_on_quotation_actions.sql',
    ],
  },

  // ─── 6. NOTIFICADOR DE COMPROBANTE ───────────────────────────────────────────
  {
    slug: 'notificador-de-comprobante',
    nombre: 'Notificador de Comprobante de Pago',
    descripcion: 'Detecta automáticamente cuando el cliente sube su comprobante de pago en el portal y alerta al admin por WhatsApp para que lo verifique contra la cuenta bancaria real.',
    descripcion_larga: `Después de que el cliente aprueba su cotización, el siguiente paso es el pago del anticipo. El cliente sube la foto del comprobante directamente en el portal público de su cotización —sin necesidad de enviarla por WhatsApp o correo— y el sistema se encarga del resto.

En el momento en que el archivo llega al bucket de Supabase Storage, un trigger detecta el nuevo comprobante y crea un registro en la tabla de pagos con estado "pendiente de verificación". Inmediatamente después, el sistema envía un WhatsApp al admin avisando que hay un comprobante listo para revisar, con el enlace directo al archivo.

El admin accede al CRM, compara el comprobante con los movimientos de la cuenta bancaria real y decide: verificar el pago (lo que activa al Conversor a Proyecto) o rechazarlo con un motivo (lo que notifica al cliente para que vuelva a intentarlo).`,
    problema_que_resuelve: 'Sin automatización, el cliente envía el comprobante por WhatsApp o correo, el admin puede olvidar revisarlo o perder el mensaje entre otras conversaciones, y el proyecto se retrasa. El Notificador garantiza que ningún comprobante quede sin revisar.',
    beneficios: [
      'El admin recibe alerta inmediata cuando hay un comprobante listo para verificar',
      'El cliente no necesita hablar con nadie: sube el archivo en el portal y listo',
      'Registro completo del pago: archivo, timestamp, estado y quién lo verificó',
      'Elimina el riesgo de perder comprobantes en conversaciones de WhatsApp',
    ],
    casos_de_uso: [
      'El cliente hace la transferencia bancaria el domingo y sube el comprobante en el portal. El admin recibe el WhatsApp el lunes en la mañana, lo revisa y verifica el pago. El proyecto arranca sin demoras.',
      'El cliente sube una imagen borrosa que no corresponde a la cotización. El admin la rechaza con el motivo desde el CRM y el cliente recibe automáticamente un WhatsApp pidiendo que vuelva a subir el comprobante correcto.',
    ],
    metricas: [
      { valor: '<30s', etiqueta: 'Alerta al admin' },
      { valor: '100%', etiqueta: 'Comprobantes detectados' },
      { valor: '0',    etiqueta: 'Revisiones perdidas' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Upload comprobante', sublabel: 'Supabase Storage' },
      { tipo: 'proceso', label: 'Crear registro pago', sublabel: 'payments pendiente' },
      { tipo: 'api',     label: 'Alerta al admin',     sublabel: 'WhatsApp Meta API' },
      { tipo: 'decision', label: '¿Admin verifica?',   sublabel: 'Aceptar o rechazar' },
      { tipo: 'output',  label: 'Resultado notificado', sublabel: 'Cliente informado' },
    ],
    categoria: 'comunicacion',
    status: 'activa',
    visibilidad: 'visible',
    tipo: 'webhook',
    frecuencia: 'Cada vez que el cliente sube un comprobante en el portal público',
    fuente_datos: 'Supabase Storage (bucket comprobantes) + tabla payments',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-30T00:00:00Z',
    pasos: [
      'Cliente hace upload del archivo en /c/<short_code> → Supabase Storage detecta el nuevo objeto',
      'Trigger de Storage crea fila en tabla payments con status = "pendiente_verificacion"',
      'Función encola WhatsApp al admin con enlace al comprobante (template interno)',
      'Admin revisa en el CRM: si verifica → RPC verify_payment activa Conversor a Proyecto',
      'Si rechaza → RPC reject_payment encola WhatsApp al cliente con motivo (template payment_proof_rejected_v1)',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-30T00:00:00Z', descripcion: 'Flujo de comprobante de pago implementado (migración 037)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/037_slice3_payment_flow.sql',
      'db/migrations/033_phase4_storage_buckets.sql',
    ],
  },

  // ─── 7. CONVERSOR A PROYECTO ─────────────────────────────────────────────────
  {
    slug: 'conversor-a-proyecto',
    nombre: 'Conversor a Proyecto',
    descripcion: 'Cuando el admin verifica el pago, ejecuta en cadena: crea el proyecto activo, bloquea la cotización, asigna el diseñador, envía WhatsApps de confirmación y encola la generación del PDF inmutable.',
    descripcion_larga: `El Conversor a Proyecto es el agente más importante del pipeline: es el que transforma una venta cerrada en un proyecto real. Una vez que el admin confirma que el pago fue recibido y corresponde, el sistema ejecuta una secuencia de seis acciones en menos de dos segundos.

Primero crea el proyecto en la base de datos, vinculado a la cotización aprobada y al cliente. Luego bloquea la cotización: a partir de ese momento no puede modificarse ni cancelarse, garantizando que el presupuesto que el cliente aprobó sea exactamente el que se va a construir.

El diseñador responsable (actualmente Álvaro Ríos) queda asignado automáticamente con la fecha de inicio del proyecto. Tanto el cliente como el diseñador reciben un WhatsApp de confirmación: el cliente sabe que su proyecto ha comenzado; el diseñador sabe que tiene un nuevo encargo.

Finalmente, el sistema encola la generación del PDF inmutable de la cotización —el documento legal que respalda el acuerdo— que queda disponible en el portal del cliente.`,
    problema_que_resuelve: 'La conversión de una cotización aprobada a un proyecto activo requiere múltiples pasos manuales que son fáciles de olvidar o ejecutar en orden incorrecto: crear el proyecto, notificar al diseñador, bloquear la cotización, generar el PDF. El Conversor los ejecuta todos en orden, instantáneamente y sin errores.',
    beneficios: [
      'Seis acciones críticas ejecutadas en orden correcto en menos de 2 segundos',
      'La cotización queda bloqueada: lo que se aprobó no puede cambiarse después',
      'El diseñador recibe su asignación automáticamente con todos los datos del proyecto',
      'El cliente recibe confirmación inmediata de que su proyecto ha iniciado',
      'PDF inmutable generado automáticamente como respaldo legal del acuerdo',
    ],
    casos_de_uso: [
      'El admin verifica el comprobante de pago del anticipo a las 9am. Sin hacer nada más, el proyecto está creado, el diseñador está asignado y tanto el cliente como el diseñador tienen el WhatsApp en su teléfono antes de las 9:01am.',
      'Tres meses después de entregado el proyecto, el cliente pregunta qué incluía exactamente su cotización. El PDF inmutable generado en el momento del pago tiene la respuesta exacta, firmada por el estado del sistema.',
    ],
    metricas: [
      { valor: '<2s',  etiqueta: 'Tiempo de conversión' },
      { valor: '6',    etiqueta: 'Acciones en cadena' },
      { valor: '100%', etiqueta: 'PDFs generados' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Pago verificado',     sublabel: 'Admin confirma' },
      { tipo: 'proceso', label: 'Crear proyecto',      sublabel: 'projects table' },
      { tipo: 'proceso', label: 'Bloquear cotización', sublabel: 'Inmutable' },
      { tipo: 'proceso', label: 'Asignar diseñador',   sublabel: 'Álvaro Ríos' },
      { tipo: 'api',     label: 'WhatsApps',           sublabel: 'Cliente + diseñador' },
      { tipo: 'output',  label: 'PDF en cola',         sublabel: 'Generación async' },
    ],
    categoria: 'operacional',
    status: 'activa',
    visibilidad: 'visible',
    tipo: 'webhook',
    frecuencia: 'Cada vez que el admin marca un pago como verificado',
    fuente_datos: 'Supabase — tablas payments + quotations + projects + profiles',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-30T00:00:00Z',
    pasos: [
      'Admin ejecuta RPC verify_payment en la pantalla de pagos del CRM',
      'RPC ejecuta INSERT en tabla projects vinculado a quotations y leads',
      'UPDATE quotations.is_locked = true para bloquear cualquier modificación futura',
      'UPDATE projects.designer_id con el diseñador por defecto y la fecha de inicio',
      'Función encola WhatsApp al cliente (template project_fully_paid_v1) y al diseñador (project_assigned_designer_v1)',
      'INSERT en tabla pdf_generation_queue para generación asíncrona del PDF inmutable',
    ],
    notas: 'La generación del PDF requiere que la Edge Function de generación esté activa y con credenciales configuradas (GOOGLE_DRIVE_KEY si se usa Drive para almacenamiento). Si falla, el proyecto ya existe y el PDF puede regenerarse manualmente.',
    historial: [
      { fecha: '2026-05-30T00:00:00Z', descripcion: 'RPC verify_payment con cadena completa de conversión (migración 037)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/037_slice3_payment_flow.sql',
      'db/migrations/038_phase4_pdf_generation_hook.sql',
    ],
  },

  // ─── 8. WORKER WHATSAPP ──────────────────────────────────────────────────────
  {
    slug: 'worker-whatsapp',
    nombre: 'Worker de Notificaciones WhatsApp',
    descripcion: 'Procesa la cola de mensajes de WhatsApp cada minuto: toma los pendientes, los envía a Meta y registra el resultado. Es el motor que hace funcionar todo el sistema de mensajería del CRM.',
    descripcion_larga: `El Worker es el "cartero" del sistema: trabaja silenciosamente en segundo plano y es el responsable de que todos los WhatsApps del CRM lleguen a su destino.

Cada minuto, un cron job lo despierta. El Worker consulta la cola de salida (notification_queue) y toma hasta 25 mensajes con estado "pendiente" que tengan menos de 3 intentos fallidos, ordenados del más antiguo al más reciente. Los marca como "en proceso" para evitar que otro ciclo los tome simultáneamente.

Para cada mensaje, busca la plantilla correspondiente en su registro interno, arma el cuerpo del mensaje con las variables correctas, normaliza el número de teléfono al formato internacional de Colombia (código 57) y hace la llamada a la API de Meta.

Si Meta confirma el envío, el mensaje queda como "enviado" con el ID único de Meta (wamid.*). Si falla, incrementa el contador de intentos. Cuando un mensaje falla 3 veces, se marca como "fallido" definitivamente y queda disponible para diagnóstico manual.

El resultado es un sistema de mensajería robusto que no pierde mensajes ante fallas temporales de Meta y que procesa toda la cola en segundos.`,
    problema_que_resuelve: 'Enviar cada WhatsApp en el momento exacto del evento (como un trigger sincrónico) hace que el sistema sea frágil: si Meta está caído en ese instante, el mensaje se pierde. El Worker con cola de salida garantiza que todos los mensajes lleguen, aunque sea con un retraso de minutos.',
    beneficios: [
      'Los mensajes nunca se pierden: si Meta falla, se reintenta en el próximo ciclo',
      'Sistema anti-duplicados: cada mensaje tiene una clave única (dedup_key) en la cola',
      'Procesamiento en lote eficiente: hasta 25 mensajes por ciclo de 60 segundos',
      'Log completo de cada envío con timestamps exactos y errores detallados',
      'Degradación elegante: si una plantilla falla, el resto de la cola sigue procesándose',
    ],
    casos_de_uso: [
      'Se generan 8 recordatorios de visita a las 9am. El Worker los procesa todos en menos de 30 segundos, uno a uno, marcando cada uno como enviado cuando Meta confirma la recepción.',
      'Meta tiene una interrupción temporal de 3 minutos. Los 2 mensajes que fallaron en ese ciclo quedan con 1 intento fallido y se reenvían exitosamente en el ciclo siguiente, sin que el usuario note ninguna diferencia.',
    ],
    metricas: [
      { valor: '60s',  etiqueta: 'Frecuencia de ciclo' },
      { valor: '25',   etiqueta: 'Mensajes por ciclo' },
      { valor: '3',    etiqueta: 'Reintentos máximos' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'pg_cron cada 1 min',  sublabel: 'Dispatcher' },
      { tipo: 'proceso', label: 'Tomar pendientes',    sublabel: 'SELECT … LIMIT 25' },
      { tipo: 'proceso', label: 'Marcar processing',   sublabel: 'Lock optimista' },
      { tipo: 'api',     label: 'Enviar a Meta',       sublabel: 'Graph API v21.0' },
      { tipo: 'proceso', label: 'Guardar resultado',   sublabel: 'sent / failed + wamid' },
      { tipo: 'output',  label: 'Cola vaciada',        sublabel: 'Hasta próximo ciclo' },
    ],
    categoria: 'notificaciones',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Cron cada 1 minuto (toda la semana, todo el día)',
    fuente_datos: 'Supabase — tabla notification_queue',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-26T00:00:00Z',
    pasos: [
      'pg_cron job-2 ejecuta net.http_post al endpoint de la Edge Function cada minuto',
      'Edge Function process-whatsapp-notifications toma hasta 25 filas con status=pending y attempt_count<3',
      'UPDATE status=processing con processing_at=NOW() (lock optimista)',
      'Para cada fila: busca plantilla en TEMPLATE_REGISTRY, normaliza teléfono a +57XXXXXXXXXX',
      'POST a https://graph.facebook.com/v21.0/{PHONE_ID}/messages con el template',
      'Éxito: UPDATE status=sent, provider_message_id=wamid.* | Fallo: UPDATE status=failed, attempt_count++',
    ],
    notas: 'Los secretos META_WABA_ACCESS_TOKEN y META_PHONE_NUMBER_ID deben estar configurados en Supabase Vault. Si una plantilla no está en el TEMPLATE_REGISTRY de la Edge Function, el mensaje falla con "Template no registrado" y no bloquea el resto de la cola.',
    historial: [
      { fecha: '2026-05-10T00:00:00Z', descripcion: 'Worker WhatsApp v1 implementado con TEMPLATE_REGISTRY básico', autor: 'Robert Virona' },
      { fecha: '2026-05-26T00:00:00Z', descripcion: 'Templates de visitas agregados al registro (v12 → v13)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/process-whatsapp-notifications/index.ts',
    ],
  },

  // ─── 9. WEBHOOK META WHATSAPP ────────────────────────────────────────────────
  {
    slug: 'webhook-meta-whatsapp',
    nombre: 'Webhook de Estado Meta WhatsApp',
    descripcion: 'Recibe las confirmaciones de entrega y lectura de Meta, actualiza el estado de cada mensaje en la cola y mantiene el historial completo de cada WhatsApp enviado por el sistema.',
    descripcion_larga: `Cuando el CRM envía un WhatsApp a través de Meta, hay una pregunta crítica: ¿llegó realmente al teléfono del cliente? El Webhook de Estado es quien responde esa pregunta.

Meta llama automáticamente a este endpoint cada vez que hay un cambio en el estado de un mensaje: cuando el mensaje fue aceptado por los servidores de Meta, cuando llegó al teléfono del destinatario, cuando el cliente lo leyó, o cuando falló definitivamente.

El Webhook valida primero que la llamada viene realmente de Meta (usando una firma HMAC-SHA256 con el secreto de la app), rechazando cualquier intento de falsificación. Luego extrae los eventos de estado, guarda el payload crudo en la tabla meta_whatsapp_status_events para auditoría completa, y actualiza la fila correspondiente en notification_queue cruzando por el ID único de Meta (wamid.*).

Así, el equipo puede ver en la pantalla de monitoreo de WhatsApp exactamente cuándo cada mensaje fue enviado, entregado y leído.`,
    problema_que_resuelve: 'Sin el webhook, el CRM solo sabe que intentó enviar el mensaje, pero no sabe si llegó. Si hay un problema de entrega, nadie se entera hasta que el cliente lo reporta. El Webhook cierra ese ciclo de información, dando visibilidad completa del estado real de cada comunicación.',
    beneficios: [
      'Visibilidad completa del ciclo de cada mensaje: enviado → entregado → leído',
      'Detección inmediata de mensajes fallidos para tomar acciones correctivas',
      'Payload crudo de Meta guardado para auditoría y diagnóstico',
      'Validación de firma HMAC que garantiza que solo Meta puede enviar eventos',
      'La pantalla /settings/whatsapp muestra el estado en tiempo real',
    ],
    casos_de_uso: [
      'El admin revisa el panel de WhatsApp y ve que el mensaje de bienvenida a un lead fue "entregado" pero no "leído" en 2 días. Decide hacer seguimiento telefónico.',
      'Un mensaje de recordatorio de visita queda en estado "failed". El webhook registra el error de Meta con el código exacto, permitiendo al equipo diagnósticar si es un número inválido o un problema temporal.',
    ],
    metricas: [
      { valor: '4',    etiqueta: 'Estados registrados' },
      { valor: '100%', etiqueta: 'Firma HMAC validada' },
      { valor: '0',    etiqueta: 'Eventos perdidos' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Meta llama al webhook', sublabel: 'Estado de mensaje' },
      { tipo: 'proceso', label: 'Validar HMAC',          sublabel: 'SHA-256 seguridad' },
      { tipo: 'proceso', label: 'Guardar evento crudo',  sublabel: 'status_events table' },
      { tipo: 'proceso', label: 'Cruzar por wamid',      sublabel: 'notification_queue' },
      { tipo: 'output',  label: 'Estado actualizado',    sublabel: 'sent/delivered/read/failed' },
    ],
    categoria: 'notificaciones',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que Meta notifica un cambio de estado en un mensaje enviado',
    fuente_datos: 'Meta WhatsApp Cloud API (push webhook)',
    canal_salida: ['supabase'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-15T00:00:00Z',
    pasos: [
      'GET /webhook: responde al handshake de Meta con el hub.challenge (verificación inicial)',
      'POST /webhook: valida la firma HMAC-SHA256 del header X-Hub-Signature-256',
      'Extrae entry[].changes[].value.statuses[] del payload',
      'INSERT en meta_whatsapp_status_events con el payload crudo completo',
      'UPDATE notification_queue SET delivery_status=<estado>, delivered_at/read_at/failed_at WHERE provider_message_id=wamid.*',
    ],
    notas: 'El secreto META_APP_SECRET y el META_WEBHOOK_VERIFY_TOKEN deben estar configurados tanto en Supabase Vault como en el panel de la app de Meta (WhatsApp → Configuration → Webhook). El endpoint es público (verify_jwt: false) pero protegido por la firma HMAC.',
    historial: [
      { fecha: '2026-05-15T00:00:00Z', descripcion: 'Webhook de estado Meta implementado con validación HMAC', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      '_archive/edge-functions-greenfield-2026-05-23/whatsapp-webhook/index.ts',
    ],
  },

  // ─── 10. RECORDATORIOS DE VISITA ─────────────────────────────────────────────
  {
    slug: 'recordatorios-de-visita',
    nombre: 'Recordatorios de Visita (24h y 2h)',
    descripcion: 'Envía automáticamente recordatorios de visita técnica al cliente y al comercial: uno 24 horas antes y otro 2 horas antes, con los datos completos de la cita.',
    descripcion_larga: `Los recordatorios son la capa de seguridad final contra las visitas olvidadas o canceladas de último momento. El sistema ejecuta dos rondas de recordatorios por cada visita programada.

El primer cron corre todos los días a las 9:00am hora Colombia. Busca todas las visitas programadas para el día siguiente y envía dos mensajes: uno al cliente recordándole la hora y confirmando el nombre del asesor que lo visitará; y otro al comercial con todos los detalles de la visita (hora, nombre del cliente, dirección, teléfono y lista de servicios solicitados).

El segundo cron corre cada 30 minutos durante todo el día. En cada ciclo, busca visitas que empiecen en las próximas 2 horas y aún no hayan recibido el recordatorio de 2h. Cuando las encuentra, envía un mensaje breve al cliente con la hora exacta, y al comercial un recordatorio de acción inmediata con todos los datos de contacto.

Ambos tipos de recordatorio usan plantillas aprobadas por Meta y se procesan a través del mismo Worker WhatsApp, garantizando trazabilidad completa.`,
    problema_que_resuelve: 'Las visitas técnicas en blanco —donde el cliente no está, llegó tarde o el comercial confundió la dirección— tienen un costo alto: tiempo del asesor perdido, retraso en el pipeline y mala experiencia del cliente. Los recordatorios dobles reducen drásticamente este problema.',
    beneficios: [
      'Dos recordatorios por visita: suficiente para evitar olvidos sin saturar al cliente',
      'El comercial recibe dirección, teléfono y servicios solicitados para prepararse mejor',
      'Los recordatorios se envían automáticamente sin que nadie tenga que programarlos',
      'El sistema detecta solo visitas que aún no recibieron el recordatorio, sin duplicados',
    ],
    casos_de_uso: [
      'El miércoles a las 9am, el sistema detecta que hay 3 visitas para el jueves. Envía 6 mensajes (3 a clientes + 3 a comerciales) en los próximos 2 minutos, sin ninguna acción manual.',
      'Son las 2:15pm y hay una visita a las 4pm que aún no recibió recordatorio de 2h. El cron de las 2:30pm la detecta y envía el recordatorio al cliente y al comercial a tiempo.',
    ],
    metricas: [
      { valor: '2',     etiqueta: 'Recordatorios por visita' },
      { valor: '9am',   etiqueta: 'Primer envío (24h antes)' },
      { valor: '2h',    etiqueta: 'Segundo envío (antes de la cita)' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron 9am diario',        sublabel: 'Recordatorio 24h' },
      { tipo: 'proceso', label: 'Buscar visitas mañana',  sublabel: 'Scan tabla visits' },
      { tipo: 'api',     label: 'Encolar recordatorios',  sublabel: 'Cliente + comercial' },
      { tipo: 'trigger', label: 'Cron cada 30min',        sublabel: 'Recordatorio 2h' },
      { tipo: 'proceso', label: 'Visitas en 2h sin aviso', sublabel: 'Filtro temporal' },
      { tipo: 'output',  label: 'WA enviados',            sublabel: 'Worker procesa cola' },
    ],
    categoria: 'notificaciones',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: '9am COT diario (recordatorio 24h) + cada 30 minutos (recordatorio 2h)',
    fuente_datos: 'Supabase — tabla visits + profiles (cliente y comercial)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-26T00:00:00Z',
    pasos: [
      'Cron wa-recordatorio-24h-daily (09:00 UTC) llama a fn_wa_recordatorio_24h_scan()',
      'Función busca visitas con scheduled_at BETWEEN NOW()+23h AND NOW()+25h sin reminder_24h_sent=true',
      'Encola mensajes con template visit_reminder_24h_internal_v1 (comercial) y recordatorio al cliente',
      'Cron visit-reminders-2h (*/30 * * * *) llama a enqueue_visit_reminders_2h()',
      'Función busca visitas con scheduled_at BETWEEN NOW()+1.5h AND NOW()+2.5h sin reminder_2h_sent=true',
      'Encola mensajes con templates visit_reminder_2h_client_v1 y visit_reminder_2h_internal_v1',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-26T00:00:00Z', descripcion: 'Crons de recordatorios 24h y 2h implementados (migración 026)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/026_visit_whatsapp_triggers.sql',
    ],
  },

  // ─── 11. EXPIRACIÓN DE COTIZACIONES ──────────────────────────────────────────
  {
    slug: 'expiracion-de-cotizaciones',
    nombre: 'Expiración Automática de Cotizaciones',
    descripcion: 'Detecta diariamente las cotizaciones aceptadas pero sin pago registrado después del período definido y las marca como expiradas, notificando al admin.',
    descripcion_larga: `Cuando un cliente aprueba una cotización pero no realiza el pago dentro del período establecido (por defecto 7 días, configurable), el sistema actúa automáticamente para limpiar el pipeline y alertar al equipo.

Todos los días a las 9:30am hora Colombia, el cron escaneador revisa todas las cotizaciones con status "aceptada" que no tienen un pago verificado asociado. Si la cotización lleva más días aceptada que el período configurado en system_settings.payment_window_days, el sistema la marca como "expirada".

Inmediatamente después, el admin recibe un WhatsApp con el nombre del cliente, el número de cotización, cuántos días lleva vencida y la información necesaria para tomar acción: contactar al cliente, renegociar o cerrar la oportunidad.

Este proceso se apoya en la configuración de system_settings, lo que significa que el período de tolerancia se puede ajustar sin tocar código, directamente desde la base de datos.`,
    problema_que_resuelve: 'Las cotizaciones que quedan en estado "aceptada" indefinidamente sin pago distorsionan el pipeline y le hacen creer al equipo que hay más clientes avanzados de los que realmente hay. La expiración automática mantiene el estado del CRM honesto con la realidad.',
    beneficios: [
      'El pipeline refleja siempre el estado real: solo cuentan las cotizaciones con pago en proceso',
      'El admin recibe aviso con los detalles exactos para tomar acción inmediata',
      'El período de tolerancia es configurable sin cambiar código (system_settings)',
      'Proceso completamente silencioso y automático: no requiere supervisión',
    ],
    casos_de_uso: [
      'Un cliente aprobó la cotización hace 10 días pero no ha hecho el pago. El sistema lo marca como expirado y el admin recibe el WhatsApp con los datos para hacer seguimiento.',
      'El equipo decide extender el período de tolerancia de 7 a 14 días para una temporada especial. Se actualiza un solo valor en system_settings y el cron adopta el nuevo criterio en el próximo ciclo.',
    ],
    metricas: [
      { valor: '7d',    etiqueta: 'Período default (configurable)' },
      { valor: '9:30am', etiqueta: 'Hora del escaneo diario' },
      { valor: '100%',  etiqueta: 'Expiradas detectadas' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron 9:30am diario',    sublabel: 'slice3-expire-cron' },
      { tipo: 'proceso', label: 'Escanear cotizaciones', sublabel: 'status=aceptada sin pago' },
      { tipo: 'decision', label: '> payment_window_days?', sublabel: 'system_settings' },
      { tipo: 'proceso', label: 'Marcar expirada',       sublabel: 'UPDATE quotations' },
      { tipo: 'api',     label: 'Notificar admin',       sublabel: 'admin_quotation_expired_v1' },
      { tipo: 'output',  label: 'Pipeline limpio',       sublabel: 'Estado actualizado' },
    ],
    categoria: 'operacional',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Cron diario a las 9:30am COT (14:30 UTC)',
    fuente_datos: 'Supabase — tablas quotations + system_settings + payments',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-31T00:00:00Z',
    pasos: [
      'pg_cron slice3-expire-accepted-quotations-daily ejecuta expire_accepted_quotations_scan() a las 14:30 UTC',
      'Función lee payment_window_days de system_settings (default 7)',
      'SELECT cotizaciones con status=accepted y created_at < NOW() - INTERVAL payment_window_days days sin pago verificado',
      'UPDATE quotations SET status=expired con ON CONFLICT (dedup_key) DO NOTHING (idempotente)',
      'Encola WhatsApp al admin con template admin_quotation_expired_v1 (admin, cliente, n°, días vencida)',
    ],
    notas: 'El período de tolerancia se configura en system_settings: UPDATE system_settings SET value = \'{"days": 14}\' WHERE key = \'payment_window_days\'. El flag slice_3_enabled debe estar en TRUE para que este cron encole mensajes reales.',
    historial: [
      { fecha: '2026-05-31T00:00:00Z', descripcion: 'Cron de expiración de cotizaciones aceptadas (migración 038)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/038_slice3_expiry_cron.sql',
      'db/migrations/039_slice3_settings_seeds.sql',
    ],
  },

  // ─── 12. SEGUIMIENTO D+3/D+7 ────────────────────────────────────────────────
  {
    slug: 'seguimiento-cotizaciones',
    nombre: 'Seguimiento de Cotizaciones D+3/D+7',
    descripcion: 'Monitorea cotizaciones enviadas sin respuesta y dispara recordatorios automáticos por WhatsApp al cliente en el día 3 y en el día 7, reduciendo las cotizaciones que mueren en silencio.',
    descripcion_larga: `La mayoría de las cotizaciones que no se cierran no es porque el cliente no estaba interesado, sino porque el seguimiento fue tardío o inconsistente. Este agente resuelve ese problema ejecutando un seguimiento preciso y automático.

Todos los días a las 9:00am hora Colombia, el workflow analiza todas las cotizaciones con estado "enviada" que aún no tienen respuesta del cliente. Las clasifica en dos grupos: D+3 (cotizaciones de 3 a 6 días sin respuesta) y D+7 (cotizaciones de 7 o más días sin respuesta). Las cotizaciones que ya recibieron un recordatorio en las últimas 12 horas se excluyen automáticamente para evitar saturar al cliente.

Para las de D+3, el sistema envía al cliente un recordatorio amable recordándole que tiene un presupuesto esperando su respuesta. Para las de D+7, el tono cambia ligeramente y también se alerta al comercial responsable para que haga un seguimiento más personalizado.

Actualmente el agente está activo pero en modo DRY_RUN: clasifica las cotizaciones y registra qué haría, sin enviar mensajes reales todavía. Estará listo para producción cuando se aprueben las plantillas de Meta correspondientes.`,
    problema_que_resuelve: 'Las cotizaciones enviadas se pierden en el inbox del cliente. Sin un seguimiento sistemático, el equipo comercial tiene que recordar manualmente cuáles necesitan seguimiento y cuándo. Este agente lo hace por ellos, de forma consistente y en el momento exacto.',
    beneficios: [
      'Ninguna cotización queda sin seguimiento después de 3 o 7 días',
      'El comercial solo interviene manualmente en los casos que el agente señala (D+7)',
      'La regla de 12h entre recordatorios evita saturar al cliente con mensajes repetidos',
      'Panel de control en el CRM: toggle ON/OFF, ejecución manual y log de resultados',
      'Infraestructura lista: cuando se aprueben los templates Meta, un solo cambio lo activa',
    ],
    casos_de_uso: [
      'El agente identifica una cotización que tiene 4 días enviada sin respuesta. Envía un recordatorio amable al cliente con el link de la cotización. Al día siguiente el cliente la aprueba.',
      'El gerente quiere saber cuántas cotizaciones están esperando seguimiento esta semana. Abre el panel en /agentes/seguimiento-cotizaciones y hace clic en "Ejecutar ahora" para ver el log en tiempo real.',
    ],
    metricas: [
      { valor: 'D+3',  etiqueta: 'Primer recordatorio' },
      { valor: 'D+7',  etiqueta: 'Segundo recordatorio' },
      { valor: '12h',  etiqueta: 'Pausa anti-spam entre envíos' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron 9am Bogotá',    sublabel: 'n8n workflow' },
      { tipo: 'proceso', label: 'Clasificar cotizaciones', sublabel: 'D+3 vs D+7' },
      { tipo: 'proceso', label: 'Filtrar recientes',  sublabel: 'Excluir últimas 12h' },
      { tipo: 'api',     label: 'Encolar WA',         sublabel: 'Via n8n-proxy EF' },
      { tipo: 'output',  label: 'Recordatorio enviado', sublabel: '+ alerta comercial D+7' },
    ],
    categoria: 'comercial',
    status: 'pausada',
    visibilidad: 'n8n',
    tipo: 'cron',
    frecuencia: 'Cron diario a las 9:00am hora Bogotá (n8n workflow activo)',
    fuente_datos: 'Supabase — tabla quotations (status=enviada, sin respuesta)',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: 'LwKmUoeNc2TQqERQ',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-08T00:00:00Z',
    pasos: [
      'n8n workflow LwKmUoeNc2TQqERQ corre a las 9am Bogotá (activo, DRY_RUN=true)',
      'Nodo Config define DRY_RUN y parámetros de clasificación D+3 y D+7',
      'Consulta Supabase: cotizaciones enviadas sin respuesta, excluye alertadas en últimas 12h',
      'Clasifica en D+3 (3–6 días) y D+7 (7+ días)',
      'Si DRY_RUN=false: encola WhatsApp al cliente (y alerta al comercial para D+7)',
      'Actualiza alert_sent_at en la cotización para aplicar la regla de 12h',
    ],
    notas: 'DRY_RUN=true actualmente: el workflow clasifica y loguea pero NO envía mensajes ni actualiza alert_sent_at. Para activar producción: (1) aprobar templates Meta pendientes, (2) cambiar slice_3_enabled=TRUE en system_settings, (3) cambiar DRY_RUN a false en el nodo Config del workflow n8n LwKmUoeNc2TQqERQ.',
    historial: [
      { fecha: '2026-06-08T00:00:00Z', descripcion: 'Workflow n8n creado y activado en DRY_RUN. Panel de control en CRM construido (SeguimientoCotizaciones.tsx)', autor: 'Robert Virona' },
      { fecha: '2026-06-08T00:00:00Z', descripcion: 'Edge Function n8n-proxy desplegada para comunicación segura browser → n8n', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'src/pages/SeguimientoCotizaciones.tsx',
      'supabase/functions/n8n-proxy/index.ts',
    ],
  },

  // ─── 13. BIENVENIDA AL PROYECTO ─────────────────────────────────────────────
  {
    slug: 'bienvenida-al-proyecto',
    nombre: 'Bienvenida al Proyecto',
    descripcion: 'Cuando se crea un proyecto activo, envía automáticamente un WhatsApp al cliente presentándole el proyecto y el nombre del diseñador asignado.',
    descripcion_larga: `El momento en que el cliente paga y el proyecto arranca es uno de los más importantes de la relación. La Bienvenida al Proyecto asegura que ese instante quede marcado con una comunicación cálida y profesional, sin que nadie tenga que escribir nada.

En cuanto el admin verifica el pago y el sistema crea el proyecto activo, este agente actúa de forma inmediata. Lee el nombre del cliente, el nombre del proyecto y el diseñador asignado, y construye un mensaje personalizado con la plantilla proyecto_iniciado_v1.

El cliente recibe un WhatsApp indicando que su proyecto ya está en marcha, quién es el diseñador que lo atenderá y que pronto estará en contacto. Este mensaje llega antes de que el equipo haya tenido tiempo de reaccionar, proyectando una imagen de organización y velocidad de respuesta.

El sistema incluye un guard de idempotencia: si por algún motivo el trigger se disparara dos veces para el mismo proyecto (por ejemplo, en un reinicio), solo se encola un mensaje, garantizando que el cliente no reciba la bienvenida duplicada.`,
    problema_que_resuelve: 'Al convertir una venta en proyecto, el cliente a menudo queda en silencio sin saber que ya empezó. Si el equipo tarda en comunicarse, se genera incertidumbre. La Bienvenida lo comunica en segundos, sin esfuerzo del equipo.',
    beneficios: [
      'El cliente sabe que su proyecto comenzó en segundos, sin esperar que alguien le escriba',
      'El diseñador asignado queda presentado desde el primer momento',
      'Imagen profesional y organizada que refuerza la confianza del cliente',
      'Guard de idempotencia: imposible que el cliente reciba el mensaje dos veces',
    ],
    casos_de_uso: [
      'El admin verifica el pago a las 9:15am. El cliente recibe el WhatsApp de bienvenida al proyecto a las 9:15:03am — antes de que el equipo haya tenido tiempo de reaccionar.',
      'El diseñador tiene múltiples proyectos en curso. Al llegar a la oficina ya sabe que fue asignado a un nuevo proyecto porque el cliente lo mencionó en un mensaje de respuesta a la bienvenida.',
    ],
    metricas: [
      { valor: '<60s', etiqueta: 'Tiempo hasta el WA de bienvenida' },
      { valor: '1',    etiqueta: 'Mensaje por proyecto (idempotente)' },
      { valor: '0',    etiqueta: 'Acciones manuales necesarias' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Proyecto creado',      sublabel: 'INSERT en projects' },
      { tipo: 'proceso', label: 'Leer contexto',        sublabel: 'Nombre, proyecto, diseñador' },
      { tipo: 'proceso', label: 'Guard dedup',          sublabel: 'Solo 1 mensaje por proyecto' },
      { tipo: 'api',     label: 'Encolar WA',           sublabel: 'notification_queue' },
      { tipo: 'output',  label: 'Bienvenida enviada',   sublabel: 'Cliente informado' },
    ],
    categoria: 'comunicacion',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se crea un proyecto activo (pago verificado)',
    fuente_datos: 'Supabase — tablas projects + clients + profiles (diseñador)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Trigger trg_wa_project_welcome se activa AFTER INSERT en tabla projects',
      'Función fn_wa_project_welcome busca el cliente y su whatsapp_phone',
      'Si el teléfono es válido (>= 10 caracteres), lee el nombre del diseñador asignado',
      'Guard: verifica que no exista ya un mensaje project.created para este proyecto en notification_queue',
      'INSERT en notification_queue con template proyecto_iniciado_v1 (nombre, proyecto, diseñador)',
      'Worker WhatsApp procesa la cola y envía el mensaje a Meta API',
    ],
    notas: 'El template proyecto_iniciado_v1 debe crearse en Meta Business Manager (Robert). Parámetros: {{1}} = primer nombre del cliente, {{2}} = nombre del proyecto, {{3}} = nombre del diseñador. Mientras el template no esté aprobado, los mensajes quedan en "pending" en la cola y pueden reenviarse cuando se aprueben.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Trigger fn_wa_project_welcome implementado (migración 044)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/044_wa_project_welcome.sql',
    ],
  },

  // ─── 14. REACTIVACIÓN DE LEADS ───────────────────────────────────────────────
  {
    slug: 'reactivacion-de-leads',
    nombre: 'Reactivación de Leads',
    descripcion: 'Detecta leads con más de 3 días en el sistema sin visita agendada y les reenvía automáticamente el link de agendamiento por WhatsApp. Recupera leads que se enfriaron antes de confirmar.',
    descripcion_larga: `Muchos leads llegan al sistema, reciben la bienvenida y el link de agendamiento, pero nunca confirman la visita. La Reactivación de Leads es el agente que los recupera de forma automática, sin que el equipo comercial tenga que rastrearlos manualmente.

Todos los días a las 9:00am hora Colombia, el sistema escanea todos los leads en estado "Nuevo" o "Contactado" que llevan más de 3 días en el sistema sin haber agendado ninguna visita futura. Para cada uno de estos leads, el sistema verifica que no haya recibido ya una reactivación en los últimos 7 días (para no saturar al cliente) y encola un nuevo mensaje con el link de agendamiento.

El mensaje usa la misma plantilla aprobada por Meta (booking_link_v1) que la bienvenida inicial, pero llegando en un contexto diferente —días después, cuando el interés puede haberse enfriado— funciona como un recordatorio sutil y personalizado.

El límite de 7 días entre reactivaciones garantiza que el cliente no reciba mensajes en exceso, manteniendo el equilibrio entre persistencia y respeto.`,
    problema_que_resuelve: 'Un porcentaje significativo de leads que reciben el primer mensaje no agenda visita de inmediato. Sin seguimiento automático, esos leads simplemente se enfrían y se pierden. La Reactivación los recupera con un contacto oportuno sin carga para el equipo.',
    beneficios: [
      'Recupera leads que recibieron la bienvenida pero no confirmaron visita',
      'Límite de 7 días entre mensajes: persistente pero sin saturar al cliente',
      'Guard anti-duplicados: verificación doble (filtro SQL + guard en loop) para robustez',
      'Usa template ya aprobado por Meta: no necesita aprobación adicional',
      'Completamente automático: el equipo comercial no tiene que hacer ningún seguimiento manual',
    ],
    casos_de_uso: [
      'Un lead llegó hace 5 días. Recibió la bienvenida y el link pero no agendó. A las 9am del día 5, el agente le reenvía el link. Esa tarde el cliente agenda su visita.',
      'El equipo tiene 20 leads activos sin visita. El agente detecta 8 que califican para reactivación, encola 8 mensajes y los envía antes de las 9:05am, sin que ningún comercial haya revisado la lista.',
    ],
    metricas: [
      { valor: '3d',   etiqueta: 'Umbral para reactivar' },
      { valor: '7d',   etiqueta: 'Pausa entre mensajes' },
      { valor: '9am',  etiqueta: 'Hora de ejecución (COT)' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron diario 9am',       sublabel: 'wa-lead-reactivation-daily' },
      { tipo: 'proceso', label: 'Escanear leads',         sublabel: 'new/contacted sin visita >3d' },
      { tipo: 'decision', label: 'Sin WA en últimos 7d?', sublabel: 'Filtro anti-spam' },
      { tipo: 'api',     label: 'Encolar WA',             sublabel: 'booking_link_v1' },
      { tipo: 'output',  label: 'Link reenviado',         sublabel: 'Lead reactivado' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Cron diario a las 9:00am COT (14:00 UTC)',
    fuente_datos: 'Supabase — tablas opportunities + clients + notification_queue',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'pg_cron job "wa-lead-reactivation-daily" ejecuta fn_wa_lead_reactivation_scan() a las 14:00 UTC',
      'Función busca oportunidades en stage new/contacted, creadas hace >3 días, sin visita futura y sin reactivación en últimos 7 días',
      'Para cada lead calificado: guard inner CONTINUE WHEN protege contra race conditions',
      'INSERT en notification_queue con template booking_link_v1 (nombre, link /v/{short_code}, nombre del comercial)',
      'Retorna el número de leads reactivados como INTEGER para logging',
      'Worker WhatsApp procesa la cola y envía los mensajes a Meta API',
    ],
    notas: 'Usa el template booking_link_v1 que ya está aprobado en Meta (4 envíos históricos). El event_type es "lead.reactivation" para distinguirlo de la bienvenida inicial y aplicar la regla de 7 días correctamente.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Cron de reactivación de leads implementado (migración 045)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/045_wa_lead_reactivation.sql',
    ],
  },

  // ─── 15. ASISTENTE DE CALIFICACIÓN IA ───────────────────────────────────────
  {
    slug: 'asistente-calificacion-ia',
    nombre: 'Asistente de Calificación IA',
    descripcion: 'Cuando el comercial no responde a un lead nuevo en las primeras 2 horas hábiles, el asistente inicia una conversación guiada por WhatsApp para precalificar automáticamente: producto, presupuesto, medidas y urgencia.',
    descripcion_larga: `Los leads más interesados son los que acaban de llegar. Si el comercial tarda horas en responder, ese interés se enfría. El Asistente de Calificación IA actúa como primer filtro inteligente, manteniendo el contacto caliente mientras el equipo está ocupado.

Cuando detecta que un lead lleva más de 2 horas hábiles sin que el comercial haya hecho ningún contacto, el asistente inicia una conversación natural por WhatsApp. A través de 4 o 5 preguntas distribuidas naturalmente en la conversación, el asistente captura la información clave: tipo de proyecto (cocina, closet, etc.), medidas aproximadas del espacio, presupuesto estimado y nivel de urgencia.

Cada respuesta del cliente se procesa con un modelo de lenguaje (LLM) que extrae los datos relevantes y los guarda directamente en los campos de la oportunidad en el CRM. Al final del intercambio, el asistente propone una visita técnica y el comercial recibe una alerta con el resumen de la calificación, listo para continuar desde donde el asistente lo dejó.

El asistente sabe cuándo ceder: si el cliente hace una pregunta técnica específica o solicita hablar con una persona, escala inmediatamente al comercial asignado sin intentar responder lo que no puede.`,
    problema_que_resuelve: 'Los leads que llegan fuera de horario o cuando el equipo está ocupado quedan sin respuesta durante horas. Sin calificación automática, el comercial tiene que empezar desde cero en cada nuevo lead. El Asistente captura la información clave y mantiene el interés activo hasta que el comercial pueda retomar.',
    beneficios: [
      'El lead recibe atención inmediata incluso a las 10pm o un domingo',
      'El comercial recibe la oportunidad ya calificada: producto, presupuesto, urgencia',
      'Reduce el tiempo que el asesor invierte en llamadas de pre-calificación rutinarias',
      'Escalada automática a persona humana cuando el cliente lo pide o la conversación se complica',
      'Propuesta de visita técnica incluida en el mismo intercambio de WhatsApp',
    ],
    casos_de_uso: [
      'Un lead llega a las 9pm. El asistente responde en segundos, captura que el cliente quiere renovar su cocina (~12m²), tiene presupuesto de $15M–$20M y quiere avanzar este mes. A las 8am el comercial tiene todo ese contexto listo.',
      'Un lead llega el lunes a las 10am pero el comercial está en una visita. El asistente lo califica y cuando el comercial termina a la 1pm, el lead ya tiene una visita propuesta para el jueves y sus datos de calificación en el CRM.',
    ],
    metricas: [
      { valor: '2h',   etiqueta: 'Ventana de activación' },
      { valor: '4–5',  etiqueta: 'Preguntas de calificación' },
      { valor: '0',    etiqueta: 'Datos perdidos por falta de respuesta' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Lead sin respuesta 2h', sublabel: 'Horario hábil' },
      { tipo: 'proceso', label: 'Iniciar conversación',  sublabel: 'Saludo IA por WA' },
      { tipo: 'ia',      label: 'Conversación guiada',   sublabel: 'OpenRouter LLM' },
      { tipo: 'proceso', label: 'Guardar en CRM',        sublabel: 'Campos oportunidad' },
      { tipo: 'output',  label: 'Lead calificado',       sublabel: 'Alerta al comercial' },
    ],
    categoria: 'comercial',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Se activa cuando un lead lleva 2 horas hábiles sin respuesta del comercial',
    fuente_datos: 'Supabase — tabla opportunities + interactions + profiles',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Cron o trigger detecta oportunidades en stage "new" con assigned_at < NOW() - INTERVAL \'2h\' y sin interacción del comercial',
      'n8n workflow inicia la conversación enviando el saludo y primera pregunta via Meta API',
      'Webhook de Meta recibe respuesta del cliente y la envía al workflow',
      'OpenRouter LLM procesa la respuesta, extrae datos y genera la siguiente pregunta contextual',
      'Al completar la calificación: UPDATE opportunity con campos product_type, budget_range, urgency_level',
      'Notificación al comercial asignado con resumen de la calificación y propuesta de visita técnica',
    ],
    notas: '3 Edge Functions desplegadas: lead-qualification-detector (detecta leads sin respuesta 2h hábiles), lead-qualification-finalizer (cierra la conversación y actualiza el CRM), lead-qualification-webhook (recibe respuestas de Meta). Bloqueante actual: template Meta lead_qualification_start_v1 pendiente de creación. Requiere también: diseño de las 4-5 preguntas de calificación y lógica de escalada a humano.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Arquitectura definida: n8n + OpenRouter + Meta webhook. Pendiente construcción del workflow.', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: '3 EFs desplegadas (detector, finalizer, webhook). Bloqueante: template lead_qualification_start_v1 pendiente Meta.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/lead-qualification-detector/index.ts',
      'supabase/functions/lead-qualification-finalizer/index.ts',
      'supabase/functions/lead-qualification-webhook/index.ts',
    ],
  },

  // ─── 16. TAREA DE COTIZACIÓN POST-VISITA ────────────────────────────────────
  {
    slug: 'tarea-cotizacion-post-visita',
    nombre: 'Tarea de Cotización Post-Visita',
    descripcion: 'Cuando Álvaro completa una visita técnica, el sistema crea automáticamente una tarea asignada a él para preparar la cotización del cliente en las próximas 48 horas.',
    descripcion_larga: `Después de que Álvaro cierra una visita como "realizada" en el CRM, hay dos cosas que deben ocurrir de inmediato: el cliente debe saber que ya tienen su información, y Álvaro debe tener en su lista de tareas pendientes preparar la cotización.

La migración 028 ya se encarga del primer punto: envía un WhatsApp al cliente confirmando la visita y prometiendo la cotización en 24-48 horas. Esta automatización cubre el segundo: crea instantáneamente una tarea en el módulo de Tareas del CRM, asignada a Álvaro, con prioridad alta y vencimiento en 48 horas.

La tarea incluye el nombre del cliente en el título ("Preparar cotización — [nombre]") para que sea identificable de un vistazo en el tablero Kanban. El sistema usa un guard de idempotencia: si la visita se marca y desmarca por error, solo se crea una tarea, nunca duplicados.

El resultado es que Álvaro sale de la visita, cierra el formulario en el CRM, y en su bandeja ya aparece la tarea de cotización lista para procesar —sin necesidad de crearla manualmente ni de que alguien le recuerde.`,
    problema_que_resuelve: 'Sin automatización, Álvaro tiene que recordar manualmente crear la tarea de cotización después de cada visita. En días con varias visitas, es fácil que alguna se olvide o se demore. El sistema la crea al instante, con el plazo correcto y sin esfuerzo adicional.',
    beneficios: [
      'La tarea de cotización aparece automáticamente en el Kanban de Álvaro al completar la visita',
      'Prioridad alta y vencimiento en 48 horas: alineado con la promesa hecha al cliente por WhatsApp',
      'Guard de idempotencia: imposible que se creen dos tareas para la misma visita',
      'El título incluye el nombre del cliente: fácil de identificar entre múltiples tareas',
      'Cero fricción: Álvaro cierra la visita y su lista de tareas ya está actualizada',
    ],
    casos_de_uso: [
      'Álvaro termina una visita a las 11am y la marca como realizada en el CRM. A las 11:00:03am aparece en su Kanban la tarea "Preparar cotización — María González" con vencimiento en 2 días.',
      'Álvaro tiene 3 visitas en un día. Al cerrar cada una, el sistema crea 3 tareas independientes con los nombres correctos. Al llegar a la oficina el día siguiente, ve exactamente qué cotizaciones debe preparar y en qué orden.',
    ],
    metricas: [
      { valor: '<5s',  etiqueta: 'Creación de la tarea' },
      { valor: '48h',  etiqueta: 'Plazo de vencimiento' },
      { valor: '1',    etiqueta: 'Tarea por visita (idempotente)' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Visita marcada realizada', sublabel: 'Por Álvaro en el CRM' },
      { tipo: 'proceso', label: 'Leer contexto',            sublabel: 'Cliente + oportunidad' },
      { tipo: 'proceso', label: 'Guard dedup',              sublabel: 'tags: visit:{uuid}' },
      { tipo: 'proceso', label: 'Crear tarea',              sublabel: 'Kanban de Álvaro' },
      { tipo: 'output',  label: 'Tarea lista',              sublabel: 'Prioridad alta, 48h' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se marca una visita técnica como realizada',
    fuente_datos: 'Supabase — tablas visits + opportunities + clients',
    canal_salida: ['supabase', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Trigger trg_create_quotation_task_after_visit se activa AFTER UPDATE cuando visits.status cambia a "realizada"',
      'Función fn_create_quotation_task_after_visit lee el cliente y la oportunidad vinculada',
      'Guard verifica que no exista ya una tarea con tag "visit:{visit_uuid}" (idempotencia)',
      'INSERT en tabla tasks: título "Preparar cotización — [cliente]", categoría seguimiento, prioridad alta, vence en 48h',
      'La tarea aparece inmediatamente en el módulo de Tareas del CRM asignada a Álvaro',
    ],
    notas: 'Co-existe con trg_notify_visit_summary_client (migración 028) que envía el WA al cliente en el mismo evento. Ambos triggers son independientes y no se interfieren. Si visited_by es null, usa get_default_visitor() (Álvaro Ríos, uuid 09ca8b37).',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Trigger fn_create_quotation_task_after_visit implementado (migración 046)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/046_task_cotizacion_post_visita.sql',
    ],
  },

  // ─── 17. ADMIN INVITE USER ───────────────────────────────────────────────────
  {
    slug: 'admin-invite-user',
    nombre: 'Invitación de Usuarios al Sistema',
    descripcion: 'Permite al administrador invitar nuevos miembros del equipo al CRM enviando un email de invitación seguro desde Supabase Auth, sin necesidad de crear contraseñas manualmente.',
    descripcion_larga: `Agregar un nuevo miembro al equipo es un proceso que debe ser simple y seguro. La invitación de usuarios usa el sistema de autenticación de Supabase para generar un email con un link de acceso temporal y único.

El admin completa el formulario de invitación en la pantalla de gestión de usuarios: nombre, email y rol (administrador, comercial, diseñador). Al confirmar, la Edge Function admin-invite-user llama a la API de autenticación de Supabase con la service role key para crear el usuario y enviar el email de invitación.

El nuevo miembro recibe el email, hace clic en el link y puede establecer su contraseña directamente. Desde ese momento, su perfil queda vinculado al sistema con el rol correcto y puede acceder al CRM según los permisos que le corresponden.

El flujo es completamente interno: el admin gestiona quién tiene acceso al sistema desde una pantalla del propio CRM, sin necesidad de entrar al dashboard de Supabase ni tocar configuraciones técnicas.`,
    problema_que_resuelve: 'Crear usuarios manualmente en el dashboard de Supabase requiere acceso técnico que no todos los admins tienen. La invitación desde el propio CRM democratiza la gestión de accesos y la hace segura y auditable.',
    beneficios: [
      'El admin puede invitar nuevos miembros del equipo sin acceso técnico a Supabase',
      'Los links de invitación son únicos y de un solo uso, garantizando seguridad',
      'El rol se asigna en el momento de la invitación, no después',
      'El nuevo miembro establece su propia contraseña en el primer acceso',
    ],
    casos_de_uso: [
      'Se contrata un nuevo asesor comercial. El admin lo invita desde el CRM en 30 segundos. El asesor recibe el email, establece su contraseña y empieza a ver sus leads asignados el mismo día.',
      'Un diseñador freelance necesita acceso temporal para revisar especificaciones. El admin lo invita con rol diseñador y acceso limitado a los proyectos relevantes.',
    ],
    metricas: [
      { valor: '<30s', etiqueta: 'Tiempo de invitación' },
      { valor: '1',    etiqueta: 'Uso por link de acceso' },
      { valor: '0',    etiqueta: 'Accesos al dashboard técnico' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Admin invita usuario',  sublabel: 'Formulario CRM' },
      { tipo: 'proceso', label: 'Validar datos',         sublabel: 'Email + rol' },
      { tipo: 'api',     label: 'Supabase Auth API',     sublabel: 'inviteUserByEmail' },
      { tipo: 'output',  label: 'Email de invitación',   sublabel: 'Link único al usuario' },
    ],
    categoria: 'operacional',
    status: 'activa',
    visibilidad: 'visible',
    tipo: 'manual',
    frecuencia: 'Bajo demanda — el admin lo ejecuta cuando necesita agregar un usuario',
    fuente_datos: 'Formulario de invitación en /admin/users',
    canal_salida: ['email', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-05-01T00:00:00Z',
    pasos: [
      'Admin completa el formulario de invitación en /admin/users con email, nombre y rol',
      'Frontend llama a la Edge Function admin-invite-user via supabase.functions.invoke()',
      'Edge Function usa SUPABASE_SERVICE_ROLE_KEY para llamar a supabase.auth.admin.inviteUserByEmail()',
      'Supabase envía el email con el link de invitación único y de un solo uso',
      'Usuario hace clic en el link, establece contraseña y queda con su perfil y rol configurados',
    ],
    notas: '',
    historial: [
      { fecha: '2026-05-01T00:00:00Z', descripcion: 'Edge Function admin-invite-user implementada', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/admin-invite-user/index.ts',
    ],
  },

  // ─── 18. GENERADOR DE BORRADOR DE COTIZACIÓN ────────────────────────────────
  {
    slug: 'generador-borrador-cotizacion',
    nombre: 'Generador de Borrador de Cotización',
    descripcion: 'Cuando la visita técnica se cierra con medidas válidas y ≥3 fotos, el sistema crea automáticamente el borrador de cotización y avanza la oportunidad al stage Cotización.',
    descripcion_larga: `Fase 4 del Motor Comercial: la captura de medidas es el punto de no retorno del proceso. Mientras Álvaro está en el espacio físico del cliente —midiendo dimensiones, registrando conexiones de gas, agua y voltaje, y fotografiando el lugar— el sistema espera con un formulario específico: el VisitMeasurementsForm.

El formulario tiene 6 secciones: Espacio (largo, ancho, alto en cm + forma de cocina), Conexiones (agua, gas, voltaje, desagüe), Estado actual (paredes, piso, si hay que remover mueble existente), Servicios a cotizar (cocina integral, mesones, closets, tv center, puertas, acabados), Notas generales y Fotos.

La validación es automática y sin excepción: el trigger validate_visit_completion bloquea el cierre de la visita si las medidas están vacías o si hay menos de 3 fotos. Es un gate técnico que garantiza calidad del dato antes de avanzar el pipeline.

En el instante que Álvaro hace clic en "Finalizar visita" con todo completo, el trigger trg_visit_auto_quotation ejecuta auto_generate_quotation: crea un registro en la tabla quotations (tipo initial, versión 1, estado draft, vence en 30 días) y avanza la oportunidad de visit_completed a quoted. Álvaro puede abrir el borrador inmediatamente desde el CRM y empezar a completarlo con los precios.`,
    problema_que_resuelve: 'Sin automatización, Álvaro tendría que crear la cotización manualmente desde cero después de cada visita, recordar los datos relevantes y buscar la oportunidad en el sistema. El generador elimina ese paso: cuando sale del apartamento del cliente ya tiene el borrador esperándolo en el CRM.',
    beneficios: [
      'El borrador aparece en el CRM en el instante que se cierra la visita',
      'Imposible olvidar crear la cotización: el sistema lo hace solo',
      'Las medidas y servicios capturados quedan asociados a la cotización',
      'Álvaro solo tiene que revisar y completar precios, no crear desde cero',
      'La oportunidad avanza automáticamente al stage correcto sin intervención manual',
    ],
    casos_de_uso: [
      'Álvaro termina la visita a las 2pm, llena las medidas y sube las fotos. Al regresar a la oficina a las 4pm, el borrador de cotización ya está en el CRM con la oportunidad en stage Cotización, listo para completar con los precios del catálogo.',
      'En una visita larga donde se midieron 4 espacios diferentes (cocina, closets, TV center, puerta), el sistema registra todos los servicios seleccionados en el formulario y los vincula al borrador. Nada se pierde aunque pasen varios días entre la visita y la cotización formal.',
    ],
    metricas: [
      { valor: '<1s',  etiqueta: 'Tiempo de creación del borrador' },
      { valor: '100%', etiqueta: 'Visitas con borrador automático' },
      { valor: '0',    etiqueta: 'Cotizaciones creadas manualmente' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Álvaro completa el form',  sublabel: 'Medidas + ≥3 fotos' },
      { tipo: 'proceso', label: 'Gate de validación',       sublabel: 'validate_visit_completion' },
      { tipo: 'proceso', label: 'Crear borrador',           sublabel: 'quotations: draft v1' },
      { tipo: 'proceso', label: 'Avanzar pipeline',         sublabel: 'visit_completed → quoted' },
      { tipo: 'output',  label: 'Borrador listo',           sublabel: 'Álvaro completa precios' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se cierra una visita técnica como "realizada"',
    fuente_datos: 'Supabase — tablas visits + opportunities + quotations',
    canal_salida: ['supabase', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Álvaro llena el formulario de 6 secciones en /agenda/hoy: dimensiones, conexiones, estado, servicios, notas y ≥3 fotos',
      'Trigger BEFORE validate_visit_completion bloquea si faltan medidas o fotos — el botón "Finalizar visita" queda deshabilitado',
      'Al pasar la validación, useFinishVisit actualiza visits.status = realizada con measurements + photos JSONB',
      'Trigger AFTER trg_visit_auto_quotation ejecuta auto_generate_quotation()',
      'INSERT en quotations: client_id, opportunity_id, status=draft, version=1, type=initial, valid_until=NOW()+30d',
      'UPDATE en opportunities: status = quoted (transición legal: visit_completed → quoted)',
      'Álvaro ve el borrador en el CRM con todos los datos de la visita vinculados',
    ],
    notas: 'El trigger validate_visit_completion también propagó el estado de la oportunidad a visit_completed en el BEFORE. El AFTER trigger trg_visit_auto_quotation la avanza a quoted. Son dos triggers distintos en el mismo evento.',
    historial: [
      { fecha: '2026-05-09T00:00:00Z', descripcion: 'auto_generate_quotation implementado (migración 009/010)', autor: 'Robert Virona' },
      { fecha: '2026-05-23T00:00:00Z', descripcion: 'Fix bug columna created_by inexistente en quotations (migración 017)', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/009_lead_to_project_functions.sql',
      'db/migrations/010_lead_to_project_triggers.sql',
      'db/migrations/017_fix_auto_generate_quotation.sql',
      'src/components/agenda/VisitMeasurementsForm.tsx',
      'src/hooks/agenda/useFinishVisit.ts',
    ],
  },

  // ─── 19. NOTIFICADOR DE INICIO DE FABRICACIÓN ────────────────────────────────
  {
    slug: 'notificador-fabricacion',
    nombre: 'Notificador de Inicio de Fabricación',
    descripcion: 'Cuando el equipo registra el inicio de fabricación en el CRM, el sistema envía automáticamente un WhatsApp al cliente avisándole que su cocina está siendo construida.',
    descripcion_larga: `Una vez que la cotización fue aprobada, el pago verificado y el proyecto creado, llega el momento de fabricar la cocina. El cliente no tiene visibilidad de qué está pasando internamente — este notificador cierra ese silencio.

Cuando el equipo registra la fecha de inicio de fabricación (campo fabrication_started_at en el proyecto), el sistema detecta ese cambio al instante y envía un WhatsApp al cliente con la plantilla fabricacion_iniciada_v1. El mensaje le confirma que su cocina está siendo fabricada y le da el tiempo estimado de entrega.

El cliente recibe tranquilidad, se reduce la cantidad de llamadas de seguimiento al equipo, y la marca proyecta profesionalismo al mantener informado al comprador sin que nadie tenga que recordarlo.`,
    problema_que_resuelve: 'Los clientes no saben qué pasa con su pedido después de aprobar la cotización. Esto genera llamadas de seguimiento innecesarias y ansiedad. El notificador mantiene al cliente informado en el momento exacto en que empieza la producción.',
    beneficios: [
      'El cliente recibe confirmación inmediata cuando empieza la fabricación de su cocina',
      'Reduce llamadas de seguimiento al equipo sobre el estado del pedido',
      'Proyecta profesionalismo y transparencia en el proceso post-venta',
      'No requiere acción manual del equipo — el registro del inicio activa el mensaje',
    ],
    casos_de_uso: [
      'El equipo de producción registra el inicio de fabricación un lunes. El cliente recibe ese mismo día un WhatsApp: "Hola María, hemos comenzado a fabricar tu cocina. El tiempo estimado es de 15 días hábiles." Sin llamadas, sin gestión manual.',
    ],
    metricas: [
      { valor: '<5s', etiqueta: 'Envío tras registrar inicio' },
      { valor: '1',   etiqueta: 'Mensaje por proyecto (idempotente)' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'fabrication_started_at seteado', sublabel: 'Equipo registra inicio en CRM' },
      { tipo: 'proceso', label: 'Trigger DB detecta cambio',       sublabel: 'AFTER UPDATE OF fabrication_started_at' },
      { tipo: 'proceso', label: 'Leer datos del cliente',          sublabel: 'nombre + teléfono WA' },
      { tipo: 'api',     label: 'Encolar notificación WA',         sublabel: 'notification_queue' },
      { tipo: 'output',  label: 'WhatsApp al cliente',             sublabel: 'fabricacion_iniciada_v1' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se registra el inicio de fabricación de un proyecto',
    fuente_datos: 'Supabase — tabla projects (campo fabrication_started_at)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'El equipo registra la fecha de inicio de fabricación en el proyecto del CRM',
      'Trigger AFTER UPDATE OF fabrication_started_at en tabla projects se activa cuando el campo pasa de NULL a NOT NULL',
      'Función lee el nombre y teléfono WA del cliente vinculado al proyecto',
      'Guard de idempotencia: verifica que no se haya enviado ya la notificación para este proyecto',
      'INSERT en notification_queue con template fabricacion_iniciada_v1: {{1}} nombre, {{2}} días estimados',
      'Worker de WA envía el mensaje al cliente vía Meta API',
    ],
    notas: 'Template Meta: fabricacion_iniciada_v1 (parámetros: {{1}} nombre cliente, {{2}} tiempo estimado). Migración 047 aplicada en producción.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Automatización diseñada (Fase 9), migración 047 escrita', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Template fabricacion_iniciada_v1 enviada a Meta para aprobación. Automatización marcada activa.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/047_notificador_fabricacion.sql',
    ],
  },

  // ─── 20. NOTIFICADOR DE INSTALACIÓN PROGRAMADA ───────────────────────────────
  {
    slug: 'notificador-instalacion-programada',
    nombre: 'Notificador de Instalación Programada',
    descripcion: 'Cuando el equipo agenda la fecha de instalación en el CRM, el sistema envía automáticamente un WhatsApp al cliente confirmándole el día exacto en que instalarán su cocina.',
    descripcion_larga: `Una vez que la cocina está fabricada y lista, el equipo coordina la fecha de instalación. Pero ese acuerdo muchas veces queda solo en una llamada sin que el cliente tenga confirmación escrita.

Cuando el equipo registra la fecha de instalación (campo scheduled_install_date), el trigger se activa al instante y envía un WhatsApp al cliente con la plantilla instalacion_programada_v1. El mensaje confirma la fecha de instalación y le recuerda que debe tener el espacio listo.

El cliente tiene la confirmación guardada en su WhatsApp, el equipo no tiene que enviar el mensaje manualmente, y se eliminan los malentendidos sobre la fecha acordada.`,
    problema_que_resuelve: 'Las fechas de instalación se comunican solo verbalmente. Esto genera confusiones, ausencias del cliente el día de la instalación y desplazamientos innecesarios del equipo.',
    beneficios: [
      'El cliente recibe confirmación escrita de la fecha de instalación por WhatsApp',
      'Elimina malentendidos sobre la fecha acordada para la instalación',
      'El equipo no tiene que enviar el mensaje manualmente',
      'El cliente puede preparar el espacio con anticipación',
    ],
    casos_de_uso: [
      'El encargado de producción agenda la instalación para el viernes 20 de junio en el CRM. Inmediatamente el cliente recibe: "Hola María, tu instalación está programada para el viernes 20 de junio de 2026." Sin llamadas adicionales, sin riesgo de olvido.',
    ],
    metricas: [
      { valor: '<5s', etiqueta: 'Envío tras agendar instalación' },
      { valor: '1',   etiqueta: 'Confirmación por proyecto' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'scheduled_install_date seteado', sublabel: 'Equipo agenda instalación en CRM' },
      { tipo: 'proceso', label: 'Trigger DB detecta cambio',       sublabel: 'AFTER UPDATE OF scheduled_install_date' },
      { tipo: 'proceso', label: 'Formatear fecha',                 sublabel: 'DD de mes de YYYY en español' },
      { tipo: 'api',     label: 'Encolar notificación WA',         sublabel: 'notification_queue' },
      { tipo: 'output',  label: 'WhatsApp al cliente',             sublabel: 'instalacion_programada_v1' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se agenda la fecha de instalación de un proyecto',
    fuente_datos: 'Supabase — tabla projects (campo scheduled_install_date)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Equipo registra la fecha de instalación (scheduled_install_date) en el proyecto del CRM',
      'Trigger AFTER UPDATE OF scheduled_install_date en tabla projects se activa cuando el campo pasa de NULL a NOT NULL',
      'Función lee nombre y teléfono WA del cliente + formatea la fecha en español',
      'Guard de idempotencia: verifica que no se haya enviado ya la confirmación para este proyecto',
      'INSERT en notification_queue con template instalacion_programada_v1: {{1}} nombre, {{2}} fecha formateada',
      'Worker de WA envía el mensaje al cliente vía Meta API',
    ],
    notas: 'Template Meta: instalacion_programada_v1 (parámetros: {{1}} nombre cliente, {{2}} fecha en español). Migración 048 aplicada en producción.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Automatización diseñada (Fase 9), migración 048 escrita', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Template instalacion_programada_v1 enviada a Meta para aprobación. Automatización marcada activa.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/048_notificador_instalacion_programada.sql',
    ],
  },

  // ─── 21. RECORDATORIO DÍA DE INSTALACIÓN ─────────────────────────────────────
  {
    slug: 'recordatorio-instalacion',
    nombre: 'Recordatorio Día de Instalación',
    descripcion: 'Cada mañana el sistema revisa si hay instalaciones programadas para ese día y envía automáticamente un recordatorio por WhatsApp al cliente, asegurando que esté listo cuando llegue el equipo.',
    descripcion_larga: `Por bien coordinada que esté la instalación, siempre existe el riesgo de que el cliente se olvide o no tenga el espacio preparado cuando llega el equipo. Este recordatorio elimina ese riesgo sin que nadie tenga que gestionarlo manualmente.

Cada día a las 7:30am (hora Bogotá), el workflow de n8n consulta la base de datos buscando proyectos con scheduled_install_date igual a la fecha de hoy y que aún no estén entregados. Por cada uno que encuentre, envía un WhatsApp al cliente con la plantilla recordatorio_instalacion_v1 recordándole que hoy es el día de su instalación.

Además, el sistema crea una tarea interna en el CRM asignada al diseñador/instalador responsable del proyecto, sirviendo como confirmación interna del trabajo del día.`,
    problema_que_resuelve: 'Los clientes pueden olvidar la fecha de instalación o no tener el espacio listo cuando llega el equipo. Esto genera viajes en vano y reprogramaciones costosas.',
    beneficios: [
      'El cliente recibe recordatorio automático la mañana del día de instalación',
      'El equipo no tiene que llamar manualmente a cada cliente antes de salir',
      'Reduce el riesgo de desplazamientos en vano por cliente ausente o espacio no preparado',
      'Genera una tarea interna de confirmación para el instalador responsable',
    ],
    casos_de_uso: [
      'El equipo tiene 2 instalaciones programadas para hoy. A las 7:30am ambos clientes reciben el recordatorio por WhatsApp. El equipo llega y ambos clientes están esperando con el espacio listo.',
      'Un cliente agendó la instalación hace dos semanas y lo olvidó. El recordatorio llega esa mañana y puede prepararse antes de que llegue el equipo.',
    ],
    metricas: [
      { valor: '7:30am', etiqueta: 'Hora de envío' },
      { valor: '1',      etiqueta: 'Recordatorio por instalación' },
      { valor: '0',      etiqueta: 'Llamadas manuales del equipo' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron 7:30am Bogotá',           sublabel: 'n8n, lunes a sábado' },
      { tipo: 'proceso', label: 'Consultar proyectos de hoy',    sublabel: 'scheduled_install_date = hoy' },
      { tipo: 'decision',label: '¿Hay instalaciones?',           sublabel: 'Si 0 → finalizar' },
      { tipo: 'proceso', label: 'Por cada proyecto',             sublabel: 'Armar mensaje + crear tarea interna' },
      { tipo: 'output',  label: 'WhatsApp al cliente',           sublabel: 'recordatorio_instalacion_v1' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'n8n',
    tipo: 'cron',
    frecuencia: 'Diario a las 7:30am hora Bogotá (lunes a sábado)',
    fuente_datos: 'Supabase — tabla projects (scheduled_install_date = hoy, delivered_at IS NULL)',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: 'CjbwjGdRKyIzWJWq',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Cron n8n se activa cada día a las 7:30am hora Bogotá (lunes a sábado)',
      'Nodo HTTP consulta Supabase: proyectos con scheduled_install_date = CURRENT_DATE y delivered_at IS NULL',
      'Si no hay proyectos, el workflow finaliza sin enviar nada',
      'Por cada proyecto encontrado: leer nombre y teléfono del cliente + designer_id asignado',
      'Encolar WA con template recordatorio_instalacion_v1: {{1}} nombre cliente',
      'INSERT en tabla tasks: "Instalación hoy — [cliente]" asignada al designer_id, vence hoy',
    ],
    notas: 'Template Meta: recordatorio_instalacion_v1 (parámetro: {{1}} nombre cliente). Cron lunes–sábado para cubrir instalaciones en fin de semana. Workflow n8n CjbwjGdRKyIzWJWq activo en producción.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Automatización diseñada (Fase 9), workflow n8n CjbwjGdRKyIzWJWq creado en modo DRY_RUN', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Template recordatorio_instalacion_v1 enviada a Meta para aprobación. Automatización marcada activa.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [],
  },

  // ─── 22. CIERRE AUTOMÁTICO DE PROYECTO ───────────────────────────────────────
  {
    slug: 'cierre-automatico-proyecto',
    nombre: 'Cierre Automático de Proyecto',
    descripcion: 'Cuando el equipo registra la entrega final y el proyecto está completamente pagado, el sistema cierra el proyecto automáticamente, envía un WhatsApp de agradecimiento al cliente y crea una tarea interna para solicitar la reseña.',
    descripcion_larga: `El cierre de un proyecto marca el fin del trabajo, la satisfacción del cliente y el inicio de la relación post-venta. Sin embargo, este cierre muchas veces queda pendiente o se hace de forma inconsistente.

Cuando el equipo registra la fecha de entrega final (campo delivered_at) y el proyecto ya tiene todos sus pagos completos (is_fully_paid = true), el trigger se activa inmediatamente. Primero actualiza el estado del proyecto a "completado". Luego envía un WhatsApp al cliente con la plantilla proyecto_completado_v1 agradeciéndole por confiar en Innovar Cocinas. Finalmente crea una tarea Kanban: "Solicitar reseña — [nombre del cliente]", asignada al responsable del proyecto, con vencimiento en 7 días.

La condición doble (entregado + pagado completamente) evita cerrar proyectos que tengan saldo pendiente.`,
    problema_que_resuelve: 'Los proyectos terminados quedan abiertos en el CRM sin cierre formal, los clientes no reciben reconocimiento por la compra, y el equipo olvida solicitar reseñas que generan nuevos leads.',
    beneficios: [
      'El proyecto se cierra automáticamente cuando se cumplen las condiciones reales (entregado + pagado)',
      'El cliente recibe un mensaje de cierre que refuerza la relación con la marca',
      'El equipo recibe una tarea automática para solicitar la reseña sin tener que recordarlo',
      'Los reportes del CRM muestran proyectos completados reales, no proyectos abiertos olvidados',
    ],
    casos_de_uso: [
      'El equipo marca la entrega de la cocina de María. El proyecto ya estaba completamente pagado. Automáticamente: el CRM cierra el proyecto, María recibe un WhatsApp de agradecimiento, y el responsable recibe la tarea "Solicitar reseña — María González" con 7 días de plazo.',
      'Se entrega un proyecto pero queda un saldo pendiente (is_fully_paid = false). El cierre automático NO se activa — evita cerrar proyectos con deuda pendiente.',
    ],
    metricas: [
      { valor: '<5s',  etiqueta: 'Cierre tras registrar entrega' },
      { valor: '100%', etiqueta: 'Proyectos con reseña solicitada' },
      { valor: '7d',   etiqueta: 'Plazo para solicitar reseña' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'delivered_at seteado',         sublabel: 'Equipo registra entrega final' },
      { tipo: 'proceso', label: 'Verificar condición doble',    sublabel: 'delivered_at NOT NULL AND is_fully_paid' },
      { tipo: 'proceso', label: 'UPDATE projects',              sublabel: 'status → completado' },
      { tipo: 'api',     label: 'Encolar WA agradecimiento',    sublabel: 'proyecto_completado_v1' },
      { tipo: 'output',  label: 'Tarea "Solicitar reseña"',     sublabel: 'Kanban del responsable, 7 días' },
    ],
    categoria: 'comercial',
    status: 'activa',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que se registra la entrega final de un proyecto completamente pagado',
    fuente_datos: 'Supabase — tabla projects (delivered_at + is_fully_paid)',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Equipo registra la fecha de entrega (delivered_at) en el proyecto del CRM',
      'Trigger AFTER UPDATE OF delivered_at, is_fully_paid en tabla projects se activa',
      'Función verifica condición doble: delivered_at IS NOT NULL AND is_fully_paid = true',
      'Guard de idempotencia: si el proyecto ya tiene status = "completado", no hace nada',
      'UPDATE projects SET status = "completado"',
      'Lee nombre, teléfono WA del cliente y nombre del proyecto',
      'INSERT en notification_queue: template proyecto_completado_v1 con {{1}} nombre + {{2}} nombre proyecto',
      'INSERT en tabla tasks: "Solicitar reseña — [cliente]", prioridad normal, vence en 7 días, asignada al created_by del proyecto',
    ],
    notas: 'Template Meta: proyecto_completado_v1 (parámetros: {{1}} nombre cliente, {{2}} nombre proyecto). Condición doble evita cerrar proyectos con pagos pendientes. Migración 049 aplicada en producción.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Automatización diseñada (Fase 9), migración 049 escrita', autor: 'Robert Virona' },
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Template proyecto_completado_v1 enviada a Meta para aprobación. Automatización marcada activa.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/049_cierre_automatico_proyecto.sql',
    ],
  },

  // ─── 23. VIGÍA DE PAGOS ──────────────────────────────────────────────────────
  {
    slug: 'vigia-pagos',
    nombre: 'Vigía de Pagos',
    descripcion: 'Detecta cotizaciones aprobadas sin pago verificado y envía recordatorios automáticos al cliente a los 7 días, y una escalada al administrador a los 14 días. A los 21 días, la cotización vence automáticamente.',
    descripcion_larga: `Cuando un cliente aprueba una cotización pero no envía el comprobante de pago, el tiempo corre. Sin seguimiento automático, muchas cotizaciones aprobadas se enfrían y se pierden.

El Vigía de Pagos opera de fondo todos los días hábiles. Revisa las cotizaciones que están en estado "aprobado" pero sin pago verificado, y actúa según la antigüedad:

A los 7 días, el cliente recibe un WhatsApp amigable recordándole los datos bancarios y el monto del anticipo. A los 14 días, el administrador recibe una alerta de escalada para que intervenga directamente. A los 21 días, la cotización vence automáticamente y el lead queda marcado para reactivación.

Cada acción es idempotente: si el cliente paga antes del recordatorio, el siguiente ciclo no lo encuentra y no envía nada.`,
    problema_que_resuelve: 'Las cotizaciones aprobadas sin pago quedaban en el aire indefinidamente. El equipo no tenía visibilidad de cuáles necesitaban seguimiento urgente, y muchos clientes interesados se perdían por falta de recordatorio.',
    beneficios: [
      'Seguimiento automático sin que el equipo tenga que recordar hacerlo',
      'Escalada a administrador cuando el cliente no responde al primer recordatorio',
      'Vencimiento automático que limpia el pipeline de cotizaciones obsoletas',
      'Cada acción es idempotente — si el cliente paga, los recordatorios se detienen solos',
    ],
    casos_de_uso: [
      'Cliente aprueba cotización el lunes pero no envía comprobante. El jueves siguiente (D+7) recibe un WhatsApp con los datos de pago. Si no paga en otros 7 días, el administrador recibe la alerta de escalada.',
      'Cotización aprobada hace 3 semanas sin pago. El vigía la marca como vencida automáticamente, libera el espacio en el pipeline y la mueve a reactivación.',
    ],
    metricas: [
      { valor: 'D+7',  etiqueta: 'Recordatorio al cliente' },
      { valor: 'D+14', etiqueta: 'Escalada al admin' },
      { valor: 'D+21', etiqueta: 'Vencimiento automático' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron L-V 9am Colombia',        sublabel: 'pg_cron 14:00 UTC' },
      { tipo: 'proceso', label: 'Buscar cotizaciones sin pago',  sublabel: 'status=approved, sin verified payment' },
      { tipo: 'decision', label: 'Antigüedad',                  sublabel: 'D+7 / D+14 / D+21' },
      { tipo: 'api',     label: 'WhatsApp al cliente (D+7)',     sublabel: 'payment_followup_d7_v1' },
      { tipo: 'api',     label: 'Alerta admin (D+14)',           sublabel: 'payment_escalation_d14_v1' },
      { tipo: 'output',  label: 'Vencimiento (D+21)',            sublabel: 'admin_quotation_expired_v1' },
    ],
    categoria: 'comercial',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Lunes a viernes a las 9:00 AM (hora Colombia)',
    fuente_datos: 'Supabase — tablas quotations + payments',
    canal_salida: ['whatsapp', 'interno'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Cron pg_cron dispara la Edge Function vigia-pagos a las 14:00 UTC (L-V)',
      'Consulta cotizaciones con status "aprobado" y sin payment con verification_status="verified"',
      'Clasifica por antigüedad: D+7, D+14, D+21',
      'D+7: INSERT en notification_queue con template payment_followup_d7_v1 al cliente',
      'D+14: INSERT en notification_queue con template payment_escalation_d14_v1 al admin',
      'D+21: UPDATE quotation status → "expired" + INSERT alerta admin con admin_quotation_expired_v1',
    ],
    notas: 'En desarrollo — DRY_RUN activo en Supabase Vault hasta validación con datos reales. Templates Meta en TEMPLATE_REGISTRY: payment_followup_d7_v1 (D+7 cliente), payment_escalation_d14_v1 (D+14 admin), admin_quotation_expired_v1 (D+21 vencimiento).',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'EF desplegada como parte de Agentes Autónomos Capa 01. DRY_RUN=true pendiente validación.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/vigia-pagos/index.ts',
    ],
  },

  // ─── 24. COORDINADOR DE PRODUCCIÓN ──────────────────────────────────────────
  {
    slug: 'coordinador-produccion',
    nombre: 'Coordinador de Producción',
    descripcion: 'Cuando un proyecto entra en producción, envía automáticamente la ficha técnica al taller vía WhatsApp con todos los detalles: nombre del proyecto, cliente, fecha de entrega y listado de ítems.',
    descripcion_larga: `El inicio de la fabricación requiere que el taller tenga exactamente la información correcta en el momento correcto. Un error o un dato faltante en la ficha técnica puede costar horas de trabajo y retrasos en la entrega.

Cuando el equipo cambia el estado de un proyecto a "en producción" en el CRM, el Coordinador de Producción actúa inmediatamente. Lee los datos del proyecto —nombre, cliente, fecha estimada de entrega e ítems de la cotización— y envía una ficha técnica estructurada al número de WhatsApp del taller.

El taller recibe toda la información que necesita para iniciar la fabricación sin tener que buscarla en otro lugar ni esperar que alguien se la envíe manualmente.`,
    problema_que_resuelve: 'El inicio de producción dependía de que alguien enviara manualmente la información al taller, lo que generaba retrasos, errores por datos incompletos y falta de trazabilidad de cuándo empezó cada trabajo.',
    beneficios: [
      'El taller recibe la ficha técnica al instante cuando el proyecto entra a producción',
      'Información completa y estructurada — sin riesgo de datos incompletos o errores de copiado',
      'Trazabilidad automática del momento exacto en que el taller fue notificado',
      'El equipo no necesita recordar enviar la información manualmente',
    ],
    casos_de_uso: [
      'El administrador marca el proyecto "Cocina González" como "en producción". En segundos, el encargado del taller recibe un WhatsApp con el nombre del proyecto, el cliente, la fecha de entrega estimada y el listado de ítems a fabricar.',
    ],
    metricas: [
      { valor: '<5s',   etiqueta: 'Notificación al taller' },
      { valor: '100%',  etiqueta: 'Proyectos con ficha técnica' },
      { valor: '0',     etiqueta: 'Envíos manuales necesarios' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Proyecto → en_produccion',  sublabel: 'UPDATE projects.status' },
      { tipo: 'proceso', label: 'Leer datos del proyecto',   sublabel: 'nombre, cliente, entrega, ítems' },
      { tipo: 'api',     label: 'WhatsApp al taller',        sublabel: 'ficha_taller_v1' },
      { tipo: 'output',  label: 'Taller notificado',         sublabel: 'Ficha técnica estructurada' },
    ],
    categoria: 'operacional',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'webhook',
    frecuencia: 'Cada vez que un proyecto cambia su estado a "en producción"',
    fuente_datos: 'Supabase — tabla projects + quotation_items',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'Trigger en projects detecta cambio de status a "en_produccion"',
      'Edge Function coordinador-produccion lee nombre del proyecto, cliente, fecha de entrega e ítems',
      'Lee workshop_whatsapp desde system_settings (número del taller)',
      'INSERT en notification_queue con template ficha_taller_v1: {{1}}=proyecto {{2}}=cliente {{3}}=entrega {{4}}=items',
    ],
    notas: 'En desarrollo — DRY_RUN activo en Supabase Vault. Requiere configurar workshop_whatsapp en system_settings con el número del taller. Template ficha_taller_v1 en TEMPLATE_REGISTRY (4 parámetros).',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'EF desplegada como parte de Agentes Autónomos Capa 03. DRY_RUN=true pendiente validación.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/coordinador-produccion/index.ts',
    ],
  },

  // ─── 25. ANALISTA DE CONVERSIÓN ─────────────────────────────────────────────
  {
    slug: 'analista-conversion',
    nombre: 'Analista de Conversión',
    descripcion: 'Cada lunes envía al administrador un reporte semanal de KPIs comerciales: leads recibidos, oportunidades abiertas, cotizaciones enviadas, tasa de aprobación y alertas cuando algún indicador está por debajo del umbral.',
    descripcion_larga: `Sin un reporte regular, es fácil perder de vista la salud del embudo de ventas hasta que ya hay un problema grave. El Analista de Conversión actúa como el contador semanal de la operación comercial.

Cada lunes a las 9am, consulta las tablas del CRM de la semana anterior y genera dos mensajes. El primero es el resumen ejecutivo: cuántos leads llegaron, cuántas oportunidades se abrieron, cuántas cotizaciones se enviaron, cuántas se aprobaron y cuál fue la tasa de conversión de la semana.

El segundo mensaje son las alertas: si algún KPI está por debajo del umbral configurado (por ejemplo: menos de 5 leads en la semana, o tasa de aprobación bajo el 30%), el administrador recibe una notificación de alerta con los indicadores en rojo para que pueda actuar a tiempo.`,
    problema_que_resuelve: 'El equipo no tenía visibilidad semanal del desempeño comercial sin revisar manualmente el CRM tabla por tabla. Los problemas del embudo de ventas se detectaban tarde y sin datos concretos.',
    beneficios: [
      'Reporte semanal automático sin trabajo manual de extracción de datos',
      'Alertas proactivas cuando un KPI cae por debajo del umbral',
      'Visibilidad de la tendencia de conversión semana a semana',
      'El administrador llega al lunes con los números listos',
    ],
    casos_de_uso: [
      'El lunes a las 9am el administrador recibe: "Semana del 02/06: 8 leads, 6 oportunidades, 4 cotizaciones, 2 aprobadas (50% conversión)." Seguido de: "Alerta: cotizaciones enviadas por debajo del objetivo (4 vs 6 esperadas)."',
    ],
    metricas: [
      { valor: 'Lunes 9am', etiqueta: 'Entrega del reporte' },
      { valor: '6 KPIs',    etiqueta: 'Indicadores monitoreados' },
      { valor: 'Semanal',   etiqueta: 'Frecuencia' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Lunes 9am',                sublabel: 'n8n cron semanal' },
      { tipo: 'proceso', label: 'Consultar KPIs semana',    sublabel: 'leads, opps, cotiz, pagos' },
      { tipo: 'decision', label: 'Comparar vs umbrales',   sublabel: 'alertas si < threshold' },
      { tipo: 'api',     label: 'WA reporte KPIs',          sublabel: 'reporte_semanal_kpi_v1' },
      { tipo: 'api',     label: 'WA alertas (si aplica)',   sublabel: 'reporte_semanal_alertas_v1' },
    ],
    categoria: 'comercial',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Lunes a las 9:00 AM (hora Colombia)',
    fuente_datos: 'Supabase — tablas opportunities, quotations, payments',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'n8n llama la Edge Function analista-conversion cada lunes a las 9am',
      'Consulta oportunidades, cotizaciones y pagos de los últimos 7 días',
      'Calcula: leads recibidos, oportunidades abiertas, cotizaciones enviadas, aprobadas, tasa de conversión',
      'Compara cada KPI contra los umbrales configurados en system_settings',
      'Envía WhatsApp con template reporte_semanal_kpi_v1 (6 parámetros) al admin',
      'Si hay alertas: envía segundo WhatsApp con template reporte_semanal_alertas_v1',
    ],
    notas: 'En desarrollo — DRY_RUN activo en Supabase Vault. Requiere configurar analista_admin_phone en system_settings. Templates: reporte_semanal_kpi_v1 ({{1-6}}=leads/opps/cotiz/aprobadas/tasa/semana) y reporte_semanal_alertas_v1 ({{1}}=admin, {{2-4}}=alertas).',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'EF desplegada como parte de Agentes Autónomos Capa 05. DRY_RUN=true pendiente validación.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/analista-conversion/index.ts',
    ],
  },

  // ─── 26. MONITOR DE CAPACIDAD ────────────────────────────────────────────────
  {
    slug: 'monitor-capacidad',
    nombre: 'Monitor de Capacidad',
    descripcion: 'Revisa diariamente cuántos proyectos activos hay en producción. Si el número alcanza el umbral amarillo envía una alerta de advertencia; si llega al umbral rojo, envía una alerta de capacidad crítica para que el equipo frene la captación de nuevos proyectos.',
    descripcion_larga: `El taller tiene una capacidad real de producción. Si se aceptan más proyectos de los que puede manejar, la calidad baja, los plazos se incumplen y los clientes se frustran.

El Monitor de Capacidad opera cada mañana antes del inicio de la jornada. Cuenta los proyectos que están actualmente en producción o en entrega (estados "en_produccion" y "entregado") y los compara contra dos umbrales configurados por el negocio.

Si el conteo alcanza el umbral amarillo (advertencia), el administrador recibe una alerta suave para que esté atento. Si alcanza el umbral rojo (crítico), la alerta es de máxima prioridad: el taller está al límite y se debe evaluar si se siguen aceptando nuevos proyectos.

Ambos umbrales son configurables desde system_settings sin necesidad de cambiar código.`,
    problema_que_resuelve: 'Sin visibilidad del volumen de producción activo, el equipo comercial seguía cerrando proyectos aunque el taller estuviera saturado, generando retrasos y problemas de calidad.',
    beneficios: [
      'Alerta temprana (amarilla) antes de llegar a la saturación',
      'Alerta crítica (roja) cuando el taller está al límite de su capacidad',
      'Umbrales configurables desde el sistema sin necesidad de código',
      'Visibilidad diaria del nivel de producción activo',
    ],
    casos_de_uso: [
      'El taller tiene configurado umbral amarillo=6 y umbral rojo=8. El lunes hay 7 proyectos activos: el administrador recibe alerta amarilla. Si cierra 2 proyectos más y llega a 9, recibe alerta roja.',
    ],
    metricas: [
      { valor: 'Diario',    etiqueta: 'Frecuencia de revisión' },
      { valor: '2 niveles', etiqueta: 'Alertas (amarilla / roja)' },
      { valor: 'Config.',   etiqueta: 'Umbrales ajustables' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'Cron 8am Colombia',           sublabel: 'pg_cron 13:00 UTC' },
      { tipo: 'proceso', label: 'Contar proyectos activos',    sublabel: 'en_produccion + entregado' },
      { tipo: 'decision', label: 'Comparar vs umbrales',      sublabel: 'amarillo / rojo' },
      { tipo: 'api',     label: 'WA alerta amarilla',          sublabel: 'alerta_capacidad_amarilla_v1' },
      { tipo: 'api',     label: 'WA alerta roja',              sublabel: 'alerta_capacidad_roja_v1' },
    ],
    categoria: 'operacional',
    status: 'en_desarrollo',
    visibilidad: 'silente',
    tipo: 'cron',
    frecuencia: 'Diariamente a las 8:00 AM (hora Colombia)',
    fuente_datos: 'Supabase — tabla projects (status)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '—',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'pg_cron dispara la Edge Function monitor-capacidad a las 13:00 UTC diariamente',
      'Cuenta proyectos con status IN ("en_produccion", "entregado")',
      'Lee umbrales capacity_yellow_threshold y capacity_red_threshold de system_settings',
      'Si conteo >= umbral amarillo: INSERT notification_queue con alerta_capacidad_amarilla_v1',
      'Si conteo >= umbral rojo: INSERT notification_queue con alerta_capacidad_roja_v1',
    ],
    notas: 'En desarrollo — DRY_RUN activo en Supabase Vault. Requiere configurar capacity_monitor_admin_phone, capacity_yellow_threshold y capacity_red_threshold en system_settings. Templates: alerta_capacidad_amarilla_v1 y alerta_capacidad_roja_v1 ({{1}}=admin {{2}}=count {{3}}=umbral {{4}}=listado).',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'EF desplegada como parte de Agentes Autónomos Capa 05. DRY_RUN=true pendiente validación.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'supabase/functions/monitor-capacidad/index.ts',
    ],
  },

  // ─── 27. RECORDATORIOS DE REUNIONES ─────────────────────────────────────────
  {
    slug: 'recordatorios-de-reuniones',
    nombre: 'Recordatorios de Reuniones',
    descripcion: 'Envía automáticamente dos avisos por WhatsApp antes de cada reunión quincenal: uno el día anterior y otro 2 horas antes. Cubre las 11 reuniones del calendario junio–noviembre 2026.',
    descripcion_larga: `Las reuniones quincenales son el eje del seguimiento comercial y operativo. Olvidar una reunión o entrar sin estar preparado tiene un costo real.

La automatización de recordatorios opera en segundo plano para las 11 reuniones del calendario junio–noviembre 2026. Para cada una, programa dos avisos por WhatsApp: el día anterior a las 6 PM Colombia y el mismo día de la reunión a las 4 PM (2 horas antes del inicio a las 6 PM).

Los 22 mensajes están programados en la base de datos como tareas diferidas. La Edge Function de WhatsApp los despacha automáticamente cuando llega su momento, sin que nadie tenga que hacer nada. Si el calendario cambia, se puede actualizar la función y re-encolar.`,
    problema_que_resuelve: 'Los participantes de las reuniones quincenales no tenían aviso automático, lo que generaba olvidos y falta de preparación. Sin un recordatorio close-in, era fácil que la reunión pasara desapercibida.',
    beneficios: [
      'Dos recordatorios por reunión sin gestión manual (24h + 2h antes)',
      'Los 22 mensajes del semestre están pre-programados — no hay que recordar hacer nada',
      'Se actualiza fácilmente si cambia el calendario: una función SQL re-encola todo',
      'Funciona sobre la misma infraestructura de WhatsApp ya operativa',
    ],
    casos_de_uso: [
      'El 24 de junio a las 6 PM Colombia: Álvaro Ríos recibe "¡Mañana a las 6 PM tienes reunión quincenal!". El 25 de junio a las 4 PM: "Tu reunión de hoy es a las 6 PM — en 2 horas."',
    ],
    metricas: [
      { valor: '11',   etiqueta: 'Reuniones cubiertas (jun–nov)' },
      { valor: '22',   etiqueta: 'Mensajes pre-programados' },
      { valor: '2',    etiqueta: 'Avisos por reunión (24h + 2h)' },
    ],
    flujo_visual: [
      { tipo: 'trigger', label: 'n8n — lunes 8am',             sublabel: 'Safety net semanal' },
      { tipo: 'proceso', label: 'fn_schedule_meeting_reminders', sublabel: 'Encola reuniones futuras' },
      { tipo: 'proceso', label: 'notification_queue',           sublabel: 'scheduled_for: 24h/2h antes' },
      { tipo: 'api',     label: 'WA 24h antes',                 sublabel: 'reunion_recordatorio_24h_v1' },
      { tipo: 'api',     label: 'WA 2h antes',                  sublabel: 'reunion_recordatorio_2h_v1' },
    ],
    categoria: 'notificaciones',
    status: 'activa',
    visibilidad: 'n8n',
    tipo: 'cron',
    frecuencia: 'Lunes a las 8:00 AM Colombia (safety net semanal). Los mensajes individuales se despachan automáticamente en su hora exacta.',
    fuente_datos: 'Supabase — system_settings (teléfono y nombre del receptor)',
    canal_salida: ['whatsapp'],
    n8n_workflow_id: '96BHeN1ZJ3D3zQlN',
    supabase_proyecto: 'xdzbjptozeqcbnaqhtye',
    responsable: 'Robert Virona',
    ultima_revision: '2026-06-09T00:00:00Z',
    pasos: [
      'n8n workflow 96BHeN1ZJ3D3zQlN llama fn_schedule_meeting_reminders() cada lunes (safety net)',
      'La función encola las reuniones futuras con dedup_key — si ya están encoladas, ON CONFLICT DO NOTHING',
      'La EF process-whatsapp-notifications procesa la cola cada minuto',
      'scheduled_for filtra: solo despacha mensajes cuya hora ya llegó',
      'D-1 (6 PM Colombia): envía reunion_recordatorio_24h_v1 ({{1}}=nombre)',
      'Día de la reunión (4 PM Colombia): envía reunion_recordatorio_2h_v1 ({{1}}=nombre {{2}}=hora)',
    ],
    notas: 'Activa — 22 filas encoladas en notification_queue (commit 44f1655, 2026-06-09). Receptor configurado en system_settings.meeting_reminder_recipient_phone. Calendario: 11 reuniones a las 23:00 UTC (6 PM Colombia) cada 2 semanas jun–nov 2026. Migración 051 aplicada.',
    historial: [
      { fecha: '2026-06-09T00:00:00Z', descripcion: 'Migración 051 aplicada. Templates Meta aprobadas. fn_schedule_meeting_reminders(false) ejecutada: 22 filas encoladas.', autor: 'Robert Virona' },
    ],
    rutas_codigo: [
      'db/migrations/051_meeting_reminders.sql',
    ],
  },

];
