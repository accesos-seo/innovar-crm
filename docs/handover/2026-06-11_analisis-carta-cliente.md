# Análisis — Carta de Revisión del Cliente (2026-06-11)

**Origen:** Comunicado del cliente (dueño de Innovar) tras revisar la app.
**Propósito:** Clasificar cada punto de la carta en: ya existe / duda a explicar / bug a diagnosticar / funcionalidad nueva. Insumo para el próximo PRD.
**Regla de esta fase:** NO se ejecutó nada. Solo análisis y verificación de código en lectura.

---

## 0. Hallazgo transversal — verificar ANTES que todo

El cliente reporta 4-5 módulos "con error" o "vacíos" (tareas, pagos, cierres, cotizaciones, subir archivos). Antes de diagnosticar cada uno por separado, hay una hipótesis que explicaría varios de golpe:

> **La versión publicada (Vercel) puede estar atrasada respecto al desarrollo local.**
> - Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, NO a `accesos-seo/innovar-crm:master` → los push NO disparan deploy automático.
> - La rama activa de desarrollo es `ux-fixes`; hay commits recientes (postventa) sin push.
> - Memoria del proyecto: *"Innovar: prod vs master antes de diagnosticar — Auto-deploy roto, prod puede estar en rama lateral."*

**Primera acción de la siguiente fase:** comparar el commit desplegado en `crm-innovar-app-2026.vercel.app` contra `ux-fixes` local. Si prod está viejo, la mitad de la carta se resuelve con un deploy.

Segunda hipótesis (si el deploy está al día): patrones conocidos del proyecto — columnas Zod que no existen en prod (caso `data_origin`), políticas RLS `FOR UPDATE TO authenticated` que dan 403 incluso a admin. Ambos ya ocurrieron antes en este proyecto.

---

## 1. Punto por punto

### 1.1 "Error al subir archivos de diseños al proyecto"
**Clasificación: 🐛 Bug a diagnosticar.**
La función EXISTE en dos lugares:
- Ficha de Taller (`/produccion/ficha/:id`): pestañas de archivos 3D y despiece → bucket `project-files` (50MB, pdf/cad/img), JSONB `design_3d_files`/`despiece_files`.
- Detalle de Proyecto (`ClientPortalCard`): upload de fotos por etapa → bucket `project-photos`.

Hipótesis ordenadas: (1) prod desactualizado, (2) policies de Storage del bucket, (3) tamaño/formato del archivo que probó. **No diagnosticado aún — pendiente fase siguiente.**

### 1.2 Flujo de diseño que describe el cliente (modelado → render → producción)
**Clasificación: 🟡 Parcialmente existe + 🆕 corazón del próximo PRD.**

Lo que el cliente describe vs lo que hay:

| Paso del cliente | Estado actual |
|---|---|
| Fotos de medidas en la visita, a disposición del diseñador | 🆕 **No existe** — las fotos hoy se suben al *proyecto* (que nace después del pago). No hay fotos asociadas a la *visita/oportunidad* pre-proyecto. |
| Cliente aprueba cotización → AVISO al diseñador | 🟡 Existe el aviso al diseñador, pero al **verificar el pago** (`project_assigned_designer_v1`), no al aprobar la cotización. Ajustar momento o agregar aviso adicional. |
| Diseño en 2 fases: **modelado 3D** → aprobación cliente → **render** → aprobación cliente | 🆕 **No existe.** El enum `project_status` tiene `en_diseno` y `aprobacion_final` como etapas únicas; no distingue modelado vs render ni tiene aprobaciones del cliente por sub-etapa. |
| Página por proyecto con link donde el cliente ve el proceso y **aprueba desde ahí** | 🟡 El portal "Mi Proyecto" (`/proyecto/:token`) YA existe: timeline, galería de fotos por etapa, pagos, instalación. **Pero es solo-lectura: no tiene botones de aprobar/pedir cambios.** Verificado en código (`PublicProjectTracking.tsx` — cero lógica de aprobación). |
| Aprobación delegada: si el cliente es persona mayor, enviar fotos por WhatsApp y nosotros aprobamos en su nombre con el aval | 🆕 **No existe.** Requiere: registro de quién aprobó en nombre del cliente + evidencia adjunta (captura WA) + auditoría. |
| Etapas de producción con AVISO al cliente en cada una | ✅ **Ya existe.** Triggers WA en prod: fabricación iniciada (047), instalación programada (048), proyecto completado (049) + Kanban de producción con 5 fases y confirmación antes de mover. |
| Cada paso soportado con fotos que el cliente revisa en la página | ✅ **Ya existe** — galería por etapa en el portal (`project_photos.stage`). |
| Entrega con fotos + AVISO trabajo terminado + **recordatorio del 40% restante** | 🟡 Aviso de entrega existe (`proyecto_completado_v1` + encuesta postventa). El **recordatorio explícito del saldo pendiente** (40%) no existe como mensaje dedicado. 🆕 Gap pequeño. |

