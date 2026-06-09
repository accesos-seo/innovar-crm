# Cierre Slice 3 — Estado y Pendientes
**Fecha:** 2026-05-24
**Estado:** Sistema 95% funcional. Cierre técnico completo. En espera de configuración WhatsApp.

---

## Lo que está listo y funcionando

✅ **Flujo de pago de principio a fin** — cliente recibe link, abre cotización, acepta, ve datos bancarios reales, sube comprobante, admin verifica.

✅ **Datos bancarios reales en producción** — Bancolombia 11533034332, titular Álvaro Fernando Gutiérrez Ríos, CC 10021456, Nequi/Daviplata 300 2826317.

✅ **Certificado Cámara de Comercio** visible en la página pública (sección "Empresa verificada" colapsable).

✅ **Bug de tarjeta bancaria vacía** corregido (`useBankDetails` hook).

✅ **Bug de V2 con total inflado** — investigado y descartado. **No era bug.** El total de V2 incluye correctamente `transport_cost` heredado de V1. Caso reproducido en DB con datos controlados:
- V1 con transport=0 → V2.total = items_sum ✓
- V1 con transport=600K → V2.total = items_sum + 600K ✓

✅ **Cola de notificaciones limpia** — 87 mensajes de prueba acumulados drenados.

✅ **Migración 040 y 041** aplicadas en producción (RLS anon para system_settings).

---

## Pendientes (no son de código)

### 1. Cargar 2 secretos de Meta en Supabase Vault
La función Edge `process-whatsapp-notifications` necesita estos dos valores para enviar mensajes:

| Variable | De dónde sale |
|---|---|
| `META_WABA_ACCESS_TOKEN` | Meta Business Manager → WhatsApp → System User → Access Token permanente |
| `META_PHONE_NUMBER_ID` | Meta Business Manager → WhatsApp → API Setup → Phone Number ID del número verificado |

Cuando estén disponibles, cargar con `supabase secrets set` o desde el dashboard de Supabase Edge Functions.

### 2. Aprobar plantillas de WhatsApp en Meta
Ver sección **"Para el técnico (Edwin)"** al final de este documento.

### 3. Activar el flag para el piloto
Cuando esté todo listo, activar el flujo S3 para el primer cliente real:
```sql
UPDATE system_settings SET value = 'true' WHERE key = 'slice_3_enabled';
```

---

## Para el técnico (Edwin)

**Hola Edwin,**

Eso es lo primero que vas a hacer, el pendiente que tienes. Necesitamos crear y aprobar **10 plantillas de WhatsApp** en Meta Business Manager para que el sistema de cotizaciones y pagos pueda enviar los mensajes automáticos. Mientras no estén aprobadas, los mensajes quedan en cola pero no salen.

Todas son tipo **UTILITY** (no marketing), idioma **español (es)**, sin header salvo donde se indique. Footer estándar: `— Innovar Cocinas Integrales`.

### Plantillas que necesitamos crear

| # | Nombre técnico | Para qué sirve | Variables |
|---|---|---|---|
| 1 | `quotation_sent_v1` | Cliente recibe su primera cotización | {{1}} nombre cliente, {{2}} número cotización, {{3}} link público corto |
| 2 | `quotation_v2_sent_v1` | Cliente recibe una versión revisada (V2, V3...) de su cotización | {{1}} nombre cliente, {{2}} número cotización, {{3}} link |
| 3 | `payment_request_v1` | Cliente recibe los datos bancarios después de aceptar la cotización | {{1}} nombre, {{2}} banco, {{3}} cuenta, {{4}} titular, {{5}} monto sugerido (30%) |
| 4 | `admin_quotation_accepted_v1` | Álvaro (admin) recibe aviso de que un cliente aceptó | {{1}} nombre admin, {{2}} cliente, {{3}} número cotización |
| 5 | `admin_quotation_adjustments_v1` | Álvaro recibe aviso de que un cliente pidió ajustes | {{1}} nombre admin, {{2}} cliente, {{3}} número cotización, {{4}} motivo |
| 6 | `admin_quotation_rejected_v1` | Álvaro recibe aviso de que un cliente rechazó | {{1}} nombre admin, {{2}} cliente, {{3}} número cotización, {{4}} motivo |
| 7 | `payment_proof_rejected_v1` | Cliente recibe aviso de que su comprobante fue rechazado y debe enviar otro | {{1}} nombre cliente, {{2}} número cotización, {{3}} motivo del rechazo, {{4}} link para reintentar |
| 8 | `project_assigned_designer_v1` | El diseñador asignado recibe aviso de que tiene un nuevo proyecto | {{1}} primer nombre diseñador, {{2}} cliente, {{3}} ruta del proyecto |
| 9 | `project_fully_paid_v1` | Cliente recibe aviso de que terminó de pagar y arranca producción | {{1}} primer nombre cliente, {{2}} nombre proyecto |
| 10 | `admin_quotation_expired_v1` | Álvaro recibe aviso de que una cotización aceptada se venció sin pago | {{1}} primer nombre admin, {{2}} cliente, {{3}} número cotización, {{4}} días vencida |

### Lo que necesito de vos

1. Crear las 10 plantillas en Meta Business Manager → WhatsApp → Plantillas de mensajes
2. Esperar a que Meta las apruebe (suele tardar entre 1 hora y 2 días por plantilla)
3. Cargar en Supabase los dos secretos: `META_WABA_ACCESS_TOKEN` y `META_PHONE_NUMBER_ID` (van al Vault de la Edge Function `process-whatsapp-notifications`)
4. Avisar cuando esté listo

Si tenés dudas con el wording exacto de cada plantilla, hablame y armamos el texto juntos. Lo importante es que las variables coincidan con la tabla de arriba (en orden y cantidad), si no Meta rechaza el envío.

---

## Estado técnico del repo

Branch local de trabajo: `ux-fixes`. NO se sube a GitHub hasta que el usuario lo autorice.

Commits recientes (en orden):
- `afa381f` S3.1 backend
- `a0ac81b` S3.2.a hooks/schemas
- `614f735` + `fd9a796` S3.2.b UI admin
- `3d28acb` + `0d7948e` S3.3 UI público
- `db3e729` S3.4 edge function templates
- `f1eb3d1` S3.5 smoke + hotfix RLS 040
- `7d0fd98` Fix bank_block + CompanyTrustSection + mig 041
- `c416bff` Texto Cámara de Comercio + URL certificado
- `ce40ac9` Doc configuración producción
- *(este doc)* Cierre Slice 3 con pendientes

Configuración detallada de producción: ver [2026-05-24_CONFIGURACION-PRODUCCION.md](./2026-05-24_CONFIGURACION-PRODUCCION.md).
