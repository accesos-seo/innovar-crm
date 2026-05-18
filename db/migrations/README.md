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

When you apply one, change its status to ✅.
