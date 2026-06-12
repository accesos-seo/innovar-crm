# Informe de Roles y Permisos — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Innovar CRM tiene un **sistema de roles diferenciados** que define con precisión qué puede ver y hacer cada miembro del equipo. Las restricciones se aplican a **3 niveles distintos** (base de datos, backend y frontend), de modo que ningún rol pueda saltarse las limitaciones por error o intención.

Este documento describe los roles disponibles, qué puede hacer cada uno, y cómo se aplican los permisos.

---

## 1. Roles definidos en el sistema

El sistema tiene **4 roles** que cubren la operación completa del negocio:

| Rol | Quién lo usa típicamente | Alcance general |
|---|---|---|
| **Administrador** | Gerencia, dueños del negocio | Control total |
| **Comercial** | Equipo de ventas, atención al cliente | Leads, clientes, cotizaciones |
| **Diseñador** | Equipo de diseño y modelado 3D | Proyectos asignados, archivos 3D |
| **Producción** | Equipo de fabricación e instalación | Lectura de proyectos + estado de producción |

---

## 2. Matriz de permisos — qué puede hacer cada rol

### 2.1 Gestión de Clientes y Leads

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver lista de clientes | ✓ | ✓ | ✓ | ✓ |
| Crear cliente nuevo | ✓ | ✓ | — | — |
| Editar datos de cliente | ✓ | ✓ | — | — |
| Eliminar cliente | ✓ | — | — | — |
| Captar lead público (sin login) | ✓ | ✓ | ✓ | ✓ |
| Ver lead score | ✓ | ✓ | — | — |

### 2.2 Cotizaciones

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver cotizaciones | ✓ | ✓ | ✓ | ✓ |
| Crear cotización nueva | ✓ | ✓ | — | — |
| Editar items de cotización (no aprobada) | ✓ | ✓ | — | — |
| Editar items de cotización aprobada | **Bloqueado para TODOS** (regla SQL) | | | |
| Aprobar cotización | ✓ | ✓ | — | — |
| Generar nueva versión | ✓ | ✓ | — | — |

### 2.3 Proyectos

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver lista de proyectos | ✓ | ✓ | Solo asignados | ✓ |
| Ver detalle de proyecto | ✓ | ✓ | Solo asignados | ✓ |
| Crear proyecto manual | ✓ | ✓ | — | — |
| Editar datos de proyecto | ✓ | ✓ | Solo asignados | — |
| **Actualizar estado de producción** | ✓ | — | — | **✓** |
| Subir archivos 3D | ✓ | — | Solo asignados | — |
| Archivar proyecto | ✓ | — | — | — |

### 2.4 Finanzas

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver pagos | ✓ | ✓ | — | — |
| Registrar pago | ✓ | ✓ | — | — |
| Ver gastos | ✓ | ✓ | ✓ | — |
| Registrar gasto | ✓ | ✓ | ✓ | — |
| Aprobar/rechazar gasto | ✓ | — | — | — |
| Hacer cierre contable | ✓ | — | — | — |
| Ver reporte financiero | ✓ | ✓ | — | — |

### 2.5 Agenda y Tareas

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver agenda propia | ✓ | ✓ | ✓ | ✓ |
| Ver agenda del equipo | ✓ | ✓ | — | — |
| Crear tarea | ✓ | ✓ | ✓ | ✓ |
| Asignar tarea a otro | ✓ | ✓ | — | — |
| Actualizar tarea propia | ✓ | ✓ | ✓ | ✓ |
| Reagendar tarea de otro | ✓ | — | — | — |
| Configurar días festivos | ✓ | — | — | — |

### 2.6 Configuración del sistema

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Gestionar usuarios | ✓ | — | — | — |
| Editar precios del catálogo | ✓ | — | — | — |
| Editar materiales | ✓ | — | — | — |
| Configurar plantillas WhatsApp | ✓ | — | — | — |
| Ver auditoría completa | ✓ | — | — | — |
| Cambiar su propio rol | **Bloqueado** (solo otro admin puede cambiarlo) | | | |

### 2.7 Notificaciones WhatsApp

| Acción | Admin | Comercial | Diseño | Producción |
|---|:---:|:---:|:---:|:---:|
| Ver historial de mensajes | ✓ | ✓ | — | — |
| Procesar cola manualmente | ✓ | — | — | — |
| Reintentar mensaje fallido | ✓ | ✓ | — | — |

---

## 3. Cómo se aplican los permisos (3 capas de protección)

El sistema **no confía** en que el frontend respete las reglas. Aplica los permisos en 3 niveles:

### Capa 1 — Base de datos (Row Level Security)
Cada consulta que llega a la base de datos pasa por **políticas RLS** que validan el rol del usuario antes de devolver datos. Aunque alguien intente acceder por fuera del sistema, las políticas siguen aplicando.

**Ejemplo**: la política `user_projects_read` en la tabla `projects` solo permite ver proyectos donde el `designer_id` coincide con el usuario actual, o si el rol es `comercial`/`produccion`.

### Capa 2 — Backend (Express)
El servidor Express valida que el rol del usuario tenga permiso antes de ejecutar la lógica de negocio sensible (por ejemplo, generar cotizaciones, aprobar pagos).

