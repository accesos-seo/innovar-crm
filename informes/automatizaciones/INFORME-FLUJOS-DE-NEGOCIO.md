# Flujos de Negocio — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Este documento describe **los flujos completos del negocio** tal como están implementados en Innovar CRM, paso a paso, desde que entra un lead hasta que se cierra contablemente el proyecto. Cada flujo muestra:

- Las acciones del usuario
- Las acciones automáticas del sistema
- Los puntos donde se notifica al cliente
- Los puntos donde queda registro en auditoría

---

## 1. Flujo principal — Del Lead al Proyecto Entregado

```
[Lead llega]
     ↓
[Comercial registra lead]
     ↓
[Sistema: bienvenida + score + WhatsApp al comercial]
     ↓
[Comercial cotiza]
     ↓
[Sistema: numera + recalcula + lock al aprobar]
     ↓
[Cliente aprueba]
     ↓
[Sistema: crea proyecto + tareas iniciales + WhatsApp al cliente]
     ↓
[Diseño 3D + Renders]
     ↓
[Cliente aprueba renders]
     ↓
[Producción]
     ↓
[Sistema: notifica a producción + actualiza score lead]
     ↓
[Instalación]
     ↓
[Entrega]
     ↓
[Sistema: garantía + encuesta satisfacción + cierre contable]
```

---

## 2. Flujo: Captación y Calificación de Lead

### Actores: Comercial
### Entidades afectadas: `clients`, `audit_log`, `notification_queue`

```
Acción usuario               | Acción automática del sistema
-----------------------------|----------------------------------
1. Comercial llena form      | 
   "Nuevo Lead" con datos    |
                             |
2. Clic en Guardar          |
                             | → Valida datos con Zod schema
                             | → INSERT en tabla clients
                             | → trg_audit_clients: registra evento
                             | → trg_client_lead_score: calcula score
                             | → trg_enqueue_whatsapp_new_lead: encola WhatsApp
                             | → tr_on_new_lead_email: encola email bienvenida
                             |
                             | (1 minuto después)
                             | → Cron job procesa cola WhatsApp
                             | → Envia mensaje a comercial: "Nuevo lead {nombre}"
                             | → Recibe webhook delivered/read del proveedor Meta
                             | → Almacena en meta_whatsapp_status_events
                             |
3. Comercial ve notificación | 
   y contacta al lead        |
                             |
4. Actualiza estado a       |
   CONTACTED                 |
                             | → trg_audit_clients: registra cambio
                             | → trg_client_lead_score: recalcula score
                             |
5. Si califica, lo deja en  |
   QUALIFIED                 |
```

### Resultado al final del flujo
- Lead registrado con score asignado
- Comercial notificado por WhatsApp
- Email enviado al lead
- 3+ eventos en bitácora de auditoría
- Lead listo para pasar a cotización

---

## 3. Flujo: Creación de Cotización

### Actores: Comercial
### Entidades afectadas: `quotations`, `quotation_items`, `pricing_catalog`, `audit_log`

```
Acción usuario               | Acción automática del sistema
-----------------------------|----------------------------------
1. Clic en Nueva Cotización |
                             |
2. Selecciona cliente       | → Trae datos del cliente
                             |
3. Elige categoría de       |
   producto (ej. Cocinas)    |
                             |
4. Configura el producto:    |
   - Medidas                 |
   - Materiales              |
   - Opciones                |
                             | → Cada cambio en config:
                             |   - Llama POST /api/quotations/calculate-item
                             |   - Backend Express lee pricing_catalog
                             |   - Motor server-side calcula subtotal
                             |   - Devuelve precio actualizado
                             |
5. Repite para más ítems    | → Mismo flujo por cada ítem
                             |
6. Aplica descuento si      |
   corresponde               |
                             |
7. Define transporte        |
   (default $600.000)        |
                             |
8. Clic en Guardar          |
                             | → generate_next_quotation_number():
                             |   - SELECT FOR UPDATE secuencia
                             |   - Devuelve COT-YYYY-NNNN único
                             | → INSERT cotización en draft
                             | → INSERT items
                             | → trg_recalculate_quotation_totals
                             | → trg_audit_quotations
                             | → trg_quotation_lead_score
                             |
9. Clic en Enviar Cliente  |
                             | → Estado cambia a 'sent'
                             | → trg_pdf_on_quotation_status:
                             |   - Encola PDF en pdf_generation_queue
                             | → Edge function generate-quotation-pdf:
                             |   - Genera PDF
                             |   - Sube a Storage bucket
                             |   - Actualiza quotation_pdf_url
                             | → trg_wa_quotation_expiry:
                             |   - Programa alerta de vencimiento
```

