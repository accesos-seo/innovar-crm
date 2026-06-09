export type PhaseStatus = 'completed' | 'current' | 'pending' | 'error';
export type AgentStatus = 'activo' | 'standby' | 'en_desarrollo';

export interface MotorPhase {
  id: number;
  label: string;
  detalle: string;
  status: PhaseStatus;
}

export interface MotorAgente {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string;
  cuando_se_activa: string;
  que_produce: string;
  status: AgentStatus;
  tecnologia: string;
  fases: MotorPhase[];
}

export interface StepDef {
  step: number;
  label: string;
  color: string;
  bg: string;
}

export const motorComercialSteps: StepDef[] = [
  { step: 1, label: 'Captura',     color: 'text-slate-300',   bg: 'bg-slate-800 border-slate-600' },
  { step: 2, label: 'Contacto',    color: 'text-violet-400',  bg: 'bg-violet-900/30 border-violet-600/50' },
  { step: 3, label: 'Visita',      color: 'text-violet-400',  bg: 'bg-violet-900/30 border-violet-600/50' },
  { step: 4, label: 'Medidas',     color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/40' },
  { step: 5, label: 'Cotización',  color: 'text-blue-400',    bg: 'bg-blue-900/20 border-blue-700/40' },
  { step: 6, label: 'Aprobación',  color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-700/40' },
  { step: 7, label: 'Pago',        color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-700/40' },
  { step: 8, label: 'Proyecto',    color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/40' },
  { step: 9, label: 'Producción',  color: 'text-green-400',   bg: 'bg-green-900/20 border-green-700/40' },
];

export const motorComercialAgentes: MotorAgente[] = [
  {
    id: 'receptor-leads',
    nombre: 'Receptor de Leads',
    emoji: '🎯',
    descripcion: 'Captura leads de todos los canales (web, WhatsApp, referidos, sala de exhibición), crea el registro automáticamente y asigna el comercial principal. Es el punto de entrada del pipeline.',
    cuando_se_activa: 'Cada vez que llega un lead nuevo desde cualquier canal',
    que_produce: 'Lead registrado + oportunidad creada + comercial asignado (Álvaro Ríos) + slot de visita propuesto',
    status: 'activo',
    tecnologia: 'Supabase Edge Function + Trigger PostgreSQL',
    fases: [
      { id: 1, label: 'Recepción del lead',      detalle: 'Detecta el evento de llegada desde el canal de origen.', status: 'completed' },
      { id: 2, label: 'Creación de registro',    detalle: 'Inserta lead en DB con estado "Nuevo" y crea oportunidad vinculada.', status: 'completed' },
      { id: 3, label: 'Asignación a Álvaro Ríos', detalle: 'Asigna automáticamente al comercial principal configurado en el sistema.', status: 'completed' },
      { id: 4, label: 'Propuesta de agenda',     detalle: 'Calcula el próximo slot disponible (mar/jue) y lo incluye en la bienvenida.', status: 'completed' },
    ],
  },
  {
    id: 'notificador-bienvenida',
    nombre: 'Notificador de Bienvenida',
    emoji: '📲',
    descripcion: 'Envía el WhatsApp de bienvenida al lead con el nombre del comercial asignado y la fecha de visita sugerida. Es el primer toque automático del sistema.',
    cuando_se_activa: 'Inmediatamente después de que el Receptor de Leads asigna el comercial',
    que_produce: 'WhatsApp entregado al lead con datos del comercial y fecha propuesta de visita',
    status: 'activo',
    tecnologia: 'Supabase Edge Function + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Lectura de contexto',      detalle: 'Lee datos del lead: nombre, comercial asignado, slot de visita propuesto.', status: 'completed' },
      { id: 2, label: 'Composición del mensaje',  detalle: 'Aplica template aprobado con variables personalizadas del lead.', status: 'completed' },
      { id: 3, label: 'Envío por WhatsApp',       detalle: 'Llama a Meta API y registra el mensaje en whatsapp_message_log.', status: 'completed' },
    ],
  },
  {
    id: 'agendador-visitas',
    nombre: 'Agendador de Visitas',
    emoji: '📅',
    descripcion: 'Gestiona el ciclo completo de agendamiento: confirma la fecha con el cliente, bloquea el slot en el calendario, envía confirmación y dispara el recordatorio 24h antes de la visita.',
    cuando_se_activa: 'Cuando el cliente confirma la fecha o el comercial agenda manualmente',
    que_produce: 'Slot bloqueado + WhatsApp de confirmación + recordatorio programado 24h antes',
    status: 'activo',
    tecnologia: 'Supabase Edge Function + pg_cron + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Confirmación del cliente',  detalle: 'Detecta respuesta del cliente o acción manual del comercial.', status: 'completed' },
      { id: 2, label: 'Bloqueo del slot',           detalle: 'Reserva el slot en availability_slots para la fecha confirmada.', status: 'completed' },
      { id: 3, label: 'WhatsApp de confirmación',   detalle: 'Envía fecha, hora y nombre del visitador al lead.', status: 'completed' },
      { id: 4, label: 'Recordatorio 24h',           detalle: 'Programa job cron que dispara WhatsApp el día anterior a la visita.', status: 'completed' },
    ],
  },
  {
    id: 'gestor-post-visita',
    nombre: 'Gestor Post-Visita',
    emoji: '📋',
    descripcion: 'Cuando Álvaro cierra una visita como realizada, el sistema actúa en dos frentes: envía WhatsApp al cliente confirmando la recepción, y crea automáticamente la tarea de cotización en el Kanban de Álvaro.',
    cuando_se_activa: 'Inmediatamente cuando Álvaro marca una visita como "realizada" en el CRM',
    que_produce: 'WhatsApp al cliente confirmando la visita + tarea "Preparar cotización" en el Kanban con prioridad alta y 48h de plazo',
    status: 'activo',
    tecnologia: 'PostgreSQL Triggers × 2 (trg_notify_visit_summary_client + trg_create_quotation_task_after_visit)',
    fases: [
      { id: 1, label: 'Detección de cierre',    detalle: 'Álvaro cambia el estado de la visita a "realizada" desde /agenda/hoy.', status: 'completed' },
      { id: 2, label: 'WA al cliente',           detalle: 'Encola mensaje con template visit_summary_client_v1: "ya tenemos tu información, cotización en 24-48h".', status: 'completed' },
      { id: 3, label: 'Guard dedup',             detalle: 'Verifica que no exista ya una tarea con tag visit:{uuid} para esta visita.', status: 'completed' },
      { id: 4, label: 'Tarea en Kanban',         detalle: 'Crea tarea "Preparar cotización — [cliente]" asignada a Álvaro, prioridad alta, vence en 48h.', status: 'completed' },
    ],
  },
  {
    id: 'monitor-inactividad',
    nombre: 'Monitor de Inactividad',
    emoji: '💤',
    descripcion: 'Escanea diariamente todos los leads activos. Si detecta 30 días sin actividad los marca como Dormido; a los 60 días los cierra como Perdido. Mantiene el pipeline limpio sin intervención humana.',
    cuando_se_activa: 'Job diario a medianoche — revisa todos los leads con última actividad vencida',
    que_produce: 'Cambios automáticos de estado: En contacto → Dormido (30d) → Perdido (60d)',
    status: 'activo',
    tecnologia: 'Supabase Scheduled Function (pg_cron)',
    fases: [
      { id: 1, label: 'Escaneo diario',          detalle: 'Consulta oportunidades sin actividad en los últimos 30 días.', status: 'completed' },
      { id: 2, label: 'Marcado como Dormido',    detalle: 'Actualiza estado a dormido y registra motivo en audit_log.', status: 'completed' },
      { id: 3, label: 'Marcado como Perdido',    detalle: 'A los 60 días dormido, cierra la oportunidad como perdida.', status: 'completed' },
    ],
  },
  {
    id: 'gestor-cotizaciones',
    nombre: 'Gestor de Cotizaciones',
    emoji: '📄',
    descripcion: 'Envía el link único de cotización al cliente, gestiona las tres respuestas posibles (aprobar, rechazar, pedir ajustes) y controla la expiración automática a los 30 días.',
    cuando_se_activa: 'Cuando el admin o diseñador marca la cotización como lista para enviar',
    que_produce: 'Link único de cotización activo enviado por WhatsApp + estado actualizado en el sistema',
    status: 'activo',
    tecnologia: 'Supabase Edge Function + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Generación del link',    detalle: 'Crea token único y registra en quotations con status "enviada".', status: 'completed' },
      { id: 2, label: 'Envío por WhatsApp',     detalle: 'Notifica al cliente con link público de cotización.', status: 'completed' },
      { id: 3, label: 'Gestión de respuesta',   detalle: 'Detecta aprobación, rechazo o solicitud de ajustes y actualiza estado.', status: 'completed' },
      { id: 4, label: 'Expiración automática',  detalle: 'Cron job marca cotizaciones sin respuesta como expiradas a los 30 días.', status: 'completed' },
    ],
  },
  {
    id: 'notificador-comprobante',
    nombre: 'Notificador de Comprobante',
    emoji: '🔔',
    descripcion: 'Detecta cuando el cliente sube la foto del comprobante de pago en el portal público y notifica al admin para que lo verifique contra la cuenta bancaria real.',
    cuando_se_activa: 'Cuando el cliente hace upload del comprobante en el portal de cotización',
    que_produce: 'WhatsApp al admin con alerta de comprobante pendiente de verificación',
    status: 'activo',
    tecnologia: 'Supabase Storage + Edge Function + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Detección del upload',   detalle: 'Storage trigger detecta nuevo archivo en el bucket de comprobantes.', status: 'completed' },
      { id: 2, label: 'Registro en payments',   detalle: 'Crea fila en tabla payments con status "pendiente_verificacion".', status: 'completed' },
      { id: 3, label: 'Alerta al admin',         detalle: 'Envía WhatsApp al admin con acceso al comprobante para verificar.', status: 'completed' },
    ],
  },
  {
    id: 'conversor-proyecto',
    nombre: 'Conversor a Proyecto',
    emoji: '✅',
    descripcion: 'El agente más crítico del pipeline: cuando el admin verifica el pago, ejecuta en secuencia la creación del proyecto, bloqueo de cotización, asignación del diseñador, WhatsApps de confirmación y generación del PDF inmutable.',
    cuando_se_activa: 'Cuando el admin marca el pago como Verificado en el sistema',
    que_produce: 'Proyecto activo + cotización bloqueada + PDF generado + WhatsApps a cliente y diseñador',
    status: 'activo',
    tecnologia: 'Supabase Edge Function + PDF generation queue + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Verificación del pago',     detalle: 'Admin confirma el comprobante; trigger actualiza payments a "verificado".', status: 'completed' },
      { id: 2, label: 'Creación del proyecto',     detalle: 'INSERT en projects vinculado a la cotización aprobada.', status: 'completed' },
      { id: 3, label: 'Bloqueo de cotización',     detalle: 'Quotation queda inmutable: no se puede editar ni cancelar.', status: 'completed' },
      { id: 4, label: 'Asignación del diseñador',  detalle: 'Asigna a Álvaro Ríos y registra fecha de inicio de proyecto.', status: 'completed' },
      { id: 5, label: 'Notificaciones',            detalle: 'WhatsApp al cliente ("tu proyecto ha comenzado") y al diseñador. Trigger automático activa la Bienvenida al Proyecto.', status: 'completed' },
      { id: 6, label: 'Generación del PDF',        detalle: 'Encola job en pdf_generation_queue para crear el PDF inmutable.', status: 'completed' },
    ],
  },
  {
    id: 'seguimiento-cotizacion',
    nombre: 'Agente de Seguimiento D+3/D+7',
    emoji: '📊',
    descripcion: 'Monitorea cotizaciones enviadas que no han tenido respuesta y dispara recordatorios inteligentes en el día 3 y día 7. Reduce las cotizaciones que mueren en silencio sin costo humano.',
    cuando_se_activa: 'Cotización enviada sin apertura ni respuesta pasadas 72 horas',
    que_produce: 'WhatsApp de seguimiento D+3/D+7 al cliente + alerta interna al comercial',
    status: 'en_desarrollo',
    tecnologia: 'n8n + Supabase + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Detección D+3',           detalle: 'Cron detecta cotizaciones enviadas hace 72h sin respuesta del cliente.', status: 'pending' },
      { id: 2, label: 'Recordatorio al cliente',  detalle: 'Envía WhatsApp con link de cotización y mensaje de seguimiento.', status: 'pending' },
      { id: 3, label: 'Alerta al comercial',      detalle: 'Si a D+7 sigue sin respuesta, notifica al comercial para seguimiento manual.', status: 'pending' },
    ],
  },
  {
    id: 'bienvenida-proyecto',
    nombre: 'Bienvenida al Proyecto',
    emoji: '🎉',
    descripcion: 'Cuando se crea un proyecto activo, envía automáticamente un WhatsApp al cliente con el nombre del proyecto y el diseñador asignado. Primer toque del equipo de diseño.',
    cuando_se_activa: 'Inmediatamente después de que el Conversor a Proyecto crea el proyecto activo',
    que_produce: 'WhatsApp personalizado al cliente presentando su proyecto y diseñador asignado',
    status: 'activo',
    tecnologia: 'PostgreSQL Trigger + Supabase notification_queue + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Detección de proyecto nuevo', detalle: 'Trigger trg_wa_project_welcome se activa en el INSERT de la tabla projects.', status: 'completed' },
      { id: 2, label: 'Lectura de contexto',          detalle: 'Lee nombre del cliente, nombre del proyecto y diseñador asignado.', status: 'completed' },
      { id: 3, label: 'Guard dedup',                  detalle: 'Verifica que no exista ya un mensaje project.created para este proyecto.', status: 'completed' },
      { id: 4, label: 'Encolar WhatsApp',             detalle: 'INSERT en notification_queue funcional. Template proyecto_iniciado_v1 pendiente de crear en Meta BM (acción pendiente de Robert).', status: 'completed' },
    ],
  },
  {
    id: 'reactivacion-leads',
    nombre: 'Reactivación de Leads',
    emoji: '🔄',
    descripcion: 'Detecta leads con más de 3 días sin visita agendada y les reenvía el link de agendamiento por WhatsApp. Recupera oportunidades que se enfriaron antes de confirmar.',
    cuando_se_activa: 'Cron diario a las 9am COT — escanea todos los leads nuevos/contactados sin visita futura',
    que_produce: 'WhatsApp con link de agendamiento para cada lead calificado (máx. 1 por semana)',
    status: 'activo',
    tecnologia: 'pg_cron + PostgreSQL Function + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Escaneo diario',              detalle: 'Busca leads en stage new/contacted con más de 3 días sin visita agendada.', status: 'completed' },
      { id: 2, label: 'Filtro anti-spam',            detalle: 'Excluye leads que ya recibieron reactivación en los últimos 7 días.', status: 'completed' },
      { id: 3, label: 'Guard anti-race-condition',   detalle: 'Verificación interna antes de cada INSERT para proteger contra doble ejecución.', status: 'completed' },
      { id: 4, label: 'Envío del link',              detalle: 'Encola mensaje con template booking_link_v1 (aprobado) con link /v/{short_code}.', status: 'completed' },
    ],
  },
  {
    id: 'asistente-calificacion',
    nombre: 'Asistente de Calificación IA',
    emoji: '🤖',
    descripcion: 'Agente con IA que califica leads por WhatsApp sin intervención humana: detecta producto, presupuesto, medidas y urgencia. Libera al comercial de llamadas de precalificación.',
    cuando_se_activa: 'Lead nuevo sin respuesta del comercial en las primeras 2 horas hábiles',
    que_produce: 'Lead precalificado con producto, presupuesto y urgencia capturados en el CRM',
    status: 'en_desarrollo',
    tecnologia: 'n8n + OpenRouter (LLM) + Meta WhatsApp API',
    fases: [
      { id: 1, label: 'Detección de ventana',   detalle: 'Verifica que el comercial no haya respondido en las últimas 2h hábiles.', status: 'pending' },
      { id: 2, label: 'Saludo inicial',          detalle: 'Envía mensaje de bienvenida y primera pregunta de calificación.', status: 'pending' },
      { id: 3, label: 'Conversación guiada',     detalle: 'LLM mantiene el hilo: producto → medidas → presupuesto → urgencia.', status: 'pending' },
      { id: 4, label: 'Guardado en CRM',         detalle: 'Actualiza la oportunidad con datos capturados y alerta al comercial.', status: 'pending' },
    ],
  },
];