### 1.3 "Clientes: no veo crear nuevo cliente"
**Clasificación: 💬 Duda — es por diseño + decisión de producto pendiente.**
El botón se quitó deliberadamente (commit `d9d6833`: "separar leads de clientes y quitar botón manual"). Filosofía: todo contacto entra como **solicitud/lead** y el sistema lo convierte en cliente automáticamente al avanzar — evita duplicados y clientes sin historial.

**Caso de uso válido del cliente:** persona conocida que llega directo a cotización. Camino actual: crearla como solicitud (toma 30 segundos, el sistema hace el resto).
**Decisión a tomar:** ¿agregar atajo "Nuevo cliente" que cree lead+cliente en un paso? (esfuerzo bajo).

### 1.4 "Gestión de oportunidades — no le veo la función (explicarme por favor)"
**Clasificación: 💬 Duda — solo explicación.**
Respuesta lista (lenguaje no técnico):

> **El lead es la persona; la oportunidad es el negocio.** Cuando alguien escribe, se crea su ficha (lead) y además una "oportunidad": *este contacto quiere una cocina integral, ahora*. La oportunidad es lo que avanza por las 10 etapas del Motor Comercial (visita → cotización → pago…), tiene su comercial asignado y sus fechas.
> ¿Por qué separarlos? Porque un mismo cliente puede tener **varios negocios en el tiempo**: hoy la cocina, el año entrante un closet. Cada uno es una oportunidad distinta con su propia cotización y su propio seguimiento, sin duplicar a la persona. Además las métricas de conversión miden negocios reales, no personas.

### 1.5 "Cotizaciones no hay nada, está creada solo la página"
**Clasificación: 🐛 A verificar — el motor SÍ está construido.**
Lo construido: 6 cotizadores con precios en vivo (Cocinas, TV, Acabados, Closets, Puertas, Mesones), motor server-side con catálogo de precios editable, versionado de cotizaciones, link público de aprobación con short code, PDF inmutable post-pago.

Si el cliente vio "nada", las explicaciones posibles son: (1) prod desactualizado — ver hallazgo transversal, (2) entró con un rol/usuario sin datos, (3) la lista estaba vacía porque no hay cotizaciones creadas en prod y el vacío se leyó como "no construido".
**Los ajustes que él menciona ("serían de tipo adicionar") se reciben sobre lo ya construido — no se parte de cero.**

### 1.6 "Agendamiento: falta la dirección exacta de la visita"
**Clasificación: 🆕 Gap real confirmado — mejora pequeña.**
Verificado: `Agenda.tsx` no tiene campo de dirección. La visita hoy hereda la dirección del cliente, pero el caso real es válido: un cliente registrado con una dirección puede pedir visita en OTRO sitio.
**Solución propuesta:** campo `visit_address` propio en cada visita (calle, conjunto, referencia) + mostrarlo en los recordatorios WA de 24h/2h al comercial.

