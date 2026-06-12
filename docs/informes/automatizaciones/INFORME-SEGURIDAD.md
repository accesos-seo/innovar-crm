# Informe de Seguridad y Protección de Datos — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Innovar CRM implementa **múltiples capas de seguridad** que protegen la información del negocio en todo momento. No es solo "una base de datos con contraseña": es un sistema con reglas activas que vigilan cada operación, auditan cada cambio y protegen contra accesos no autorizados, manipulaciones internas y errores humanos.

Este documento resume las protecciones activas actualmente en el sistema.

---

## 1. Control de acceso por rol (RLS — Row Level Security)

Cada usuario solo ve y modifica lo que su rol le permite. La base de datos misma valida los permisos en cada consulta, no solo la aplicación. Esto significa que **aunque alguien intentara acceder por fuera del sistema, las reglas de la base de datos seguirían aplicando**.

### Roles definidos

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Acceso total al sistema, gestión de usuarios, configuración |
| **Comercial** | Gestión de leads, clientes y cotizaciones |
| **Diseñador** | Acceso a proyectos asignados, archivos 3D, despieces |
| **Producción** | Lectura de proyectos + actualizar estado de producción únicamente |

### Tablas protegidas con RLS activo

`projects`, `quotations`, `quotation_items`, `materials`, `pricing_catalog`, `holidays`, `profiles`, `clients` y otras — un total de **8 tablas críticas** con Row Level Security activado y políticas específicas por rol.

---

## 2. Auditoría completa de cambios

**Cada modificación importante queda registrada automáticamente** en la bitácora del sistema (`audit_log`). El registro incluye:

- Quién hizo el cambio (usuario identificado)
- Cuándo (fecha y hora exactas)
- Qué tabla y qué registro se afectó
- Valores antes del cambio (`old_data`)
- Valores después del cambio (`new_data`)

### Tablas auditadas automáticamente

- Clientes
- Cotizaciones
- Items de cotización
- Proyectos
- Pagos
- Gastos
- Tareas

### Estado actual

- **162 eventos** ya registrados en la bitácora oficial
- Sistema redundante con bitácora simplificada (`audit_logs`) como respaldo

**Beneficio**: si algún dato cambia incorrectamente, es posible saber exactamente quién, cuándo y qué se modificó — y restaurar el valor anterior.

---

## 3. Protección contra escalada de privilegios

El sistema impide automáticamente que un usuario se asigne a sí mismo un rol superior. Si un comercial intenta cambiarse a "Administrador", la base de datos rechaza la operación incluso si el frontend lo permitiera por error.

**Implementación**: trigger `trg_prevent_non_admin_profile_role_change` activo en la tabla `profiles`.

---

## 4. Anti-manipulación de cotizaciones aprobadas

Una vez que el cliente aprueba una cotización, **el sistema bloquea cualquier modificación** sobre sus items (precios, cantidades, descripciones). Esto previene:

- Cambios accidentales en cotizaciones ya enviadas al cliente
- Manipulación intencional de cifras post-aprobación
- Inconsistencias entre lo cotizado y lo facturado

**Implementación**: trigger `trg_prevent_changes_on_finalized_quotation_items` con bloqueo a nivel base de datos (no se puede saltear).

---

## 5. Cierre automático de pagos aprobados

Los pagos aprobados quedan registrados de forma inmutable. Cualquier modificación posterior queda registrada en bitácora de auditoría con identificación del responsable.

---

## 6. Autenticación segura

### Mecanismo
- **JSON Web Tokens (JWT)** firmados criptográficamente — estándar de la industria
- Tokens con vencimiento automático (1 hora por defecto)
- Refresh automático para que el usuario no tenga que reloguearse constantemente
- Almacenamiento seguro en el navegador (con storageKey aislado del proyecto)

### Recovery automático de sesión rota (implementado 19/05/2026)
- Si la sesión queda inválida o atascada, el sistema detecta el problema en menos de 30 segundos
- Redirige automáticamente al login sin que el usuario tenga que recargar manualmente
- Detecta múltiples escenarios: refresh fallido, timeouts repetidos, token vencido

---

## 7. Validación de datos en múltiples capas

El sistema valida los datos en **3 niveles distintos** antes de aceptarlos:

| Capa | Validación |
|---|---|
| **Frontend (React)** | Validación instantánea con Zod schemas antes de enviar |
| **Backend (Express)** | Re-validación de cada request |
| **Base de datos** | Constraints SQL (NOT NULL, CHECK, UNIQUE, FK) que rechazan datos inválidos en último recurso |

