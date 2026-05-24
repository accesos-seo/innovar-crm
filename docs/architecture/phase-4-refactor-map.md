# Refactor Map — Fase 4 · Cotización y Aprobación del Proyecto

> **Versión**: 1.0 · **Audiencia**: devs y agentes IA ejecutores · **Fase**: 4 (post-PRD, pre-ejecución)
> **Inputs**: [PRD phase-4-quotation-approval.md](../prd/phase-4-quotation-approval.md) + migraciones [`db/migrations/030..038`](../../db/migrations/)
> **Convenciones obligatorias**: [docs/CONVENTIONS.md](../CONVENTIONS.md)
> **Branch base sugerido**: `master` (Fase 3 mergeada) o `ux-fixes` si Fase 3 todavía está abierta
> **Modo de trabajo**: *"MVP simple"* (D9 lockeada) — agregar features extra solo si las métricas lo piden

Este documento mapea Fase 4 al árbol de carpetas actual: qué se crea, qué se modifica, qué se elimina, en qué orden, y bajo qué bandera. Sigue los 5 slices del PRD. La parte SQL ya está cerrada (migraciones 030-038 listas); este mapa enfoca el frontend + edge functions.

---

## 0. Principios de arquitectura aplicados a Fase 4

1. **Schema y triggers ya hacen el trabajo pesado.** `convert_quotation_to_project` (verificado 2026-05-23, vive en producción) crea project + bloquea quotation + mueve opportunity + liga payment en una sola transacción al firmar `payments.verification_status='verified'`. El frontend NO orquesta esa cascada; solo llama `verify_payment(payment_id, designer_id)` y refresca queries. **Cero replicación de lógica en TypeScript.**
2. **URL pública es nueva, no comparte layout con el CRM.** `/cotizacion/:token` corre fuera del `MainLayout` (sin sidebar, sin auth, mobile-first). Sigue el patrón ya existente de `PublicBooking.tsx` / `PublicBookingByCode.tsx`. **Cero acoplamiento con shells autenticados.**
3. **Hooks deep sobre lo deep posible.** `useAcceptQuotation` orquesta validación + RPC + invalidación + toast — caller solo llama `acceptQuotation({ token, note })`. Idem `useSubmitPaymentProof` que combina upload a storage + RPC en una sola mutation. **No tres hooks chiquitos que el caller compone.**
4. **Feature flag por fase, no por slice individual.** `VITE_FF_PHASE_4_QUOTATION_PUBLIC` enciende TODO el flujo de Fase 4. Al estar OFF: la ruta `/cotizacion/:token` retorna 404, el botón "Enviar al cliente" no aparece en `QuotationDetail`, la cola `/admin/pagos-pendientes` no aparece en el menú. El flujo legacy (cotización manual por WhatsApp) sigue funcionando exactamente igual. **Política operativa simple.**
5. **Identifiers en inglés, UI en español.** Sin excepción. Para mantener consistencia con Fase 3.
6. **No tocar `QuotationCreate.tsx` (wizard de armado).** Solo agregar botón "Enviar al cliente" en `QuotationDetail.tsx` cuando estado=draft. El wizard queda intacto.
7. **Convivencia con triggers viejos** (`notify_payment_received`, `check_and_update_project_status_on_payment`, `handle_payment_approval`). No se tocan. Si alguno genera ruido en producción (ej: notif "Pago recibido" se duplica con la nueva del flujo), se decide eliminarlo aparte. **Conservar lo que funciona.**

---

## 1. Hooks — nuevos y refactorizados

### 1.1 Hooks nuevos en `src/hooks/quotations/`

