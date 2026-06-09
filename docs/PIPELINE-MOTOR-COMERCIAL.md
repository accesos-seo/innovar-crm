# Pipeline Motor Comercial — Innovar CRM

**Versión:** 2.0  
**Fecha:** 2026-06-09  
**Estado:** En producción (15 agentes, 12 activos / 3 en diseño)  
**Reemplaza:** `informes/automatizaciones/INFORME-FLUJOS-DE-NEGOCIO.md` (mayo 19, 2026 — desactualizado)

---

## 1. Visión General del Pipeline

El Motor Comercial cubre el ciclo completo **Lead → Proyecto Cerrado** en 10 etapas, con 15 agentes automatizados, 10+ templates de WhatsApp, 2 workflows n8n y rutas públicas para el cliente.

```
[Lead entra]
     │
     ▼
 ① CAPTURA
 Receptor de Leads
 Asistente IA (en diseño)
     │
     ▼
 ② BIENVENIDA & CALIFICACIÓN
 Notificador de Bienvenida
 Monitor de Inactividad (paralelo, continuo)
 Reactivación de Leads (paralelo, continuo)
     │
     ▼
 ③ AGENDAMIENTO DE VISITA
 Agendador de Visitas
 ← cliente accede por /agendar/:token o /v/:code
     │
     ▼
 ④ POST-VISITA
 Gestor Post-Visita
     │
     ▼
 ⑤ CREACIÓN DE COTIZACIÓN
 Creador de Borrador (auto si ≥3 fotos + medidas)
 Gestor de Cotizaciones
 ← cliente accede por /cotizacion/:token o /c/:code
     │
     ▼
 ⑥ SEGUIMIENTO DE COTIZACIÓN
 Agente Seguimiento D+3/D+7 (workflow n8n LwKmUoeNc2TQqERQ)
 Notificador de Comprobante
     │
     ▼
 ⑦ CONVERSIÓN A PROYECTO
 Conversor a Proyecto (verifica pago → crea proyecto)
     │
     ▼
 ⑧ EJECUCIÓN DE PROYECTO
 Bienvenida al Proyecto
 Monitor de Producción
     │
     ▼
 ⑨ CIERRE DE PROYECTO
 Cierre de Proyecto (entrega + pago completo)
```

---

## 2. Agentes — Catálogo Completo

### ① CAPTURA

#### 🎯 Receptor de Leads
- **Estado:** Activo
- **Trigger:** Comercial llena formulario en `/leads/new`
- **Acciones automáticas:**
  - INSERT en `clients` con estado inicial `NEW`
  - `trg_audit_clients` → registra evento
  - `trg_client_lead_score` → calcula score
  - `trg_enqueue_whatsapp_new_lead` → encola WA al comercial
  - `tr_on_new_lead_email` → encola email bienvenida
- **Templates WA:** `notify_lead_followup_flow` (welcome_lead_v1)
- **Fases:** (1) Recibir lead · (2) Validar datos · (3) Notificar comercial · (4) Score inicial

#### 🤖 Asistente de Calificación IA
- **Estado:** En diseño
- **Trigger:** Lead nuevo sin respuesta del comercial en 2h
- **Acciones automáticas:** IA califica por WhatsApp (producto, presupuesto, medidas, urgencia)
- **Templates WA:** por definir
- **Fases:** (1) Detectar inactividad · (2) Iniciar conversación IA · (3) Calificar · (4) Actualizar score

---

### ② BIENVENIDA & CALIFICACIÓN

#### 📲 Notificador de Bienvenida
- **Estado:** Activo
- **Trigger:** Lead registrado con teléfono válido
- **Acciones automáticas:**
  - Envía WhatsApp de bienvenida al lead
  - Incluye nombre del comercial asignado
  - Incluye fecha propuesta de visita
- **Templates WA:** `welcome_lead_v1`
- **Fases:** (1) Detectar lead nuevo · (2) Preparar mensaje · (3) Enviar bienvenida

#### 💤 Monitor de Inactividad *(continuo — paralelo al pipeline)*
- **Estado:** Activo
- **Trigger:** Cron job diario
- **Lógica:**
  - Sin actividad 30 días → estado `DORMANT`
  - Sin actividad 60 días → estado `LOST`
- **Templates WA:** —
- **Fases:** (1) Escanear leads inactivos · (2) Clasificar por umbral · (3) Actualizar estado

