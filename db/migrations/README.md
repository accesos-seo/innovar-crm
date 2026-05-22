# Database Migrations

SQL migrations for the Innovar CRM Supabase database.

## How to apply

1. Open the Supabase dashboard for the Innovar CRM project (`xdzbjptozeqcbnaqhtye`).
2. Go to **SQL Editor → New query**.
3. Paste the migration file contents.
4. Click **Run**.

Migrations are written to be idempotent — safe to re-run if you're not sure whether they've been applied.

## Migration log

| File | Status | Description |
|---|---|---|
| `001_generate_quotation_number.sql` | ✅ Applied 2026-05-17 | Adds `quotation_number` column + atomic generator (fixes race condition + missing column) |
| `002_fix_handle_new_user_default_role.sql` | ⏳ Pending | Cambia el rol default de `'admin'` a `'comercial'` en el trigger de creación de perfiles (cierra escalada de privilegios) |
| `002_kitchen_pricing_catalog.sql` | ⏳ Pending | Catálogo de precios de cocina |
| `003_tv_center_pricing.sql` | ⏳ Pending | Catálogo de precios TV Center |
| `004_special_finishes_pricing.sql` | ⏳ Pending | Catálogo de acabados especiales |
| `005_closets_pricing.sql` | ⏳ Pending | Catálogo de closets |
| `006_interior_doors_pricing.sql` | ⏳ Pending | Catálogo de puertas interiores |
| `007_mesones_pricing.sql` | ⏳ Pending | Catálogo de mesones |
| `007a_quotation_status_enum.sql` | ✅ Applied 2026-05-22 | **Pre-008/011**: agrega valores faltantes a enums `quotation_status` (`client_approved`, `pending_payment_verification`, `expired`) y `user_role` (`super_admin`). Statements individuales (no transaccional). |
| `008_lead_to_project_schema.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Estructura**: tablas `opportunities`, `opportunity_assignment_history`, `visits`, `system_settings`, `agent_actions_log`; UNIQUE parcial en `clients.whatsapp_phone`; ALTERs en quotations/payments/projects. Ver `docs/prd/lead-to-project-flow.md` |
| `009_lead_to_project_functions.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Funciones**: `validate_public_token`, `get_visit_slots`, `calculate_refund_percentage`, round-robin, validación de transiciones, espejo visit→task, auto-generación de cotización, conversión a proyecto |
| `010_lead_to_project_triggers.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Triggers**: cablea las funciones de 009 a las tablas correspondientes |
| `011_lead_to_project_rls.sql` | ✅ Applied 2026-05-22 | **Lead→Project · RLS**: políticas estrictas (comercial solo ve lo suyo, admin todo). Endurece `payments` |
| `012_lead_to_project_seed.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Seed**: configuración inicial en `system_settings` |
| `ROLLBACK_lead_to_project.sql` | — | Revierte 008→012. ⚠️ DESTRUCTIVO: borra opportunities/visits/payments verificados |

When you apply one, change its status to ✅.

## Orden estricto para Lead → Project (007a + 008–012)

Aplicar SECUENCIALMENTE, en este orden:

1. `007a_quotation_status_enum.sql` — extiende enums `quotation_status` y `user_role`. Correr como statements **individuales** (PG no acepta `ADD VALUE` + uso del valor en la misma transacción).
2. `008_lead_to_project_schema.sql` — tablas nuevas + ALTERs. Sin esto las siguientes fallan.
3. `009_lead_to_project_functions.sql` — funciones referenciadas en 010.
4. `010_lead_to_project_triggers.sql` — triggers usando las funciones de 009.
5. `011_lead_to_project_rls.sql` — RLS (endurece `payments`).
6. `012_lead_to_project_seed.sql` — config inicial editable por admin.

**Pre-condiciones críticas (validadas al deploy 2026-05-22):**

- **Duplicados de `whatsapp_phone`**: la migración 008 crea un UNIQUE parcial (`WHERE deleted_at IS NULL`) que falla si hay duplicados activos. Diagnóstico:
  ```sql
  SELECT regexp_replace(whatsapp_phone, '[^0-9]', '', 'g') AS normalized, COUNT(*)
   FROM public.clients
   WHERE whatsapp_phone IS NOT NULL AND deleted_at IS NULL
   GROUP BY 1 HAVING COUNT(*) > 1;
  ```
  Soft-delete (`UPDATE clients SET deleted_at = NOW() WHERE id = ...`) las filas extras antes de aplicar.

- **Helper functions existentes**: `update_updated_at()` y `get_my_role()` (en `public`). Las migraciones referenciaban `update_updated_at_column()` por error — ya corregido en 008/010.

- **Legacy en `payments.payment_type`**: la 008 agrega `CHECK (payment_type IN ('advance','installment','final','refund'))`. Si hay filas con valores en español ('abono'…) o NULL, normalizarlas antes.

- **Backup**: Free Plan no incluye backups manuales en dashboard. Alternativa probada: snapshot JSON via Management API
  ```bash
  curl -sS -X POST "https://api.supabase.com/v1/projects/<PROJECT_ID>/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query":"SELECT row_to_json(c) FROM public.clients c;"}' \
    > db/backups/$(date +%Y-%m-%d)_clients_pre_migration.json
  ```

**Si una migración falla a mitad de camino**, la cláusula `BEGIN...COMMIT` revierte el archivo entero. Aplicar `ROLLBACK_lead_to_project.sql` si necesitas restaurar 008–012 a estado anterior.