| Hook | Propósito | Slice | Profundidad |
|---|---|---|---|
| `usePublicQuotation.ts` | `useQuery(['public-quotation', token])` — llama RPC `get_public_quotation(token)`. Maneja 3 casos: (1) cotización vigente → retorna JSONB con items + bank + tracking; (2) `redirect_to_token` presente → caller navega al token nuevo; (3) `is_expired=true` → caller renderiza `QuotationExpiredView`. Sin auth, no requiere login. `staleTime: 30s` para que el `view_count` se incremente cada navegación real. | S2 | Deep: una sola llamada cubre fetch + redirect + expiry detection + tracking implícito. |
| `useAcceptQuotation.ts` | Mutation contra `accept_public_quotation(token, note)`. Optimistic update local (status='client_approved'). Invalida `['public-quotation', token]`. Toast "¡Listo! Te llegó WhatsApp con los datos de pago." | S2 | Deep: RPC + UX feedback en un solo hook. |
| `useRejectQuotation.ts` | Mutation contra `reject_public_quotation(token, subtype, reason)`. Valida en cliente que si `subtype='adjustments_requested'` entonces `reason` no vacío. Toast diferenciado: ajustes → "Le avisamos al asesor, te contactará pronto" / declined → "Gracias por avisar". | S2 | Deep: 2 RPCs en 1, branching de UX, validación Zod. |
| `useRequestReactivation.ts` | Mutation contra `request_quotation_reactivation(token)`. Solo si estado=expired. Toast "Pediste una nueva propuesta. Tu asesor te contactará". | S2 | Shallow pero justificado: mantiene patrón consistente con los demás hooks de la fase. |
| `useSubmitPaymentProof.ts` | Mutation que: 1) sube `proofFile` a bucket `payment-receipts` con path `<quotation_id>/<crypto.randomUUID()>.<ext>`; 2) llama RPC `submit_quotation_payment_proof(token, amount, method, public_url, notes)`; 3) invalida `['public-quotation', token]`. Caller solo llama `submitProof({ token, amount, method, proofFile, notes })`. Manejo de errores: upload falla → toast + retry visible; RPC falla → toast con mensaje del backend. | S3 | Deep: storage upload + RPC + toast en una unidad atómica desde la perspectiva del caller. |
| `useSendQuotation.ts` | Mutation contra `send_quotation_to_client(quotation_id)`. Solo visible para admin/super_admin/comercial. Invalida `['quotation', id]` y `['quotations']`. Toast "WhatsApp enviado al cliente". | S2 | Deep: cubre transición draft→sent + lock automático + WA en una sola operación. |
| `useUnlockQuotation.ts` | Mutation contra `unlock_quotation(quotation_id, change_reason)`. Modal previo exige `change_reason`. Solo admin/super_admin. Invalida `['quotation', id]`. Toast amarillo con warning. | S2 | Deep: incluye audit + transición en un solo hook. |
| `useQuotationVersions.ts` | `useQuery(['quotation-versions', quotation_id])` — devuelve todas las versiones de una cotización (misma `quotation_number`) ordenadas por `version_number DESC`. Alimenta el diff en `QuotationVersionsDiff`. | S2 | Deep: encapsula la query "todas las versiones de esta cotización" que aparece en 2 lugares (UI admin + URL pública). |

### 1.2 Hooks nuevos en `src/hooks/finanzas/`

| Hook | Propósito | Slice | Profundidad |
|---|---|---|---|
| `usePendingPayments.ts` | `useQuery(['pending-payments'])` — `payments WHERE verification_status='pending'` JOIN clients/quotations/profiles. Alimenta `PendingPayments.tsx` page. Realtime: invalida en INSERT/UPDATE de `payments`. | S3 | Deep: una sola query con joins agregados, lista para renderizar. |
| `useVerifyPayment.ts` | Mutation contra `verify_payment(payment_id, designer_id)`. Caller pasa `designer_id` opcional (NULL si no asignó en el modal). Invalida `['pending-payments']`, `['payment', id]`, `['quotation', quotation_id]`. Toast "Pago verificado, proyecto creado". | S3 | Deep: confirma + asigna designer + dispara cascada SQL en una sola llamada visible para el caller. |
| `useActiveDesigners.ts` | `useQuery(['active-designers'])` — llama RPC `get_active_designers()`. Cacheo `staleTime: 5min`. Feed del `DesignerPicker` dentro de `PaymentVerificationModal`. | S3 | Shallow justificado: misma razón que `useActiveStaff` / `useActiveVisitors` ya existentes en Fase 3. |

### 1.3 Hooks nuevos en `src/hooks/` (top-level, settings administrativos)

| Hook | Propósito | Slice | Profundidad |
|---|---|---|---|
| `useBankSettings.ts` | `useQuery(['bank-settings'])` que lee las 7 filas de `system_settings` con keys bancarios + `useMutation` `updateBankSetting({ key, value })`. UI compone los dos. | S3 | Deep: encapsula tanto lectura como escritura del bloque de settings bancarios. |

### 1.4 Hooks refactorizados

| Hook | Cambio | Slice |
|---|---|---|
| `src/hooks/useQuotations.ts` | Agregar selector `byStatus(status)` que filtra `quotations` por estado. Útil para nueva pestaña "Visto pero sin decidir" en `Quotations.tsx`. Sin breaking change. | S2 |
| `src/hooks/finanzas/usePayments.ts` | **Sin cambio funcional.** Sigue listando todos los pagos. La cola "Pendientes" usa hook nuevo `usePendingPayments`. Documentar la diferencia en JSDoc. | — |

### 1.5 Hooks eliminados

Ninguno. Modelo aditivo.

---

## 2. Componentes — nuevos y modificados

### 2.1 Componentes nuevos en `src/components/quotations/public/` (nuevo subdir)

