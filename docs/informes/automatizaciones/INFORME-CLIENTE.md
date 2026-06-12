# Informe Ejecutivo de Automatizaciones — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Innovar CRM no es solo un sistema donde se registran datos: es una plataforma con **más de 100 piezas de automatización trabajando en segundo plano** para que el negocio funcione solo. Cada vez que alguien crea un cliente, aprueba una cotización, recibe un pago o asigna una tarea, el sistema dispara automáticamente una cadena de acciones que antes hacía el equipo manualmente.

A continuación se describen las áreas donde el sistema trabaja por sí solo, agrupadas por proceso del negocio.

---

## 1. Captación y seguimiento de leads

Cuando entra un nuevo cliente al CRM, el sistema reacciona automáticamente:

- **Envía un correo de bienvenida** al nuevo lead (sin intervención manual).
- **Calcula un score de calidad del lead** basado en sus datos. Ese score se actualiza solo cada vez que el cliente sube de etapa (por ejemplo, cuando le cotizan).
- **Encola un mensaje de WhatsApp** para que el equipo comercial reciba aviso del lead nuevo en tiempo real.
- **Audita el cambio**: queda registro de quién creó al cliente, cuándo y con qué datos.

## 2. Cotizaciones inteligentes

Cuando se construye una cotización el sistema:

- **Numera la cotización automáticamente** con secuencia anti-colisión (jamás se repite un número aunque dos comerciales coticen al mismo segundo).
- **Recalcula totales en tiempo real** cuando se agrega o quita un ítem (ahorra el riesgo de error humano en sumas).
- **Bloquea modificaciones** en cotizaciones ya finalizadas (evita que se manipulen cifras después de enviadas al cliente).
- **Genera el PDF de la cotización automáticamente** cuando cambia a un estado que lo requiere (no hay que pedirlo manualmente).
- **Versiona cotizaciones**: si el cliente pide cambios, el sistema guarda la versión vieja como copia histórica.
- **Notifica al cliente por WhatsApp** cuando su cotización está por vencer.

## 3. Conversión a proyecto

Cuando una cotización es aprobada por el cliente:

- **Se crea el proyecto automáticamente** con todos los datos de la cotización (cliente, monto, alcance).
- **Se generan las tareas iniciales del proyecto** (las que siempre van: medición, diseño, planos, etc.) sin que nadie las tipee manualmente.
- **Notifica al equipo de producción** que hay un nuevo proyecto.

## 4. Gestión de pagos

Cuando se registra un pago:

- **Avanza el estado del proyecto** automáticamente si el pago cubre un hito (por ejemplo, "iniciar producción" al recibir el anticipo).
- **Notifica por WhatsApp al cliente** la confirmación del pago recibido.
- **Audita** quién registró el pago y por cuánto.
- **Bloquea cambios** sobre pagos ya aprobados.

## 5. Control de gastos del proyecto

Cuando alguien del equipo registra un gasto:

- **Notifica al supervisor o admin** para aprobación.
- Cuando el gasto se aprueba o rechaza, **notifica al solicitante** automáticamente.
- **Audita** cada cambio para trazabilidad financiera.

## 6. Agenda y citas

El sistema maneja una agenda inteligente:

- **Bloquea automáticamente los slots** de los días festivos (cuando se agrega un festivo al sistema, todos los horarios de ese día quedan no-disponibles).
- **Sincroniza tareas con Google Calendar** de cada miembro del equipo (insertar, mover o borrar una tarea actualiza el calendario externo).
- **Notifica por WhatsApp** cuando se reserva, modifica o cancela una cita.
- **Reserva el horario del responsable** automáticamente al asignarle la tarea.

## 7. Notificaciones inteligentes

Toda la mensajería del sistema pasa por una **cola central**:

- Se acumulan los mensajes pendientes en una cola interna.
- **Un proceso automático corre cada minuto** que toma los mensajes pendientes y los envía por WhatsApp (vía Meta Business API).
- Si un mensaje falla, se reintenta automáticamente.
- Se reciben las **confirmaciones de entrega del proveedor** (entregado, leído, fallido) y se guardan para reportes.

## 8. Tareas y kanban

Sobre la gestión de tareas operativas:

- **Asignación notificada por WhatsApp**: cuando se asigna una tarea, el responsable recibe aviso inmediato.
- **Tareas bloqueadas**: si una tarea queda bloqueada (espera de aprobación, falta de información), se notifica para que alguien actúe.
- **Tareas completadas**: notifica al proyecto/cliente cuando una tarea importante se cierra.
- **Comentarios**: si alguien comenta una tarea, los involucrados reciben aviso.
- **Escalamiento automático**: las tareas vencidas o bloqueadas mucho tiempo se escalan a supervisores (función `escalate_overdue_and_blocked_tasks`).

## 9. Auditoría completa

El sistema audita **automáticamente** todos los cambios sensibles:

- Clientes, cotizaciones, proyectos, pagos, gastos, tareas — cada modificación queda registrada.
- Se guarda quién hizo el cambio, cuándo, y los valores antes/después.
- Actualmente hay **162 eventos auditados** acumulados.

## 10. Garantías post-venta

- **Encuestas de satisfacción** automáticas tras entrega del proyecto.
- Registro de garantías y reclamos asociados.

## 11. Cierres contables

- Función automática para **cerrar el período contable** de un proyecto.
- **Resumen financiero** automático por proyecto y por período.
- Reportes semanales automatizables.

## 12. Seguridad y permisos

- El sistema **impide automáticamente** que un usuario no-administrador se cambie a sí mismo el rol (protección anti-escalada de privilegios).
- Cada usuario nuevo recibe un perfil propio creado automáticamente.

---

## Beneficios para el negocio

| Antes (manual) | Ahora (automatizado) |
|---|---|
| Calcular score de lead a ojo | Score automático con criterios definidos |
| Notificar al cliente uno a uno | WhatsApp masivo automático con cola anti-fallos |
| Generar PDFs de cotización a pedido | PDFs generados solos al cambiar de estado |
| Recordar al cliente vencimiento manualmente | Alerta automática antes de vencer |
| Avanzar estado del proyecto manualmente al cobrar | Avance automático al registrar pago |
| Auditar cambios a mano | Auditoría 100% automática |
| Sincronizar agenda con Google Calendar a mano | Sincronización en tiempo real |
| Bloquear festivos manualmente | Bloqueo automático al agregar al sistema |

---

## Resumen numérico

- **50 reglas** de base de datos vigilando cambios y reaccionando
- **51 funciones** de lógica de negocio reutilizables
- **1 proceso continuo** (cada minuto) procesando notificaciones WhatsApp
- **4 colas de procesamiento** para tareas asíncronas
- **2 sistemas de auditoría** (bitácora detallada + bitácora simplificada)
- **18 eventos WhatsApp** procesados del proveedor Meta

---

## Próximos pasos sugeridos

1. **Documentar cada automatización** dentro del sistema (la tabla `system_dictionary` ya está diseñada para esto; conviene completarla).
2. **Dashboard de monitoreo**: ver en tiempo real cuántos mensajes hay en cola, cuántas tareas se escalaron, cuántas auditorías por día.
3. **Reportes de eficiencia**: medir cuánto tiempo ahorra cada automatización vs hacerlo manualmente.

---

*Para detalle técnico ver el documento [DETALLE-TECNICO.md](DETALLE-TECNICO.md).*
*Para inventario plano exportable a Excel ver [INVENTARIO.csv](INVENTARIO.csv).*
