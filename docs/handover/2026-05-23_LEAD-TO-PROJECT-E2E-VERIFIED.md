# HANDOFF — Lead → Project · Verificación E2E (Slices 1-3)

> **Fecha**: 2026-05-23
> **Sesión**: continuación del handoff 2026-05-22 (que cerró Fases 1-4)
> **Estado al cierre**: Slices 1, 2 y 3 con DB + UI funcionales end-to-end. Faltan Slices 4-7.
> **Predecesor**: `docs/handover/2026-05-22_LEAD-TO-PROJECT-FLOW.md` (sigue válido como contexto de diseño; este lo extiende con la ejecución del 23-may)

---

## 0. TL;DR — 60 segundos

- **Slice 1** (esqueleto de datos) está aplicado y probado: 13 casos SQL pasan tras 4 migraciones de fix (014a, 015, 016, 017).
- **Slice 2** (UI Leads como Opportunities) tiene código completo, FF `VITE_FF_OPPORTUNITIES=true` activado en `.env` local, `tsc --noEmit` verde sin errores nuevos atribuibles al refactor, `npm run build` pasa limpio.
- **Slice 3 SQL** (booking público) aplicado: migración `014_whatsapp_lead_followup_flow.sql` (que ya existía en disco sin aplicar) + fix `018` + fix de timezone `019`. **Verificado E2E desde el navegador** vía Claude Preview MCP sobre `vite preview`.
- **Cable de WhatsApp tendido**: cada `INSERT en opportunities` encola 2 mensajes en `notification_queue` (welcome + booking link con URL pública). Las plantillas Meta `welcome_lead_v1` y `booking_link_v1` aún no están aprobadas, por lo que el worker externo los marca como `failed` hasta que se aprueben. Eso no bloquea el flujo de la app.
- **Slices 4-7** sin tocar (mediciones tipadas + calculadoras compartidas, versiones de cotización, aprobación pública + verificación pago + conversión a proyecto, agentes restantes incluyendo A-05).

---

## 1. Resumen ejecutivo de cambios aplicados hoy

### 1.1 Migraciones nuevas (todas vía Management API contra `xdzbjptozeqcbnaqhtye`)

| # | Archivo | Por qué |
|---|---|---|
| 014 | `014_whatsapp_lead_followup_flow.sql` | **Pre-existía en disco sin aplicar.** Es el SQL del Slice 3: trigger AFTER INSERT en opportunities + 3 RPCs públicas (`get_public_booking_context`, `get_public_visit_slots`, `book_public_visit`) + columna `public_token_expires_at` + seed `public_app_base_url` en system_settings. |
| 014a | `014a_fix_opportunity_transitions.sql` | El CASE de `validate_opportunity_transition` no incluía `new → visit_scheduled` (self-booking público) ni `contacted → quoted` (bypass admin sin visita). Ambas están explícitamente en el PRD §3 y §4.2 pero faltaban del código de 009. Sin esto era imposible INSERT en visits sobre opportunities frescas. |
| 015 | `015_fix_visit_to_task_mirror.sql` | `visit_to_task_mirror` usaba `'completada'`/`'cancelada'` (femenino) que no existen en el enum `task_status` (reales: `completado`/`cancelado` masculino), faltaba el cast `::task_status` al final del CASE, y el `task_category = 'visit_mirror'` no es un valor válido del enum (válidos: cita, operativa, diseno, produccion, administrativa, seguimiento). Sustituido por `'cita'::task_category`. |
| 016 | `016_fix_visit_to_task_mirror_timeslot.sql` | `tasks.time_slot` es `time without time zone`, pero el trigger pasaba `to_char(scheduled_at, 'HH24:MI')` (TEXT). PG no castea implícito. Fix: `NEW.scheduled_at::time`. |
| 017 | `017_fix_auto_generate_quotation.sql` | El INSERT en `quotations` referenciaba columna `created_by` que **no existe** en la tabla. Quitada del INSERT — la atribución se deriva vía `opportunity_id → opportunities.assigned_to`. |
| 018 | `018_fix_visit_to_task_mirror_availability.sql` | El trigger legacy `sync_task_availability_booking` (en tasks AFTER INSERT) exige que exista un row precargado en `availability_slots` con `(staff_id, date, start_time)` exactos. El flujo nuevo no precargaba esos slots, así que el espejo visit→task abortaba la cadena. Fix: `visit_to_task_mirror` hace UPSERT en `availability_slots` antes del INSERT en tasks. |
| 019 | `019_fix_get_visit_slots_timezone.sql` | `get_visit_slots` casteaba `(date + time)::TIMESTAMPTZ` que PG interpreta como UTC. Resultado: el cliente veía slots `04:00 / 06:00 / 08:30 / 10:30` en lugar de los `09:00 / 11:00 / 13:30 / 15:30` esperados. Fix: `AT TIME ZONE 'America/Bogota'`. |

