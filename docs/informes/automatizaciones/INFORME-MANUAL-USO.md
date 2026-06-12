# Manual de Uso Rápido — Innovar CRM

**Para**: Usuarios del sistema (comerciales, diseñadores, producción, administradores)
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Cómo usar este manual

Este manual cubre **los flujos más comunes del día a día** con paso a paso. Está organizado por escenario ("¿cómo hago X?") para que sea fácil de consultar. Cada flujo muestra qué pasa por dentro (automatizaciones) para que entiendas qué ocurre además de lo que ves en pantalla.

---

## 1. Acceder al sistema

### 1.1 Login
1. Ir a la URL del sistema (`crm-innovar-app-2026.vercel.app` en producción o `localhost:3000` en desarrollo).
2. Ingresar email y contraseña.
3. Hacer clic en "Iniciar sesión".

### 1.2 Cerrar sesión
1. Click en tu nombre en la esquina superior derecha.
2. Click en "Cerrar sesión".

### 1.3 Si la app se queda colgada
El sistema tiene **recovery automático**: en menos de 30 segundos te redirige solo a `/login`. Si por alguna razón no lo hace, **cierra la pestaña y abre una nueva** — es el reset más rápido.

---

## 2. Gestión de Leads y Clientes

### 2.1 Registrar un nuevo lead
1. Ir al menú lateral → **Clientes & Ventas** → **Solicitudes / Leads**.
2. Clic en **+ Nuevo lead** (esquina superior derecha).
3. Llenar el formulario:
   - Nombre (obligatorio)
   - Teléfono WhatsApp (recomendado)
   - Email
   - Dirección
   - Ciudad
   - Servicios de interés
   - Urgencia
   - Estado inicial (por defecto: PENDING)
4. Clic en **Guardar**.

**Lo que pasa por dentro automáticamente:**
- Se envía un email de bienvenida al lead
- Se calcula el lead score (puntaje de calidad)
- Se encola un WhatsApp avisando al equipo comercial
- Se registra el evento en bitácora de auditoría

### 2.2 Buscar un cliente
1. Ir a **Clientes & Ventas → Directorio**.
2. Usar la barra de búsqueda en la parte superior.
3. Búsqueda funciona sobre: nombre, email, teléfono.

### 2.3 Convertir un lead a cliente activo
La conversión ocurre **automáticamente** cuando se aprueba la primera cotización del lead. El sistema:
- Actualiza el estado a `CONVERTED`
- Conserva el historial del lead
- Vincula con el nuevo proyecto creado

---

## 3. Crear una Cotización

### 3.1 Pasos básicos
1. Ir a **Cotizaciones** → **+ Nueva cotización**.
2. Seleccionar el cliente (o crearlo desde el mismo flujo).
3. Elegir la categoría del producto:
   - Cocinas
   - Closets
   - Mesones
   - Centro de TV
   - Puertas Interiores
   - Acabados Especiales
4. Llenar la configuración específica de cada categoría (medidas, materiales, opciones).
5. El sistema **calcula los precios automáticamente** desde el catálogo en base de datos.
6. Agregar descuento si aplica (porcentual o monto fijo).
7. Configurar transporte (por defecto $600.000).
8. Clic en **Guardar como borrador** o **Enviar al cliente**.

### 3.2 Numeración
Se asigna automáticamente con formato `COT-YYYY-NNNN` (ej. `COT-2026-0001`). El sistema garantiza que **dos comerciales nunca obtengan el mismo número**.

### 3.3 Aprobar una cotización
1. Abrir la cotización en estado `sent`.
2. Clic en **Aprobar** (requiere rol Admin o Comercial).
3. Confirmar.

**Lo que pasa por dentro automáticamente:**
- La cotización pasa a estado `approved` y se bloquea (no se puede modificar más)
- Se crea un proyecto nuevo asociado a la cotización
- Se crean las tareas iniciales del proyecto (medición, diseño, etc.)
- Se notifica por WhatsApp al cliente confirmando aprobación
- Se notifica al equipo de producción del nuevo proyecto