| Componente | Propósito | Reusos | Slice |
|---|---|---|---|
| `QuotationPublicView.tsx` | Layout mobile-first SIN sidebar. Header con logo Innovar + número cotización + estado. Cuerpo: tabla items, subtotal/descuento/transporte/total, notas, vigencia. Footer: 3 botones (Aceptar/Ajustes/Rechazar) o sección de pago según estado. | `Card`, `Button` de shadcn, formato COP, `useResponsive` | S2 |
| `QuotationActionButtons.tsx` | Los 3 botones con sus modals: `AcceptQuotationModal` (textarea opcional), `RequestAdjustmentsModal` (textarea obligatoria), `RejectQuotationModal` (dropdown motivos predefinidos + textarea opcional). Coordina con `useAcceptQuotation`/`useRejectQuotation`. | RHF, `Dialog`, `Select`, `Textarea` de shadcn, `Zod` | S2 |
| `QuotationVersionsDiff.tsx` | Toggle "Ver cambios respecto a V[N-1]". Cuando se abre, llama `useQuotationVersions`, compara items por descripción (heurística simple) y muestra tabla diff: ítems eliminados (tachado rojo) / agregados (verde) / cambio de precio (mostrar antes → después con %). Solo visible si `version_number > 1`. | `Collapsible`, `Badge`, formato COP | S2 |
| `QuotationExpiredView.tsx` | Vista cuando `is_expired=true`. Card grande "Esta cotización venció el [fecha]" + botón "Solicitar nueva cotización" → `useRequestReactivation`. Toast de éxito. | `Card`, `Button`, `Alert` | S2 |
| `QuotationRedirectView.tsx` | Vista cuando `get_public_quotation` retornó `redirect_to_token`. Mensaje "Esta cotización fue actualizada. Ver versión vigente." + botón "Ir a la versión nueva" → `navigate(/cotizacion/<new_token>)`. Auto-redirect después de 3s con countdown. | `Card`, `Button`, `useEffect` con timer | S2 |
| `QuotationPaymentSection.tsx` | Aparece bajo `QuotationPublicView` cuando estado=`client_approved` o `pending_payment_verification`. Muestra **bank info** (del RPC `get_public_quotation`) — banco, cuenta, titular, NIT, Nequi/Daviplata. Y debajo: `QuotationPaymentUpload` para subir comprobante. Si estado=`pending_payment_verification` (ya subió comprobante), muestra "Tu comprobante está en revisión" + thumbnail del proof. | `Card`, `Badge`, `Image`, `Copy` button por cada dato bancario | S3 |
| `QuotationPaymentUpload.tsx` | Form: monto (input numérico, sugerido pre-llenado), método (Select con enum `payment_method`), upload file. Validación cliente: archivo image/pdf, < 5MB. Subir a bucket + RPC. Spinner durante upload. | RHF, `Input`, `Select`, `FileUpload`, `Zod` | S3 |
| `QuotationApprovedView.tsx` | Reemplaza la sección de pago cuando estado=`approved`. Card de éxito "¡Tu proyecto arrancó!" + datos del designer asignado + botón "Descargar PDF del contrato" si `pdf_url_available=true`. Polling cada 10s del query hasta que PDF aparezca (si recién aprobaron). | `Card`, `Button`, signed URL signing | S5 |

### 2.2 Componentes nuevos en `src/components/quotations/`

| Componente | Propósito | Reusos | Slice |
|---|---|---|---|
| `QuotationLockBadge.tsx` | Badge con icono candado mostrando `is_locked=true`. Hover: tooltip "Bloqueada al enviar al cliente". Si rol del user es admin/super_admin, agrega botón "Desbloquear" que abre `UnlockQuotationModal`. | `Badge`, `Tooltip`, `Dialog`, RHF | S2 |
| `UnlockQuotationModal.tsx` | Modal con textarea `change_reason` (obligatorio min 10 chars). Warning amarillo: "Estás editando una cotización que el cliente ya vio. Tu cambio quedará registrado en el log de auditoría." Botón "Desbloquear" → `useUnlockQuotation`. | RHF, `Dialog`, `Alert`, `Textarea`, `Zod` | S2 |
| `QuotationViewTracking.tsx` | Mini-componente para `QuotationDetail.tsx`: muestra "Visto X veces · Primera vez: [fecha]". Si `view_count=0` muestra "El cliente no ha abierto el link aún". | `Badge` | S2 |
| `SendQuotationButton.tsx` | Botón "Enviar al cliente" visible solo si estado=draft y rol válido. Confirm dialog "Esto bloquea la cotización y manda WhatsApp al cliente. ¿Continuar?" → `useSendQuotation`. | `Button`, `AlertDialog` | S2 |
| `CreateNewVersionButton.tsx` | Botón "Crear nueva versión (V[N+1])" visible solo si estado=rejected y rol admin. Llama RPC existente `create_quotation_version(quotation_id)`. Navega a `QuotationCreate` con la V2 en draft pre-cargada. | `Button`, `Dialog` | S2 |

### 2.3 Componentes nuevos en `src/components/finanzas/`