### 1.7 "Tareas: dan error al crearlas"
**Clasificación: 🐛 Bug a diagnosticar.**
Hipótesis ordenadas: (1) prod desactualizado, (2) desfase de esquema Zod vs producción (patrón `data_origin` ya visto), (3) RLS. Nota conocida del proyecto: `tasks` tiene trigger `fn_queue_calendar_sync` que ya causó problemas en DELETE — revisar si afecta INSERT.

### 1.8 "Pagos: no se pueden registrar" + "deben ir asociados a cotización, no a cliente"
**Clasificación: 🐛 bug a diagnosticar + ✅ el modelo YA es como él pide.**
- **Modelo de datos:** los pagos YA se asocian a la cotización (y por ella al proyecto), no al cliente. Un cliente con 3 proyectos tiene pagos separados por proyecto. El flujo completo: comprobante subido en el portal → registro en `payments` ligado a la cotización → admin verifica → se crea el proyecto. **Respuesta para el cliente: ya funciona así.**
- **El error al registrar:** a diagnosticar (mismas hipótesis del punto 1.7).
- Dato positivo de la carta: "esta pantalla sí la veo completa con todos los datos requeridos y hasta soporte recibo muy bien".

### 1.9 "Gastos: 2 clases — materiales de proyecto vs gastos de bodega/empresa, con derivados"
**Clasificación: 🟡 Parcialmente existe + 🆕 mejora de presentación y taxonomía.**
Lo que YA hay (verificado en `database.types.ts` + `Gastos.tsx`):
- Categorías: `materiales, operativo, nomina, transporte, herramientas, servicios_publicos, arriendo, subcontrato, otro`
- Cada gasto puede ligarse (o no) a un proyecto → la distinción que pide ya existe implícitamente: **gasto con proyecto = clase 1 (proyecto→cliente); gasto sin proyecto = clase 2 (empresa/bodega)**.
- Filtros por estado, categoría y proyecto.

Lo que FALTA para cumplir su visión:
1. Presentar las 2 grandes clases en la UI (totales separados, pestañas o segmentos "Proyectos" vs "Empresa").
2. Subcategoría "dietas/extras" (instalaciones en horarios especiales o zonas retiradas) — no existe en el enum.
3. Reporte por clase + derivados, alimentando los cierres (ver 1.10).

### 1.10 "Cierres contables: error + no cerramos por mes sino por proyecto terminado y pagado al 100%"
**Clasificación: 🐛 bug a diagnosticar + ✅ concepto ya alineado + 🆕 regla de gastos de bodega por definir.**
- **Bug:** marca error, no pudo probar — a diagnosticar primero.
- **Concepto:** verificado en código — el cierre YA se asocia a proyecto (`c.project.name`), no a mes calendario. Las tarjetas "Cierres mes / Utilidad mes" son solo métricas agregadas. **La filosofía que pide ya es la del módulo.**
- **Gap real a definir CON el cliente (decisión de negocio, no de código):** ¿cómo se asignan los gastos de bodega/empresa al período de cada cierre de proyecto? Opciones a discutir en el PRD: prorrateo por días del proyecto, por % de facturación del período, o asignación manual al cerrar. Esto requiere una conversación antes de construir.

---

## 2. Resumen clasificado

### ✅ Ya existe — solo comunicar/mostrar (5)
1. Pagos asociados a cotización/proyecto (no a cliente) — ya es así
2. Avisos WA automáticos por etapa de producción, instalación y entrega
3. Portal por proyecto con link único + galería de fotos por etapa
4. Motor de cotizaciones completo (6 cotizadores + versionado + link público + PDF)
5. Cierres asociados a proyecto (no a mes calendario)

### 💬 Dudas con respuesta lista (2)
6. Qué es "Gestión de Oportunidades" → explicación redactada en 1.4
7. Por qué no hay botón "crear cliente" → por diseño; decisión pendiente: ¿atajo directo?