**Lección general**: las 6 migraciones de fix (014a a 019) corrigen bugs que aparecieron porque las funciones plpgsql de 009/010 nunca se habían ejecutado contra datos reales antes del QA de hoy. `CREATE FUNCTION` no valida el cuerpo de la función hasta su primera ejecución. Guardado en memoria: `bug_innovar_migration_009_010_never_tested.md`.

### 1.2 Estado del `.env` local (puerto canonical)

```bash
# Agregadas hoy
VITE_SUPABASE_URL=https://xdzbjptozeqcbnaqhtye.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # el mismo que SUPABASE_ANON_KEY
VITE_FF_OPPORTUNITIES=true
```

El cliente Vite necesita variables prefijadas con `VITE_`. Antes solo había `SUPABASE_URL` y `SUPABASE_ANON_KEY` sin prefijo (probable que viniera de Vercel, no de dev local).

`.env*` está en `.gitignore`, sin riesgo de filtrado por commit accidental.

### 1.3 Sin cambios en código TS/React

Slice 2 y 3 UI ya estaban construidos en disco antes de esta sesión. Solo se activó el flag y se verificó. No edité archivos TSX/TS de la app.

---

## 2. Resultados de pruebas E2E

### 2.1 13 casos SQL del Slice 1 — todos pasan

| # | Caso | Resultado |
|---|---|---|
| 1.1 | INSERT opportunity sin assigned_to | Round-robin asigna "Comercial Test" ✅ |
| 1.2 | INSERT clients con phone duplicado | UNIQUE parcial `clients_whatsapp_phone_unique_idx` rechaza ✅ |
| 1.3 | INSERT segunda opp sobre mismo client | Crea sin duplicar cliente, round-robin alterna a "Leo Heredia" ✅ |
| 1.4 | INSERT visit lunes presencial | CHECK `visits_dow_window` rechaza ✅ |
| 1.5 | INSERT visit martes presencial | Aceptada, opp pasa a `visit_scheduled` ✅ |
| 1.6 | Propagación trigger validate_visit_completion | opp `new → visit_scheduled` ✅ |
| 1.7 | Trigger visit_to_task_mirror | Task espejo creado con mismo UUID que visit ✅ |
| 1.8 | INSERT visit foto_remota miércoles | Aceptada (bypass del CHECK DOW) ✅ |
| 1.9 | UPDATE opp `visit_scheduled → approved` | `validate_opportunity_transition` rechaza ✅ |
| 1.10 | UPDATE visit `agendada → realizada` con measurements + 3 fotos | Cascada completa: opp `visit_completed → quoted` + quotation v1 draft auto-generada con `valid_until` 30 días ✅ |
| 1.11 | Reasignación admin de comercial | Fila auto-poblada en `opportunity_assignment_history` ✅ |
| 1.12 | UPDATE opp `new → approved` | `validate_opportunity_transition` rechaza ✅ |
| 1.13 | `notification_queue` encola eventos | `lead.form_submitted`, `lead_welcome`, `lead_booking_link` aparecen con status `pending` ✅ |

### 2.2 Camino dorado Slice 3 — verificado en navegador

Validado vía Claude Preview MCP sobre `vite preview` (build estático). Detalles del workaround en `feedback_onedrive_vite_hmr_conflict.md`.