### 3.4 Modificar una cotización aprobada
**No se puede directamente** — el sistema lo bloquea. La opción correcta es:
1. Crear una **nueva versión** de la cotización desde el detalle.
2. Editar la versión nueva.
3. El sistema conserva la versión anterior como histórica.

### 3.5 Aplicar descuentos
- **Porcentual**: ingresa el porcentaje (ej. 10 → 10% de descuento)
- **Fijo**: ingresa monto exacto a descontar
- El descuento aplica sobre el subtotal antes de transporte

### 3.6 Generar PDF de la cotización
Se genera **automáticamente** cuando la cotización cambia a estado `sent` o `approved`. El PDF queda disponible en `quotation_pdf_url`. Si no se generó, ejecutarlo manualmente desde la pantalla de detalle.

---

## 4. Gestión de Proyectos

### 4.1 Crear proyecto manual (sin cotización previa)
**Excepcional** — el flujo normal es vía aprobación de cotización. Si necesitas crear uno manual:
1. **Proyectos** → **+ Nuevo proyecto**.
2. Asignar cliente, tipo de trabajo, monto total.
3. Asignar diseñador.
4. Guardar.

### 4.2 Avanzar el estado del proyecto
El proyecto sigue una secuencia natural:

```
contacto → cotización aprobada → diseño → modelado → renders →
producción → instalación → entregado → garantía
```

Para avanzar:
1. Abrir el proyecto.
2. Clic en el botón del siguiente estado.
3. Llenar los campos requeridos (fechas, archivos, etc.).
4. Confirmar.

**Cada cambio de estado:**
- Notifica al cliente por WhatsApp
- Notifica al equipo correspondiente
- Queda registrado en auditoría
- Algunas transiciones disparan creación automática de tareas

### 4.3 Subir archivos 3D
1. Abrir el proyecto.
2. Tab **Archivos 3D**.
3. Clic en **Subir archivo**.
4. Seleccionar el archivo (formato CAD, OBJ, etc.).
5. Asignar versión (el sistema sugiere la siguiente).
6. Guardar.

El archivo queda en Supabase Storage con URL pública. La nueva versión se agrega al historial sin borrar las anteriores.

### 4.4 Compartir link de seguimiento con cliente
Cada proyecto tiene un **token de tracking** único (`tracking_token`). Para compartir:
1. Abrir el proyecto.
2. Copiar el link de "Seguimiento público" desde el menú de opciones.
3. Enviar al cliente.

El cliente verá el avance del proyecto **sin necesidad de login**.

### 4.5 Archivar proyectos completados
1. Solo Admin puede archivar.
2. En el proyecto entregado, clic en **Archivar**.
3. El proyecto sale de listas operativas pero conserva todos los datos.

---

## 5. Pagos y Finanzas

### 5.1 Registrar un pago de cliente
1. Ir a **Finanzas → Pagos** → **+ Nuevo pago**.
2. Seleccionar el proyecto.
3. Ingresar monto, método de pago, fecha.
4. Adjuntar comprobante (opcional).
5. Guardar.

**Lo que pasa por dentro automáticamente:**
- Si el pago cubre un hito del proyecto, **el estado del proyecto avanza solo**
- Se envía WhatsApp al cliente confirmando recepción
- Queda registrado en auditoría

### 5.2 Registrar un gasto del proyecto
1. **Finanzas → Gastos** → **+ Nuevo gasto**.
2. Seleccionar proyecto y categoría.
3. Monto, fecha, descripción.
4. Adjuntar comprobante.
5. Guardar.

El gasto queda en estado `pendiente` esperando aprobación.

### 5.3 Aprobar o rechazar un gasto (solo Admin)
1. **Finanzas → Gastos**.
2. Filtrar por estado `pendiente`.
3. Abrir el gasto.
4. Clic en **Aprobar** o **Rechazar** (con motivo).

