# Matriz de Segmentación y Brechas — Cuestionarios de Decisiones

**Proyecto:** Innovar CRM · Cliente: Cocinas Integrales Pereira
**Fuente:** [`decisiones-innovar-cuestionarios.md`](decisiones-innovar-cuestionarios.md) (versión canónica reconciliada)
**Verificado contra:** producción real (Supabase — proyecto Innovar, vía Management API) + código vivo en `src/` — **19/06/2026**
**Método:** cada respuesta del cliente se descompuso en ítems atómicos y se contrastó contra el código y el esquema de BD en producción. No se dio por cierta ninguna afirmación del documento sin evidencia.

### Leyenda
| Símbolo | Significado |
|---|---|
| ✅ | **Verificado en producción** — existe y se comporta como lo describe el documento |
| 🟡 | **Parcial** — existe la base (campo/infra/parte), pero falta lógica, UI o integración, **o difiere** del documento |
| 🔴 | **No existe** — el documento lo describe (a menudo como *ya existente*), pero no está en el código ni en la BD |
| ⚠️ | **Riesgo de expectativa** — el documento lo afirma como hecho; el cliente podría creer que ya funciona |
| ⏳ | **Decisión pendiente del cliente** — quedó sin responder |

---

## ⚠️ Veredicto ejecutivo (leer primero)

**El documento describe un sistema mucho más completo del que existe hoy.** La hipótesis inicial ("el documento solo confirma lo ya construido") quedó **refutada** por la verificación contra producción.

Las respuestas están redactadas en presente ("el sistema graba…", "el modal pide…", "se dispara la notificación…") citando nombres de campos y tablas concretos — pero **una parte importante de esos campos y tablas no existe en la base de datos de producción**, y los flujos descritos (todo el ciclo de aprobación de diseño, los PDF de cierre, la cadena de avisos del render) **no están construidos**.

**Conteo sobre ~27 ítems atómicos verificados:**

| Estado | Ítems | Lectura |
|---|---|---|
| ✅ Verificado | ~5 | Lo que de verdad existe y calza con el documento |
| 🟡 Parcial / difiere | ~5 | Hay base, pero falta o no coincide con lo descrito |
| 🔴 No existe ⚠️ | ~15 | **Descrito como hecho, pero ausente en producción — más de la mitad** |
| ⏳ Pendiente cliente | 2 | Preguntas 1 y 9 del Cuestionario 2 |

**Implicación para el objetivo del cliente** ("que todo calce con lo que propuso, incluso si revisa la base de datos"): hoy **NO calza**. Si el cliente revisara la BD esperando `closure_audit_log`, `modelado_approved_by`, `changes_requested_at`, los PDF de cierre o el ciclo de aprobación delegada, **no los encontraría**. Esto es precisamente lo que esta matriz expone para poder cerrarlo de forma ordenada.

> **Nota de origen (importante para la conversación con el cliente):** el detalle técnico de las respuestas (nombres de campos, comportamientos al milímetro) sugiere que fueron redactadas describiendo un sistema *objetivo/ideal*, no el estado real. Conviene aclararlo antes de que el cliente las tome como inventario de lo entregado.

---

## 1. FINANZAS — Cuestionario 1 (Cierres Contables y Gastos)

**Módulos:** `/finanzas/gastos`, `/finanzas/cierres` · **Tablas reales:** `accounting_closures`, `expenses`