### 🐛 Bugs a diagnosticar — NO diagnosticados aún (5)
8. Subir archivos de diseño al proyecto
9. Crear tareas
10. Registrar pagos
11. Cierres contables (error genérico)
12. Cotizaciones "vacías" (probablemente mismo origen)
→ **Paso 0 obligatorio: verificar versión desplegada en Vercel vs rama `ux-fixes`.**

### 🆕 Funcionalidad nueva — insumos del PRD (9)
13. Sub-etapas de diseño: Modelado → aprobación → Render → aprobación
14. Aprobación del cliente desde el portal público (botones + registro + AVISO)
15. Aprobación delegada con aval de WhatsApp (staff aprueba en nombre del cliente + evidencia)
16. AVISO al diseñador al aprobarse la cotización (hoy es al verificar pago)
17. Fotos de medidas en la VISITA, visibles para el diseñador (pre-proyecto)
18. Recordatorio del saldo restante (40%) al entregar
19. Dirección exacta propia por visita + en recordatorios WA
20. Gastos: UI de 2 clases (Proyecto vs Empresa) + subcategoría "dietas/extras"
21. Cierres: regla de asignación de gastos de bodega al período (requiere definición con el cliente)

---

## 3. Plan de trabajo propuesto (para aprobación — nada ejecutado)

| Fase | Contenido | Esfuerzo estimado |
|---|---|---|
| **Fase 0 — Diagnóstico** | Verificar deploy de prod vs `ux-fixes`. Reproducir los 5 errores (#8-12). Arreglar lo que sea bug puro (deploy, RLS, schema). | 1 sesión |
| **Fase 1 — Respuestas + quick wins** | Enviar respuestas al cliente (#1-7). Dirección en visitas (#19). UI 2 clases de gastos + dietas (#20). Recordatorio 40% (#18). Aviso al diseñador en aprobación (#16). | 1-2 sesiones |
| **Fase 2 — PRD "Ciclo de Diseño y Aprobaciones"** | Grill + PRD de #13, #14, #15, #17. Es el corazón de la carta: modelado/render con aprobaciones del cliente desde el portal o delegadas con aval WA. | 1 sesión de PRD + slices |
| **Fase 3 — Cierres contables v2** | Sesión de definición con el cliente sobre regla de gastos de bodega (#21) → PRD → construcción. | Definición + 1-2 sesiones |

---

## 4. Notas para la fase de PRD (Fase 2)

- Reutilizar: el portal `/proyecto/:token` ya tiene auth por token, timeline y galería — la aprobación se monta SOBRE esto, no se construye portal nuevo.
- El patrón de aprobación pública ya existe en el proyecto: la cotización pública (`/c/:short_code`) tiene aprobar/ajustes/rechazar con notificaciones. Replicar ese patrón para modelado/render.
- Enum `project_status` actual (8 valores): `contacto, cotizacion_aprobada, en_diseno, aprobacion_final, en_produccion, listo_instalacion, entregado, completado`. Decidir en el grill: ¿sub-etapas como nuevos valores del enum o tabla `design_phases` aparte? (Cuidado: agregar valores a enum en prod ya se hizo antes — migración `2519f8e` agregó `completado`; pero el Zod local desactualizado rechaza valores nuevos — patrón conocido, todo movimiento vía RPC como hizo Producción.)
- Aprobación delegada: tabla de auditoría con `approved_by` (staff), `approval_channel` (`portal` | `whatsapp_delegado`), `evidence_url` (captura del WA en Storage).
- Las fotos de medidas pre-proyecto: hoy `project_photos` requiere `project_id`. Las visitas ocurren antes del proyecto → o se asocian a `opportunity_id`/`visit_id`, o se crea el proyecto en estado temprano. Decisión de grill.

**Próximo paso acordado:** usuario revisa este análisis → aprueba qué ejecutar → `/grill-me` o `/to-prd` para la Fase 2.