**Lo que pasa por dentro:**
- El solicitante recibe notificación por WhatsApp
- Si aprobado, queda visible en reportes financieros del proyecto
- Si rechazado, no impacta el balance

### 5.4 Hacer cierre contable de un proyecto
1. Solo Admin tiene acceso.
2. **Finanzas → Cierres Contables**.
3. Seleccionar proyecto entregado.
4. El sistema calcula automáticamente:
   - Ingresos totales (suma de pagos)
   - Gastos totales (suma de gastos aprobados)
   - Utilidad neta
   - Margen porcentual
5. Revisar y marcar como `closed`.

---

## 6. Agenda y Tareas

### 6.1 Crear una tarea
1. **Agenda y Tareas → Tareas** → **+ Nueva tarea**.
2. Asignar título, descripción, prioridad.
3. Seleccionar responsable.
4. Fecha de vencimiento.
5. Asignar a proyecto (opcional).
6. Tags, horas estimadas (opcional).
7. Guardar.

**Lo que pasa por dentro:**
- El responsable recibe WhatsApp con la asignación
- Se reserva el slot de agenda del responsable
- Se sincroniza con Google Calendar del responsable
- Aparece en su kanban

### 6.2 Reordenar tareas en kanban
- Arrastrar y soltar las tarjetas entre columnas (estados).
- El sistema actualiza el orden automáticamente.

### 6.3 Comentar una tarea
1. Abrir la tarea.
2. En la sección de comentarios, escribir y enviar.

**Los involucrados** (asignado, creador, comentaristas anteriores) reciben notificación.

### 6.4 Adjuntar archivos a una tarea
1. Abrir la tarea.
2. En la sección de archivos adjuntos, clic en **Subir**.
3. Seleccionar archivo.

### 6.5 Configurar un día festivo
1. Solo Admin: **Configuración → Días Festivos** → **+ Nuevo**.
2. Fecha, nombre, año.
3. Guardar.

**Efecto automático**: todos los slots de agenda de ese día quedan bloqueados.

---

## 7. WhatsApp y Notificaciones

### 7.1 Ver historial de mensajes enviados
1. **Configuración → Notificaciones WhatsApp**.
2. Filtrar por estado, fecha, destinatario.
3. Ver detalle de cada mensaje y su trayectoria (sent → delivered → read).

### 7.2 Reintentar un mensaje fallido
1. En el historial, filtrar por estado `failed`.
2. Abrir el mensaje.
3. Clic en **Reintentar**.

### 7.3 Procesar la cola manualmente (Admin)
La cola se procesa **automáticamente cada minuto**. Si necesitas forzarlo:
1. **Configuración → Notificaciones WhatsApp**.
2. Clic en **Procesar ahora**.
3. Confirmar (puede ingresar un límite, por ejemplo 25).

---

## 8. Configuración del Sistema

### 8.1 Crear un nuevo usuario (Admin)
1. **Configuración → Usuarios** → **+ Nuevo**.
2. Ingresar email, nombre completo, rol.
3. Guardar.

El usuario recibe sus credenciales por canal seguro. Al primer login se crea su perfil con preferencias por defecto.

### 8.2 Cambiar el rol de un usuario (Admin)
1. **Configuración → Usuarios**.
2. Abrir el usuario.
3. Cambiar el campo rol.
4. Guardar.

**Restricción**: ningún usuario puede cambiarse a sí mismo el rol.

### 8.3 Editar un precio del catálogo (Admin)
1. **Configuración → Tarifas y Precios**.
2. Filtrar por categoría o código.
3. Editar el precio.
4. Guardar.

El sistema guarda automáticamente el precio anterior en `previousValue` y la fecha en `lastUpdated`.

### 8.4 Agregar un material al catálogo
1. **Configuración → Materiales** → **+ Nuevo material**.
2. Llenar: categoría, nombre, descripción, foto, precio, unidad, stock.
3. Definir si activo y orden de presentación.
4. Guardar.

