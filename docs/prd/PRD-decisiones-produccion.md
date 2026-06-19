# PRD — Decisiones del Cliente · Departamento PRODUCCIÓN

> **Autocontenido.** Esquema **verificado contra producción** + código vivo el **19/06/2026**. Re-validar contra prod antes de implementar.
>
> **Origen:** Cuestionario 2, **Preguntas 7 y 12** de [`../decisiones/decisiones-innovar-cuestionarios.md`](../decisiones/decisiones-innovar-cuestionarios.md). Estado en la [matriz](../decisiones/00-matriz-segmentacion-brechas.md). **Depende de** [`PRD-decisiones-comercial-aprobaciones.md`](PRD-decisiones-comercial-aprobaciones.md) (la cadena de avisos se dispara cuando aquél setea `renders_approved_at`).

## Problem Statement

El cliente describe: (Q7) producción **no bloqueada duro** — al "Pasar a Producción" el sistema avisa si el render no está aprobado y permite **override**; los proyectos `skip_design_process` van **directo a taller**. (Q12) cuando el render queda aprobado, se avisa **al mismo tiempo** a producción/jefe de taller (para planear), al comercial (para seguimiento) y al cliente, y gerencia lo ve en el dashboard.

La verificación muestra:
- `move_project_status` **no valida** `renders_approved_at`; el modal ámbar existe pero es por **WhatsApp** (destino `en_produccion/listo_instalacion/entregado`), no por renders faltantes.
- `skip_design_process` **existe como columna pero sin lógica** de ruteo ni UI.
- **No hay trigger sobre `renders_approved_at`** → la cadena de avisos del render aprobado **no existe**. Hoy taller se entera **al pasar a `en_produccion`** (template `ficha_taller_v1` al número `workshop_whatsapp`), no al aprobar el render.
- ✅ La **trazabilidad** del paso a producción sí existe (`project_status_history` + `trg_log_project_status`).

## Solution

Agregar (1) el chequeo de renders con override ámbar en `move_project_status`, (2) el ruteo `skip_design_process`, y (3) un trigger sobre `renders_approved_at` que dispare la cadena de avisos (taller temprano + comercial + cliente), reutilizando la cola `notification_queue` y el patrón de notificación a taller ya existente.

## User Stories
- Como **admin**, al pasar a producción sin render aprobado quiero un **aviso ámbar** que pueda confirmar (override), no un bloqueo.
- Como **admin**, para un proyecto sin diseño quiero **enviarlo directo a taller** con un botón.
- Como **jefe de taller**, quiero enterarme **apenas se aprueba el render** para planear carga y materiales, no recién cuando arranca la fabricación.
- Como **comercial**, quiero saber que el diseño de mi proyecto fue aprobado para hacer seguimiento.

## Contexto del sistema existente (leer antes de implementar)

| Pieza | Ubicación | Estado |
|---|---|---|
| RPC `move_project_status(p_project_id, p_to_status, p_note)` | `db/migrations/054_production_module.sql:91-145` (valida rol+transición; escribe `project_status_history`) | ✅ (sin chequeo de renders) |
| `MoveConfirmDialog.tsx` (ámbar) | `src/components/produccion/MoveConfirmDialog.tsx`; ámbar si destino ∈ `WA_TRIGGER_STATUSES` (`useProductionBoard.ts:35-39`) | ✅ (ámbar = WhatsApp, no renders) |
| Notif. taller | `notify_fabrication_started` (trigger `status→en_produccion`) → `workshop_whatsapp` de `system_settings`, template `ficha_taller_v1`; EF `coordinador-produccion` | ✅ (en producción, no en aprobación) |
| Notif. cliente prod. | `trg_notify_fabricacion_started`, `trg_notify_instalacion_programada` (WhatsApp cliente) | ✅ |
| `renders_approved_at` | columna en `projects`; **sin trigger** sobre ella | 🔴 |
| `skip_design_process` | columna `boolean` en `projects`; **sin lógica ni UI** | 🔴 |
| Taller | `system_settings.workshop_whatsapp` (un número). Rol `jefe_taller` definido en el tipo pero **sin usuarios ni policies** | — |
| Comercial del proyecto | vía `projects.opportunity_id` → la oportunidad y su comercial asignado (confirmar columna exacta en `opportunities`/`opportunity_assignment_history`) | ⚠️ verificar |

## Implementation Decisions

> Decisiones técnicas tomadas con criterio. Las del dueño van abajo.

