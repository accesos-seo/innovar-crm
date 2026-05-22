# Mini-handoff — Slice 1 · Esqueleto de datos

> **Fecha**: 2026-05-22 (tarde)
> **PR**: [innovar-crm#7](https://github.com/accesos-seo/innovar-crm/pull/7)
> **Branch**: `feature/slice-1-data-skeleton`

## Qué quedó hecho

- Migraciones aplicadas en producción Supabase Innovar (`xdzbjptozeqcbnaqhtye`):
  - `007a_quotation_status_enum.sql` (nuevo) — extiende `quotation_status` y `user_role`
  - `008..012_lead_to_project_*.sql` — schema, funciones, triggers, RLS, seed
- `src/lib/features.ts` con 6 flags en `false`
- `src/types/database.types.ts` regenerado
- Snapshot de `clients` pre-mutación en `db/backups/2026-05-22_clients_pre_slice1.json`
- QA del trigger round-robin verificado (insert en tx + rollback)

## Qué falta antes de Slice 2

- [ ] **Merge del PR** `innovar-crm#7` a `master`
- [ ] **41 uncommitted changes** en working tree — el usuario debe identificar y commitear o descartar antes de Slice 2 (ver `git status` localmente). NO se tocan porque pueden contener trabajo previo no relacionado.
- [ ] **Crear al menos un profile con `role='comercial'`** activo en producción. Sin esto, el round-robin asigna `NULL` y la UI de Slice 2 muestra opportunities sin owner.
- [ ] **Error TS pre-existente** en `src/components/agenda/ClientSearchSelect.tsx:178` (`TooltipTrigger asChild` no compila bajo strict TS). NO bloquea Vite build, sí bloquea `tsc --noEmit`. Crear issue aparte o arreglar antes del Slice 2.

## Sorpresas que vale guardar

1. **`db/supabase_schema.sql` está desactualizado vs producción** — mismo patrón del bug `data_origin` de mayo. Varias migraciones 008/011 asumían columnas TEXT donde la DB tiene ENUMs:
   - `quotations.status` → ENUM `quotation_status` (4 valores; faltaban `client_approved`, `pending_payment_verification`, `expired`)
   - `user_role` → ENUM (faltaba `super_admin` que las policies RLS usan)
2. **Helper function name mismatch**: la DB tiene `update_updated_at()` (sin `_column`); las migraciones 008/010 referenciaban `update_updated_at_column()`. Edición en línea.
3. **Legacy values en `payments.payment_type`**: había `'abono'` (español) y NULL. El CHECK de 008 los rechazaba. Normalizados a `'advance'` antes.
4. **11 clientes con `whatsapp_phone` duplicado** — todos eran de prueba, soft-deleted preservando FKs (las quotations/projects siguen apuntando a sus clientes originales).
5. **Free Plan no incluye backups manuales** en dashboard. Sustituto probado: snapshot JSON vía Management API.

## Aprendizaje meta

El refactor map (Fase 4) NO había validado el shape de los ENUMs ni los nombres reales de helper functions en la DB. La auditoría debería incluir un paso de "verificar que las migraciones referencien tipos/funciones que existen tal cual" antes de marcarlas como listas. Vale agregarlo al `deploy-check` skill.

## Próximo paso — Slice 2

**Foco**: Refactor `Leads.tsx` para consumir `opportunities`. Crear `OpportunityDetail`. Cutover con feature flag `VITE_FF_OPPORTUNITIES`.

**Checklist detallado**: `docs/architecture/lead-to-project-refactor-map.md` §9 (Slice 2).

**Pre-requisitos antes de arrancar**:
1. PR #7 mergeado a master
2. Working tree limpio (resolver los 41 uncommitted)
3. Al menos 1 comercial activo en `profiles`
