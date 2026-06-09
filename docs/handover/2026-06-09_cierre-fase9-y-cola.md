# Handoff — Innovar CRM: Cierre Fase 9 + Limpieza de Cola WA
**Fecha:** 2026-06-09  
**Para:** próxima sesión de IA (sin contexto previo)  
**Autor:** Claude Sonnet 4.6 + Robert Viroña  
**Estado al cierre de esta sesión:** templates Meta aprobadas ✅ · migraciones escritas · pendiente aplicación  

---

## 1. Contexto del proyecto

**Innovar CRM** es un CRM a medida para Innovar Cocinas de Diseño (Pereira, Colombia). Gestiona el ciclo comercial completo desde que llega un lead hasta el cierre del proyecto de instalación.

**Stack:**
- Frontend: React 19 + Vite + TypeScript + Tailwind
- Backend: Supabase (PostgreSQL + Edge Functions + pg_cron)
- Automatizaciones: n8n (instancia cloud)
- WhatsApp: Meta Business API (Graph API v21.0)
- Deploy: Vercel

**Motor Comercial — 9 fases:**
1. Captura de lead → WA bienvenida + link agendamiento
2. Contacto → asignación comercial
3. Agenda → confirmación + recordatorios 24h y 2h
4. Cotización → WA con link de aprobación
5. Aprobación → WA de datos bancarios
6. Pago → verificación manual + WA confirmación
7. Proyecto → asignación diseñador + WA bienvenida a proyecto
8. Visita técnica → WA recordatorio 24h y 2h
9. **Producción → 4 nuevas automatizaciones (objetivo de este handoff)**

---

## 2. Infraestructura — credenciales y rutas

### Ruta canónica del proyecto
```
D:\Agents-automations\04-Innovar
```
> ⚠️ Las rutas en `OneDrive\...\Innovar-App-main` son copias MUERTAS desincronizadas. NUNCA usar esas rutas para git, build o edición.

### Git
- **Repo remoto:** `https://github.com/accesos-seo/innovar-crm`
- **Rama activa:** `ux-fixes` (ya pusheada a origin)
- **Último commit:** `56f1307` — "docs(fase9): marcar automatizaciones de Producción como activas"
- **Próximo paso git:** merge `ux-fixes` → `main` cuando todo esté validado

### Supabase (Innovar CRM)
- **Project ID:** `xdzbjptozeqcbnaqhtye`
- **URL:** `https://xdzbjptozeqcbnaqhtye.supabase.co`
- **Región:** us-west-2
- **⚠️ FUERA del scope del MCP Supabase** — usar Management API con curl/node

**Patrón Management API** (ejecutar desde `D:\Agents-automations\04-Innovar`):
```javascript
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
async function query(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const res = await fetch('https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return res.json();
}
```

**Todas las credenciales están en** `D:\Agents-automations\04-Innovar\.env`:
- `SUPABASE_ACCESS_TOKEN` — Management API token (comienza con `sbp_ed3b...`)
- `VITE_SUPABASE_URL` — URL del proyecto
- `VITE_SUPABASE_ANON_KEY` — anon key pública
- `SUPABASE_SERVICE_ROLE_KEY` — service role (para Edge Functions)
- `VERCEL_TOKEN` — deploy directo con CLI