### 1. Override por renders en `move_project_status` (Q7a)
Extender la RPC: si `p_to_status = 'en_produccion'`, `renders_approved_at IS NULL` y `skip_design_process = false`, devolver `{ ok:false, code:'renders_not_approved' }` (señal suave, no error). La UI lo distingue del ámbar de WhatsApp y muestra un diálogo **ámbar específico**: "Este proyecto no tiene renders aprobados. ¿Pasar igual a producción?". Al confirmar, llamar `move_project_status(..., p_force => true)`, que ejecuta el movimiento y registra el override en `project_status_history.note` ("Pasó a producción sin render aprobado — autorizado por [usuario]"). Trazabilidad completa.

### 2. Ruteo `skip_design_process` (Q7b)
En `move_project_status`, si `skip_design_process = true`, permitir la transición `cotizacion_aprobada`/`adelanto_recibido` → `en_produccion` **saltando** `en_diseno`/`aprobacion_final` (y sin el chequeo de renders). UI: botón **"Enviar directo a taller"** en la ficha (visible para admin) que setea `skip_design_process = true` y dispara el movimiento. Estos proyectos no entran al ciclo de diseño/aprobación.

### 3. Cadena de avisos al aprobar render (Q12)
Trigger nuevo `fn_notify_render_approved()` `AFTER UPDATE OF renders_approved_at ON projects` (cuando pasa de NULL a NOT NULL):
- **Taller (temprano):** encolar WhatsApp a `workshop_whatsapp` con plantilla nueva `render_aprobado_taller_v1` (nombre cliente + tipo de trabajo + proyecto) — señal de **planificación**, distinta de `ficha_taller_v1` que se manda al pasar a `en_produccion` (ejecución).
- **Comercial:** notificación in-app (+ WhatsApp opcional) al comercial asociado al proyecto.
- **Gerencia:** **sin** notificación individual (evita ruido) — el dashboard ya refleja el avance vía el cambio de estado a `aprobacion_final` + `project_status_history`. Coincide con lo que pide el cliente.
- **Cliente:** confirmación de que su diseño fue aprobado y pasa a la siguiente fase. Coordinar con el portal de aprobación (PRD Comercial) para **no duplicar** el aviso al cliente.

### 4. Jefe de taller
Hoy taller = un número `workshop_whatsapp`. Se mantiene así (la notificación va a ese número). El rol `jefe_taller` con usuarios individuales y notificación in-app queda como mejora futura opcional, no requerida por el documento.

## Testing Decisions
1. **Override renders:** mover a `en_produccion` un proyecto sin `renders_approved_at` (no skip) → diálogo ámbar específico; confirmar → avanza + nota de override en historial. Con `renders_approved_at` seteado → pasa directo.
2. **Skip:** marcar `skip_design_process` y "Enviar directo a taller" desde `cotizacion_aprobada` → avanza a `en_produccion` sin pasar por diseño y sin pedir renders.
3. **Cadena render aprobado:** setear `renders_approved_at` (vía flujo del PRD Comercial) → taller recibe `render_aprobado_taller_v1`, el comercial recibe in-app, gerencia NO recibe push individual, el cliente recibe confirmación una sola vez.
4. **Trazabilidad:** todo movimiento queda en `project_status_history`.

## Out of Scope
- El evento que **setea** `renders_approved_at` (aprobación del render) → **PRD Comercial/Aprobaciones**.
- Gestión de usuarios individuales de taller / rol `jefe_taller` activo.

## Decisiones del dueño (pendientes — para el documento a enviar)
1. **Criterio de `skip_design_process` (proyectos "sin diseño"):** el documento dice que estos van directo a taller, pero **no define quién marca un proyecto como "sin diseño" ni bajo qué criterio** (¿solo ciertos productos como puertas o acabados? ¿lo decide el comercial, el admin?). Es una regla de negocio que solo el dueño define.
2. *(Confirmación, no bloqueante)* **Aviso temprano a taller al aprobar el render:** asumimos que debe salir **siempre** que se aprueba un render (como dice el documento). Confirmar que no hay tipos de trabajo donde NO se quiera ese aviso anticipado.

## Further Notes
- **No reinventar:** reusar `move_project_status`, `notification_queue`, el patrón `notify_fabrication_started`/`workshop_whatsapp`, `project_status_history`.
- **Plantilla Meta nueva (agencia):** `render_aprobado_taller_v1`.
- **Conformidad ✅ (informar al cliente):** la trazabilidad del paso a producción ya existe; falta el chequeo de renders, el ruteo skip, y la cadena de avisos del render.
- **Commits:** `feat(produccion): ...`, push tras OK.
