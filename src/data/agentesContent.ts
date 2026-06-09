export type AgentPhaseStatus = 'pending' | 'completed' | 'current';
export type AgentStatusType = 'activo' | 'en_disenyo';

export interface AgentPhase {
  id: number;
  label: string;
  detalle: string;
  status: AgentPhaseStatus;
}

export interface AgentRelatedModule {
  label: string;
  path: string;
}

export interface AgentConfigItem {
  label: string;
  value: string;
  description: string;
}

export interface AgentSpec {
  id: string;
  emoji: string;
  nombre: string;
  layer: string;
  layerNumber: string;
  status: AgentStatusType;
  tecnologia: string;
  descripcion: string;
  cuando_se_activa: string;
  que_produce: string;
  nota?: string;
  fases: AgentPhase[];
  modulos_relacionados: AgentRelatedModule[];
  config: AgentConfigItem[];
}

export const AGENTES_SPECS: AgentSpec[] = [
  {
    id: 'calificador-leads-ia',
    emoji: '🤖',
    nombre: 'Calificador de Leads IA',
    layer: 'Adquisición',
    layerNumber: '01',
    status: 'en_disenyo',
    tecnologia: 'n8n + OpenRouter (LLM) + Meta WhatsApp API',
    descripcion: 'Precalifica leads por WhatsApp usando IA conversacional. Detecta producto, presupuesto y urgencia antes de la primera llamada del comercial, ahorrando tiempo y aumentando la tasa de conversión.',
    cuando_se_activa: 'Lead nuevo sin respuesta del comercial en las primeras 2 horas hábiles',
    que_produce: 'Lead precalificado con producto, presupuesto y urgencia capturados en el CRM + alerta al comercial',
    nota: 'Requiere integración con OpenRouter (LLM) y template de WhatsApp aprobado por Meta para iniciar conversaciones proactivas.',
    fases: [
      { id: 1, label: 'Detección de ventana', detalle: 'Verifica que el comercial no haya respondido en las últimas 2h hábiles.', status: 'pending' },
      { id: 2, label: 'Saludo inicial', detalle: 'Envía mensaje de bienvenida y primera pregunta de calificación.', status: 'pending' },
      { id: 3, label: 'Conversación guiada', detalle: 'LLM mantiene el hilo: producto → medidas → presupuesto → urgencia.', status: 'pending' },
      { id: 4, label: 'Guardado en CRM', detalle: 'Actualiza la oportunidad con datos capturados y alerta al comercial.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Leads', path: '/leads' },
    ],
    config: [
      { label: 'Tecnología', value: 'n8n + OpenRouter + WhatsApp', description: 'LLM orquestado por n8n' },
      { label: 'Ventana de activación', value: '2 horas hábiles', description: 'Sin respuesta del comercial' },
      { label: 'Canal', value: 'WhatsApp', description: 'Conversación proactiva IA' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente templates Meta aprobados' },
    ],
  },
  {
    id: 'detector-abandono',
    emoji: '🎯',
    nombre: 'Detector de Abandono',
    layer: 'Adquisición',
    layerNumber: '01',
    status: 'en_disenyo',
    tecnologia: 'Supabase pg_cron + Meta WhatsApp API',
    descripcion: 'Identifica leads sin actividad por más de 5 días y dispara automáticamente una secuencia de rescate al comercial responsable, evitando que oportunidades mueran en silencio.',
    cuando_se_activa: 'Lead activo sin ninguna actividad registrada en los últimos 5 días',
    que_produce: 'Alerta al comercial responsable + tarea de seguimiento creada en CRM',
    fases: [
      { id: 1, label: 'Escaneo de inactividad', detalle: 'Cron diario detecta leads sin actividad en 5+ días.', status: 'pending' },
      { id: 2, label: 'Alerta al comercial', detalle: 'Notificación WhatsApp/in-app al comercial con datos del lead.', status: 'pending' },
      { id: 3, label: 'Creación de tarea', detalle: 'Genera tarea de seguimiento urgente en el CRM.', status: 'pending' },
      { id: 4, label: 'Registro de alerta', detalle: 'Guarda log de la alerta para métricas de abandono.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Leads', path: '/leads' },
      { label: 'Tareas', path: '/tasks' },
    ],
    config: [
      { label: 'Umbral de inactividad', value: '5 días', description: 'Sin actividad registrada' },
      { label: 'Secuencia de rescate', value: 'D+5 / D+10', description: 'Dos alertas escalonadas' },
      { label: 'Canal de alerta', value: 'WhatsApp + CRM', description: 'Comercial responsable' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'orquestador-agenda',
    emoji: '📅',
    nombre: 'Orquestador de Agenda',
    layer: 'Conversión',
    layerNumber: '02',
    status: 'en_disenyo',
    tecnologia: 'Supabase Edge Function + pg_cron + Meta WhatsApp API',
    descripcion: 'Agenda visitas técnicas automáticamente según disponibilidad real del calendario, envía confirmación por WhatsApp y dispara recordatorio 24 horas antes de cada visita.',
    cuando_se_activa: 'Cuando el cliente confirma interés en una visita técnica o el comercial lo agenda manualmente',
    que_produce: 'Slot bloqueado en calendario + WhatsApp de confirmación al cliente + recordatorio programado 24h antes',
    fases: [
      { id: 1, label: 'Consulta de disponibilidad', detalle: 'Verifica slots libres en availability_slots para martes y jueves.', status: 'pending' },
      { id: 2, label: 'Propuesta y confirmación', detalle: 'Propone horario al cliente y espera confirmación.', status: 'pending' },
      { id: 3, label: 'Bloqueo del slot', detalle: 'Reserva el slot seleccionado e impide doble booking.', status: 'pending' },
      { id: 4, label: 'Recordatorio 24h', detalle: 'Cron job envía WhatsApp al cliente la víspera de la visita.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Agenda', path: '/agenda' },
      { label: 'Seguimiento Cotizaciones', path: '/agentes/seguimiento-cotizaciones' },
    ],
    config: [
      { label: 'Días disponibles', value: 'Martes / Jueves', description: 'Según configuración de sala' },
      { label: 'Recordatorio', value: '24 horas antes', description: 'Mensaje automático al cliente' },
      { label: 'Anti doble-booking', value: 'Activo', description: 'Bloqueo en availability_slots' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'vigia-pagos',
    emoji: '💸',
    nombre: 'Vigía de Pagos',
    layer: 'Conversión',
    layerNumber: '02',
    status: 'en_disenyo',
    tecnologia: 'Supabase pg_cron + Meta WhatsApp API',
    descripcion: 'Monitorea pagos pendientes tras la aprobación de una cotización y envía alertas escalonadas al cliente y al comercial en D+1, D+7 y D+14 para acelerar el cierre.',
    cuando_se_activa: 'Cotización aprobada sin registro de pago después de 24 horas',
    que_produce: 'WhatsApp escalonado al cliente (D+1, D+7, D+14) + alerta interna al comercial',
    fases: [
      { id: 1, label: 'Detección D+1', detalle: 'Cotización aprobada sin pago registrado pasadas 24h.', status: 'pending' },
      { id: 2, label: 'Recordatorio amable (D+1)', detalle: 'WhatsApp al cliente con datos bancarios e instrucciones de pago.', status: 'pending' },
      { id: 3, label: 'Seguimiento (D+7)', detalle: 'Segunda alerta al cliente + notificación al comercial.', status: 'pending' },
      { id: 4, label: 'Escalamiento (D+14)', detalle: 'Alerta urgente al comercial para seguimiento manual.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Cotizaciones', path: '/quotations' },
      { label: 'Pagos', path: '/finanzas/pagos' },
    ],
    config: [
      { label: 'Escalamiento', value: 'D+1 / D+7 / D+14', description: 'Tres recordatorios progresivos' },
      { label: 'Destinatarios', value: 'Cliente + Comercial', description: 'Escalado automático' },
      { label: 'Canal', value: 'WhatsApp', description: 'Mensajes personalizados por etapa' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'notificador-proyecto',
    emoji: '📦',
    nombre: 'Notificador de Proyecto',
    layer: 'Entrega',
    layerNumber: '03',
    status: 'en_disenyo',
    tecnologia: 'Supabase Trigger + Meta WhatsApp API',
    descripcion: 'Avisa automáticamente al cliente cuando su proyecto avanza de fase: diseño, materiales, fabricación e instalación. Mantiene al cliente informado sin que el equipo tenga que hacer nada manualmente.',
    cuando_se_activa: 'Cuando un proyecto cambia de fase en el sistema (trigger en tabla projects)',
    que_produce: 'WhatsApp personalizado al cliente con la nueva fase + foto del avance (si está disponible)',
    fases: [
      { id: 1, label: 'Detección de cambio de fase', detalle: 'Trigger en tabla projects detecta actualización de estado.', status: 'pending' },
      { id: 2, label: 'Composición del mensaje', detalle: 'Aplica template según la fase: diseño/materiales/fabricación/instalación.', status: 'pending' },
      { id: 3, label: 'Adjunto de foto (opcional)', detalle: 'Si hay imagen cargada, se adjunta al mensaje WhatsApp.', status: 'pending' },
      { id: 4, label: 'Envío y log', detalle: 'Entrega el WhatsApp y registra en whatsapp_message_log.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Proyectos', path: '/projects' },
    ],
    config: [
      { label: 'Fases notificadas', value: '4 fases', description: 'Diseño → Materiales → Fab. → Inst.' },
      { label: 'Canal', value: 'WhatsApp + foto', description: 'Mensaje con imagen de avance' },
      { label: 'Trigger', value: 'Cambio de estado', description: 'Automático en tabla projects' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'coordinador-produccion',
    emoji: '🔧',
    nombre: 'Coordinador de Producción',
    layer: 'Entrega',
    layerNumber: '03',
    status: 'en_disenyo',
    tecnologia: 'Supabase Edge Function + Meta WhatsApp API',
    descripcion: 'Al iniciar la fabricación, notifica automáticamente al taller con la ficha técnica completa: medidas exactas, materiales, acabados y fecha comprometida de entrega.',
    cuando_se_activa: 'Cuando un proyecto pasa al estado "En Fabricación" en el sistema',
    que_produce: 'Ficha técnica completa enviada al taller vía WhatsApp + fecha comprometida registrada',
    fases: [
      { id: 1, label: 'Detección de inicio de fabricación', detalle: 'Trigger detecta cambio de estado a "En Fabricación".', status: 'pending' },
      { id: 2, label: 'Generación de ficha técnica', detalle: 'Compila medidas, materiales, acabados y fecha de entrega del proyecto.', status: 'pending' },
      { id: 3, label: 'Notificación al taller', detalle: 'Envía ficha técnica al número del taller vía WhatsApp.', status: 'pending' },
      { id: 4, label: 'Registro de fecha compromiso', detalle: 'Guarda la fecha de entrega comprometida en el proyecto.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Proyectos', path: '/projects' },
      { label: 'Notificador de Proyecto', path: '/agentes/notificador-proyecto' },
    ],
    config: [
      { label: 'Trigger', value: 'Estado "En Fabricación"', description: 'Cambio automático en proyecto' },
      { label: 'Destinatario', value: 'Taller de producción', description: 'Número configurado en ajustes' },
      { label: 'Contenido', value: 'Ficha técnica completa', description: 'Medidas + materiales + fecha' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'asistente-postventa',
    emoji: '⭐',
    nombre: 'Asistente de Postventa',
    layer: 'Retención',
    layerNumber: '04',
    status: 'en_disenyo',
    tecnologia: 'Supabase Trigger + Meta WhatsApp API',
    descripcion: 'Al entregar un proyecto, dispara automáticamente una encuesta de satisfacción NPS, comparte información de garantía y solicita un referido personalizado al cliente.',
    cuando_se_activa: 'Cuando un proyecto se marca como "Entregado" en el sistema',
    que_produce: 'Encuesta NPS enviada por WhatsApp + info de garantía + solicitud de referido personalizada',
    fases: [
      { id: 1, label: 'Detección de entrega', detalle: 'Trigger detecta proyecto marcado como "Entregado".', status: 'pending' },
      { id: 2, label: 'Encuesta de satisfacción NPS', detalle: 'Envía WhatsApp con link de encuesta de satisfacción (1-10).', status: 'pending' },
      { id: 3, label: 'Información de garantía', detalle: 'Comparte términos de garantía y contacto de soporte.', status: 'pending' },
      { id: 4, label: 'Solicitud de referido', detalle: 'Mensaje personalizado pidiendo recomendación a amigos o familia.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Proyectos', path: '/projects' },
      { label: 'Reactivador de Clientes', path: '/agentes/reactivador-clientes' },
      { label: 'Clientes', path: '/clients' },
    ],
    config: [
      { label: 'Trigger', value: 'Proyecto entregado', description: 'Estado "Entregado" en sistema' },
      { label: 'Secuencia', value: '3 mensajes', description: 'NPS → Garantía → Referido' },
      { label: 'Canal', value: 'WhatsApp', description: 'Mensajes separados por 24h' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'reactivador-clientes',
    emoji: '🔄',
    nombre: 'Reactivador de Clientes',
    layer: 'Retención',
    layerNumber: '04',
    status: 'en_disenyo',
    tecnologia: 'Supabase pg_cron + Meta WhatsApp API',
    descripcion: 'A los 9 meses de un proyecto entregado, contacta automáticamente al cliente para explorar una remodelación adicional o solicitar un referido activo, maximizando el valor de vida del cliente.',
    cuando_se_activa: 'Cron mensual — 9 meses después de la fecha de entrega de cada proyecto',
    que_produce: 'WhatsApp personalizado al cliente con propuesta de re-engagement o solicitud de referido',
    fases: [
      { id: 1, label: 'Escaneo mensual', detalle: 'Cron detecta proyectos entregados hace exactamente 9 meses.', status: 'pending' },
      { id: 2, label: 'Selección de template', detalle: 'Elige entre template de remodelación o de referido según historial.', status: 'pending' },
      { id: 3, label: 'Envío personalizado', detalle: 'WhatsApp con nombre del proyecto y oferta personalizada.', status: 'pending' },
      { id: 4, label: 'Registro de intento', detalle: 'Log del contacto en el perfil del cliente para métricas de retención.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Asistente de Postventa', path: '/agentes/asistente-postventa' },
      { label: 'Clientes', path: '/clients' },
      { label: 'Proyectos', path: '/projects' },
    ],
    config: [
      { label: 'Ciclo', value: '9 meses post-entrega', description: 'Cron mensual automático' },
      { label: 'Objetivo', value: 'Re-engagement + referidos', description: 'Doble propósito' },
      { label: 'Canal', value: 'WhatsApp', description: 'Mensaje personalizado' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'analista-conversion',
    emoji: '📈',
    nombre: 'Analista de Conversión',
    layer: 'Inteligencia',
    layerNumber: '05',
    status: 'en_disenyo',
    tecnologia: 'Supabase pg_cron + n8n + Meta WhatsApp API',
    descripcion: 'Genera un reporte semanal automático por WhatsApp: tasa Lead→Cotización→Aprobación, tiempo promedio por fase y cuellos de botella del pipeline comercial.',
    cuando_se_activa: 'Cron semanal — todos los lunes a las 8:00 AM',
    que_produce: 'Reporte semanal en WhatsApp con KPIs del pipeline: conversión por fase, tiempos y alertas de cuello de botella',
    fases: [
      { id: 1, label: 'Cálculo de métricas', detalle: 'Consulta DB: leads nuevos, cotizaciones enviadas, aprobaciones de la semana anterior.', status: 'pending' },
      { id: 2, label: 'Detección de cuellos de botella', detalle: 'Identifica fases con tiempo promedio superior al umbral.', status: 'pending' },
      { id: 3, label: 'Composición del reporte', detalle: 'Formatea métricas en texto estructurado para WhatsApp.', status: 'pending' },
      { id: 4, label: 'Envío al equipo', detalle: 'Entrega el reporte al gerente y comerciales cada lunes.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Motor Comercial', path: '/motor-comercial' },
      { label: 'Monitor de Capacidad', path: '/agentes/monitor-capacidad' },
      { label: 'Leads', path: '/leads' },
    ],
    config: [
      { label: 'Frecuencia', value: 'Cada lunes 8:00 AM', description: 'Reporte de la semana anterior' },
      { label: 'Métricas', value: 'Conversión x fase', description: 'Lead → Cotización → Aprobación' },
      { label: 'Canal', value: 'WhatsApp', description: 'Reporte al gerente y equipo' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
  {
    id: 'monitor-capacidad',
    emoji: '⚡',
    nombre: 'Monitor de Capacidad',
    layer: 'Inteligencia',
    layerNumber: '05',
    status: 'en_disenyo',
    tecnologia: 'Supabase pg_cron + Meta WhatsApp API',
    descripcion: 'Cruza los proyectos activos vs. la capacidad real del taller y alerta con anticipación cuando hay riesgo de saturar producción, previniendo retrasos antes de que ocurran.',
    cuando_se_activa: 'Cron diario — revisa carga del taller vs. capacidad configurada',
    que_produce: 'Alerta proactiva al gerente cuando la carga supera el 80% de capacidad del taller',
    fases: [
      { id: 1, label: 'Cálculo de carga activa', detalle: 'Cuenta proyectos en fabricación e instalación activos.', status: 'pending' },
      { id: 2, label: 'Comparación con capacidad', detalle: 'Contrasta con capacidad máxima configurada del taller.', status: 'pending' },
      { id: 3, label: 'Evaluación de riesgo', detalle: 'Si carga > 80%, genera alerta; si > 100%, alerta crítica.', status: 'pending' },
      { id: 4, label: 'Notificación al gerente', detalle: 'WhatsApp con carga actual, proyectos en cola y fecha estimada de liberación.', status: 'pending' },
    ],
    modulos_relacionados: [
      { label: 'Analista de Conversión', path: '/agentes/analista-conversion' },
      { label: 'Proyectos', path: '/projects' },
      { label: 'Motor Comercial', path: '/motor-comercial' },
    ],
    config: [
      { label: 'Umbral de alerta', value: '80% de capacidad', description: 'Configurable en ajustes' },
      { label: 'Umbral crítico', value: '100% de capacidad', description: 'Alerta urgente al gerente' },
      { label: 'Frecuencia', value: 'Diario', description: 'Revisión automática de carga' },
      { label: 'Estado', value: 'En diseño', description: 'Pendiente de construcción' },
    ],
  },
];

export function getAgentById(id: string): AgentSpec | undefined {
  return AGENTES_SPECS.find((a) => a.id === id);
}