### Edge Function activa
- **Nombre:** `process-whatsapp-notifications`
- **Versión desplegada:** con fixes de smoke test 2026-06-09 (5 templates agregados al REGISTRY)
- **Cron:** cada 1 minuto via pg_cron (job #2)
- **Procesa:** filas con `status='pending'` en `notification_queue`

### n8n
- **Instancia:** `https://estancias-atlas-n8n.heh8a3.easypanel.host`
- **MCP disponible:** `mcp__n8n-mcp` — control total vía API
- **Workflow "Recordatorio Día de Instalación":**
  - ID: `CjbwjGdRKyIzWJWq`
  - Estado actual: **INACTIVO** · DRY_RUN=true
  - Cron: 7:30am lunes–sábado, timezone Bogotá (America/Bogota)
  - Template: `recordatorio_instalacion_v1`

### Vercel
- **URL producción:** `https://crm-innovar-app-2026.vercel.app`
- **Project ID:** `prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi`
- **Deploy:** `npx vercel --prod --token TOKEN --yes` (solo si hay cambios de UI)

### Meta WhatsApp Business
- **WABA:** Innovar Cocinas De Diseño
- **Phone ID:** `1070297299506759`
- **API Key:** en Supabase Vault como `META_WABA_ACCESS_TOKEN` y `META_PHONE_NUMBER_ID`
- **wa_test_phone_override:** `3183061286` (Robert) — ACTIVO, redirige todos los WA a Robert

### Sistema de memoria (Claude)
- **MEMORY.md:** `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md`
- **Memoria del proyecto:** `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\project_innovar.md`
- **Catálogo de templates WA:** `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\reference_innovar_whatsapp_templates.md`

---

## 3. Estado actual al cierre (2026-06-09)

### ✅ Completado
- Fases 1–8 funcionando en producción
- Smoke test E2E Motor Comercial: 5 bugs corregidos y deployados (commits `e2de3a9` a `185697b`)
- Fase 9 documentada en `src/data/automatizacionesContent.ts` (4 entradas, `status: 'activa'`)
- Fase 9 documentada en `src/data/motorComercialContent.ts` (agents `monitor-produccion` y `cierre-proyecto`, `status: 'activo'`)
- Migraciones 047, 048, 049 escritas en `db/migrations/` (no aplicadas aún)
- Templates Fase 9 enviadas a Meta el 2026-06-09 → **APROBADAS** (confirmado por Robert en sesión)
- n8n workflow `CjbwjGdRKyIzWJWq` creado con DRY_RUN=true (listo para activar)

### 🔴 Pendiente (objetivo de esta sesión/handoff)
Ver sección 4 para el plan de acción detallado.

---

## 4. Plan de acción — en orden estricto

### PASO 1: Investigar y corregir `bienvenidas_clientes` que sigue insertándose

**Problema descubierto:** Hoy (2026-06-09 11:23) se creó una nueva entrada en `notification_queue` con `template_name='bienvenidas_clientes'` para el lead "Juan Prueba ED2" (phone `573001234567`). Esto ocurrió DESPUÉS de que la migración 042 fue aplicada (que reemplazó `notify_lead_followup_flow` para usar `welcome_lead_v1`). Hay otra función/trigger que aún usa el nombre antiguo.

**Investigación — ejecutar este SQL:**
```sql
-- 1. Buscar todas las funciones que referencian 'bienvenidas_clientes'
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%bienvenidas_clientes%';

-- 2. Buscar triggers relacionados
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%bienvenidas_clientes%'
   OR trigger_name ILIKE '%bienvenidas%'
   OR trigger_name ILIKE '%lead%'
   OR trigger_name ILIKE '%welcome%';

-- 3. Verificar si hay n8n workflows con el nombre antiguo
-- (revisar en n8n MCP: buscar workflows activos que mencionen bienvenidas_clientes)
```

**Fix esperado:** Reemplazar `bienvenidas_clientes` con `welcome_lead_v1` en cualquier función encontrada. El formato de `template_parameters` debe ser objeto: `jsonb_build_object('1', split_part(nombre, ' ', 1))`.

---

### PASO 2: Limpiar cola de notificaciones stuck

**Problema:** Hay 7 items en `status='processing'` con `attempt_count=0` desde hace 10+ horas. La Edge Function solo procesa items en `status='pending'`; cuando los toma los pone en `processing`, pero si crashea o hay error de formato los deja atascados. Necesitan reset a `pending`.

**Nota:** Los items de "Juan Prueba ED2" (`573001234567`) son número de test falso — Meta rechazará el envío. Está OK que fallen, solo asegurarse de que no bloqueen la cola.

**SQL para reset + eliminación de pruebas:**
```sql
-- Reset items legítimos atascados (destino: Robert/Alvaro - números reales)
UPDATE public.notification_queue
SET status = 'pending',
    attempt_count = 0,
    error_message = NULL,
    failed_at = NULL
WHERE status = 'processing'
  AND attempt_count = 0
  AND created_at < NOW() - INTERVAL '2 hours'
  AND recipient_phone NOT IN ('573001234567', '3009999333');

-- Descartar items de prueba con número falso
UPDATE public.notification_queue
SET status = 'failed',
    error_message = 'DESCARTADO - número de prueba inválido',
    failed_at = NOW()
WHERE recipient_phone IN ('573001234567', '3009999333')
  AND status IN ('pending', 'processing');

-- Verificar resultado
SELECT template_name, status, attempt_count, recipient_phone
FROM notification_queue
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC
LIMIT 20;
```

---

### PASO 3: Aplicar migración 047 — Notificador Inicio de Fabricación

**Archivo:** `D:\Agents-automations\04-Innovar\db\migrations\047_notificador_fabricacion.sql`  
**Template:** `fabricacion_iniciada_v1` (APROBADA por Meta ✅)  
**Dispara:** cuando `projects.fabrication_started_at` pasa de NULL a NOT NULL

**SQL completo a ejecutar:**
```sql
CREATE OR REPLACE FUNCTION public.fn_notify_fabricacion_started()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_project_name  TEXT;
  v_notif_id      UUID;
BEGIN
  IF NEW.fabrication_started_at IS NULL OR OLD.fabrication_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client_id, v_client_name, v_client_phone
    FROM public.clients c
   WHERE c.id = NEW.client_id;
  IF NOT FOUND OR v_client_phone IS NULL THEN
    RETURN NEW;
  END IF;
  v_project_name := COALESCE(NEW.name, 'tu proyecto');
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
     WHERE payload->>'project_id' = NEW.id::text
       AND event_type = 'project.fabricacion_started'
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notification_queue (
    recipient_phone, recipient_name, template_name, template_params,
    event_type, payload, status
  ) VALUES (
    v_client_phone,
    v_client_name,
    'fabricacion_iniciada_v1',
    jsonb_build_array(
      COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
      '15 días hábiles'
    ),
    'project.fabricacion_started',
    jsonb_build_object(
      'project_id',   NEW.id,
      'client_id',    v_client_id,
      'project_name', v_project_name
    ),
    'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fabricacion_started ON public.projects;
CREATE TRIGGER trg_notify_fabricacion_started
  AFTER UPDATE OF fabrication_started_at ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_fabricacion_started();
```

**Verificación post-aplicación:**
```sql
-- Confirmar que el trigger existe
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trg_notify_fabricacion_started';

-- Test: tomar un proyecto en estado activo con fabrication_started_at IS NULL
-- UPDATE public.projects SET fabrication_started_at = NOW()
-- WHERE id = '<uuid>' AND fabrication_started_at IS NULL;
-- Luego verificar que apareció una fila en notification_queue con template='fabricacion_iniciada_v1'
```

> ⚠️ **IMPORTANTE:** El `wa_test_phone_override` está activo — el WA llegará al teléfono de Robert, no al cliente real. Validar que Robert reciba el mensaje antes de limpiar el override.

---

### PASO 4: Aplicar migración 048 — Notificador Instalación Programada

**Archivo:** `D:\Agents-automations\04-Innovar\db\migrations\048_notificador_instalacion_programada.sql`  
**Template:** `instalacion_programada_v1` (APROBADA por Meta ✅)  
**Dispara:** cuando `projects.scheduled_install_date` pasa de NULL a NOT NULL  
**Nota técnica:** Formatea la fecha en español usando arrays de meses/días en PL/pgSQL

**SQL completo:**
```sql
CREATE OR REPLACE FUNCTION public.fn_notify_instalacion_programada()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_fecha_texto   TEXT;
  v_notif_id      UUID;
  v_meses TEXT[] := ARRAY['enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  v_dias TEXT[] := ARRAY['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
BEGIN
  IF NEW.scheduled_install_date IS NULL OR OLD.scheduled_install_date IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client_id, v_client_name, v_client_phone
    FROM public.clients c
   WHERE c.id = NEW.client_id;
  IF NOT FOUND OR v_client_phone IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
     WHERE payload->>'project_id' = NEW.id::text
       AND event_type = 'project.instalacion_programada'
  ) THEN
    RETURN NEW;
  END IF;
  v_fecha_texto := v_dias[EXTRACT(DOW FROM NEW.scheduled_install_date)::int + 1]
    || ' ' || EXTRACT(DAY FROM NEW.scheduled_install_date)::int::text
    || ' de ' || v_meses[EXTRACT(MONTH FROM NEW.scheduled_install_date)::int]
    || ' de ' || EXTRACT(YEAR FROM NEW.scheduled_install_date)::int::text;
  INSERT INTO public.notification_queue (
    recipient_phone, recipient_name, template_name, template_params,
    event_type, payload, status
  ) VALUES (
    v_client_phone,
    v_client_name,
    'instalacion_programada_v1',
    jsonb_build_array(
      COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
      v_fecha_texto
    ),
    'project.instalacion_programada',
    jsonb_build_object(
      'project_id',         NEW.id,
      'client_id',          v_client_id,
      'install_date',       NEW.scheduled_install_date::text,
      'install_date_texto', v_fecha_texto
    ),
    'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_instalacion_programada ON public.projects;
CREATE TRIGGER trg_notify_instalacion_programada
  AFTER UPDATE OF scheduled_install_date ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_instalacion_programada();
```

**Verificación:**
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trg_notify_instalacion_programada';
-- Test con: UPDATE public.projects SET scheduled_install_date = CURRENT_DATE + 7
-- WHERE id = '<uuid>' AND scheduled_install_date IS NULL;
-- Verificar que template_params[1] tenga fecha en español correcto
```

---

### PASO 5: Aplicar migración 049 — Cierre Automático de Proyecto

**Archivo:** `D:\Agents-automations\04-Innovar\db\migrations\049_cierre_automatico_proyecto.sql`  
**Template:** `proyecto_completado_v1` (APROBADA por Meta ✅)  
**Condición:** `delivered_at` NULL→NOT NULL **Y** `is_fully_paid = true` (ambas juntas)  
**Tipo de trigger:** BEFORE (no AFTER) — para que `NEW.status := 'completado'` sea atómico con el UPDATE original, sin un segundo UPDATE separado que puede causar "tuple concurrently updated" bajo concurrencia.  
**Acciones:**
1. `NEW.status := 'completado'` (atómico, parte del mismo UPDATE)
2. Inserta WA al cliente con `proyecto_completado_v1`
3. Crea tarea Kanban "Solicitar reseña" con due_date = NOW() + 7 días

**SQL completo (rev 2 — BEFORE trigger):**
```sql
CREATE OR REPLACE FUNCTION public.fn_cierre_automatico_proyecto()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_project_name  TEXT;
  v_responsable   UUID;
  v_default_user  UUID;
BEGIN
  IF NEW.delivered_at IS NULL OR OLD.delivered_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.is_fully_paid IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  -- Guard: comparar OLD.status para evitar re-ejecución
  IF OLD.status::text = 'completado' THEN
    RETURN NEW;
  END IF;
  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client_id, v_client_name, v_client_phone
    FROM public.clients c
   WHERE c.id = NEW.client_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  v_project_name := COALESCE(NEW.name, 'tu proyecto');
  v_responsable  := COALESCE(NEW.designer_id, NEW.created_by);
  IF v_responsable IS NULL THEN
    SELECT id INTO v_default_user
      FROM public.profiles WHERE role = 'admin' LIMIT 1;
    v_responsable := v_default_user;
  END IF;
  -- 1. Cambio atómico de status — sin UPDATE separado
  NEW.status := 'completado';
  -- 2. WA al cliente (dedup: solo si no existe notificación previa para este proyecto)
  IF v_client_phone IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.notification_queue
        WHERE payload->>'project_id' = NEW.id::text
          AND event_type = 'project.completed'
     )
  THEN
    INSERT INTO public.notification_queue (
      recipient_phone, recipient_name, template_name, template_params,
      event_type, payload, status
    ) VALUES (
      v_client_phone, v_client_name,
      'proyecto_completado_v1',
      jsonb_build_array(
        COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
        v_project_name
      ),
      'project.completed',
      jsonb_build_object('project_id', NEW.id, 'client_id', v_client_id, 'project_name', v_project_name),
      'pending'
    );
  END IF;
  -- 3. Tarea "Solicitar reseña" (dedup: solo si no existe tarea previa para este proyecto)
  IF v_responsable IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.tasks
        WHERE 'project:' || NEW.id::text = ANY(tags)
          AND title LIKE 'Solicitar reseña%'
     )
  THEN
    INSERT INTO public.tasks (
      client_id, assigned_to, created_by, title, description,
      status, priority, due_date, task_category, tags, kanban_order
    ) VALUES (
      v_client_id, v_responsable, v_responsable,
      'Solicitar reseña — ' || COALESCE(v_client_name, 'Cliente'),
      'El proyecto fue entregado y pagado. Contactar al cliente para solicitar reseña en Google o redes sociales.',
      'pendiente'::task_status, 0,
      NOW()::DATE + INTERVAL '7 days',
      'seguimiento'::task_category,
      ARRAY['project:' || NEW.id::text],
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cierre_automatico_proyecto ON public.projects;
CREATE TRIGGER trg_cierre_automatico_proyecto
  BEFORE UPDATE OF delivered_at, is_fully_paid ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cierre_automatico_proyecto();
```

**Verificación:**
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trg_cierre_automatico_proyecto';
-- Test: tomar proyecto con is_fully_paid=true y delivered_at IS NULL
-- UPDATE public.projects SET delivered_at = NOW() WHERE id='<uuid>' AND is_fully_paid=true;
-- Verificar status='completado', entrada en notification_queue, y tarea creada
```

---

### PASO 6: Activar n8n workflow — Recordatorio Día de Instalación

**Workflow ID:** `CjbwjGdRKyIzWJWq`  
**Nombre:** "Innovar — Recordatorio Día de Instalación"  
**Estado actual:** INACTIVO · `DRY_RUN=true`

**Acciones a ejecutar vía MCP `mcp__n8n-mcp`:**

1. Leer el workflow: `n8n_get_workflow(id: 'CjbwjGdRKyIzWJWq')`
2. Buscar el nodo `Configuración` (nodo de variables de entorno/Set)
3. Cambiar `DRY_RUN` de `true` a `false`
4. Actualizar el workflow: `n8n_update_partial_workflow(id: 'CjbwjGdRKyIzWJWq', ...)`
5. Activar: `n8n_update_partial_workflow(id: 'CjbwjGdRKyIzWJWq', active: true)`

> **Nota de seguridad:** Con `wa_test_phone_override=3183061286` activo, el cron enviará el recordatorio al teléfono de Robert (no a clientes reales). Esto es el comportamiento correcto para la prueba.

**Qué hace este workflow:**
- Cron: 7:30am lunes–sábado (America/Bogota)
- Consulta proyectos con `scheduled_install_date = TODAY`
- Envía template `recordatorio_instalacion_v1` con `{{1}}` = nombre cliente
- Inserta en `notification_queue` o llama directamente a la EF (verificar el diseño del workflow)

---

### PASO 7: Resolver `visit_assigned_admin_v1` (requiere acción de Robert en Meta BM)

Este template NO existe en Meta Business Manager → error `#132001`.

**Acción de Robert:**
1. Ir a Meta Business Manager → Message Templates → WABA "Innovar Cocinas De Diseño"
2. Crear template con nombre exacto: `visit_assigned_admin_v1`
3. Parámetros: 4 variables de cuerpo:
   - `{{1}}` = nombre del técnico asignado
   - `{{2}}` = nombre del cliente
   - `{{3}}` = fecha y hora de la visita
   - `{{4}}` = dirección del cliente
4. Esperar aprobación Meta (24–48h)
5. Una vez aprobado: los 2 items `failed` en la cola se deben resetear a `pending` para reintento

**SQL para resetear después de aprobación:**
```sql
UPDATE public.notification_queue
SET status = 'pending', attempt_count = 0, error_message = NULL, failed_at = NULL
WHERE template_name = 'visit_assigned_admin_v1'
  AND status = 'failed';
```

---

### PASO 8: Limpiar `wa_test_phone_override`

Una vez que Robert haya validado que los mensajes de Fase 9 llegan correctamente:

```sql
-- Eliminar el override (WA vuelve a ir a clientes reales)
UPDATE public.system_settings
SET value = 'null'::jsonb
WHERE key = 'wa_test_phone_override';

-- Verificar
SELECT key, value FROM public.system_settings WHERE key = 'wa_test_phone_override';
```

> ⚠️ **NO ejecutar hasta que Robert confirme que vio y validó mensajes de prueba** de al menos las 3 automaciones nuevas de Fase 9 (fabricación, instalación, recordatorio).

---

### PASO 9: Merge `ux-fixes` → `main` + deploy Vercel

Solo cuando pasos 1–8 estén completos y Robert confirme:

```bash
cd D:\Agents-automations\04-Innovar
git checkout main
git merge ux-fixes
git push origin main
```

Y si hay cambios de UI que deployar (actualmente no hay):
```bash
npm run build
npx vercel --prod --yes
```

---

## 5. Estado de `notification_queue` al cierre de sesión

| Template | Status | Desde | Notas |
|---|---|---|---|
| `welcome_lead_v1` | processing (3) | 23:44–01:51 | Stuck — reset a pending en Paso 2 |
| `booking_link_v1` | processing (1) | 01:51 | Stuck — reset a pending en Paso 2 |
| `appointment_booked` | processing (1) | 23:46 | Stuck — reset a pending en Paso 2 |
| `task_assigned` | processing (1) | 23:46 | Stuck — reset a pending en Paso 2 |
| `bienvenidas_clientes` | failed (1) | 11:23 HOY | Origen desconocido — investigar Paso 1 |
| `visit_assigned_admin_v1` | failed (2) | 23:46 y 12:03 | Esperando Robert cree template en Meta |
| `visit_reminder_24h_internal_v1` | sent | 14:00 | OK |
| `visit_reminder_2h_client_v1` | sent | 14:00 | OK |
| `visit_reminder_2h_internal_v1` | sent | 14:00 | OK |
| `admin_quotation_expired_v1` | sent | ayer | OK |
| `appointment_booked` | sent (1) | 12:03 | OK (nueva entrada, procesó bien) |
| `task_assigned` | sent (11) | 12:03 | OK (nuevas entradas, procesaron bien) |
| `welcome_lead_v1` | sent (3) | 12:02 | OK (nuevas entradas) |
| `booking_link_v1` | sent (4) | 12:02 | OK |

---

## 6. Catálogo completo de templates Meta — estado al 2026-06-09

### Aprobadas y funcionando
| Template | Fases | Vars |
|---|---|---|
| `welcome_lead_v1` | 1 — Bienvenida lead | `{{1}}` primer nombre |
| `booking_link_v1` | 1 — Link agendamiento | `{{1}}` nombre, `{{2}}` URL, `{{3}}` comercial |
| `appointment_booked` | 3 — Confirmación cita | `{{1}}` nombre, `{{2}}` título, `{{3}}` fecha, `{{4}}` hora |
| `booking_cancelled` | 3 — Cancelación | `{{1}}` nombre, `{{2}}` título, `{{3}}` fecha+hora |
| `recordatorio24hantes` | 3 — Recordatorio 24h cliente | `{{1}}` nombre, `{{2}}` título, `{{3}}` fecha |
| `visit_reminder_24h_internal_v1` | 3 — Recordatorio 24h interno | `{{1}}` hora, `{{2}}` cliente, `{{3}}` dir, `{{4}}` tel, `{{5}}` servicios |
| `visit_reminder_2h_client_v1` | 3 — Recordatorio 2h cliente | `{{1}}` nombre, `{{2}}` hora |
| `visit_reminder_2h_internal_v1` | 3 — Recordatorio 2h interno | `{{1}}` hora, `{{2}}` cliente, `{{3}}` dir, `{{4}}` tel |
| `quotation_sent_v1` | 4 — Cotización enviada | `{{1}}` nombre, `{{2}}` N° cot, `{{3}}` URL |
| `quotation_v2_sent_v1` | 4 — Cotización V2 | `{{1}}` nombre, `{{2}}` N° cot, `{{3}}` URL |
| `admin_quotation_accepted_v1` | 4 — Admin: cliente aceptó | `{{1}}` admin, `{{2}}` cliente, `{{3}}` N° cot |
| `admin_quotation_adjustments_v1` | 4 — Admin: pide ajustes | `{{1}}` admin, `{{2}}` cliente, `{{3}}` N° cot, `{{4}}` razón |
| `admin_quotation_rejected_v1` | 4 — Admin: rechazó | `{{1}}` admin, `{{2}}` cliente, `{{3}}` N° cot, `{{4}}` razón |
| `payment_proof_rejected_v1` | 6 — Comprobante rechazado | `{{1}}` nombre, `{{2}}` motivo, `{{3}}` banco, `{{4}}` cuenta |
| `project_assigned_designer_v1` | 7 — Diseñador asignado | `{{1}}` diseñador, `{{2}}` proyecto, `{{3}}` cliente |
| `project_fully_paid_v1` | 6 — Proyecto pagado 100% | `{{1}}` nombre, `{{2}}` proyecto |
| `payment_received` | 6 — Confirmación pago | `{{1}}` nombre, `{{2}}` monto, `{{3}}` proyecto, `{{4}}` método, `{{5}}` saldo |
| `quotation_expiry_3d` | 4 — Aviso vencimiento | `{{1}}` nombre, `{{2}}` N° cot, `{{3}}` fecha venc |
| `project_status_change` | multi — Cambio etapa | `{{1}}` nombre, `{{2}}` proyecto, `{{3}}` etapa |
| `booking_modified` | 3 — Reagendamiento | `{{1}}` nombre, `{{2}}` título, `{{3}}` fecha ant, `{{4}}` fecha nueva |
| **`fabricacion_iniciada_v1`** | **9 — Inicio fabricación** | **`{{1}}` nombre cliente, `{{2}}` días estimados** |
| **`instalacion_programada_v1`** | **9 — Fecha instalación** | **`{{1}}` nombre cliente, `{{2}}` fecha en español** |
| **`recordatorio_instalacion_v1`** | **9 — Recordatorio día D** | **`{{1}}` nombre cliente** |
| **`proyecto_completado_v1`** | **9 — Cierre proyecto** | **`{{1}}` nombre cliente, `{{2}}` nombre proyecto** |

### Pendientes (bloqueantes)
| Template | Estado | Acción |
|---|---|---|
| `visit_assigned_admin_v1` | ❌ No existe en Meta BM | Robert debe crear (Paso 7) |
| `payment_request_v1` | 🟡 En revisión Meta | Pendiente aprobación |
| `quotation_reactivation_admin_v1` | 🟡 En revisión Meta | Pendiente + agregar al TEMPLATE_REGISTRY cuando apruebe |

---

## 7. Archivos clave del proyecto

| Archivo | Descripción |
|---|---|
| `D:\Agents-automations\04-Innovar\.env` | Todas las credenciales |
| `D:\Agents-automations\04-Innovar\db\migrations\042_fix_welcome_lead_and_quotation_valid_until.sql` | Fix bienvenida + valid_until |
| `D:\Agents-automations\04-Innovar\db\migrations\047_notificador_fabricacion.sql` | 🔴 PENDIENTE aplicar |
| `D:\Agents-automations\04-Innovar\db\migrations\048_notificador_instalacion_programada.sql` | 🔴 PENDIENTE aplicar |
| `D:\Agents-automations\04-Innovar\db\migrations\049_cierre_automatico_proyecto.sql` | 🔴 PENDIENTE aplicar |
| `D:\Agents-automations\04-Innovar\src\data\automatizacionesContent.ts` | Documentación Docs /docs |
| `D:\Agents-automations\04-Innovar\src\data\motorComercialContent.ts` | Documentación Motor Comercial |
| `D:\Agents-automations\04-Innovar\supabase\functions\process-whatsapp-notifications\index.ts` | Edge Function WA (puede no estar en repo local — verificar en Supabase dashboard) |

---

## 8. Cómo ejecutar las migraciones (paso a paso)

```bash
# 1. Ir al proyecto
cd D:\Agents-automations\04-Innovar

# 2. Cargar credenciales y ejecutar el SQL de la migración
node -e "
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const fs = require('fs');

async function applyMigration(file) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const sql = fs.readFileSync(file, 'utf8');
  const res = await fetch('https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const data = await res.json();
  if (data.message) { console.error('ERROR:', data.message); } 
  else { console.log('OK:', file, '—', JSON.stringify(data).substring(0, 100)); }
}

applyMigration('./db/migrations/047_notificador_fabricacion.sql');
"
```

> Repetir para 048 y 049. Verificar siempre que `data.message` no tenga error antes de continuar con la siguiente.

---

## 9. Checklist de cierre completo

- [ ] **Paso 1:** Investigar y eliminar `bienvenidas_clientes` residual en DB
- [ ] **Paso 2:** Reset items stuck en `notification_queue` + descartar test numbers
- [ ] **Paso 3:** Migración 047 aplicada y verificada con trigger test
- [ ] **Paso 4:** Migración 048 aplicada y verificada (incluye fecha en español)
- [ ] **Paso 5:** Migración 049 aplicada y verificada (cierre + tarea + WA)
- [ ] **Paso 6:** n8n workflow `CjbwjGdRKyIzWJWq` — DRY_RUN=false + activado
- [ ] **Paso 7:** Robert crea `visit_assigned_admin_v1` en Meta BM (acción humana)
- [ ] **Paso 8:** Robert valida mensajes de Fase 9 en su teléfono → limpiar `wa_test_phone_override`
- [ ] **Paso 9:** Merge `ux-fixes` → `main` + git push
- [ ] **Actualizar memoria:** `project_innovar.md` con estado final — Fase 9 COMPLETADA

---

## 10. Skills y referencias útiles para la próxima IA

- **`/retomar innovar`** — carga el handoff más reciente y ejecuta el siguiente paso
- **`/diagnose`** — si algún template sigue fallando después de Meta
- **Memoria del proyecto:** `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\project_innovar.md`
- **Catálogo WA:** `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\reference_innovar_whatsapp_templates.md`
- **CLAUDE.md global** — cargado automáticamente, define autonomía, rutas, credenciales globales
- **Patrón Management API Innovar** — documentado en `reference_innovar_management_api.md` en memoria

---

*Generado por Claude Sonnet 4.6 en sesión 2026-06-09. Templates Meta confirmadas aprobadas por Robert Viroña.*