### Capa 3 — Frontend (React)
La interfaz **oculta los botones y secciones** que el usuario no puede usar. Esto es solo cosmético — la seguridad real está en las capas 1 y 2.

---

## 4. Protecciones especiales

### 4.1 Anti-escalada de privilegios
Un usuario **no puede cambiarse a sí mismo a un rol superior**. Si un comercial intenta editarse el campo "rol" a "admin", la base de datos rechaza la operación inmediatamente.

**Implementación**: trigger `trg_prevent_non_admin_profile_role_change` activo en la tabla `profiles`.

### 4.2 Lock de cotizaciones aprobadas
Una vez aprobada una cotización, **ningún rol puede modificar sus items** (precios, cantidades). Esto previene manipulaciones post-aprobación, incluso del administrador.

**Implementación**: trigger `trg_prevent_changes_on_finalized_quotation_items` con bloqueo a nivel SQL.

### 4.3 Auditoría obligatoria
Toda modificación a tablas críticas queda registrada con identificación del usuario que la hizo, **sin importar el rol**. El administrador también es auditado.

**Implementación**: triggers de auditoría sobre clients, expenses, payments, projects, quotations, quotation_items y tasks.

### 4.4 Designer ownership
Los diseñadores **solo ven proyectos donde están asignados como designer_id**. No pueden ver proyectos de sus colegas a menos que el admin lo permita.

**Implementación**: política RLS `user_projects_read` con condición `designer_id = auth.uid()`.

---

## 5. Capacidades exclusivas del Administrador

Solo el rol `admin` puede:

- Crear, editar y eliminar usuarios
- Cambiar el rol de otros usuarios
- Aprobar o rechazar gastos
- Editar el catálogo de precios y materiales
- Hacer cierres contables
- Configurar días festivos
- Ver y consultar la bitácora completa de auditoría
- Archivar proyectos completados
- Configurar plantillas y comunicaciones WhatsApp
- Procesar manualmente la cola de notificaciones

---

## 6. Capacidades exclusivas de Producción

El rol `produccion` está intencionalmente limitado:

- **Solo lectura** sobre clientes, cotizaciones, finanzas
- **Solo escritura sobre el estado del proyecto** (lo que vino a hacer)
- No puede registrar pagos ni gastos
- No puede crear ni modificar cotizaciones
- No puede asignar tareas a otros

Esto **previene errores accidentales** del personal de planta sobre datos comerciales sensibles.

---

## 7. Sistema de invitaciones / alta de nuevos usuarios

Cuando se agrega un nuevo miembro al equipo:

1. **Solo un Admin** puede crear el usuario.
2. El sistema le asigna un rol inicial (por defecto `comercial`).
3. Al primer login del usuario, se **crea automáticamente su perfil** (`profiles`) con timestamp.
4. Recibe credenciales por canal seguro (no vía email plano).
5. **Cambio de rol** futuro requiere autorización de otro admin (no autodelegable).

---

## 8. Sesiones y autenticación

- **Login con email + password** validado por Supabase Auth.
- **Token JWT** firmado con vencimiento de 1 hora.
- **Refresh automático** mientras el usuario esté activo.
- **Logout automático** si la sesión queda atascada (recovery activado el 19/05/2026).
- **Deslogueo manual** disponible desde el menú de perfil.
- **Sesiones simultáneas** permitidas (mismo usuario puede usar varios dispositivos).

---

## 9. Recuperación de acceso

Si un usuario pierde acceso:

| Escenario | Solución |
|---|---|
| Olvidó contraseña | El admin la resetea desde Supabase (en el futuro: link de reseteo por email) |
| Cuenta bloqueada | Admin desactiva temporalmente el `is_active = false` y reactiva cuando corresponde |
| Sospecha de compromiso | Admin desactiva inmediatamente la cuenta y revisa bitácora de auditoría |
| Cambio de rol | Admin actualiza el rol desde la pantalla de gestión de usuarios |

---

## 10. Tabla resumen de capas de protección

| Rol | Lo que ve | Lo que modifica | Limitaciones automáticas |
|---|---|---|---|
| **Admin** | Todo el sistema | Todo excepto cotizaciones finalizadas | Auditoría obligatoria de cada cambio |
| **Comercial** | Clientes, leads, cotizaciones, sus proyectos | Crear/editar leads, cotizaciones (no finalizadas), pagos | No puede aprobar gastos ni gestionar usuarios |
| **Diseño** | Proyectos asignados a sí mismo | Datos técnicos del proyecto, archivos 3D | Solo ve proyectos propios; no ve finanzas |
| **Producción** | Proyectos (lectura) | Solo estado de producción | No puede tocar finanzas ni cotizaciones |

---

## Conclusión

Innovar CRM tiene un **sistema de roles riguroso** que separa funciones del negocio sin dejar fisuras. Las protecciones se aplican a nivel de base de datos, lo que significa que **ni siquiera un bug en el código de la aplicación podría comprometer los datos sensibles**.

Cada miembro del equipo accede exactamente a lo que necesita para su trabajo — ni más, ni menos. Esto reduce riesgos operativos, facilita el cumplimiento normativo y mantiene una bitácora completa de la actividad del sistema.

---

*Informe de roles y permisos generado el 19 de mayo de 2026 a partir de la inspección de políticas RLS activas en producción.*