#### 🔄 Reactivación de Leads *(continuo — paralelo al pipeline)*
- **Estado:** Activo
- **Trigger:** Cron 9:00 AM Bogotá
- **Lógica:**
  - Leads con >3 días sin visita agendada
  - Máximo 1 reactivación por semana por lead
  - Envía link de agendamiento
- **Templates WA:** `booking_link_v1`
- **Fases:** (1) Identificar leads elegibles · (2) Filtrar enviados esta semana · (3) Enviar link · (4) Actualizar `last_reactivation_sent_at`

---

### ③ AGENDAMIENTO DE VISITA

#### 📅 Agendador de Visitas
- **Estado:** Activo
- **Trigger:** Comercial agenda o cliente auto-agenda por link público
- **Acciones automáticas:**
  - Confirma fecha y bloquea slot en `availability_slots`
  - Envía confirmación WA al cliente
  - Envía notificación WA al técnico/admin asignado
  - Dispara recordatorio 24h antes
- **Rutas públicas:**
  - `/agendar/:token` — formulario de agendamiento del cliente (sin auth)
  - `/v/:code` — URL corta que resuelve short_code
- **Templates WA:** `appointment_booked`, `visit_assigned_admin_v1`
- **Fases:** (1) Verificar disponibilidad · (2) Bloquear slot · (3) Confirmar cliente · (4) Notificar equipo · (5) Recordatorio 24h