### Resultado
- Cotización numerada con secuencia única
- PDF generado disponible para descarga
- Items con precios desde catálogo central
- Auditoría completa de cada item

---

## 4. Flujo: Aprobación de Cotización → Creación de Proyecto

### Actores: Cliente (vía aprobación externa) + Sistema
### Entidades afectadas: `quotations`, `projects`, `tasks`, múltiples notificaciones

```
Estado: cotización en 'sent'
     ↓
Cliente revisa y aprueba
     ↓
Comercial marca como aprobada en el sistema
     ↓
trg_create_project_from_approved_quotation:
   → INSERT en projects:
     - client_id (de la cotización)
     - approved_quotation_id (de la cotización)
     - work_type (categoría dominante de la cotización)
     - total_amount (de la cotización)
     - status = 'cotizacion_aprobada'
     - data_origin = 'system'
     ↓
trg_create_project_starter_tasks:
   → Crea tareas iniciales del proyecto:
     - Medición técnica
     - Diseño preliminar
     - Aprobación de modelado
     - Renders
     - Pedido de materiales
     - Producción
     - Instalación
     - Entrega final
     ↓
trg_prevent_changes_on_finalized_quotation_items se activa:
   → A partir de ahora la cotización es INMUTABLE
     ↓
trg_project_status_notification:
   → Notifica cambio de estado
     ↓
trg_wa_project_status_change:
   → Encola WhatsApp al cliente: "Tu proyecto fue creado"
     ↓
trigger_notify_production:
   → Notifica al equipo de producción del nuevo proyecto
     ↓
[Auditoría de TODOS los pasos en audit_log]
```

### Resultado
- Proyecto creado automáticamente con todos los datos
- 8 tareas iniciales asignables
- Cliente notificado por WhatsApp
- Equipo de producción al tanto
- Cotización bloqueada para modificaciones

---

## 5. Flujo: Diseño 3D y Renders

### Actores: Diseñador asignado, Cliente, Admin
### Entidades afectadas: `projects` (campo `design_3d_files`, `render_revision_number`)

```
1. Admin asigna designer_id al proyecto
   → Diseñador queda con permisos sobre el proyecto (RLS)
   → trg_notify_task_assigned: WhatsApp al diseñador
     ↓
2. Diseñador sube archivo 3D inicial
   → Upload a Storage bucket project-3d-files
   → JSON con versión, URL, fecha, autor agregado a design_3d_files
   → modelado_revision_number incrementa
     ↓
3. Comercial comparte link con cliente
     ↓
4. Cliente aprueba o pide cambios
   → Si pide cambios: render_revision_number++, ciclo se repite
   → Si aprueba: renders_approved_at se setea
     ↓
5. Estado del proyecto avanza a 'renders'
   → trg_project_status_notification
   → trg_wa_project_status_change: WhatsApp al cliente
```

### Punto importante: Designer ownership
El diseñador **solo ve proyectos donde está asignado** (`designer_id = auth.uid()`), gracias a la policy `user_projects_read` en la tabla `projects`. Esto se aplica a nivel base de datos — no requiere lógica en el frontend.

---

## 6. Flujo: Recepción de Pago y Avance Automático

### Actores: Comercial / Admin
### Entidades afectadas: `payments`, `projects`, `notification_queue`

```
1. Comercial registra pago del cliente:
   - Monto, método, fecha
   - Comprobante adjunto (opcional)
     ↓
2. INSERT en payments
     ↓
3. trg_after_payment_insert ejecuta:
   → check_and_update_project_status_on_payment:
     - Lee project.total_amount, project.advance_amount
     - Suma pagos recibidos hasta ahora
     - Si cubre anticipo → avanza proyecto a producción
     - Si cubre saldo → avanza a entrega/cerrado
     ↓
4. trg_notify_payment_received:
   → Encola WhatsApp al cliente: "Pago de $X recibido. Gracias."
     ↓
5. trigger_handle_payment_approval:
   → Lógica de aprobación automática del pago
     ↓
6. trg_audit_payments:
   → Registra en bitácora con autor y monto
```