| Componente | Propósito | Reusos | Slice |
|---|---|---|---|
| `PaymentVerificationModal.tsx` | Modal abierto desde `PendingPayments.tsx`. Preview del comprobante (image o pdf embed). Info: monto, método, cliente, cotización, fecha. Badge rojo si `below_suggested=true`. **`DesignerPicker`** integrado (selector required). Botón "Verificar y crear proyecto" → `useVerifyPayment`. | `Dialog`, `Image`, `iframe` (pdf), `Badge`, `Button`, `DesignerPicker` | S3 |
| `DesignerPicker.tsx` | Select con lista de `useActiveDesigners`. Si la lista está vacía, muestra "Sin diseñadores activos — el proyecto se creará sin asignar y aparecerá en /proyectos con badge amarillo". Permite elegir "Asignar después" (NULL). | `Select`, `useActiveDesigners` | S3 |
| `PaymentReceiptPreview.tsx` | Componente reusable que renderiza el comprobante según mime-type: `<img>` para image/*, `<iframe>` para pdf. Manejo de loading + error. | `Image`, `iframe` | S3 |

### 2.4 Componentes nuevos en `src/components/admin/` (nuevo subdir)

| Componente | Propósito | Reusos | Slice |
|---|---|---|---|
| `BankSettingsForm.tsx` | Form con 7 campos (banco, cuenta, tipo, titular, NIT, Nequi, Daviplata). Cada campo individualmente editable + botón "Guardar" por sección. Optimistic update. Toast por cada cambio. | RHF, `Input`, `useBankSettings` | S3 |

### 2.5 Componentes modificados

| Componente | Cambio | Slice |
|---|---|---|
| `src/pages/QuotationDetail.tsx` | Agregar `<QuotationLockBadge quotation={quot} />` en el header. Agregar `<QuotationViewTracking quotation={quot} />` en el panel de info. Agregar `<SendQuotationButton quotation={quot} />` cuando estado=draft. Agregar `<CreateNewVersionButton />` cuando estado=rejected. Si `is_historical_copy=true`, banner gris "Esta versión está histórica — versión vigente: [link]". | S2 |
| `src/pages/Quotations.tsx` | Agregar columna "Visto" en la lista (icono ✓ o ✗ + número `view_count`). Agregar filtros por nuevos estados: `client_approved`, `pending_payment_verification`. Filtro especial "Vistas sin decidir" = `viewed_at IS NOT NULL AND status='sent'`. | S2 |
| `src/pages/Pagos.tsx` | Agregar tab "Pendientes de verificar" arriba del listado actual. Si hay pendings, badge rojo con count. El tab abre `PendingPayments.tsx` (o renderea inline). Resto intacto. | S3 |
| `src/components/layout/NotificationBell.tsx` | Agregar mapping en `getNotificationIcon` y `getNotificationColor` para nuevos `notification_type`: `quotation_accepted` (CheckCircle, green), `quotation_adjustments_requested` (MessageSquare, yellow), `quotation_rejected` (XCircle, red), `payment_proof_uploaded` (Upload, blue), `project_assigned` (Briefcase, green), `quotation_expired` (Clock, orange), `quotation_reactivation_requested` (RefreshCw, blue). | S2 + S3 |
| `src/App.tsx` | Registrar 3 rutas nuevas lazy-loaded: `/cotizacion/:token` (PublicQuotation, sin layout, sin auth), `/admin/pagos-pendientes` (PendingPayments, MainLayout, role check admin), `/admin/configuracion/bancarios` (BankSettings, MainLayout, role check admin). | S2 + S3 |
| `src/components/layout/Sidebar.tsx` (o equivalente) | Agregar entry "Pagos pendientes" bajo "Finanzas" visible solo para admin. Agregar entry "Datos bancarios" bajo "Configuración" visible solo para admin. Condicional por `VITE_FF_PHASE_4_QUOTATION_PUBLIC`. | S3 |

### 2.6 Componentes eliminados

Ninguno.

---

## 3. Páginas — nuevas

| Página | Ruta | Layout | Auth | Slice |
|---|---|---|---|---|
| `src/pages/PublicQuotation.tsx` | `/cotizacion/:token` | **Sin layout** (mobile-first standalone, igual que `PublicBooking.tsx`) | Anónima (no requiere login) | S2 |
| `src/pages/PendingPayments.tsx` | `/admin/pagos-pendientes` | `MainLayout` | `requireRole(['admin','super_admin'])` | S3 |
| `src/pages/BankSettings.tsx` | `/admin/configuracion/bancarios` | `MainLayout` | `requireRole(['admin','super_admin'])` | S3 |

### 3.1 `PublicQuotation.tsx` (S2) — composición

```tsx
// Pseudo-código
export default function PublicQuotation() {
  const { token } = useParams();
  const { data, isLoading, error } = usePublicQuotation(token);

  if (isLoading) return <FullScreenSpinner />;
  if (error) return <FullScreenError />;
  if (data.redirect_to_token) return <QuotationRedirectView token={data.redirect_to_token} />;
  if (data.is_expired) return <QuotationExpiredView token={token} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <QuotationPublicView quotation={data} />
      {data.version_number > 1 && <QuotationVersionsDiff quotationId={data.id} />}

      {data.status === 'sent' && <QuotationActionButtons token={token} />}
      {['client_approved', 'pending_payment_verification'].includes(data.status) && (
        <QuotationPaymentSection quotation={data} token={token} />
      )}
      {data.status === 'approved' && <QuotationApprovedView quotation={data} token={token} />}
      {data.status === 'rejected' && <QuotationRejectedView quotation={data} />}
    </div>
  );
}
```

### 3.2 `PendingPayments.tsx` (S3) — composición

```tsx
export default function PendingPayments() {
  const { data: pendings } = usePendingPayments();
  const [selectedPayment, setSelectedPayment] = useState(null);

  return (
    <MainLayout>
      <CategoryHeader title="Pagos pendientes de verificar" count={pendings?.length} />
      <PaymentsList payments={pendings} onSelect={setSelectedPayment} />
      {selectedPayment && (
        <PaymentVerificationModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </MainLayout>
  );
}
```

### 3.3 `BankSettings.tsx` (S3)

```tsx
export default function BankSettings() {
  return (
    <MainLayout>
      <CategoryHeader title="Datos bancarios para cobros" />
      <BankSettingsForm />
    </MainLayout>
  );
}
```

---

## 4. Edge Functions

### 4.1 Nueva: `generate-quotation-pdf` (S5)

| Propiedad | Valor |
|---|---|
| Path | `supabase/functions/generate-quotation-pdf/index.ts` |
| Trigger | Llamada vía `pg_net` desde `trigger_pdf_generation(project_id)` (RPC en migración 038) o trigger AFTER INSERT en `projects` |
| Auth | Service role (interno, no expuesto al cliente) |
| Body request | `{ project_id, quotation_id, log_id }` |
| Stack | Deno + `@react-pdf/renderer` (preferido por footprint) o `puppeteer` (fallback si CSS es muy complejo) |
| Output | PDF subido a bucket `quotation-pdfs` con path `<quotation_id>/v<version_number>.pdf` |
| Side effects | UPDATE `projects.quotation_pdf_url = '<storage_url>'`; UPDATE `pdf_generation_log` set status='succeeded' + completed_at |
| Error handling | UPDATE `pdf_generation_log` set status='failed' + error_message. NO reintenta automáticamente (admin lo dispara manual con `trigger_pdf_generation(project_id)`) |

### 4.2 Existente extendida: `process-whatsapp-notifications`

| Cambio | Slice |
|---|---|
| Agregar 6 builders nuevos en `TEMPLATE_REGISTRY`: `quotation_sent_v1`, `quotation_v2_sent_v1`, `payment_request_v1`, `payment_received_v1`, `quotation_reminder_3d_client_v1`, `quotation_expiry_3d_client_v1` (ya existía como `recordatorio24hantes`? verificar), `payment_reminder_3d_client_v1`, `project_assigned_designer_v1`, `quotation_reactivation_admin_v1`. Cada builder mapea el `template_parameters` jsonb al formato Meta. **9 templates totales nuevos**, distribuidos entre slices según bloqueador. | S2/S3/S4/S5 |

---

## 5. Schemas Zod nuevos (`src/lib/schemas/`)

| Archivo | Propósito | Slice |
|---|---|---|
| `quotation-public.ts` | Schemas: `acceptQuotationSchema` (note opcional max 500), `rejectQuotationSchema` (subtype enum + reason condicional), `paymentProofSchema` (amount > 0, method enum, file < 5MB image/pdf). Tipos derivados exportados. | S2 + S3 |
| `bank-settings.ts` | Schema para validar cada campo bancario: `bank_account_number` solo dígitos, `nequi_phone`/`daviplata_phone` formato `+57XXXXXXXXXX` opcional. | S3 |

---

## 6. Feature flag

`VITE_FF_PHASE_4_QUOTATION_PUBLIC` (default `false`).

**Cuando está OFF:**
- La ruta `/cotizacion/:token` retorna 404 (NotFound page).
- El botón `SendQuotationButton` no se renderiza en `QuotationDetail`.
- `QuotationLockBadge` no se renderiza.
- `QuotationViewTracking` no se renderiza.
- `CreateNewVersionButton` no se renderiza.
- Los tabs/entries en sidebar `/admin/pagos-pendientes` y `/admin/configuracion/bancarios` no aparecen.
- Las rutas admin retornan 404 si alguien las pega directo.
- El flujo legacy (manual por WhatsApp) sigue funcionando exactamente igual.

**Cuando está ON:**
- Todo lo de Fase 4 visible.
- Las migraciones 030-038 ya aplicadas (no son condicionales — el DB siempre tiene el esquema nuevo).

**Política de activación:**
1. Migraciones 030-033 aplicadas en producción → S1 cerrado.
2. Migraciones 034-035 aplicadas → S2 listo en código pero flag sigue OFF.
3. QA E2E en staging con `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` → si pasa, encender en producción.
4. Slice 3 y siguientes: cada slice se mergea con código, pero la activación final del flag se hace UNA SOLA VEZ después del último slice listo. **No se hace flag por slice individual** (D9 pidió simple, este flag refleja eso).

---

## 7. Estructura de directorios — antes / después

### Antes (estado tras Fase 3 completa)

```
src/
├── components/
│   ├── agenda/         (ya tiene los componentes de Fase 3)
│   ├── finanzas/
│   │   ├── ClosureDetailPanel.tsx
│   │   ├── ExpenseDetailPanel.tsx
│   │   ├── NewClosureModal.tsx
│   │   ├── NewExpenseModal.tsx
│   │   ├── NewPaymentModal.tsx
│   │   ├── PaymentDetailPanel.tsx
│   │   ├── PaymentMetrics.tsx
│   │   └── PaymentsList.tsx
│   ├── layout/
│   │   ├── NotificationBell.tsx
│   │   └── Sidebar.tsx (o equivalente)
│   ├── quotations/
│   │   ├── DoorsConfigurator.tsx
│   │   ├── KitchenConfigurator.tsx
│   │   ├── QuotationBuilder.tsx
│   │   ├── QuotationForm.tsx
│   │   ├── builder/
│   │   └── steps/
│   └── ... (resto)
├── hooks/
│   ├── finanzas/
│   │   ├── useApproveExpense.ts
│   │   ├── useCreatePayment.ts
│   │   ├── usePayments.ts
│   │   └── ...
│   ├── quotations/
│   │   └── useQuotationBuilder.ts
│   ├── useQuotations.ts
│   └── ...
├── lib/
│   ├── errors.ts
│   ├── schemas/  (creada en Fase 3)
│   └── supabaseClient.ts
├── pages/
│   ├── Pagos.tsx
│   ├── PublicBooking.tsx
│   ├── PublicBookingByCode.tsx
│   ├── QuotationCreate.tsx
│   ├── QuotationDetail.tsx
│   ├── Quotations.tsx
│   └── ... (resto)
└── App.tsx
```

### Después (Fase 4 completa)

```
src/
├── components/
│   ├── admin/                                   ← NUEVO directorio (S3)
│   │   └── BankSettingsForm.tsx                 ← NUEVO (S3)
│   ├── finanzas/
│   │   ├── DesignerPicker.tsx                   ← NUEVO (S3)
│   │   ├── PaymentReceiptPreview.tsx            ← NUEVO (S3)
│   │   ├── PaymentVerificationModal.tsx         ← NUEVO (S3)
│   │   └── ... (resto sin cambios)
│   ├── layout/
│   │   ├── NotificationBell.tsx                 ← MODIFICADO (S2 + S3)
│   │   └── Sidebar.tsx                          ← MODIFICADO (S3)
│   └── quotations/
│       ├── CreateNewVersionButton.tsx           ← NUEVO (S2)
│       ├── QuotationLockBadge.tsx               ← NUEVO (S2)
│       ├── QuotationViewTracking.tsx            ← NUEVO (S2)
│       ├── SendQuotationButton.tsx              ← NUEVO (S2)
│       ├── UnlockQuotationModal.tsx             ← NUEVO (S2)
│       ├── public/                              ← NUEVO subdirectorio
│       │   ├── QuotationActionButtons.tsx       ← NUEVO (S2)
│       │   ├── QuotationApprovedView.tsx        ← NUEVO (S5)
│       │   ├── QuotationExpiredView.tsx         ← NUEVO (S2)
│       │   ├── QuotationPaymentSection.tsx      ← NUEVO (S3)
│       │   ├── QuotationPaymentUpload.tsx       ← NUEVO (S3)
│       │   ├── QuotationPublicView.tsx          ← NUEVO (S2)
│       │   ├── QuotationRedirectView.tsx        ← NUEVO (S2)
│       │   ├── QuotationRejectedView.tsx        ← NUEVO (S2)
│       │   └── QuotationVersionsDiff.tsx        ← NUEVO (S2)
│       └── ... (resto sin cambios)
├── hooks/
│   ├── finanzas/
│   │   ├── useActiveDesigners.ts                ← NUEVO (S3)
│   │   ├── usePendingPayments.ts                ← NUEVO (S3)
│   │   ├── useVerifyPayment.ts                  ← NUEVO (S3)
│   │   └── ... (resto)
│   ├── quotations/
│   │   ├── useAcceptQuotation.ts                ← NUEVO (S2)
│   │   ├── usePublicQuotation.ts                ← NUEVO (S2)
│   │   ├── useQuotationVersions.ts              ← NUEVO (S2)
│   │   ├── useRejectQuotation.ts                ← NUEVO (S2)
│   │   ├── useRequestReactivation.ts            ← NUEVO (S2)
│   │   ├── useSendQuotation.ts                  ← NUEVO (S2)
│   │   ├── useSubmitPaymentProof.ts             ← NUEVO (S3)
│   │   ├── useUnlockQuotation.ts                ← NUEVO (S2)
│   │   └── useQuotationBuilder.ts               (sin cambio)
│   ├── useBankSettings.ts                       ← NUEVO (S3)
│   ├── useQuotations.ts                         ← MODIFICADO (selector byStatus, S2)
│   └── ... (resto)
├── lib/
│   ├── schemas/
│   │   ├── bank-settings.ts                     ← NUEVO (S3)
│   │   ├── quotation-public.ts                  ← NUEVO (S2 + S3)
│   │   └── visit-measurements.ts                (Fase 3)
│   └── ... (resto)
├── pages/
│   ├── BankSettings.tsx                         ← NUEVO (S3)
│   ├── Pagos.tsx                                ← MODIFICADO (tab Pendientes, S3)
│   ├── PendingPayments.tsx                      ← NUEVO (S3)
│   ├── PublicQuotation.tsx                      ← NUEVO (S2)
│   ├── QuotationDetail.tsx                      ← MODIFICADO (S2)
│   ├── Quotations.tsx                           ← MODIFICADO (S2)
│   └── ... (resto)
└── App.tsx                                      ← MODIFICADO (3 rutas nuevas, S2 + S3)
```

```
supabase/functions/
├── process-whatsapp-notifications/ (existente, v13)
│   └── index.ts                                 ← MODIFICADO (9 templates nuevos)
└── generate-quotation-pdf/                      ← NUEVO directorio (S5)
    ├── index.ts                                 ← NUEVO (S5)
    ├── deno.json
    └── README.md
```

**Totales:**
- **Páginas nuevas:** 3 (PublicQuotation, PendingPayments, BankSettings)
- **Páginas modificadas:** 3 (QuotationDetail, Quotations, Pagos)
- **Componentes nuevos:** 17 (incluyendo subdir `public/` con 9)
- **Componentes modificados:** 2 (NotificationBell, Sidebar)
- **Hooks nuevos:** 12
- **Hooks modificados:** 1 (useQuotations)
- **Schemas Zod nuevos:** 2
- **Edge Functions:** 1 nueva + 1 modificada
- **Directorios nuevos:** 2 (`components/admin/`, `components/quotations/public/`)
- **Archivos eliminados:** 0

---

## 8. Dependencias entre slices

```
S1 (DB-only: schema + seeds + buckets + diseñador QA)
 └── S2 (DB + Frontend: URL pública + acceptance/rejection + lock + sync opp)
      ├── S3 (DB + Frontend: pago, verificación, BankSettings, designer assignment)
      │    ├── S4 (DB-only: recordatorios + expiry)
      │    └── S5 (DB + Edge Fn: PDF post-aprobación)
      └── (S4 y S5 independientes entre sí, ambos esperan S3)
```

**Reglas operativas:**
- **S1 se aplica solo** y queda 24h sin frontend para confirmar que el schema nuevo no rompe queries existentes (smoke en `useQuotations`, `useClients`, `useProjects`).
- **S2 requiere 2 templates Meta aprobados** (`quotation_sent_v1`, `quotation_v2_sent_v1`) antes de poder activar el flag.
- **S2 y S3 NO pueden ir en paralelo** desde la UI — S3 asume que el cliente ya pudo aceptar la cotización en S2.
- **S4 puede ir en paralelo con S3** (es backend-only, no requiere UI).
- **S5 cierra Fase 4** y desbloquea el botón "Descargar PDF" en `QuotationApprovedView`.

---

## 9. Cutover strategy (orden de merge + activación)

| Fase | Acción | Quién | Observación |
|---|---|---|---|
| 1 | Crear branch `feature/phase-4-slice-1-db` desde `master` | Dev | Solo migraciones 030-033 |
| 2 | Aplicar migraciones 030-033 vía Management API (agente) | Agente Claude | Confirmar smoke en staging |
| 3 | Merge `feature/phase-4-slice-1-db` → master | Dev (PR review) | Sin cambios de frontend |
| 4 | Soak 24h. Verificar `useQuotations` no rompe | Alvaro | |
| 5 | Crear branch `feature/phase-4-slice-2-public-flow` | Dev | Migraciones 034-035 + frontend completo de S2 |
| 6 | Aprobar templates Meta `quotation_sent_v1`, `quotation_v2_sent_v1` | Felipe (externo) | 24-48h |
| 7 | Aplicar migraciones 034-035 en staging | Agente | |
| 8 | QA E2E en staging con `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` (var de entorno Vercel preview) | Alvaro + agente | Crear cotización QA, mandar, aceptar desde incógnito, rechazar V2, ver redirect, etc. |
| 9 | Merge → master + aplicar migraciones en prod | Dev + agente | Flag sigue OFF en prod |
| 10 | Soak 48h. Si Meta aprobó templates, activar flag en prod | Alvaro | Sentinel: 1 cotización real con cliente real |
| 11 | Repetir 5-10 para S3 (templates `payment_request_v1`, `payment_received_v1`, `project_assigned_designer_v1`) | | |
| 12 | S4 (backend-only) puede mergearse + aplicarse SIN tocar flag | | El flag controla solo UI |
| 13 | S5 (PDF) — deploy Edge Function `generate-quotation-pdf` ANTES de aplicar migración 038 | Dev | Si no, el trigger fallará silenciosamente y `pdf_generation_log` quedará lleno de failed |

---

## 10. Riesgos arquitectónicos identificados

1. **El bucket `payment-receipts` permite INSERT anónimo**. RLS valida que el `quotation_id` en el path corresponde a una cotización en estado activo, pero un atacante podría intentar subir archivos masivos a cotizaciones legítimas. Mitigación: rate limiting por IP a nivel de Edge / CDN (configurar después si surge el problema).
2. **`useSubmitPaymentProof` hace upload + RPC en secuencia**. Si la RPC falla, el archivo queda huérfano en storage. Solución: la RPC valida el path del proof_url y rechaza si no apunta al bucket correcto + cron de limpieza semanal de archivos sin payment row asociado (out of scope).
3. **`QuotationVersionsDiff` compara items por descripción**. Heurística simple: si Alvaro renombra un item entre V1 y V2 sin tocar precio, aparece como "eliminado + agregado". Aceptable para MVP; mejorar con `parent_item_id` opcional en V2 si las métricas lo piden.
4. **Polling de PDF en `QuotationApprovedView`**. Si la Edge Function tarda > 30s en generar, el cliente ve "Generando PDF..." mucho tiempo. Mitigación: timeout de 60s + mensaje "El PDF estará disponible en breve, recargá la página".
5. **El `viewed_at` se setea desde la RPC pública SIN autenticación**. Cualquier scraper que llame `get_public_quotation(token)` cuenta como "vista". Aceptable (es un dato indicativo, no transaccional).
6. **No hay rate limiting en `accept_public_quotation` / `reject_public_quotation`**. Un atacante con el token podría llamar la RPC ANTES de que el cliente real abra el link. Solución parcial: token de 32 hex chars (collision-resistant), `valid_until` de 30d. Mitigación adicional: rate limiting de Supabase platform (default 30 req/s/IP por defecto).
7. **`QuotationCreate.tsx` puede generar quotation con items vacíos**. Si Alvaro envía sin items, `total_amount=0` → `submit_quotation_payment_proof` calcula `below_suggested = (amount < 0)` que es siempre false. Validar en `useSendQuotation`: rechazar si `items.length === 0` o `total_amount = 0`.

---

## 11. Convenciones obligatorias resumidas (refuerzo)

- **Errores Supabase:** SIEMPRE pasar por `mapSupabaseError` antes de mostrar toast.
- **Mutations:** SIEMPRE validar input con Zod en el cuerpo del hook.
- **React Query:** `retry: 0` en mutations y queries que llaman RPCs públicas (no reintentar en RPCs idempotentes que ya manejaron error en backend).
- **Design tokens:** colores via `@/lib/colors` o tokens de Tailwind, jamás hex hardcoded.
- **RLS de mínimo privilegio:** ya cubierto en las migraciones SQL. Frontend confía en backend para enforcing.
- **Identifiers en inglés** (props, types, state, columns). UI strings en español.
- **OneDrive + path con espacios** (`mi proyect`) rompe `npm run dev`. Usar `npm run build` + `vite preview` para QA visual local. Vercel preview deploys son la mejor opción para QA real.

---

## 12. Bibliografía y referencias internas

- [PRD Fase 4](../prd/phase-4-quotation-approval.md) — fuente canónica del flujo.
- [docs/CONVENTIONS.md](../CONVENTIONS.md) — convenciones de código.
- [Migraciones 030-038](../../db/migrations/) — schema, triggers, RPCs.
- [Refactor Map Fase 3](./phase-3-refactor-map.md) — referencia de formato.
- [PRD Lead → Project](../prd/lead-to-project-flow.md) — contexto de Fases 2-3 (opportunities, visits, schema actual).
- [Memory: feedback-onedrive-vite-hmr-conflict](file:///C:/Users/ceoel/.claude/projects/C--Users-ceoel/memory/) — por qué usar `vite preview` no `npm run dev`.
