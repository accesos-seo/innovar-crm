# Configuración de Producción — Innovar CRM
**Última actualización:** 2026-05-24  
**Estado:** Activo en `xdzbjptozeqcbnaqhtye`

---

## Datos Bancarios (system_settings en DB)

Estos valores están grabados en la tabla `system_settings` y los lee el componente `BankDetailsCard` en la página pública del cliente (`/c/:code` → `/cotizacion/:token`).

| Key en DB | Valor |
|---|---|
| `bank_name` | Bancolombia S.A. |
| `bank_account_number` | 11533034332 |
| `bank_account_type` | Cuenta Ahorros |
| `bank_holder_name` | ALVARO FERNANDO GUTIERREZ RIOS |
| `bank_holder_id` | 10021456 |
| `nequi_phone` | 300 2826317 |
| `daviplata_phone` | 300 2826317 |
| `suggested_min_advance_pct` | 20 |

---

## Certificado de Existencia Empresarial

| Campo | Valor |
|---|---|
| `company_certificate_url` | `https://xdzbjptozeqcbnaqhtye.supabase.co/storage/v1/object/public/Documentos%20legales/Camara%20de%20comercio.pdf` |
| Bucket Supabase Storage | `Documentos legales` |
| Documento | Certificado de existencia y representación legal — Cámara de Comercio de Pereira |

El componente `CompanyTrustSection` (en `src/components/quotations/public/CompanyTrustSection.tsx`) lee este valor automáticamente. Si la key no está seteada, el componente no aparece. Para actualizar el certificado: subir el nuevo PDF al bucket y actualizar el valor en `system_settings`.

---

## WhatsApp Business API

**Estado actual: NO HABILITADA.** Los mensajes se encolan en `notification_queue` con status `pending` pero no salen porque los secretos de Meta no están cargados en Supabase Vault.

| Secreto | Estado |
|---|---|
| `META_WABA_ACCESS_TOKEN` | Pendiente — cargar en Vault de la Edge Function |
| `META_PHONE_NUMBER_ID` | Pendiente — cargar en Vault de la Edge Function |

### Número para pruebas
Cuando se activen las notificaciones, usar este número como `whatsapp_phone` en los clientes de prueba:

```
318 3061286
```

Este es el número personal del propietario del sistema para verificar que los mensajes lleguen correctamente antes de enviarlos a clientes reales.

### Número real del negocio
El número registrado en Meta Business para recibir mensajes entrantes (referencia):
```
+57 300 2826317
```

---

## Feature Flags activos

| Flag (`system_settings.key`) | Valor actual | Efecto |
|---|---|---|
| `slice_3_enabled` | `false` | Flujo de pago S3 desactivado — clientes ven aviso legacy |
| `public_app_base_url` | (verificar en DB) | URL base para links en triggers WhatsApp |

Para activar el flujo de pago completo para el primer cliente piloto:
```sql
UPDATE system_settings SET value = 'true' WHERE key = 'slice_3_enabled';
```

---

## Estado del branch `ux-fixes`

Todos los commits de Slice 3 viven en el branch local `ux-fixes`. En orden:

| Commit | Sub-slice | Descripción |
|---|---|---|
| `afa381f` | S3.1 | Backend — migraciones 037-039 + 10 hotfixes |
| `a0ac81b` | S3.2.a | Hooks + schemas + payment_type ES→EN |
| `614f735` | S3.2.b | UI admin — BankSettings + PaymentSettings + modales |
| `fd9a796` | S3.2.b | Rediseño BankSettings |
| `3d28acb` | S3.3 | UI cliente público — BankDetailsCard + PaymentProofUploader |
| `0d7948e` | S3.3 | Handoff S3.3 |
| `db3e729` | S3.4 | Edge function TEMPLATE_REGISTRY +5 builders |
| `f1eb3d1` | S3.5 | Smoke E2E + hotfix RLS 040 (anon read system_settings) |
| `7d0fd98` | S3.6-prep | Fix bank_block + CompanyTrustSection + migración 041 |
| `c416bff` | S3.6-prep | Texto Cámara de Comercio + URL certificado |

---

## Pendientes antes del piloto S3.6

1. **Cargar secretos Meta en Vault** — `META_WABA_ACCESS_TOKEN` y `META_PHONE_NUMBER_ID`
2. **Activar `slice_3_enabled = true`** en `system_settings` cuando esté listo el primer cliente piloto
3. **Verificar templates Meta aprobados** — 9 plantillas pendientes (4 de S2 + 5 de S3)

---

## Migraciones aplicadas en producción (Slice 3)

| Migración | Descripción |
|---|---|
| `037` + `037a-j` | Schema S3: enum, columnas, helpers, triggers, RPCs (10 hotfixes) |
| `038` | Cron job expiración cotizaciones (14:30 UTC) |
| `039` | Seeds de settings S3 |
| `040` | Hotfix RLS: anon puede leer 10 keys de `system_settings` |
| `041` | Extiende allowlist anon con `company_certificate_url` (11 keys) |
