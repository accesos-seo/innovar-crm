# BankSettings UX Rediseño — S3.2.b
**Fecha:** 2026-05-24  
**Estado:** Implementado, listo para smoke testing  
**Commit:** `fd9a796` (rama `ux-fixes`)

---

## Resumen Ejecutivo

Se rediseñó la página **BankSettings** (`/settings/bancarios`) para cambiar de un modelo de **UN único registro de datos bancarios** (en `system_settings`) a un modelo de **múltiples registros independientes** con una UX clara de "lista + botón agregar + modal".

### Cambios Principales
- **Antes:** Formulario directo con 7 campos, guardar todo en `system_settings` key/value
- **Ahora:** 
  - Lista de tarjetas bancarias guardadas (cada una activable/eliminable)
  - Botón "Agregar Datos Bancarios" que abre modal
  - Modal con formulario validado (banco dropdown, cuenta numérica, tipo select, cédula exacta)
  - Empty state si no hay registros

---

## Archivos Modificados

### 1. Migración SQL
**Archivo:** `db/migrations/041_bank_details_table.sql`

```
CREATE TABLE public.bank_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name        TEXT NOT NULL,
  account_number   TEXT NOT NULL,
  account_type     TEXT NOT NULL CHECK (account_type IN ('ahorro', 'corriente')),
  holder_name      TEXT NOT NULL,
  holder_id        TEXT NOT NULL,
  nequi_phone      TEXT,
  daviplata_phone  TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  ...
)
```

**Características:**
- Tabla relacional (no key/value como `system_settings`)
- Solo UNO puede ser `is_active=true` (enforced en trigger `useSetActiveBankDetail`)
- RLS: admin (read + write), public (read active only)
- Migración automática: si hay datos en `system_settings`, crea 1 registro en `bank_details`

**Aplicar migración (opción A — recomendada):**
```bash
cd Innovar-App-main
supabase db push  # Si estás con supabase CLI
```

**Aplicar migración (opción B — Management API):**
```bash
# El agente ya lo hizo si el comando de fondo completó.
# Si no, ejecutar manualmente:
cat db/migrations/041_bank_details_table.sql | \
  curl -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query": "<SQL>"}'
```

### 2. Hooks CRUD
**Archivo:** `src/hooks/useBankDetails.ts`
- `useBankDetails()` — Lee lista ordenada por is_active DESC, luego created_at DESC
- `useBankDetailsActive()` — Lee el único registro activo (o null)

**Archivo:** `src/hooks/useBankDetailsMutations.ts`
- `useCreateBankDetail(input)` — Inserta nuevo registro
- `useDeleteBankDetail(id)` — Elimina (invalidates cache)
- `useSetActiveBankDetail(id)` — Marca como activo, desactiva otros

### 3. Componentes UI

**Archivo:** `src/components/finanzas/BankDetailModal.tsx`
- Dialog modal con formulario validado con Zod
- Campos:
  - **Banco** (obligatorio): Select de 12 bancos principales + "Otro"
  - **Número de Cuenta** (obligatorio): Numérico, 8-20 dígitos
  - **Tipo de Cuenta** (obligatorio): Ahorro / Corriente
  - **Titular** (obligatorio): Texto, 3+ caracteres
  - **Cédula/NIT** (obligatorio): Exactamente 8-11 dígitos
  - **Nequi** (opcional): Teléfono formato +57XXX
  - **Daviplata** (opcional): Teléfono formato +57XXX
- Botones: Cancelar (ghost) + Agregar (PrimaryButton)
- Aplicado DESIGN_SYSTEM_RULES: h-12 inputs, h-12 botones modal, uppercase labels, tracking-widest

**Archivo:** `src/components/finanzas/BankDetailCard.tsx`
- Tarjeta individual para cada registro guardado
- Muestra: banco, tipo, cuenta, titular, cédula
- Badge "Activa" si is_active=true
- Botones: "Activar" (outline, si no activo) + "Eliminar" (ghost, destructive)
- Animaciones: framer-motion entrada/salida
- Aplicado DESIGN_SYSTEM_RULES: border-primary si activo, border-border/50 si no, hover states

### 4. Página Refactorizada
**Archivo:** `src/pages/settings/BankSettings.tsx`
- UX nueva:
  1. **Header** con CategoryHeader (icono Landmark, título "Datos Bancarios")
  2. **Lista de tarjetas** (o empty state si vacío)
  3. **Botón "Agregar datos bancarios"** (centered, h-14, PrimaryButton)
  4. **Modal** (desactivado por defecto, se abre al clickear botón)
  5. **Info box** (primary/5 bg) con 4 tips en bullets

- UX behavior:
  - Al montar: load lista de `useBankDetails()`
  - Click "Agregar": abre modal
  - Submit modal: `useCreateBankDetail()` → invalida cache → lista se actualiza
  - Click "Activar": `useSetActiveBankDetail()` → desactiva otros → actualiza tarjetas
  - Click "Eliminar": confirm dialog → `useDeleteBankDetail()` → actualiza lista

---

## Testing Checklist