| # | Ítem / requisito del documento | Estado | Evidencia / nota |
|---|---|---|---|
| Q1a | Gastos de empresa/bodega independientes de proyectos (no se prorratean) | ✅ | `expenses.project_id` NULL = gasto empresa. `NewExpenseModal.tsx:35-77` |
| Q1b | "13 categorías de bodega ya activas" (Arriendo, Luz, Agua, Internet, Insumos aseo/papelería, Cortesía, Gasolina, Mant. moto/bodega/maquinaria, Nómina, Otro) | 🟡 ⚠️ | En código hay **10 categorías y DISTINTAS** (Materiales, Subcontrato, Transporte, Herramientas, Operativo, Dietas, Nómina, Servicios públicos, Arriendo, Otro). No hay constraint en BD (son constante de frontend). **No coinciden** con las 13 del documento |
| Q2 | Al cierre solo entran proyectos terminados **y pagados 100%** | 🟡 | El trigger `trg_cierre_automatico_proyecto` (mig 049) exige `delivered_at` + `is_fully_paid`; pero el **selector manual** del cierre filtra solo `status==='entregado'`, sin verificar pago 100% (`NewClosureModal.tsx:32`). Inconsistencia UI vs trigger |
| Q3 | Regla de período: gastos de bodega desde el **último cierre confirmado** hasta la fecha del nuevo cierre | 🔴 ⚠️ | No existe la RPC ni la lógica de corte por período. `useCreateClosure` llama a un RPC inexistente. Descrito en detalle, **no construido** |
| Q4 | Revertir cierre solo super_admin + motivo ≥10 chars + registro en `closureAuditLog` + botón oculto a admins | 🔴 ⚠️ | **`closure_audit_log` no existe en prod.** No hay flujo de revertir, ni validación de motivo, ni restricción super_admin. Solo archivar/restaurar (soft-delete) |
| Q5 | No hay dietas de empleados (si existieran → gasto bodega) | ✅ | Política, sin build. (Curiosamente sí existe categoría "Dietas y extras" en las 10 del frontend) |
| Q6a | Tablas-foto del cierre `accountingClosureProjects` / `accountingClosureOperationalExpenses` | 🔴 ⚠️ | **No existen en prod.** Modelo real = `accounting_closures` (1:1 proyecto) + `expenses` |
| Q6b | **Reporte Ejecutivo PDF** + **Anexo de Gastos PDF** (columnas, fila pérdida rosada, firmas, 2 secciones) | 🔴 ⚠️ | **No hay generación de PDF en absoluto** (sin librería PDF en package.json). Hoy solo panel web. Uno de los mayores gaps |
| Q7 | Cierres solo super_admin/CEO | 🟡 | UI: botón solo si `role==='admin'` (no super_admin); **el rol "CEO" no existe**. RLS: `FOR ALL TO authenticated` (sin filtro de rol). Difiere |

---

## 2. DISEÑO — Cuestionario 2: Q1, Q8, Q10, Q11

**Módulos:** flujo de diseño en Proyectos, Visita Técnica, Portal cliente

| # | Ítem / requisito | Estado | Evidencia / nota |
|---|---|---|---|
| Q1 | Contadores `modelado_revision_number` / `render_revision_number` sin tope | ✅ + ⏳ | Campos existen en prod, sin validación de tope. **Decisión pendiente:** si se agrega tope/aviso (política comercial sin decidir) |
| Q8 | JPG/PNG + PDF, **12MB**, compresión imágenes (1920px/80%), portal distingue galería vs ícono PDF | 🟡 ⚠️ | Buckets `project-photos` (10MB) y `project-files` (50MB) existen; **límites no son 12MB**. Compresión cliente 1920px/0.85 ✅. Validación de extensiones ✅. **El portal del cliente con galería NO existe** |
| Q10a | Visita técnica captura medidas por tipo + fotos categorizadas en campo | ✅ | `VisitMeasurementsForm.tsx`, `VisitPhotoUploader.tsx`, `useFinishVisit.ts`, tabla `visits`. (Campos de medida difieren: real = largo/ancho/alto/forma/conexiones; concepto ✅) |
| Q10b | Plano GoodNotes comprimido con **Ghostscript** | 🔴 | No hay Ghostscript en el código (las fotos sí se comprimen client-side) |
| Q10c | Sección **"Levantamiento técnico"** en la ficha del PROYECTO, automática para el diseñador (galería + tabla medidas + PDF + notas) | 🔴 ⚠️ | Los datos viven en `visits` (no en el proyecto); `WorkshopSheet` no los muestra. **La integración automática descrita no existe** |
| Q10d | Notificación "Enviar al equipo" (push a admin/comercial/diseñadores) | 🔴 | No existe ese evento; al finalizar visita solo se notifica al **cliente** (`visit_summary_client_v1`) |
| Q11 | Cliente ve solo la versión vigente (no V1/V2/V3); el equipo sí ve historial | 🔴 ⚠️ | **El portal/galería de diseño del cliente no existe**, así que no hay ni "solo vigente" ni historial. Descrito como funcionando |

---

## 3. COMERCIAL / APROBACIONES — Cuestionario 2: Q2–Q6

**Módulos:** Portal público de aprobación, aprobaciones internas, notificaciones