### Resultado
- Estado del proyecto puede avanzar **solo** por el pago recibido
- Cliente confirmado por WhatsApp
- Saldo recalculado automáticamente
- Trazabilidad completa del pago

---

## 7. Flujo: Aprobación de Gastos

### Actores: Operario/Diseñador (solicita), Admin (aprueba)
### Entidades afectadas: `expenses`, `notification_queue`

```
1. Operario registra gasto del proyecto:
   - Categoría, monto, comprobante
   - Estado inicial: 'pendiente'
     ↓
2. trg_notify_expense_pending:
   → WhatsApp al Admin: "Gasto pendiente de aprobación"
     ↓
3. Admin revisa
     ↓
   3a. APRUEBA:
       → UPDATE expense.approval_status = 'aprobado'
       → expense.approved_by = admin.id
       → trg_notify_expense_reviewed:
         → WhatsApp al solicitante: "Tu gasto fue aprobado"
       → Gasto entra al cálculo del proyecto
     ↓
   3b. RECHAZA:
       → UPDATE expense.approval_status = 'rechazado'
       → Notes con motivo
       → trg_notify_expense_reviewed:
         → WhatsApp al solicitante: "Tu gasto fue rechazado: {motivo}"
       → NO entra al cálculo del proyecto
     ↓
4. trg_audit_expenses registra todo el flujo
```

### Resultado
- Doble confirmación para asegurar control de gastos
- Solicitante siempre enterado del resultado
- Auditoría completa para revisión posterior
- Solo gastos aprobados impactan el balance financiero

---

## 8. Flujo: Asignación de Tarea con Sincronización a Calendar

### Actores: Cualquier rol con permisos
### Entidades afectadas: `tasks`, `availability_slots`, `calendar_sync_queue`

```
1. Usuario crea tarea con:
   - Título, descripción
   - Asignado a (otro usuario)
   - Fecha y hora
     ↓
2. INSERT en tasks
     ↓
3. trg_book_task_availability:
   → sync_task_availability_booking:
     - Busca slot disponible del responsable en esa fecha
     - Marca slot como is_booked = true
     - Vincula task_id ↔ availability_slot
     ↓
4. trg_calendar_sync_insert:
   → fn_queue_calendar_sync:
     - INSERT en calendar_sync_queue con action='create'
     ↓
5. trg_notify_task_assigned:
   → WhatsApp al responsable: "Nueva tarea: {título}"
     ↓
6. trg_notify_booking_created (si es booking):
   → WhatsApp adicional con detalles de la cita
     ↓
7. Edge function sync-google-calendar (asíncrono):
   → POST a Google Calendar API
   → Crea evento en el calendar del responsable
   → Actualiza queue: status='synced', guarda google_event_id
     ↓
8. Si la tarea se actualiza:
   → trg_calendar_sync_update encola action='update'
     ↓
9. Si la tarea se elimina:
   → trg_book_task_availability libera el slot
   → trg_calendar_sync_delete encola action='delete'
   → Edge function elimina evento de Google Calendar
```

### Resultado
- Tarea sincronizada en 3 lugares: Innovar CRM, Google Calendar, slots de agenda
- Responsable notificado por WhatsApp
- Disponibilidad del responsable actualizada en tiempo real
- Toda modificación se propaga automáticamente

---

## 9. Flujo: Bloqueo de Festivos en Agenda

### Actores: Admin
### Entidades afectadas: `holidays`, `availability_slots`

```
1. Admin agrega un festivo (ej. "Día del trabajo - 1 de mayo")
     ↓
2. INSERT en holidays con date='2026-05-01'
     ↓
3. tr_block_slots_after_holiday_insert:
   → fn_block_slots_on_holiday:
     - UPDATE availability_slots SET is_booked = true
     - WHERE date = '2026-05-01'
     - Para TODOS los staff
     ↓
4. Resultado inmediato:
   → Nadie puede ser agendado ese día
   → Si alguien intenta reservar, el sistema responde "Sin disponibilidad"
```