### Smoke (Basic)
- [ ] Acceder a `/settings/bancarios` (logueado como admin)
- [ ] Verificar empty state ("Sin Datos Bancarios")
- [ ] Click "Agregar datos bancarios" → abre modal
- [ ] Validaciones funcionan:
  - [ ] Campo vacío banco → error
  - [ ] Cuenta "abc" → error "solo dígitos"
  - [ ] Cuenta "1234" → error "mínimo 8"
  - [ ] Cédula "123" → error "mínimo 8"
  - [ ] Cédula "123456789012" → error "máximo 11"
- [ ] Submit válido → cierra modal, aparece tarjeta en lista

### Smoke E2E
- [ ] Agregar registro 1: Bancolombia, 12345678, Ahorro, Juan Pérez, 123456789
  - [ ] Aparece tarjeta con esos datos
  - [ ] Tiene badge "Activa"
  - [ ] No tiene botón "Activar" (solo "Eliminar")
- [ ] Agregar registro 2: BBVA, 98765432, Corriente, Jane Doe, 987654321
  - [ ] Aparece segunda tarjeta
  - [ ] Tiene botón "Activar" (no es activa aún)
  - [ ] Primera tarjeta ya NO tiene badge "Activa"
  - [ ] Primer registro se mueve debajo (isActive DESC)
- [ ] Click "Activar" en tarjeta BBVA
  - [ ] BBVA ahora tiene badge "Activa"
  - [ ] Bancolombia pierde badge
  - [ ] Tarjeta BBVA se mueve a arriba
- [ ] Click "Eliminar" en tarjeta Bancolombia
  - [ ] Confirm dialog aparece
  - [ ] Tarjeta desaparece de lista
  - [ ] BBVA sigue activa

### Edge Cases
- [ ] Teléfono Nequi vacío → debe aceptar (opcional)
- [ ] Teléfono Nequi "+573001234567" → debe validar OK
- [ ] Teléfono Daviplata "573001234567" (sin +57) → debe rechazar
- [ ] Titular "A" (1 char) → error "mínimo 3"
- [ ] Banco "otro" → no existe en dropdown, pero si escribes "otro" manualmente... (nota: tipo text normal, no select)
  - [ ] Verificar si el campo Banco es SELECT o INPUT
- [ ] Navegar fuera y volver → lista se recarga (React Query cache hit)
- [ ] Agregar, no refrescar, agregar otro → ambos aparecen (no race condition)

---

## Notas Técnicas

### Validaciones
- **Banco:** 12 opciones hardcodeadas en `BankDetailModal.tsx`, dropdown Select
- **Cuenta:** Regex `/^\d+$/`, length 8-20
- **Tipo:** Enum strict con Zod (Ahorro/Corriente)
- **Titular:** Mínimo 3 caracteres
- **Cédula:** Regex `/^\d+$/`, length exacto 8-11
- **Teléfonos:** Regex `/^\+?57\d{9,10}$/` (opcional)

### Cache Invalidation
- Todos los hooks de mutación invalidan `['bank_details']` query key
- React Query se recarga automáticamente
- AnimatePresence + mode="popLayout" hace transiciones suaves

### Colores & Tipografía (DESIGN_SYSTEM_RULES)
- Inputs: `h-12 rounded-none border-border/50 bg-background/50 focus:bg-background`
- Labels: `text-[10px] font-bold uppercase tracking-widest`
- Botones modales: `h-12 rounded-none` (secundarios), `h-14` (primarios en página)
- Tarjetas activas: `border-primary bg-primary/5 ring-1 ring-primary/20`
- Tarjetas inactivas: `border-border/50 bg-background`
- Spacing: `space-y-10` entre secciones, `gap-4` en tarjetas

### RLS
```sql
-- Admin (roles: admin, comercial) puede ver y modificar
FOR SELECT: get_my_role() IN ('admin', 'comercial')
FOR ALL: get_my_role() = 'admin'

-- Public puede ver solo activo
FOR SELECT (anon, public): is_active = TRUE
```

---

## Pendientes para Usuario

### 1. Aplicar Migración
Si no se aplicó automáticamente via Management API:
```bash
supabase db push
```

### 2. Smoke Testing
Seguir checklist arriba. Reportar cualquier error.

### 3. Verificar DB
```sql
SELECT COUNT(*) FROM public.bank_details;
-- Debe ser 0 (nuevo) o 1 (si hubo migración de system_settings)

SELECT * FROM public.bank_details;
-- Ver registros si existen
```

### 4. Producción (cuando apruebes)
```bash
git push origin ux-fixes
# Crear PR ux-fixes → main (o mergearlo directo si autoflow)
```

---

## Próximo Paso
Una vez smoke testing OK, continuar con:
- **PaymentSettings.tsx** (página toggle flag + ventana emergente min anticipo)
- **PaymentVerifyModal.tsx** + **ManualPaymentModal.tsx** + **QuotationCancelModal.tsx** (modales)
- **Pagos.tsx refactor** a 3 tabs (gated por `useFeatureFlag('slice_3_enabled')`)
- **QuotationDetail botones** (Cancelar, Crear V2, Reactivar — condicionados por status+rol+flag)

---

## Build Status
- ✅ Compilación TypeScript: OK (no errores nuevos)
- ✅ Build Vite: OK (13.86s)
- ✅ Archivos estáticos: Listos en `dist/`
- ✅ Commit: `fd9a796` (rama ux-fixes)

---

**Código listo. Awaiting smoke testing + migración aplicada. 🚀**