| # | Ítem / requisito | Estado | Evidencia / nota |
|---|---|---|---|
| Q2 | "Solicitar Cambios" (cliente/comercial/admin), modal fuente+descripción, vuelve a `en_diseno`, `changesRequestedAt`, notif. en cadena al diseñador (tarea 48h) + admin/CEO | 🔴 ⚠️ | **No existe** "Solicitar Cambios" ni el modal. **`changes_requested_at` no existe en prod.** `client_approval_notes` existe pero genérico. Flujo descrito al detalle, **ausente** |
| Q3 | Aprobación cliente (link público, 2 botones) + delegada (modal motivo), `modeladoApprovedBy`, sub-estados, 25 días hábiles | 🔴 ⚠️ | Portal de aprobación **no existe**. `modelado_approved_at` existe pero **`modelado_approved_by` NO** (no se guarda el "quién"). Sub-estados `pendiente_modelado`/`pendiente_render`/`aprobacion_final` no son enum de BD. Aprobación delegada **no existe**. Solo hay un `client_approved_at` genérico |
| Q4 | Evidencia delegada: motivo + nota + adjunto (≤10MB) ligado a historial inmutable | 🔴 ⚠️ | No existe (la aprobación delegada misma no existe) |
| Q5 | Datos del familiar: nombre + parentesco (sin teléfono) en historial | 🔴 ⚠️ | Campos y registro no existen |
| Q6 | Recordatorios T+5h / T+48h (WhatsApp cliente) + T+96h (alerta interna); reinicio de contador | 🔴 ⚠️ | No existen para aprobación de diseño. (Sí hay recordatorios de **cotización** mig 037 y de **visitas** mig 026 — no de diseño) |

---

## 4. PRODUCCIÓN — Cuestionario 2: Q7, Q12

**Módulos:** Producción/Taller, notificaciones · **Tabla:** `project_status_history`

| # | Ítem / requisito | Estado | Evidencia / nota |
|---|---|---|---|
| Q7a | Sin bloqueo duro: al "Pasar a Producción" se valida `rendersApprovedAt`; si falta → modal ámbar con override | 🔴 | La RPC `move_project_status` (mig 054) **no valida `renders_approved_at`**. El modal ámbar existe pero por WhatsApp, no por renders faltantes |
| Q7b | `skipDesignProcess` va directo a taller por botón separado | 🟡 | Campo `skip_design_process` existe en prod, pero **la lógica de ruteo directo no está implementada** (ni input visible) |
| Q7c | Trazabilidad del paso a producción | ✅ | `project_status_history` + trigger `trg_log_project_status` |
| Q12 | Aprobar render → avisa simultáneo a producción/jefe de taller, comercial, dashboard gerencia y cliente | 🔴 ⚠️ | **No hay trigger sobre `renders_approved_at`**; el campo es solo-lectura en la UI. Existen notificaciones de producción/fabricación/instalación pero atadas a **cambio de estado posterior**, no a la aprobación del render. La "sincronización simultánea" descrita **no existe** |

---

## 5. ⏳ Decisiones pendientes del cliente (bloqueantes)

| # | Decisión | Estado actual del sistema | Qué falta |
|---|---|---|---|
| C2-Q1 | ¿Tope de rondas de cambios? | Sin tope (contadores libres) | El cliente debe decidir si quiere tope/aviso (política comercial). Si decide tope → desarrollo |
| C2-Q9 | Disparo del aviso al diseñador: ¿al aprobar la cotización o al verificar el pago? | Hoy: al `adelanto_recibido` (pago). El cliente había pedido: al aprobar la cotización | El cliente **dejó la respuesta en blanco**. Hay que devolvérsela y, según decida, ajustar el trigger |

---

## 6. Brechas priorizadas → insumo para los PRD (Fase C)

Agrupadas por departamento, lo 🔴/🟡 que requiere construcción o corrección:

1. **PRD Finanzas** — regla de período del cierre (RPC), revertir cierre + auditoría (`closure_audit_log`), **generación de PDF Ejecutivo + Anexo**, reconciliar las 13 categorías vs las 10 reales, filtro de cierre "100% pagado" en UI, permisos super_admin reales.
2. **PRD Diseño** — integrar "Levantamiento técnico" en la ficha del proyecto, alinear formatos/límites (12MB), compresión PDF (Ghostscript) si se mantiene el requisito.
3. **PRD Comercial / Aprobaciones** — **el ciclo de aprobación completo** (portal público Aprobar/Solicitar cambios, sub-estados, `modelado_approved_by`, `changes_requested_at`), aprobación delegada + evidencia + datos del familiar, recordatorios T+5h/48h/96h.
4. **PRD Producción** — override por `renders_approved_at`, ruteo `skip_design_process`, **cadena de avisos al aprobar render** (trigger + notificaciones a taller/comercial/cliente).
5. **PRD Visita Técnica** — surface de medidas/fotos del `visits` hacia el proyecto, evento "Enviar al equipo".

> **Cambio de naturaleza respecto al plan original:** los PRD ya **no** son "documentar y verificar lo existente" sino mayormente **"construir lo que el documento describe como hecho"**. El esfuerzo real es considerablemente mayor al estimado al inicio. La secuencia y priorización se definen en el roadmap (Fase D), con las 2 decisiones pendientes del cliente al frente.

---

*Siguiente paso: checkpoint con el usuario. No se redacta ningún PRD hasta validar este mapa.*
