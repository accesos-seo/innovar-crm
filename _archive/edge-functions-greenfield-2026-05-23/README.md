# Edge Functions archivadas — flujo WhatsApp + Booking público (2026-05-23)

Estas funciones fueron escritas asumiendo greenfield, pero **ya existe en producción** un sistema WhatsApp con sus propias Edge Functions (`process-whatsapp-notifications` v12 + `meta-whatsapp-webhook` v12) procesando templates aprobados con éxito real (`wamid.*` de Meta).

Si se deployaran como están, **sobrescribirían el worker de producción** y romperían el envío de los templates ya aprobados (`appointment_booked`, `bienvenidas_clientes`, `payment_received`, `recordatorio24hantes`, `task_assigned`).

## Cuándo se pueden usar

Estas son **referencias de diseño** — el patrón del registry de templates y el HMAC validator del webhook están bien y son reusables. Cuando Meta apruebe los templates `welcome_lead_v1` + `booking_link_v1` (ver [reference_innovar_whatsapp_templates.md](../../../../.claude/projects/C--Users-ceoel/memory/reference_innovar_whatsapp_templates.md)), la integración correcta es:

1. **NO redeployar** estos archivos.
2. Descargar el código real del `process-whatsapp-notifications` v12 desde el Dashboard de Supabase (Studio → Functions → process-whatsapp-notifications → Source code).
3. Committearlo al repo (la carpeta `supabase/functions/` está untracked — antes hay que decidir si la versionamos).
4. Extender su registro de templates con `welcome_lead_v1` y `booking_link_v1` (copiar los builders desde `process-whatsapp-notifications/index.ts` de este archive).
5. Redeployarlo como v13.

Para el webhook: el `meta-whatsapp-webhook` v12 ya está en uso. Si su lógica de status events no cubre lo que el webhook archivado hace (inserts en `meta_whatsapp_status_events` + update de `notification_queue.delivery_status`), considerar extenderlo igual que el worker.

## Por qué quedó archivado

- `process-whatsapp-notifications/index.ts`: el `TEMPLATE_REGISTRY` solo conoce 2 templates de los 12+ que ya están en uso → marcaría como `failed` cada envío que no sea `welcome_lead_v1`/`booking_link_v1`.
- `whatsapp-webhook/index.ts`: tendría que reemplazar al `meta-whatsapp-webhook` activo y reconfigurar Meta. Ningún beneficio sobre lo existente.

## Lo que SÍ se aplicó del paquete

- Migración 014 (`db/migrations/014_whatsapp_lead_followup_flow.sql`) — aplicada y validada.
- Página pública `/agendar/:token` + hooks — operativa, no depende de WhatsApp.
- 3 RPCs públicas `get_public_booking_context` / `get_public_visit_slots` / `book_public_visit` — testeadas.