### Resultado
- Festivos se respetan automáticamente
- No se requiere que cada miembro bloquee su calendar manualmente
- Configuración centralizada

---

## 10. Flujo: Cotización por Vencer

### Actores: Sistema (automático)
### Entidades afectadas: `quotations`, `notification_queue`

```
Cuando una cotización se aprueba o se envía:
trg_wa_quotation_expiry calcula:
   → valid_until = now() + 30 days (default)
     ↓
N días antes del vencimiento (ej. 3 días antes):
[Probable cron job inferido]:
   → SELECT cotizaciones con valid_until entre now() y now()+3days
   → AND status IN ('sent', 'draft')
   → Por cada una:
     → enqueue_notification con template 'cotizacion_por_vencer'
     ↓
Cron job WhatsApp procesa la cola (cada minuto):
   → Envía recordatorio al cliente
   → "Tu cotización COT-2026-XXX vence en 3 días"
     ↓
Si cliente no responde y pasan los 30 días:
   → Estado cambia a 'expired'
   → No se pueden reabrir items
```

### Resultado
- Clientes no pierden cotizaciones por olvido
- Equipo comercial no necesita recordar manualmente
- Recordatorio profesional vía WhatsApp

---

## 11. Flujo: Encuesta de Satisfacción Post-Entrega

### Actores: Sistema (automático), Cliente
### Entidades afectadas: `projects`, `satisfaction_surveys`, `notification_queue`

```
1. Comercial marca proyecto como 'entregado'
     ↓
2. trg_auto_post_delivery se dispara:
   → INSERT en satisfaction_surveys:
     - project_id
     - client_id
     - status = 'pending'
   → INSERT en warranties:
     - starts_at = now()
     - expires_at = now() + 12 months
     - status = 'active'
     ↓
3. Cuando la encuesta se marca como lista a enviar:
   → enqueue_notification con template 'encuesta_satisfaccion'
   → Estado de la encuesta: 'sent'
     ↓
4. Cliente recibe WhatsApp con link a la encuesta
     ↓
5. Cliente responde (1-5 en 4 dimensiones + comentarios + would_recommend)
     ↓
6. UPDATE satisfaction_surveys:
   → responded_at = now()
   → status = 'responded'
   → Ratings y comentarios guardados
     ↓
7. Si no responde en plazo:
   → status = 'expired' (vía cron job)
```

### Resultado
- Feedback estructurado automático tras cada proyecto
- Métricas NPS por proyecto y agregadas
- Base de datos para mejorar el servicio

---

## 12. Flujo: Reclamo de Garantía

### Actores: Cliente, Soporte/Admin
### Entidades afectadas: `warranties`, `warranty_claims`

```
1. Cliente reporta problema (vía WhatsApp, llamada, o portal de tracking)
     ↓
2. Soporte verifica garantía vigente:
   → SELECT * FROM warranties WHERE expires_at > now() AND status='active'
     ↓
3. Crea reclamo:
   → INSERT en warranty_claims:
     - warranty_id, description
     - severity: low/medium/high/critical
     - status: 'open'
     - assigned_to (responsable)
     ↓
4. Notificación al responsable asignado
     ↓
5. Responsable trabaja en el reclamo:
   → Actualiza status a 'in_progress'
   → Agrega resolution_notes
     ↓
6. Cierre del reclamo:
   → status = 'resolved' (con notas)
   → resolved_at = now()
     ↓
7. Si la garantía se "consume" (ej. cambio de pieza):
   → warranties.status = 'claimed'
   → Sigue activa para otros reclamos
     ↓
8. Si es voida (cliente la anula):
   → warranties.status = 'voided'
```

### Resultado
- Control formal de garantías
- Trazabilidad por severidad
- Histórico de problemas por proyecto

---

## 13. Flujo: Cierre Contable de Proyecto

### Actores: Admin
### Entidades afectadas: `projects`, `payments`, `expenses`, `accounting_closures`

