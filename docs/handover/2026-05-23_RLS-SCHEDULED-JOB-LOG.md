# 2026-05-23 — Cierre completo: RLS + grants en `public.scheduled_job_log`

## Contexto

Robert (técnico de Resend SMTP) reportó RLS desactivado en `public.scheduled_job_log`. Esta sesión cierra el ciclo completo: la migración **029** ya había sido aplicada hoy más temprano (RLS + policy SELECT admin), pero **no cubría los grants a nivel tabla** — específicamente `TRUNCATE`, que en PostgreSQL **no se evalúa por RLS** y se autoriza solo por el grant.

## Estado pre-fix (verificado vía Management API)

```
relrowsecurity         = true   ← 029 ya lo había puesto
relforcerowsecurity    = false
policies               = 1 (scheduled_job_log_select_admin, SELECT, admin/super_admin)
rows                   = 0
grants problemáticos   = anon y authenticated tenían:
                         SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
writers identificados  = 4 funciones SECURITY DEFINER (postgres owner):
                         run_daily_task_escalation, run_payment_reminders,
                         generate_weekly_report, run_archive_inactive_projects
cron callers           = ninguno (las 4 funciones siguen siendo scaffold no agendado)
frontend readers       = ninguno (solo aparece en database.types.ts autogenerado)
edge function readers  = ninguno
```

## Decisión

**Escenario C híbrido**: base ya en su lugar (migración 029), falta cerrar el agujero TRUNCATE + reducir superficie de ataque retirando grants innecesarios.

No se borraron las 4 funciones SECURITY DEFINER ni la tabla, porque:
- Son scaffolding probablemente preparado para cron jobs que aún no se crearon
- El costo de mantenerlas es cero ahora que están bien aseguradas
- Si después se decide que son código muerto, ese es otro ticket

## Migración aplicada

**Archivo**: `db/migrations/029a_scheduled_job_log_revoke_table_grants.sql`

```sql
BEGIN;
REVOKE ALL ON TABLE public.scheduled_job_log FROM anon;
REVOKE ALL ON TABLE public.scheduled_job_log FROM authenticated;
COMMENT ON TABLE public.scheduled_job_log IS '...';
COMMIT;
```

Aplicada vía Management API (`POST /v1/projects/xdzbjptozeqcbnaqhtye/database/query`) el 2026-05-23.

## Verificaciones ejecutadas

### 1. Estado de grants post-fix
Solo quedan `postgres` y `service_role` con privilegios. `anon` y `authenticated` no aparecen en `information_schema.role_table_grants`.

### 2. Smoke SQL (SET ROLE)
| Acción como `anon` | Resultado |
|---|---|
| `TRUNCATE public.scheduled_job_log` | ❌ permission denied (esperado) |
| `SELECT * FROM ...` | ❌ permission denied |
| `INSERT INTO ...` | ❌ permission denied |
| `DELETE FROM ...` | ❌ permission denied |

| Acción como `authenticated` | Resultado |
|---|---|
| `TRUNCATE public.scheduled_job_log` | ❌ permission denied |

| Acción como `postgres` | Resultado |
|---|---|
| `SELECT public.run_archive_inactive_projects()` | ✅ insertó fila `status=success, archived=0` |

### 3. Smoke end-to-end con anon JWT real vía PostgREST
| Request | HTTP |
|---|---|
| `GET /rest/v1/scheduled_job_log?select=*&limit=1` | **401** `permission denied for table scheduled_job_log` |
| `POST /rest/v1/scheduled_job_log` body `{job_name:'attack'}` | **401** `permission denied` |
| `DELETE /rest/v1/scheduled_job_log?id=neq.<zero-uuid>` | **401** `permission denied` |

(Antes del fix: las tres devolvían 200 con éxito.)

### 4. Cleanup
La única fila insertada por la prueba del writer se eliminó con `TRUNCATE` desde postgres. Tabla en 0 filas, igual que antes.

## Deuda pendiente

1. **4 funciones SECURITY DEFINER huérfanas** (`run_daily_task_escalation`, `run_payment_reminders`, `generate_weekly_report`, `run_archive_inactive_projects`): existen pero ningún cron las invoca. Decidir si:
   - (a) Crear los `cron.job` correspondientes (¿hay un PRD que las necesite?)
   - (b) Borrarlas como deuda técnica si nadie las planificó

   No se actuó porque requiere consulta de producto, no decisión técnica.

2. **Templates Meta pendientes para flujo de visit reminders** (no relacionado con este fix, pero contexto): los 5 templates `visit_*_v1` siguen sin aprobarse — los rows quedan `failed` en `notification_queue` por ahora. Tracking en `MEMORY.md`.

## Comando que el usuario debe ejecutar (commit)

> Git en OneDrive lo ejecuta el usuario por la race condition con el sync. No correr desde el agente.

```powershell
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
git add db/migrations/029a_scheduled_job_log_revoke_table_grants.sql docs/handover/2026-05-23_RLS-SCHEDULED-JOB-LOG.md
git commit -m "fix(security): revoke anon/authenticated table grants on scheduled_job_log

Complementa 029: RLS no se aplica a TRUNCATE en PostgreSQL, así que el
fix anterior dejaba la tabla expuesta a borrado destructivo con anon key.
Esta migración 029a retira todos los grants a nivel tabla para anon y
authenticated; postgres y service_role siguen escribiendo via BYPASSRLS
(las 4 funciones run_* / generate_weekly_report no se ven afectadas).

Verificado end-to-end con anon JWT vía PostgREST (SELECT/INSERT/DELETE
ahora devuelven 401 permission denied)."
```

## Archivos tocados en esta sesión

- `db/migrations/029a_scheduled_job_log_revoke_table_grants.sql` (nuevo)
- `docs/handover/2026-05-23_RLS-SCHEDULED-JOB-LOG.md` (este archivo)
- `~/.claude/projects/C--Users-ceoel/memory/fix_innovar_scheduled_job_log_rls.md` (actualizado para reflejar 029a)
- `~/.claude/projects/C--Users-ceoel/memory/MEMORY.md` (entrada actualizada)