```
1. Opp creada vía SQL (a8542ac9-4a09-4abb-b8e7-f6abd2a4e67a)
   ↓ trigger trg_opp_round_robin (BEFORE INSERT)
2. Round-robin asigna "Comercial Test" (b46545f7-...)
   ↓ trigger trg_notify_lead_followup_flow (AFTER INSERT)
3. notification_queue encola 2 mensajes con URL pública:
   · welcome_lead_v1 → "Hola [QA-20260523] Cliente UI Booking..."
   · booking_link_v1 con URL http://localhost:4173/agendar/d3dd52b1...

4. Cliente abre /agendar/d3dd52b1...
   ↓ React Router → PublicBooking.tsx (no requiere auth)
   ↓ RPC get_public_booking_context
5. UI muestra: "AGENDA TU VISITA TÉCNICA · Cliente: ...
                Te atiende: Comercial Test · 6 fechas Mar/Jue"
   ↓ RPC get_public_visit_slots(token, CURRENT_DATE, +14)
6. UI lista 24 slots con horarios 09:00/11:00/13:30/15:30
   (tras fix 019; antes mostraba 04:00/06:00/08:30/10:30 por bug timezone)

7. Click en "11:00" del martes 26-may → button selected
8. Click "CONFIRMAR VISITA"
   ↓ RPC book_public_visit(token, '2026-05-26 16:00:00+00')
   ↓ INSERT visits (scheduled_via='public_link', status='agendada')
   ↓ trigger trg_visit_validate_completion (BEFORE INSERT)
9. Opportunity propaga: new → visit_scheduled
   ↓ trigger trg_visit_to_task_mirror (AFTER INSERT)
10. availability_slots row creado + UPSERT
11. tasks row creado (mismo UUID que la visit)
    ↓ trigger trg_book_task_availability (AFTER INSERT en tasks)
12. availability_slot marcado is_booked=true, ligado al task.id
13. RPC retorna {visit_id, scheduled_at, staff_name, client_name}
14. UI renderiza pantalla: "¡LISTO! VISITA TÉCNICA CONFIRMADA ·
                            Martes 26 De Mayo De 2026 · 11:00 ·
                            Tu asesor: Comercial Test"
15. Token public_token automáticamente invalidado:
    get_public_booking_context() devuelve [] porque opp.status
    ya no está en ('new','contacted')
```

**Verificación en DB post-flujo:**
```sql
SELECT o.status, v.scheduled_at, v.scheduled_via, v.status::text
  FROM opportunities o JOIN visits v ON v.opportunity_id=o.id
 WHERE o.id='a8542ac9-4a09-4abb-b8e7-f6abd2a4e67a';
-- visit_scheduled | 2026-05-26 16:00:00+00 | public_link | agendada
```

### 2.3 Slice 2 — verificado parcialmente