### 8.5 Consultar auditoría del sistema (Admin)
1. **Configuración → Auditoría**.
2. Filtros disponibles: usuario, tabla, fecha, tipo de acción.
3. Ver detalle del cambio (datos antes y después).

---

## 9. Atajos y consejos

### 9.1 Buscar globalmente
- Usa la barra superior de búsqueda — funciona sobre planos, órdenes y clientes simultáneamente.

### 9.2 Indicador de conexión
- Si ves el banner amarillo **"Conectando con Innovar..."** en la parte inferior, la app está esperando datos. Si dura más de 30 segundos, el sistema te recuperará automáticamente.

### 9.3 Centro de notificaciones (campanita en TopBar)
- Las notificaciones en tiempo real aparecen ahí.
- Click para ver detalle de cada una.
- Botón **Marcar todas como leídas** disponible.

### 9.4 Mi perfil
1. Click en tu nombre (esquina superior derecha).
2. **Mi perfil**.
3. Cambiar avatar, teléfono, preferencias de notificación.

---

## 10. Solución de problemas frecuentes

### 10.1 "No puedo ver un proyecto"
- **Si eres Diseñador**: solo ves proyectos donde estás asignado como diseñador. Pide al Admin que te asigne.
- **Si eres Producción**: solo tienes acceso a ciertos proyectos según RLS.

### 10.2 "El sistema dice que mi sesión expiró"
- Hacer clic en **Iniciar sesión de nuevo** desde la pantalla de login.
- Si te aparece muy seguido, contactar al Admin para revisar configuración.

### 10.3 "Mi cotización no se actualiza"
- Si está en estado `approved`, **no se puede modificar más**. Crea una nueva versión.

### 10.4 "El cliente dice que no recibió el WhatsApp"
1. Ir a **Configuración → Notificaciones WhatsApp**.
2. Buscar el mensaje por teléfono o nombre.
3. Revisar el estado:
   - `pending`/`processing`: aún no se envió, espera unos minutos
   - `sent` pero no `delivered`: el proveedor lo aceptó pero el teléfono no lo recibió (revisar número)
   - `failed`: clic en reintentar

### 10.5 "Quiero saber quién modificó X dato"
1. Solo Admin: **Configuración → Auditoría**.
2. Filtrar por tabla y registro afectado.
3. Ver historial completo de cambios con autor.

---

## 11. Glosario rápido

| Término | Significado |
|---|---|
| **Lead** | Persona interesada que aún no es cliente activo |
| **Lead score** | Puntaje de calidad del lead (0-100) que calcula el sistema |
| **Cotización** | Propuesta económica formal a un cliente |
| **Versión de cotización** | Variante de una cotización existente cuando hay cambios |
| **Proyecto** | Trabajo a ejecutar tras aprobación de cotización |
| **Despiece** | Archivo técnico de fabricación |
| **Slot** | Bloque de horario disponible para asignar una tarea |
| **Kanban** | Vista de tareas en columnas por estado |
| **NPS** | Indicador de satisfacción del cliente (would_recommend) |
| **Garantía** | Período post-entrega donde el cliente puede reclamar |
| **Cierre contable** | Resumen financiero formal del proyecto al finalizar |
| **Bitácora / Auditoría** | Registro automático de quién cambió qué |

---

## 12. ¿Necesitas ayuda adicional?

- **Manual completo de capacidades**: ver `INFORME-CAPACIDADES.md`
- **Tabla de roles y permisos**: ver `INFORME-ROLES-Y-PERMISOS.md`
- **Configuración del sistema**: ver `INFORME-CONFIGURACION-ADMINISTRATIVA.md`
- **Soporte técnico**: contactar al equipo de desarrollo

---

*Manual de uso generado el 19 de mayo de 2026 para entrega al equipo operativo del cliente.*
