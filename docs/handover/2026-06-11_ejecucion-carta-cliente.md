# Ejecución carta cliente — 2026-06-11 (tarde)

> Continuación de `2026-06-11_analisis-carta-cliente.md`. El usuario dio luz verde
> para ejecutar todo lo alcanzable y pidió que el **grill NO se le haga a él**:
> se construyó un módulo dentro del CRM ("Centro de Decisiones") para que el
> CLIENTE responda los cuestionarios y las respuestas caigan en la DB.

## Fase 0 — Diagnóstico CERRADO (causas raíz verificadas contra prod)

| Error reportado | Causa raíz | Estado |
|---|---|---|
| Subir archivos de diseño | `useUpload3DFile` subía al bucket `project-3d-files` que **nunca existió en prod** (el real es `project-files`, de migración 054) | ✅ Fix en código |
| Crear tareas | `NewTaskModal` envía `due_date: ""` si no se elige fecha → Zod exige `YYYY-MM-DD` → toda tarea sin fecha fallaba | ✅ Fix en código |
| Registrar pagos | `NewPaymentModal` envía `received_at: "YYYY-MM-DD"` → el schema exige `z.string().datetime()` (ISO completo) → **TODO pago manual fallaba, 100% reproducible** | ✅ Fix en código |
| Cierres contables | RPC `create_accounting_closure` existe y es SECURITY DEFINER; la escritura RLS era solo `role='admin'`. Probable combinación deploy viejo + cuenta usada | ✅ Paridad RLS (056) + requiere deploy |
| Cotizaciones "no hay nada" | Falso: hay 27 cotizaciones en prod (18 vivas: 14 draft, 3 sent, 3 approved/client_approved…). Query del frontend sana (left join, deleted_at null) | ⚠️ Apunta al deploy viejo |

**Deploy de prod CONFIRMADO viejo** (verificado contra el bundle JS desplegado en
`crm-innovar-app-2026.vercel.app`): tiene Portal Cliente (`proyecto/:token`) pero
NO tiene módulo Producción, ni `move_project_status`, ni Postventa front. Prod
corre un build de ~2026-06-10 a.m. Los pushes posteriores nunca se desplegaron
(Vercel conectado a `Rvirona/CRM-INNOVAR-APP:main`, auto-deploy roto).

**Usuarios reales en prod:** 2 admin, 2 comercial, 1 diseno. **No existe
ningún super_admin** — pero el enum lo tiene y las policies legacy solo cubrían
`admin`; se blindó igual.

## Migraciones aplicadas a PROD — las 3 con `[]` OK

- **056_rls_super_admin_parity.sql** — consolida los pares duplicados
  "admin: todo en X"/"admin_all_X" en una sola policy por tabla con
  `get_my_role() IN ('admin','super_admin')`: clients, projects, quotations,
  tasks, payments, expenses, accounting_closures, notifications.
- **057_decision_center.sql** — `decision_questionnaires` + `decision_questions`
  + RLS admin/super_admin + trigger de estado (pendiente/en_progreso/completado
  según respuestas) + **seeds: "Ciclo de Diseño y Aprobaciones" (12 preguntas) y
  "Cierres Contables y Gastos de Empresa" (7 preguntas)**. Verificado: 12+7
  sembradas, ambas `pendiente`.
- **058_quick_wins_carta_cliente.sql** — `visits.address` (columna lista para el
  PRD; la UI v1 usa descripción de cita), `expense_category += 'dietas'`,
  trigger `trg_notify_design_on_client_approval` (aviso in-app a
  diseno/admin/super_admin cuando cotización → client_approved), trigger
  `trg_notify_pending_balance_on_delivery` (aviso in-app a admin/comercial si
  proyecto → entregado con `balance_due > 0`; el WA al cliente final queda para
  cuando exista template Meta).

## Código (rama master, repo D:\Agents-automations\04-Innovar)

### Fixes de bugs
- `src/hooks/useProjects.ts` — `useUpload3DFile` ahora sube a `project-files`
  con formato nuevo `{path,name,version,uploaded_at,uploaded_by}` + cleanup de
  huérfanos si falla el UPDATE.
- `src/pages/ProjectDetail.tsx` — render dual-formato (legacy `{url,nombre}` +
  nuevo `{path,name}`), descarga vía `getProjectFileUrl` (signed URL 1h),
  validación de extensión con `ALLOWED_FILE_EXTENSIONS`, `accept` en el input.
- `src/components/tareas/NewTaskModal.tsx` — `due_date`/`description` vacíos → null.
- `src/components/finanzas/NewPaymentModal.tsx` — `received_at` a ISO completo
  (mediodía local para no correr el día por zona horaria).

### Centro de Decisiones (grill-me in-app)
- `src/hooks/useDecisiones.ts` — list/detail/saveAnswer.
- `src/pages/Decisiones.tsx` — cards con progreso y estado.
- `src/pages/DecisionDetail.tsx` — preguntas con "por qué importa", textarea,
  guardar por pregunta, banner de completado.