- ✅ `npm run build` pasa con FF activo (bundle de 522 kB, sin warnings de error)
- ✅ `tsc --noEmit` reporta 61 errores **todos pre-existentes** (legacy en Pagos, MaterialCreate, settings/*, LeadsLegacy.tsx, etc.); 0 nuevos atribuibles al cutover Slice 2
- ✅ Login renderiza correctamente al abrir la app
- ⏸ Falta verificación visual del listado `/leads` con sesión autenticada (Claude Preview MCP arranca sin cookies, no puede autenticarse). El usuario puede validarlo después en su navegador real corriendo `npx vite preview` o esperando a deploy.

---

## 3. Estado por slice — DB / UI / E2E

| Slice | DB | UI | E2E | Notas |
|---|---|---|---|---|
| 1 — Esqueleto de datos | ✅ | n/a | ✅ | 13 casos SQL, 4 fixes aplicados |
| 2 — Leads como Opportunities | ✅ | ✅ | parcial | Cutover compilado, login renderiza, listado autenticado pendiente de QA visual |
| 3 — Calendar + Public Booking | ✅ | ✅ | ✅ | Flujo dorado probado en navegador, ver §2.2 |
| 4 — Mediciones tipadas + calculadoras | ❌ | ❌ | ❌ | Sin empezar |
| 5 — Versiones de cotización + comparador | ❌ | ❌ | ❌ | Sin empezar |
| 6 — Aprobación pública + pago + proyecto | ❌ | ❌ | ❌ | Sin empezar |
| 7+ — Agentes (A-01, A-02, A-12, A-13, A-05 ⭐) | ❌ | ❌ | ❌ | Sin empezar |

---

## 4. Datos de prueba que quedaron en DB

Para mantener trazabilidad, dejo los registros QA marcados con prefijo `[QA-20260523]`. Si se quieren limpiar:

```sql
-- Soft-delete las opportunities QA + sus visits + clients sin otras opps activas
WITH qa_opps AS (
  SELECT id, client_id FROM public.opportunities WHERE notes ILIKE '[QA-20260523]%'
),
qa_visits AS (
  UPDATE public.visits SET deleted_at = NOW()
   WHERE opportunity_id IN (SELECT id FROM qa_opps)
  RETURNING id
),
soft_opps AS (
  UPDATE public.opportunities SET deleted_at = NOW()
   WHERE id IN (SELECT id FROM qa_opps)
)
UPDATE public.clients SET deleted_at = NOW()
 WHERE id IN (SELECT client_id FROM qa_opps)
   AND NOT EXISTS (
     SELECT 1 FROM public.opportunities o2
      WHERE o2.client_id = clients.id
        AND o2.deleted_at IS NULL
        AND o2.notes NOT ILIKE '[QA-20260523]%'
   );
```

Lista actual de filas QA:
- 4 clients (phones 99001000001, 99001000002, 99001000003, 99001000150)
- 4 opportunities (estados: `quoted`, `visit_scheduled` x2, `new`)
- 3 visits (1 realizada, 2 agendadas)
- 1 quotation v1 draft (auto-generada por trigger)
- ~10 filas en notification_queue (todas con status `pending` o `failed`)

---

## 5. Deuda técnica descubierta hoy

### 5.1 Políticas RLS duplicadas en `payments`
La tabla `payments` tiene 11 policies acumuladas de migraciones distintas, con nombres como:
- `"Admin todo en payments"`, `"admin: todo en payments"`, `"admin_all_payments"` (3 versiones del mismo policy ALL)
- `"Comercial registra pagos"`, `"comercial: insertar payments"`, `"payments_insert"` (3 versiones de INSERT)
- `"Equipo lee pagos"`, `"comercial: insertar y ver payments"`, `"payments_select"`, `"user_payments"` (4 versiones de SELECT)

Como PG combina policies con OR, no rompen nada operativamente, pero hacen el comportamiento difícil de razonar. **Sugiero migración 020** para consolidar a un único set canónico definido por la 011.

### 5.2 Trigger legacy `trg_enqueue_whatsapp_new_lead` en `clients`
Sigue activo y encola un evento `lead.form_submitted` cada vez que se inserta un cliente. Ahora con el flujo nuevo de opportunities, cada nuevo lead genera **3 mensajes en queue** (1 legacy + 2 nuevos) en lugar de 2.

Opciones:
- a) Deshabilitar el trigger viejo (`DROP TRIGGER trg_enqueue_whatsapp_new_lead ON clients`) — el contenido del welcome del flujo nuevo es más rico (incluye comercial asignado).
- b) Mantenerlo como redundancia mientras Meta aprueba los templates nuevos — el legacy usa `bienvenidas_clientes` que sí está aprobado.

**Decisión sugerida**: deshabilitarlo en Slice 7 cuando los templates `welcome_lead_v1` y `booking_link_v1` estén aprobados y verificados en producción.

### 5.3 `tsc-errors.log` desactualizado en disco
El archivo `tsc-errors.log` en la raíz del repo tiene 62 errores y referencia líneas de `Leads.tsx` que ya no existen tras el cutover. Sugiero borrarlo o regenerarlo con `npx tsc --noEmit > tsc-errors.log 2>&1`.

### 5.4 Anomalía menor en availability_slots con visits realizadas
Cuando una visit pasa a `realizada` (estado terminal), el `availability_slot` asociado sigue marcado `is_booked=true`. Eso es correcto desde "el comercial estuvo ocupado ese día/hora", pero `get_visit_slots` excluye visits con status `('cancelada','no_show')` — incluye `realizada` como ocupado. Comportamiento esperado: una visita ya hecha no libera el slot. **No es bug, anotado para evitar confusión futura.**

### 5.5 PublicBooking.tsx ya existe (no documentado en handoff anterior)
El componente `src/pages/PublicBooking.tsx` (~13 kB) ya estaba en disco al inicio de esta sesión. No estaba referenciado en el handoff del 22-may. Cableado en `src/App.tsx:55,126` con la ruta `/agendar/:token`. Funcional, sin cambios necesarios.

---

## 6. Limitaciones del entorno descubiertas

### 6.1 Vite dev + OneDrive — incompatible
`npm run dev` (que ejecuta `tsx server.ts` con Vite middleware) falla intermitentemente con:
```
[vite] Pre-transform error: Failed to load url /src/main.tsx
       Does the file exist?
```

El archivo existe (curl manual devuelve 200). El bug es race condition entre el filesystem watcher de Vite y el cliente de sincronización de OneDrive. Documentado en memoria global del usuario antes de esta sesión, validado hoy con caso concreto.

**Workaround usado**: `vite preview --port 4173 --host 127.0.0.1` sobre `dist/` (el build estático). Sin HMR, sin watcher, sin race condition. Para cambios en código exige rebuild manual.

Guardado: `feedback_onedrive_vite_hmr_conflict.md`.

### 6.2 Claude Preview MCP y paths con espacios
La ruta canónica `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\...` tiene espacio en "mi proyect". El MCP de Claude Preview pasa los args al spawn sin shell-quoting, así que Windows interpreta "Program" como ejecutable.

**Workaround**: usar nombre corto 8.3 de Windows en `runtimeArgs`. Obtenido con:
```powershell
(New-Object -ComObject Scripting.FileSystemObject).GetFolder($path).ShortPath
# C:\Users\ceoel\OneDrive\ESCRIT~1\MIPROY~2\AGENTS~1\INNOVA~1
```

`.claude/launch.json` (en el espejo `Documentos/.../Innovar-App-main/.claude/` porque es el cwd del agente) usa este short path con `npm --prefix`.

---

## 7. Próximos pasos sugeridos

### 7.1 Slice 4 — Mediciones tipadas + calculadoras compartidas
Es el siguiente cable lógico. Cuando una visit cierra como `realizada`, ya dispara `auto_generate_quotation` que crea quotation v1 draft. Pero la cotización queda con 0 items (falta llenarla con los productos calculados desde `measurements`).

Tareas:
1. Crear `src/schemas/measurements/*.ts` — 7 schemas Zod, uno por servicio (kitchen, closet, tv_center, hardware, mesones, doors, special_finishes).
2. Extraer las 7 calculadoras de `src/hooks/use-{service}-calculator.ts` a `src/lib/calculators/{service}.ts` como funciones puras (sin React/Supabase). Mantener los hooks como wrappers delgados.
3. Crear `src/components/visits/MeasurementsForm.tsx` (form genérico que delega al schema del servicio elegido) + `PhotoUploader.tsx`.
4. Crear `src/pages/public/SubmitMeasurements.tsx` para foto-remota — el cliente sube medidas + fotos sin agendar slot.
5. Crear hook `useCompleteVisit` (cierra visit con validación de ≥3 fotos + measurements no vacío).
6. Crear Edge Function `auto-generate-quotation` que se dispare por Database Webhook al INSERT de quotations v1 draft, importe las calculadoras compartidas, calcule items, y haga UPDATE de la quotation con los items.
7. Probar: cerrar una visit realizada con measurements de cocina + 3 fotos → quotation v1 se llena automáticamente con los items.

### 7.2 Slice 5 — Versiones de cotización + comparador
Una vez Slice 4 cierre y haya quotations con items reales, agregar:
1. `useQuotationVersions(rootId)` — lista todas las versiones de una cotización
2. `useCreateQuotationVersion` con `change_reason` obligatorio
3. `QuotationCompare.tsx` — diff lado-a-lado de dos versiones
4. Cron `expiry_watcher` — marca como `expired` las quotations con `valid_until < now()`

### 7.3 Slice 6 — Aprobación pública + verificación de pago + creación de proyecto
1. `src/pages/public/ApproveQuotation.tsx` — cliente ve la versión vigente y aprueba + sube comprobante.
2. Hooks `useApproveQuotationPublic`, `useUploadPaymentProof`, `useVerifyPayment`, `useRejectPayment`.
3. `src/pages/admin/PaymentVerification.tsx` — admin valida comprobantes.
4. Verificar que el trigger `convert_quotation_to_project` (en `payments`) crea el proyecto correctamente cuando un pago pasa a `verified`.

### 7.4 Slice 7+ — Agentes restantes
- A-01 webhook WordPress (Edge Function)
- A-02 intake WhatsApp (n8n)
- A-04 notificador de nuevo lead (ya parcialmente cubierto por trg_notify_lead_followup_flow + worker)
- A-12 dormancy_watcher (cron diario)
- A-13 refund-calculator (Edge Function)
- **A-05 chatbot interno ⭐** (lo más complejo, se deja al último)

---

## 8. Reglas operativas que validamos hoy

- ✅ El agente aplica acciones en Supabase directamente con el PAT del `.env` — no hay que delegarlas al usuario. Memoria: `feedback_innovar_apply_actions_self.md`.
- ✅ Migraciones se aplican via Management API con curl + node JSON serialization (para escapar comillas correctamente). Memoria: `reference_innovar_management_api.md`.
- ❌ `npm run dev` no funciona en OneDrive — usar `vite preview` sobre el build. Memoria: `feedback_onedrive_vite_hmr_conflict.md`.
- ✅ Datos QA marcados con prefijo `[QA-YYYYMMDD]` para trazabilidad y limpieza posterior.
- ✅ Smoke-test obligatorio post-apply de migraciones con funciones plpgsql (las funciones no se validan en CREATE, solo en primera ejecución). Memoria: `bug_innovar_migration_009_010_never_tested.md`.

---

## 9. Archivos creados/modificados en esta sesión

```
Innovar-App-main/
├── .env                                                                # +VITE_SUPABASE_URL, +VITE_SUPABASE_ANON_KEY, +VITE_FF_OPPORTUNITIES=true
├── db/migrations/
│   ├── 014a_fix_opportunity_transitions.sql                            # NUEVO
│   ├── 015_fix_visit_to_task_mirror.sql                                # NUEVO
│   ├── 016_fix_visit_to_task_mirror_timeslot.sql                       # NUEVO
│   ├── 017_fix_auto_generate_quotation.sql                             # NUEVO
│   ├── 018_fix_visit_to_task_mirror_availability.sql                   # NUEVO
│   ├── 019_fix_get_visit_slots_timezone.sql                            # NUEVO
│   └── README.md                                                       # actualizado (status de 013, 014, 014a-019)
└── docs/handover/
    └── 2026-05-23_LEAD-TO-PROJECT-E2E-VERIFIED.md                      # ESTE archivo

C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main\.claude\
└── launch.json                                                          # NUEVO (config Claude Preview MCP)

C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\
├── MEMORY.md                                                            # actualizado
├── bug_innovar_migration_009_010_never_tested.md                        # NUEVO
└── feedback_onedrive_vite_hmr_conflict.md                               # NUEVO
```

**Migración 014 (`014_whatsapp_lead_followup_flow.sql`) NO se editó** — solo se aplicó. Ya existía en disco escrita por una sesión previa.

---

## 10. Cómo retomar esto en la próxima ventana

Sugerencia de primer mensaje:

> "Estoy retomando el rediseño Lead → Proyecto del CRM Innovar. Leí el handoff
> `docs/handover/2026-05-23_LEAD-TO-PROJECT-E2E-VERIFIED.md`. Slices 1, 2 cutover
> y 3 están verificados E2E. Mi próxima acción es arrancar Slice 4 (mediciones
> tipadas + extracción de calculadoras a `src/lib/calculators/`). Antes de tocar
> código quiero confirmar contigo si querés que arranque por el schema Zod de
> kitchen.ts (el servicio principal) o si preferís otra prioridad."

Si la nueva sesión necesita validar el estado DB:
```bash
cd "C:/Users/ceoel/OneDrive/Escritorio/mi proyect/Agents-automations/Innovar-App-main"
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '"')
curl -sS -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary '{"query":"SELECT COUNT(*) AS opp, (SELECT COUNT(*) FROM visits) AS visits, (SELECT COUNT(*) FROM notification_queue WHERE created_at > NOW() - INTERVAL ''1 day'') AS recent_notifs FROM public.opportunities;"}'
```

Si la nueva sesión necesita correr la app:
```powershell
# NO usar npm run dev (falla por OneDrive sync)
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
npm run build
npx vite preview --port 4173 --host 127.0.0.1
# Abrir http://localhost:4173
```

---

**Fin del handoff. La cadena Lead → Visita agendada está cerrada. Siguiente: mediciones → quotation con items reales.**