> ⚠️ `visit_assigned_admin_v1` pendiente aprobación Meta (#132001). Una vez aprobado funciona automáticamente.

---

### ④ POST-VISITA

#### 📋 Gestor Post-Visita
- **Estado:** Activo
- **Trigger:** Comercial/técnico marca visita como "realizada"
- **Acciones automáticas:**
  - Envía WhatsApp al cliente confirmando la visita
  - Crea tarea `"Preparar cotización"` asignada al comercial
  - Notifica al comercial por WA que tiene la tarea pendiente
- **Templates WA:** `task_assigned`
- **Fases:** (1) Detectar visita completada · (2) WhatsApp cliente · (3) Crear tarea · (4) Notificar comercial

---

### ⑤ CREACIÓN DE COTIZACIÓN

#### 📐 Creador de Borrador
- **Estado:** Activo
- **Trigger:** Visita tiene ≥3 fotos + medidas completas
- **Acciones automáticas:**
  - Genera borrador de cotización automáticamente
  - Pre-rellena desde `pricing_catalog`
  - Crea ítems en `quotation_items`
- **Templates WA:** —
- **Fases:** (1) Validar fotos y medidas · (2) Calcular ítems · (3) Generar borrador · (4) Notificar comercial

#### 📄 Gestor de Cotizaciones
- **Estado:** Activo
- **Trigger:** Comercial envía cotización al cliente
- **Acciones automáticas:**
  - Envía link único de cotización al cliente
  - Establece `valid_until` = `CURRENT_DATE + quotation_validity_days` (default 30 días)
  - Gestiona respuestas: aprobar / rechazar / solicitar ajustes
  - Al expirar: notifica admin y cierra cotización
- **Rutas públicas:**
  - `/cotizacion/:token` — página pública de la cotización (sin auth)
  - `/c/:code` — URL corta
- **Templates WA:** `quotation_sent_v1`, `admin_quotation_expired_v1`
- **Fases:** (1) Generar token único · (2) Enviar link cliente · (3) Monitorear respuesta · (4) Gestionar expiración

---

### ⑥ SEGUIMIENTO DE COTIZACIÓN

#### 📊 Agente de Seguimiento D+3/D+7
- **Estado:** Activo (DRY_RUN=true — pendiente validación Robert)
- **Workflow n8n:** `LwKmUoeNc2TQqERQ` — "Innovar — Seguimiento Cotizaciones D+3/D+7"
- **Trigger:** Cron 9:00 AM Bogotá, todos los días
- **Lógica:**
  - D+3: cotizaciones pendientes 3-6 días → recordatorio al cliente
  - D+7: cotizaciones pendientes 7+ días → alerta al comercial
  - Skip si alertada en las últimas 12h
- **Ruta interna:** `/agentes/seguimiento-cotizaciones` — panel operativo con toggle ON/OFF + ejecutar ahora + recordatorio por fila
- **Templates WA:** (seguimiento — templates pendientes aprobación)
- **Fases:** (1) Clasificar cotizaciones · (2) Filtrar alertadas recientemente · (3) D+3 al cliente · (4) D+7 al comercial

#### 🔔 Notificador de Comprobante
- **Estado:** Activo
- **Trigger:** Cliente sube comprobante de pago
- **Acciones automáticas:**
  - Detecta upload del comprobante
  - Notifica al admin/comercial para verificación manual
- **Templates WA:** (notificación interna)
- **Fases:** (1) Detectar upload · (2) Notificar admin · (3) Esperar verificación

---

### ⑦ CONVERSIÓN A PROYECTO

#### ✅ Conversor a Proyecto *(agente crítico)*
- **Estado:** Activo
- **Trigger:** Admin verifica pago manualmente
- **Acciones automáticas (secuenciales):**
  1. Verifica `is_fully_paid = true` en la cotización
  2. Crea proyecto en `projects` (Lead→Project refactor v2)
  3. Bloquea la cotización (`locked = true`)
  4. Asigna diseñador al proyecto
  5. Crea tareas iniciales de diseño
  6. Genera PDF de confirmación
  7. Envía WhatsApp al cliente con bienvenida al proyecto
- **Rutas internas:** `/projects`, `/projects/new`, `/projects/:id`
- **Templates WA:** (confirmación proyecto)
- **Fases:** (1) Verificar pago · (2) Crear proyecto · (3) Asignar equipo · (4) Generar PDF · (5) Notificar cliente · (6) Notificar equipo

---

### ⑧ EJECUCIÓN DE PROYECTO

#### 🎉 Bienvenida al Proyecto
- **Estado:** Activo
- **Trigger:** Proyecto creado exitosamente
- **Acciones automáticas:**
  - Envía WhatsApp al cliente presentando el proyecto
  - Incluye nombre del diseñador asignado
  - Incluye próximos pasos
- **Templates WA:** (bienvenida proyecto)
- **Fases:** (1) Proyecto creado · (2) Preparar mensaje · (3) Enviar bienvenida · (4) Crear tarea seguimiento

#### 🔨 Monitor de Producción
- **Estado:** Activo
- **Trigger:** Cambios de estado en el proyecto
- **Lógica:**
  - Fabricación iniciada → notifica cliente
  - Instalación programada → notifica cliente con fecha
  - Día D recordatorio → notifica cliente 24h antes
- **Templates WA:** (estados producción)
- **Fases:** (1) Detectar cambio estado · (2) Seleccionar template · (3) Notificar cliente

---

### ⑨ CIERRE DE PROYECTO

#### 🎊 Cierre de Proyecto
- **Estado:** Activo
- **Trigger:** `delivered_at IS NOT NULL` AND `is_fully_paid = true`
- **Acciones automáticas:**
  - Cierra el proyecto contablemente
  - Envía WhatsApp de agradecimiento al cliente
  - Crea tarea "Solicitar reseña Google"
- **Templates WA:** (agradecimiento + solicitud reseña)
- **Fases:** (1) Detectar entrega completa · (2) Verificar pago total · (3) Cierre contable · (4) WhatsApp agradecimiento · (5) Tarea reseña

---

## 3. Mapa de Rutas Completo

### Rutas públicas *(sin autenticación — acceso del cliente)*

| Ruta | Componente | Propósito |
|------|-----------|-----------|
| `/agendar/:token` | `PublicBookingPage` | Cliente agenda su visita técnica |
| `/v/:code` | `PublicBookingByCodePage` | URL corta de agendamiento |
| `/cotizacion/:token` | `PublicQuotationPage` | Cliente ve y aprueba su cotización |
| `/c/:code` | `PublicQuotationByCodePage` | URL corta de cotización |

### Rutas internas del pipeline *(requieren auth)*

| Ruta | Componente | Etapa |
|------|-----------|-------|
| `/motor-comercial` | `MotorComercialPage` | Dashboard del pipeline completo |
| `/leads` | `LeadsPage` | Etapas ①②③ |
| `/leads/new` | `LeadCreatePage` | Captura de lead |
| `/quotations` | `QuotationsPage` | Etapas ⑤⑥ |
| `/quotations/new` | `QuotationCreatePage` | Crear cotización |
| `/quotations/:id` | `QuotationDetailPage` | Detalle cotización |
| `/projects` | `ProjectsPage` | Etapas ⑦⑧⑨ |
| `/projects/new` | `ProjectCreatePage` | Crear proyecto |
| `/projects/:id` | `ProjectDetailPage` | Detalle proyecto |
| `/agenda` | `AgendaPage` | Gestión de visitas (etapa ③) |
| `/agentes` | `AgentesPage` | Hub de agentes |
| `/agentes/seguimiento-cotizaciones` | `SeguimientoCotizacionesPage` | Panel agente D+3/D+7 |
| `/agentes/:agentId` | `AgentDetailPage` | Detalle de cualquier agente |
| `/clients` | `ClientsPage` | Directorio de clientes |

### Rutas de soporte

| Ruta | Propósito |
|------|-----------|
| `/tasks` | Gestión de tareas generadas por agentes |
| `/finanzas/pagos` | Verificación de comprobantes |
| `/finanzas/gastos` | Gastos del proyecto |
| `/finanzas/cierres` | Cierre contable (etapa ⑨) |
| `/notifications` | Centro de notificaciones |
| `/settings` | Configuración del sistema |
| `/reuniones` | Reuniones de equipo |

---

## 4. Template Registry WhatsApp

| Template | Etapa | Destinatario | Estado |
|----------|-------|-------------|--------|
| `welcome_lead_v1` | ① | Cliente (lead) | ✅ Activo |
| `notify_lead_followup_flow` | ① | Comercial | ✅ Activo |
| `booking_link_v1` | ② | Cliente | ✅ Activo |
| `appointment_booked` | ③ | Cliente | ✅ Activo |
| `visit_assigned_admin_v1` | ③ | Técnico/Admin | 🔴 Pendiente Meta #132001 |
| `task_assigned` | ④ | Comercial | ✅ Activo |
| `quotation_sent_v1` | ⑤ | Cliente | ✅ Activo |
| `admin_quotation_expired_v1` | ⑤ | Admin | ✅ Activo |
| (seguimiento D+3) | ⑥ | Cliente | 🟡 DRY_RUN |
| (seguimiento D+7) | ⑥ | Comercial | 🟡 DRY_RUN |

**Phone ID activo:** ver `.env` → `VITE_WA_PHONE_ID`  
**Phone de prueba:** ver `~/.claude/secrets.env` (Robert, Heduin)

---

## 5. Workflows n8n Activos

| ID | Nombre | Trigger | Estado |
|----|--------|---------|--------|
| `LwKmUoeNc2TQqERQ` | Innovar — Seguimiento Cotizaciones D+3/D+7 | Cron 9AM Bogotá | 🟡 ACTIVO (DRY_RUN=true) |

**Para activar producción:** En nodo "Config" del workflow → cambiar `DRY_RUN` a `false`. Requiere `slice_3_enabled=true` y templates Meta aprobadas.

---

## 6. Máquina de Estados

### Lead / Client (`clients.status`)

```
NEW → CONTACTED → QUALIFIED → VISIT_SCHEDULED → VISITED → IN_QUOTATION
   → CONVERTED (proyecto creado)
   → DORMANT (30 días sin actividad)
   → LOST (60 días sin actividad)
```

### Cotización (`quotations.status`)

```
DRAFT → SENT → APPROVED → LOCKED (cuando se crea el proyecto)
             → REJECTED
             → EXPIRED (30 días sin respuesta)
             → REVISION_REQUESTED
```

### Proyecto (`projects.status`)

```
CREATED → DESIGN → DESIGN_APPROVED → PRODUCTION → INSTALLATION → DELIVERED
```

---

## 7. Pendientes de Producción

| # | Item | Bloqueante | Acción |
|---|------|-----------|--------|
| 1 | `visit_assigned_admin_v1` | Meta #132001 — template no existe en BM | Robert crea template en Meta BM con 4 parámetros |
| 2 | Seguimiento D+3/D+7 (WA real) | DRY_RUN=true | Robert valida mensajes → cambiar `DRY_RUN=false` en n8n |
| 3 | `wa_test_phone_override` activo | Todos los WA van a Robert en pruebas | Ejecutar SQL `UPDATE system_settings SET value='null'::jsonb WHERE key='wa_test_phone_override'` |
| 4 | Merge `ux-fixes` → `main` | Robert valida E2E en producción | `git checkout main && git merge ux-fixes && git push origin main` |

---

## 8. Infraestructura

- **Base de datos:** Supabase `ver `.env` → `SUPABASE_PROJECT_ID``
- **Edge Functions:** `ver `.env` → `SUPABASE_PROJECT_ID`` (notify-lead-followup, send-quotation-to-client, n8n-proxy, convert-to-project, etc.)
- **WhatsApp API:** Meta Business API v17 — phone ver `.env` → `VITE_WA_PHONE_ID`
- **n8n:** ver `.env` → `VITE_N8N_BASE_URL`
- **Cron queue procesamiento WA:** cada 1 minuto (Supabase cron)
- **Rama activa:** `ux-fixes` (last commit `185697b`)