- `src/App.tsx` — rutas `/decisiones` y `/decisiones/:slug` (roles admin/super_admin).
- `src/components/layout/Sidebar.tsx` — ítem "Decisiones" (ClipboardCheck) solo
  admin/super_admin. ⚠️ Sidebar/Settings tenían cambios SIN COMMITEAR de otra
  sesión — ver "Pendiente de otra ventana" abajo.

### Quick wins
- Gastos 2 clases: `NewExpenseModal` con selector "De proyecto / De empresa-Bodega"
  (proyecto obligatorio en clase proyecto; categorías filtradas por clase;
  categoría nueva `dietas`), filtro "Tipo de gasto" en `Gastos.tsx` +
  `useExpenses` (`expense_class`), columna "Asignación" en `ExpensesColumns`
  (nombre de proyecto o badge "Empresa / Bodega"), schema `expense.ts` += dietas.
- Dirección exacta en citas: `NewAppointmentModal` sección Ubicación (opcional),
  `useBookAppointment` la guarda como `📍 Dirección: …` en la descripción de la
  cita. (La columna normalizada `visits.address` queda para el PRD.)
- Alta directa de clientes: `useCreateClient` + `NewClientModal` + botón
  "Nuevo cliente" en `/clients` (vía `createLabel`/`onCreateClick` de
  ResourceListPage). El flujo lead→cliente automático sigue intacto.

## LO QUE FALTA (acciones del usuario)

1. **`git push` + redeploy en Vercel** — ROOT CAUSE #1 de la carta. Sin esto el
   cliente sigue viendo el build viejo. Recordar `VITE_FF_POSTVENTA=true` y
   verificar que el deploy tome el commit correcto (repo conectado:
   Rvirona/CRM-INNOVAR-APP).
2. Avisar al cliente que entre a **/decisiones** (cuenta admin) y responda los
   2 cuestionarios.
3. Cuando los cuestionarios estén `completado` → leer respuestas de la DB
   (`SELECT q.position, q.question, q.answer FROM decision_questions q JOIN
   decision_questionnaires c ON c.id=q.questionnaire_id WHERE c.slug='…' ORDER
   BY q.position`) → levantar PRD "Ciclo de Diseño y Aprobaciones" (Fase 2) y
   definición de Cierres v2 (Fase 3).
4. Templates Meta pendientes (de antes): `tracking_link_v1`,
   `encuesta_satisfaccion_v1`, `garantia_reclamo_admin_v1`; nueva candidata:
   recordatorio de saldo al entregar.

## Tarea nueva iniciada — Diseño de Roles y Tableros (2026-06-11, tarde)

**Contexto:** En la misma jornada del 11 de junio, se abrió análisis sobre nuevos roles
de usuario para el CRM. El sistema actualmente tiene 5 roles definidos (`admin`,
`super_admin`, `comercial`, `diseno`, `produccion`) pero hay dos gaps sin cubrir.

**Hallazgo — 2 roles con oportunidad real:**

| Rol propuesto | Naturaleza | Accede | No accede |
|---|---|---|---|
| `administradora` | Coordinadora operativa | Clientes (todos), Proyectos (vista + fechas), Agenda, Reuniones, Tareas, Cotizaciones (lectura), Pagos recibidos (solo consulta), Postventa | Crear/editar usuarios, Auditoría, Gastos, Cierres contables, Decisiones, Configuraciones del sistema |
| `socio` / `gerente` | Observador de alto nivel | Lectura de absolutamente todo: dashboard, proyectos, clientes, cotizaciones, finanzas completa, decisiones | Crear/editar/eliminar usuarios, modificar configuraciones, cambiar parámetros, ejecutar mantenimiento |

**Justificación de los 2 roles:**
- `administradora`: Cubre el vacío entre `admin` (control total) y `comercial` (foco en ventas). Hay una zona operativa — coordinación, agendamiento, seguimiento de pagos — que hoy no tiene representación y obliga a dar permisos de `admin` a quien no debería tenerlos.
- `socio/gerente`: El dueño o socio del negocio necesita ver el pulso completo (incluido finanzas) pero no debe operar el sistema. Un rol de solo-lectura total evita accidentes y mantiene trazabilidad.

**Estado:** Análisis completado y documentado en `/docs` del CRM.
Pendiente: aprobación del cliente → construcción de ProtectedRoute + RLS + tableros diferenciados por perfil.

## Pendiente de otra ventana (NO tocado por esta sesión)

En el repo había trabajo sin commitear ajeno a esta sesión: hooks
`useArchiveClosures/useArchiveExpenses/useRestoreClosures/useRestoreExpenses`,
cambios en `Settings.tsx` y parte de `Sidebar.tsx`, `scripts/fix-encoding-expenses.mjs`,
y varios `*.tmp.*`. Mis commits son selectivos (archivo por archivo) para no
arrastrar eso.