```
1. Admin va a Cierres Contables y selecciona proyecto
     ↓
2. Función SQL create_accounting_closure(project_id):
   → SELECT SUM(amount) FROM payments WHERE project_id = X → total_income
   → SELECT SUM(amount) FROM expenses WHERE project_id = X
     AND approval_status='aprobado' → total_expenses
   → net_profit = total_income - total_expenses
   → profit_margin = (net_profit / total_income) * 100
   → INSERT accounting_closure con status='draft'
     ↓
3. Admin revisa cifras y marca como 'closed'
     ↓
4. Posteriormente, gerencia revisa y aprueba:
   → status = 'reviewed'
     ↓
5. Proyecto queda con accounting_closure_id apuntando al cierre
```

### Resultado
- Cierre financiero automático del proyecto
- Margen calculado solo con gastos aprobados
- Imposible alterar cierre revisado sin auditoría

---

## 14. Flujo paralelo: Procesamiento continuo de cola WhatsApp

### Actor: Cron Job 2 (Postgres pg_cron)
### Frecuencia: cada minuto

```
Cada minuto (cron job 2):
   ↓
POST a edge function process-whatsapp-notifications
   body: { dry_run: false, limit: 25 }
   ↓
Edge function ejecuta:
   1. SELECT 25 mensajes con status='pending'
      ordenados por created_at ASC
   2. Para cada uno:
      a. UPDATE status='processing'
      b. Llama Meta WhatsApp Business API:
         POST https://graph.facebook.com/v17.0/{phone_id}/messages
         con template_name, parameters, recipient_phone
      c. Si OK:
         - UPDATE status='sent'
         - Guarda provider_message_id
         - Guarda provider_response
      d. Si FAIL:
         - UPDATE status='failed', error_message=err
         - Incrementa attempt_count
         - Si attempts >= 3: marca como 'skipped'
   ↓
Webhook entrante de Meta (asíncrono):
   POST a edge function whatsapp-webhook
   body: { entry: [{ changes: [{ value: { statuses: [...] } }] }] }
   ↓
Webhook procesa:
   1. Por cada status update (sent/delivered/read/failed):
      a. INSERT en meta_whatsapp_status_events con payload completo
      b. UPDATE notification_queue.delivery_status según corresponda
      c. Setea timestamp correspondiente (sent_at/delivered_at/read_at)
```

### Resultado
- Procesamiento garantizado de mensajes pendientes
- Confirmaciones de entrega trazadas
- Métricas exportables para reportes
- Retry automático ante fallos transitorios

---

## Resumen de flujos automáticos del sistema

| Proceso | Frecuencia / Disparo | Beneficio para el negocio |
|---|---|---|
| Captación de lead | Al crear cliente | Score automático + notificación al comercial |
| Cotización a proyecto | Al aprobar cotización | Crea proyecto + tareas iniciales sin trabajo manual |
| Pago avanza proyecto | Al registrar pago | Estado del proyecto evoluciona solo |
| Aprobación de gasto | Manual + auto-notificación | Doble control con transparencia total |
| Sync agenda Google Calendar | En cada cambio de tarea | Equipo siempre sincronizado |
| Bloqueo de festivos | Al agregar festivo | Sin agendar accidental en feriado |
| Recordatorio cotización por vencer | Programado | No se pierden ventas por olvido |
| Encuesta post-entrega | Automática | Feedback estructurado de cada cliente |
| Procesamiento WhatsApp | Cada minuto | Comunicación masiva confiable |
| Auditoría completa | En cada cambio | Trazabilidad para gerencia y auditoría |
| Cierre contable | Manual con cálculo automático | Sin errores aritméticos en cifras finales |

---

## Conclusión

Cada flujo del negocio en Innovar CRM tiene **partes automatizadas que ahorran trabajo manual y partes humanas donde se toman decisiones**. La división está pensada para que:

- **El equipo dedique tiempo al cliente**, no a tareas repetitivas
- **Los errores administrativos sean imposibles** (numeración duplicada, gastos no auditados, agendas chocadas)
- **Cada paso quede registrado** para auditoría posterior
- **El cliente reciba comunicación profesional** sin que nadie tenga que escribirle manualmente

Los 11 flujos descritos cubren prácticamente todo el ciclo de negocio del modelo Innovar.

---

*Documento de flujos de negocio generado el 19 de mayo de 2026 a partir del análisis de los 50 triggers y 51 funciones SQL activas en producción.*
