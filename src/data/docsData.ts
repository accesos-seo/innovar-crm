const NOW = new Date().toISOString();

export interface DocsItem {
  id: string;
  category: 'habilidades' | 'automatizaciones';
  title: string;
  description: string;
  status: 'activo' | 'pausado' | 'en_desarrollo';
  features: string[] | null;
  sort_order: number;
  last_updated_at: string;
  route?: string | null;
}

export const habilidadesData: DocsItem[] = [
  {
    id: 'skill-arnes', category: 'habilidades', title: '/arnes', status: 'activo',
    description: 'Genera el protocolo de un proyecto nuevo o existente para que cualquier agente de IA lo entienda desde el primer dia. Crea un mapa del repositorio con las reglas, los atajos y los criterios de "terminado".',
    features: ['Genera AGENTS.md y CHECKPOINTS.md', 'Funciona en proyectos nuevos y existentes', 'Aplica los estandares de la agencia', 'Encadena con /optimizar-doc al finalizar'],
    sort_order: 100, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-borrow', category: 'habilidades', title: '/borrow', status: 'activo',
    description: 'Extrae un patron o solucion de un proyecto anterior y lo adapta al proyecto actual, sin copiar codigo literalmente. Entiende por que funciona en el origen y lo reescribe para que encaje bien en el destino.',
    features: ['Localiza el patron en el proyecto fuente', 'Adapta, no copia literal', 'Verifica que funcione antes de declarar exito', 'Reporta que se cambio y por que'],
    sort_order: 101, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-crear-tarea', category: 'habilidades', title: '/crear-tarea', status: 'activo',
    description: 'Registra una tarea en el sistema del proyecto (solo el registro, sin documento). Ideal para anotar trabajo pendiente que aparezca en el dashboard sin necesitar ficha de ejecucion.',
    features: ['Crea la tarea en Supabase del proyecto', 'Sin generar documento en Drive', 'Primer eslabon de la cadena de tareas', 'Compatible con cualquier proyecto configurado'],
    sort_order: 102, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-deploy-check', category: 'habilidades', title: '/deploy-check', status: 'activo',
    description: 'Verifica que todo este en orden antes de publicar cambios a produccion. Revisa puntos clave — build, variables de entorno, errores de TypeScript, rutas, seguridad — para evitar sorpresas despues del lanzamiento.',
    features: ['Checklist Vercel (frontend)', 'Checklist Supabase (backend)', 'Reporta PASS / FAIL / SKIP por item', 'Bloquea el deploy si hay fallos criticos'],
    sort_order: 103, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-diagnose', category: 'habilidades', title: '/diagnose', status: 'activo',
    description: 'Analiza y diagnostica errores o problemas complejos paso a paso, en seis fases, para encontrar la causa raiz antes de tocar el codigo. Evita arreglar el sintoma equivocado.',
    features: ['6 fases estructuradas de diagnostico', 'Identifica la causa raiz, no el sintoma', 'Util para bugs, comportamientos inesperados y errores de produccion', 'Genera un plan de accion claro'],
    sort_order: 104, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-documento-master', category: 'habilidades', title: '/documento-master', status: 'activo',
    description: 'Genera un documento unico con todas las tareas pendientes del proyecto, lo sube a Google Drive y entrega un enlace listo para compartir con el gerente.',
    features: ['Consolida todas las tareas abiertas', 'Sube a Google Drive como doc publico', 'Link estable que no cambia al actualizar', 'Ideal para seguimiento gerencial sin entrar al software'],
    sort_order: 105, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-grill-me', category: 'habilidades', title: '/grill-me', status: 'activo',
    description: 'Hace preguntas profundas sobre un plan o diseno hasta asegurarse de que esta bien pensado. Ideal para validar una idea antes de empezar a construirla y descubrir huecos antes de que sean problemas.',
    features: ['Interroga cada decision de diseno', 'Resuelve ramas del arbol de decisiones', 'Documenta los acuerdos alcanzados', 'Evita construir sobre suposiciones erroneas'],
    sort_order: 106, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-handoff', category: 'habilidades', title: '/handoff', status: 'activo',
    description: 'Convierte la sesion de trabajo actual en un documento de traspaso para que otro agente (o una sesion nueva) pueda continuar exactamente donde se quedo, sin perder contexto.',
    features: ['Resume el estado actual del proyecto', 'Lista el proximo paso concreto', 'Guarda el documento en docs/handover/', 'Compatible con la skill /retomar'],
    sort_order: 107, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-herramienta', category: 'habilidades', title: '/herramienta', status: 'activo',
    description: 'Da de alta una herramienta nueva en el sistema de la agencia: la documenta, guarda sus credenciales de forma segura y la deja lista para usar en cualquier proyecto.',
    features: ['Documenta la herramienta en memoria persistente', 'Guarda credenciales de forma segura', 'La agrega al catalogo de capacidades de Atalaya', 'Cubre MCP, API REST, CLI, SDK y webhooks'],
    sort_order: 108, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-improve-arch', category: 'habilidades', title: '/improve-codebase-architecture', status: 'activo',
    description: 'Revisa la estructura del codigo en busca de partes que pueden simplificarse o reorganizarse para que sea mas facil de entender y mantener.',
    features: ['Identifica modulos superficiales y de alto acoplamiento', 'Propone "modulos profundos" con interfaces simples', 'No cambia funcionalidad, solo estructura', 'Genera un plan de refactor priorizado'],
    sort_order: 109, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-migrate-project', category: 'habilidades', title: '/migrate-project', status: 'activo',
    description: 'Copia la arquitectura de un proyecto existente hacia uno nuevo, adaptando colores e identidad de marca.',
    features: ['Replica modulos reutilizables del proyecto fuente', 'Inyecta colores y nombre de la marca nueva', 'Entrega con build limpio verificado', 'Nunca modifica el proyecto original'],
    sort_order: 110, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-notificaciones', category: 'habilidades', title: '/notificaciones', status: 'activo',
    description: 'Disena o audita el sistema de alertas de una automatizacion: define cuando, por donde y como se envian los mensajes, siguiendo los estandares de la agencia.',
    features: ['Carga la Biblia de Notificaciones de la agencia', 'Genera template Slack + SQL + codigo JS', 'DRY_RUN obligatorio en disenos nuevos', 'Audita workflows existentes contra el estandar'],
    sort_order: 111, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-nueva-tarea', category: 'habilidades', title: '/nueva-tarea', status: 'activo',
    description: 'Crea una tarea en el sistema Y genera su documento de respaldo (Ficha de Ejecucion) en Google Drive, todo en una sola pasada.',
    features: ['Registra la tarea en Supabase', 'Genera la Ficha de Ejecucion en Word', 'Sube el documento a Google Drive', 'Adjunta el link de la ficha a la tarea'],
    sort_order: 112, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-nuevo-agentico', category: 'habilidades', title: '/nuevo-agentico', status: 'activo',
    description: 'Arranca un proyecto de automatizacion desde cero siguiendo la arquitectura canonica de la agencia.',
    features: ['Aplica la arquitectura: orchestrator → ingestors → analyst → detective → dispatcher', 'Valida el diseno antes de escribir codigo', 'Configura schema Supabase y Edge Functions', 'Incluye outbox pattern para llamadas externas'],
    sort_order: 113, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-nuevo-proyecto', category: 'habilidades', title: '/nuevo-proyecto', status: 'activo',
    description: 'Crea un proyecto nuevo de software (panel o CRM) a partir de la plantilla base de la agencia en minutos.',
    features: ['Copia la plantilla base limpia de la agencia', 'Personaliza nombre, color e icono de marca', 'Instala dependencias y verifica el build', 'Listo para conectar Supabase y configurar variables'],
    sort_order: 114, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-optimizar-doc', category: 'habilidades', title: '/optimizar-doc', status: 'activo',
    description: 'Adelgaza un documento de guia (AGENTS.md, CLAUDE.md) que crecio demasiado, moviendo el contenido pesado a archivos separados.',
    features: ['Extrae contenido pesado a documentos dedicados', 'Mantiene el documento principal como mapa liviano', 'No borra nada: reubica y enlaza', 'Respeta el limite de 180 lineas por documento'],
    sort_order: 115, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-prototype', category: 'habilidades', title: '/prototype', status: 'activo',
    description: 'Construye un prototipo rapido y desechable para validar una pregunta de diseno o logica antes de comprometerse con codigo de produccion.',
    features: ['Define una sola pregunta a validar', 'Dos modos: logica (CLI/terminal) o UI (variantes por URL)', 'Sin pulido ni manejo de errores', 'El codigo es desechable — no va a produccion'],
    sort_order: 116, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-qa-autofix', category: 'habilidades', title: '/qa-autofix', status: 'activo',
    description: 'Ejecuta un ciclo de control de calidad automatico al terminar un modulo: detecta errores de TypeScript y de build, los corrige en bucle (maximo 5 intentos).',
    features: ['Corre tsc --noEmit y npm run build', 'Corrige errores en bucle autonomamente', 'Abre el browser con vite preview si se da una ruta', 'Entrega reporte de cierre con estado final'],
    sort_order: 117, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-respaldo-tarea', category: 'habilidades', title: '/respaldo-tarea', status: 'activo',
    description: 'Genera el documento de respaldo (Ficha de Ejecucion) de una tarea que ya existe en el sistema y lo adjunta a ella via Google Drive.',
    features: ['Genera la Ficha de Ejecucion en Word con plantilla oficial', 'Sube el documento a Google Drive', 'Adjunta el link a la tarea existente', 'Segundo eslabon de la cadena de tareas'],
    sort_order: 118, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-retomar', category: 'habilidades', title: '/retomar', status: 'activo',
    description: 'Retoma un proyecto en curso leyendo su documento de traspaso y ejecutando el siguiente paso pendiente sin pedir confirmacion.',
    features: ['Lee el handoff mas reciente del proyecto', 'Entrega un resumen de estado en un parrafo', 'Ejecuta el siguiente paso sin preguntar', 'Compatible con proyectos registrados en memoria'],
    sort_order: 119, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-supabase-schema', category: 'habilidades', title: '/supabase-schema', status: 'activo',
    description: 'Disena o revisa la estructura de bases de datos en Supabase, siguiendo los patrones establecidos para proyectos de la agencia.',
    features: ['Schema dedicado por proyecto (nunca en public)', 'Incluye tabla run_events para trazabilidad', 'Define RLS y politicas de seguridad', 'Genera SQL listo para aplicar en migracion'],
    sort_order: 120, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-to-prd', category: 'habilidades', title: '/to-prd', status: 'activo',
    description: 'Convierte una conversacion o idea en un documento formal de requisitos de producto (PRD) listo para implementar.',
    features: ['Explora el repo para entender el contexto actual', 'Propone los modulos y confirma con el usuario', 'Escribe el PRD en la raiz del proyecto', 'Listo para que otro agente lo implemente'],
    sort_order: 121, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-triage', category: 'habilidades', title: '/triage', status: 'activo',
    description: 'Prioriza y categoriza una lista de tareas, bugs o issues usando un sistema de estados, para decidir que va primero.',
    features: ['Categoriza por tipo: bug o mejora', 'Asigna estado: listo / necesita-info / para-humano / descartado', 'Justifica cada decision de prioridad', 'Genera la lista ordenada lista para el sprint'],
    sort_order: 122, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
  {
    id: 'skill-zoom-out', category: 'habilidades', title: '/zoom-out', status: 'activo',
    description: 'Sube un nivel de abstraccion para entender como encaja una pieza de codigo en el sistema mayor. Ideal al trabajar en codigo desconocido.',
    features: ['Identifica los puntos de entrada al codigo', 'Mapea los modulos que interactuan con esta area', 'Muestra el flujo de datos: como llega, transforma y sale', 'Genera diagrama ASCII o Mermaid si ayuda'],
    sort_order: 123, last_updated_at: '2026-06-05T00:00:00Z', route: null,
  },
];