**Beneficio**: aunque alguien intente forzar datos inválidos por API directa, la base de datos misma los rechaza.

---

## 8. Hosting y comunicaciones seguras

### Infraestructura
- **Supabase** (Postgres 17 en AWS, región us-west-2)
  - Estado actual: ACTIVE_HEALTHY
  - Backups automáticos diarios
  - Encriptación en reposo
  - Encriptación en tránsito (TLS 1.3)
- **Vercel** (frontend)
  - Hosting con CDN global
  - HTTPS forzado en todas las rutas
  - Certificados SSL automáticos
- **GitHub** (código fuente)
  - Repositorio versionado con historial completo
  - Acceso controlado por permisos

### Comunicaciones
- Todas las llamadas entre navegador, backend y base de datos usan HTTPS
- WhatsApp Business API con tokens firmados (Bearer authentication)
- Webhook receivers con validación de payload

---

## 9. Aislamiento de credenciales

Las credenciales sensibles (API keys, tokens de servicio, secrets) **nunca viajan al navegador del usuario**:

- Las edge functions usan service_role_key que solo existe en servidor
- El frontend solo usa anon key con permisos limitados
- Tokens de Google Calendar y Meta WhatsApp viven en backend exclusivamente

---

## 10. Trazabilidad de webhooks externos

Los eventos recibidos del API de WhatsApp Business (Meta) quedan **almacenados con su payload completo** en la tabla `meta_whatsapp_status_events` para auditoría y debugging.

### Estado actual
- 18 eventos almacenados (entrega, lectura, fallos de mensajes)
- Payload completo guardado en JSONB para reproducibilidad

---

## 11. Numeración atómica de cotizaciones

Las cotizaciones se numeran con secuencia **anti-colisión a nivel base de datos**. Aunque dos comerciales coticen exactamente al mismo segundo, **es imposible que reciban el mismo número**.

**Implementación**: función `generate_next_quotation_number` con `SELECT FOR UPDATE` dentro de transacción Postgres + retry automático en caso de race condition.

---

## 12. Versionado de cotizaciones

Cuando un cliente pide cambios sobre una cotización ya generada, el sistema:

- **Conserva la versión original** marcada como histórica
- Crea una **nueva versión incrementada** con los cambios
- Mantiene la trazabilidad completa entre versiones

Esto previene la pérdida de información histórica y permite auditoría completa del proceso comercial.

---

## 13. Permisos granulares en GRANTs de base de datos

Más allá del RLS, cada tabla tiene permisos explícitos definidos a nivel SQL para los roles `anon` (anónimo) y `authenticated` (usuario logueado). Esto añade una capa adicional de seguridad que actúa incluso si las políticas RLS fueran modificadas accidentalmente.

---

## Resumen de protecciones activas

| Capa | Mecanismo | Estado |
|---|---|---|
| Autenticación | JWT + refresh automático + recovery | Activo |
| Autorización por rol | RLS con 4 roles diferenciados | Activo en 8 tablas |
| Auditoría | Bitácora automática con 162 eventos | Activo |
| Anti-escalada | Bloqueo de auto-promoción de roles | Activo |
| Anti-manipulación | Lock de cotizaciones finalizadas | Activo |
| Numeración | Anti-colisión transaccional | Activo |
| Validación de datos | Frontend + Backend + DB | Activo |
| Encriptación | TLS 1.3 + AES en reposo | Activo |
| Aislamiento de credenciales | Service keys solo en servidor | Activo |
| Trazabilidad | Webhooks con payload completo | Activo |
| Versionado | Cotizaciones históricas conservadas | Activo |
| Backup | Backups diarios automáticos | Activo (Supabase) |

---

## Conclusión

Innovar CRM no es "una aplicación con login". Es un sistema con **protección en capas** donde cada operación crítica está vigilada por reglas activas en la base de datos, no solo en el código del frontend. Esto significa que:

- Un error del programador no compromete los datos
- Un usuario malicioso no puede saltar las reglas
- Cada cambio queda registrado para revisión posterior
- La información histórica nunca se pierde

El nivel de protección actual cumple buenas prácticas de la industria para sistemas de gestión empresarial.

---

*Informe de seguridad generado el 19 de mayo de 2026 a partir de inspección directa del sistema en producción.*
