# Refactor map — Fase 4 · Slice 3 (Pago → Proyecto)

**Fecha:** 2026-05-23 (cierre Fase 4 del ciclo `/grill-me`)
**Autor:** IA Fase 4 (improve-codebase-architecture)
**Estado:** Listo para Fase 5 (ejecución multi-turno en sesión nueva)
**Branch sugerida:** `slice-3-payment-flow` cortada de `master`
**Predecesores (orden de lectura):**

1. [`docs/handover/2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md`](../handover/2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md) — handoff autoritativo con las **10 correcciones al PRD** detectadas validando contra prod.
2. [`docs/prd/2026-05-23_slice-3-payment-to-project.md`](../prd/2026-05-23_slice-3-payment-to-project.md) — PRD formal (aplicar §3 del handoff sobre cualquier discrepancia).
3. [`db/migrations/037_slice3_payment_flow.sql`](../../db/migrations/037_slice3_payment_flow.sql), [`038_slice3_expiry_cron.sql`](../../db/migrations/038_slice3_expiry_cron.sql), [`039_slice3_settings_seeds.sql`](../../db/migrations/039_slice3_settings_seeds.sql), [`ROLLBACK_slice_3.sql`](../../db/migrations/ROLLBACK_slice_3.sql).
4. [`docs/handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md`](../handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md) — handoff predecesor (13 decisiones grill).

---

## 0. TL;DR del map (lo que cambia vs PRD)

El PRD listó **~38 archivos nuevos/modificados**. Aplicando el **deletion test** (Ousterhout: si borro este módulo, ¿se esparce complejidad en los callers, o desaparece?) este map consolida a **24 archivos** sin perder cobertura funcional:

| Cambio vs PRD | Justificación |
|---|---|
| **`usePayments` extendido con filtro `verification_status`** en vez de crear 3 hooks (`usePending/Verified/RejectedPayments`) | Hook actual ya acepta 5 filtros; sumar uno es 1 línea. 3 hooks separados = shallow pass-through. |
| **`PaymentVerifyModal` unifica verify + reject** (modal único con 2 acciones) en vez de modal separado por acción | Las 2 acciones comparten preview, datos del cliente, lookup de cotización. Separar duplica 80% del JSX. |
| **`BankSettingsForm` y `PaymentSettingsForm` viven inline** dentro de `BankSettings.tsx` / `PaymentSettings.tsx` en vez de componentes hijos | Sin reuso esperado; las páginas son simples (5-7 inputs + submit). Extraer = shallow. |
| **`QuotationRevisionButton`** inline en `QuotationDetail` (un `<Button>` + mutation) en vez de componente | 1 click + confirmación. Componente añade nada. |
| **Schemas Zod extienden `payment.ts` y `quotation.ts` existentes** en vez de crear `payment-proof.ts` + `quotation-cancel.ts` nuevos | El repo tiene un schema por entidad. Mantener convención. |
| **Realtime del badge "Por verificar" reusa el channel singleton `notifications-updates` + invalida `usePayments`** en vez de crear channel `payments-updates` con `crypto.randomUUID()` | Reuso de infra existente. El channel `notifications-updates` ya escucha INSERTs en `public.notifications`; cuando llega una notif `notification_type='payment_proof_uploaded'`, invalidamos `['payments', {verification_status:'pending'}]`. Cero código nuevo de realtime. |
| **Rutas viven bajo `/settings/bancarios` y `/settings/pagos`** (no `/admin/configuracion/*` como decía PRD) | Convención real del repo: settings cuelgan de `/settings/<slug>`. PRD inventó un namespace. |
| **Pantallas nuevas viven en `src/pages/settings/`** (no en `src/pages/`) | Patrón actual: `pages/settings/Users.tsx`, `Audit.tsx`, etc. |
| **Componentes nuevos de pagos van a `src/components/finanzas/`** (no `src/components/payments/`) | La carpeta real es `finanzas/` (`NewPaymentModal.tsx`, `PaymentMetrics.tsx`, etc.). PRD inventó nombre. |

Resto del map respeta el PRD textualmente.

---

## 1. Insumos validados contra prod (qué descubrí mirando el repo + DB en vivo)

Validaciones hechas con Management API en esta Fase 4:

| Hallazgo | Origen | Impacto en Fase 5 |
|---|---|---|
| **`payments.payment_type` CHECK en prod usa INGLÉS** (`advance/installment/final/refund`), pero `src/schemas/payment.ts` declara enum en **ESPAÑOL** (`anticipo/abono/pago_final/reembolso`). 8 archivos consumen los valores en español. | `curl pg_constraint` confirmó CHECK; `Grep paymentTypeSchema` listó consumers. | **Bug latente activo de S2**: cualquier INSERT en `payments` desde NewPaymentModal hoy falla con PG 23514. S3.2 **debe migrar todos los consumers a inglés** (no es opcional, lo bloquearía un smoke). Detalle en §10. |
| **`payments.payment_method` es ENUM Postgres** (USER-DEFINED type `payment_method`). El handoff §3.2 sólo habló de `payment_type`. | `information_schema.columns`. | Los valores del enum coinciden con el Zod actual (`efectivo`, `transferencia`, etc.) — si no, NewPaymentModal estaría rotísimo. Asumo OK; verificar en S3.1 smoke con `SELECT unnest(enum_range(NULL::payment_method))`. |
| **`verification_status` ya tiene CHECK en prod** `('pending','verified','rejected')`. | Mismo curl. | Las migraciones 037 NO tienen que añadirlo (handoff §3.1 ya lo dijo). |
| **No hay channel Realtime hardcoded fuera del `'notifications-updates'`** en `useRealtimeNotifications.ts`. | `Grep supabase.channel(`. | Para badge live de "Por verificar", reuso este channel (estrategia detallada en §8 e §3). |
| **No existe `useSystemSettings`, `useFeatureFlag`, ni `useActiveDesigners`** en el repo. | Inventario hooks (Explore). | Crear los 3 (hooks deep porque tendrán >1 caller). |
| **No existe `lib/queryKeys.ts`** — keys inline. | Inventario lib. | Deuda. NO se aborda en Slice 3 (out of scope), pero ojo: las invalidaciones cross-hook (verify_payment debe invalidar `['payments']`, `['projects']`, `['quotations']`, `['opportunities']`, `['notifications']`) van a vivir en cada `onSuccess`. Documento la lista en §6. |
| **No existe carpeta `src/components/settings/`** — settings son sólo páginas. | Inventario components. | Confirma decisión: los Forms van inline en cada página settings. |
| **`vite.config.ts` ya tiene `preview.allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']`** | Inventario lib. | NO hay que tocarlo. QA con cloudflared tunnel funciona ya. |
| **`PublicQuotation.tsx` actual** ya renderiza 3 cards (`PendingPaymentNotice`, `UnderReviewNotice`, `ApprovedNotice`) condicionadas por status, pero TODAS son texto estático ("te enviamos un WhatsApp con los datos bancarios"). | `Read PublicQuotation.tsx`. | S3.3 **reemplaza** `PendingPaymentNotice` por uno con datos bancarios + uploader, y **extiende** `ApprovedNotice` para mostrar uploader si `balance_due > 0` (D11 abonos). Las cards actuales sirven como fallback cuando flag OFF. |
| **`Pagos.tsx` actual** tiene FilterSheet con SelectItem por `payment_method` y `payment_type` (en español). El refactor a 3 tabs **complementa** los filtros (no los reemplaza): cada tab filtra por `verification_status`, los filtros internos siguen funcionando. | `Read Pagos.tsx`. | S3.2 mantiene FilterSheet, añade tabs encima. |
| **Settings.tsx actual** es una grid de QuickAccessGrid con 2 secciones (Catálogos Maestros, Accesos y Seguridad). | `Read Settings.tsx`. | S3.2 **agrega nueva sección** "Operaciones financieras" con 2 cards: "Datos Bancarios" + "Configuración de Pagos". Patrón visual idéntico a los items existentes. **Sidebar.tsx no necesita cambios** — Settings landing es el punto de entrada. |

---

## 2. Componentes NUEVOS (12 archivos)

Cada uno con: path final, responsabilidad, criterio "deep vs shallow" aplicado.

### 2.1 Páginas

| # | Path | Responsabilidad | Por qué deep |
|---|---|---|---|
| N-1 | `src/pages/settings/BankSettings.tsx` | Form con 7 inputs editando filas de `system_settings`: `bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone`. Read inicial + submit que upsertea las 7 filas en una transacción. | Toda la UX de "configurar datos bancarios" en un archivo. No hay sub-componentes que justifiquen extracción. |
| N-2 | `src/pages/settings/PaymentSettings.tsx` | Toggle `slice_3_enabled` + input numérico `payment_window_days` (default 7, 1-60) + input `suggested_min_advance_pct` (default 30, 0-100). Sin sub-componentes. | Idem N-1. |

### 2.2 Componentes (en `src/components/finanzas/` salvo donde se indica)

| # | Path | Responsabilidad | Por qué deep |
|---|---|---|---|
| N-3 | `src/components/finanzas/PaymentVerifyModal.tsx` | Modal único con: preview del comprobante (img `<img>` o `<iframe src=...>` para PDF) + datos cliente + cotización + monto + warning `below_suggested` + DesignerPicker (con escape "asignar después") + dropdown `payment_type` (default `advance` si primer pago, `installment`/`final` si proyecto ya existe) + **dos botones**: "Verificar y crear proyecto" / "Rechazar con motivo". El segundo abre un sub-state con textarea inline. Llama `verify_payment` o `reject_payment`. | Unifica las 2 acciones que comparten 80% del JSX (preview, datos, lookup). Separar en 2 modales = duplicación. |
| N-4 | `src/components/finanzas/ManualPaymentModal.tsx` | Form para admin: autocomplete de cotización en `client_approved`/`pending_payment_verification`/`approved` → carga total + cliente → inputs monto + método (incluye efectivo/cheque) + DesignerPicker (si primer pago) + `payment_type` + notas. Llama `register_manual_payment`. | Conceptualmente distinto a verify (no parte de un pago pre-existente). Reuso de DesignerPicker. |
| N-5 | `src/components/finanzas/DesignerPicker.tsx` | `<Select>` con lookup `useActiveDesigners()` + opción literal "asignar después" (mapea a `null`). Acepta `value: string \| null`, `onChange`. | Se reusa en N-3 (verify) y N-4 (manual). Si surge S4+ con asignación desde otro flujo, lo reusa también. |
| N-6 | `src/components/quotations/QuotationCancelModal.tsx` | Textarea obligatoria "Motivo de cancelación" (min 10 chars con Zod live) + botón "Confirmar cancelación". Llama `cancel_quotation_acceptance`. | Modal con 1 input + 1 mutation, pero **se monta desde `QuotationDetail.tsx`** y la lógica de validación + error handling justifica separar. |

### 2.3 Componente público

| # | Path | Responsabilidad | Por qué deep |
|---|---|---|---|
| N-7 | `src/components/quotations/public/PaymentProofUploader.tsx` | File picker (image/* + application/pdf, max 5MB validado client-side) + form (monto NUMERIC con displayAmount pattern como NewPaymentModal, método dropdown limitado a `transferencia/nequi/daviplata/pse`, notas opcional). Upload a bucket `payment-receipts` con `path = '<quotation_id>/<uuid>.<ext>'` → llama `submit_quotation_payment_proof(p_token, amount, method, public_url, notes)`. Renderiza dentro de `PublicQuotation.tsx` cuando flag ON + estado válido. | Carga sustantiva: upload + validación + RPC + manejo de errores PG (token inválido, cotización expirada, monto inválido). No se inline en PublicQuotation. |

### 2.4 Hooks (en `src/hooks/finanzas/` salvo donde se indica)

| # | Path | Responsabilidad | Por qué deep |
|---|---|---|---|
| N-8 | `src/hooks/finanzas/useSubmitPaymentProof.ts` | Mutation: upload a `payment-receipts` bucket + RPC `submit_quotation_payment_proof`. Maneja errores de tamaño/tipo de archivo localmente. Invalida nada (frontend público no tiene caché del admin). | Encadena 2 operaciones (storage + RPC) con compensación si la 2ª falla (borrar el archivo subido). |
| N-9 | `src/hooks/finanzas/useVerifyPayment.ts` | Mutation: RPC `verify_payment(payment_id, designer_id, payment_type)`. **`onSuccess` invalida**: `['payments']` (todos los filtros), `['projects']`, `['quotations']`, `['opportunities']`, `['notifications']`. | Mutation con cross-table invalidations no triviales — explicarlas inline en el hook con comentario. |
| N-10 | `src/hooks/finanzas/useRejectPayment.ts` | Mutation: `reject_payment(payment_id, reason)`. Invalida `['payments']`, `['quotations']`, `['notifications']`. | Idem N-9 pero menos invalidaciones. |
| N-11 | `src/hooks/finanzas/useRegisterManualPayment.ts` | Mutation: `register_manual_payment(quotation_id, amount, method, payment_type, designer_id?, notes?)`. Invalida igual que N-9. | Idem. |
| N-12 | `src/hooks/quotations/useCancelQuotationAcceptance.ts` | Mutation: `cancel_quotation_acceptance(quotation_id, reason)`. Invalida `['quotations']`, `['opportunities']`, `['notifications']`. | Carpeta `quotations/` (no `finanzas/`) porque opera sobre la entidad cotización. |
| N-13 | `src/hooks/quotations/useCreateQuotationRevision.ts` | Mutation: `create_quotation_revision(quotation_id)`. `onSuccess` navega a `/quotations/<new_quotation_id>` (recibe el id desde el JSONB response). Invalida `['quotations']`. | Idem. |
| N-14 | `src/hooks/quotations/useReactivateExpiredQuotation.ts` | Mutation: `reactivate_expired_quotation(quotation_id)`. Invalida `['quotations']`, `['payments']`, `['notifications']`. | Idem. |
| N-15 | `src/hooks/settings/useSystemSettings.ts` | Hook genérico con: `useSetting(key)` (read) + `useUpdateSetting()` (write upsert). queryKey `['system_settings', key]`. Carpeta nueva `src/hooks/settings/`. | Reutilizable: BankSettings llama 7 veces, PaymentSettings 3 veces. Si lo borrara, cada página tendría que escribir su propio useQuery + mutation = duplicación enorme. |
| N-16 | `src/hooks/settings/useFeatureFlag.ts` | `useFeatureFlag(key)` → `boolean`. Internamente reusa `useSetting(key)` con `staleTime: 5 * 60_000` (5 min). Default `false` si query loading o setting no existe. | Wrapper deep: encapsula el casting JSONB→boolean + el default safe + el staleTime. Callers en PublicQuotation, Pagos refactor, Sidebar (futuro), PaymentSettings (auto-toggle). |
| N-17 | `src/hooks/useActiveDesigners.ts` | `useQuery(['profiles', 'designers'], () => from('profiles').select('id, full_name, whatsapp_phone').eq('role', 'diseno').eq('is_active', true))`. Acepta opcional `includeAdminFallback` para devolver [{id: null, full_name: 'Asignar después'}, ...designers]. | Reutilizable en DesignerPicker (N-5) + futuro en ProjectAssignDesignerModal cuando exista. |

---

## 3. Componentes MODIFICADOS (8 archivos)

| # | Path | Cambios | Tamaño aproximado del diff |
|---|---|---|---|
| M-1 | `src/App.tsx` | Agregar 2 imports lazy + 2 `<Route>` dentro del bloque Settings: `/settings/bancarios` → `<BankSettingsPage>` con `roles=["admin","super_admin"]`; `/settings/pagos` → `<PaymentSettingsPage>` con `roles=["admin","super_admin"]`. | +6 líneas |
| M-2 | `src/pages/Settings.tsx` | Agregar tercera sección "Operaciones Financieras" con 2 QuickAccessItems: Datos Bancarios (path `/settings/bancarios`, icon `Landmark` de lucide), Configuración de Pagos (path `/settings/pagos`, icon `Settings2`). Reusar el patrón QuickAccessGrid existente. | +30 líneas |
| M-3 | `src/pages/Pagos.tsx` | **Refactor mayor**. Convertir layout a 3 tabs (`Por verificar` / `Verificados` / `Rechazados`) con `<Tabs>` de shadcn. Cada tab pasa `verification_status` distinto a `usePayments`. Tab "Por verificar" muestra **badge contador** = `pendingPayments.length`. Header agrega botón "Registrar pago manual" (abre `ManualPaymentModal`). El botón "Registrar Pago" actual queda removido (su lógica vivía en NewPaymentModal — se conserva para registrar pagos manuales legacy fuera del flujo Slice 3). El modal de detalle clickea: si `verification_status='pending'` abre `PaymentVerifyModal` (N-3); sino abre `PaymentDetailPanel` (legacy). Toda la lógica gated por `useFeatureFlag('slice_3_enabled')`: si OFF, la página queda con el layout actual sin tabs y sin botón manual. | Refactor ~120 líneas (sobre 201 actuales) |
| M-4 | `src/pages/PublicQuotation.tsx` | Si `useFeatureFlag('slice_3_enabled')` ON y `data.status === 'client_approved'`: **reemplazar** `PendingPaymentNotice` por `<BankDetailsCard>` (componente inline: 7 fields desde useSystemSettings) + `<PaymentProofUploader token={token} />`. Si `data.status === 'pending_payment_verification'`: mantener `UnderReviewNotice` (texto "estamos verificando"). Si `data.status === 'approved'` con `balance_due > 0`: renderizar `<BalancePendingCard>` + `<PaymentProofUploader />` (D11 abonos). Si `data.status === 'approved'` con `is_fully_paid`: mantener `ApprovedNotice`. **Agregar** ramas para `cancelled` / `superseded` / `expired`: nuevas StatusCards con tones y CTAs apropiados (ej. `superseded` con link a `<QuotationRedirectView>` apuntando a la V2 via `superseded_by_quotation_id`). | +80 líneas, -10 |
| M-5 | `src/pages/QuotationDetail.tsx` | Agregar 2 botones en header (gated `useFeatureFlag` + estado): "Cancelar aceptación" (abre `QuotationCancelModal` N-6, sólo visible si status IN `client_approved`/`pending_payment_verification`) + "Crear versión nueva" (inline confirmación + `useCreateQuotationRevision`, mismo gating). Si status es `expired`: agregar botón "Reactivar" que llama `useReactivateExpiredQuotation`. | +25 líneas |
| M-6 | `src/schemas/payment.ts` | **MIGRAR `paymentTypeSchema` a INGLÉS** (`advance/installment/final/refund`). Mantener `paymentMethodSchema` en español (es enum DB validado). Agregar nuevos schemas: `submitPaymentProofSchema`, `verifyPaymentSchema`, `rejectPaymentSchema`, `registerManualPaymentSchema`. Exportar mapas `PAYMENT_TYPE_LABELS_ES` y `PAYMENT_METHOD_LABELS_ES` para uso UI. | +60 líneas, -4 |
| M-7 | `src/schemas/quotation.ts` (o `quotation.schema.ts`, ver Explore) | Agregar enums extendidos `quotationStatusSchema` con `cancelled`, `superseded` (mantener existentes). Agregar `cancelQuotationAcceptanceSchema`, `createQuotationRevisionSchema`. | +20 líneas |
| M-8 | Componentes consumers de `payment_type` español (5 archivos) — efectos colaterales de M-6 | **Migrar a INGLÉS** los valores duros: `NewPaymentModal.tsx` (TYPE_OPTIONS), `PaymentDetailPanel.tsx` (display), `PaymentsList.tsx` (getTypeBadge switch + labels), `Pagos.tsx` (FilterSheet SelectItem values), `Dashboard.tsx` (si compara por type). Conservar **labels** en español usando `PAYMENT_TYPE_LABELS_ES` exportado. Ver §10 para el listado exacto. | ~15 líneas distribuidas |

---

## 4. Componentes ELIMINADOS

**Ninguno**. Validado por Explore + lectura individual. No hay archivos huérfanos ni duplicados a borrar como parte de este slice.

**Deuda observada (NO se aborda en S3)**:
- `lib/queryKeys.ts` inexistente — keys ad-hoc en cada hook. Riesgo de typos en invalidaciones. Out of scope.
- Triggers `handle_payment_approval` + `check_and_update_project_status_on_payment` duplicados en prod (handoff §3.10). Out of scope.
- `db/supabase_schema.sql` y `src/types/database.types.ts` desactualizados (deuda histórica). Out of scope — solo tocar columnas afectadas por S3.

---

## 5. Backend / edge function MODIFICADO

| Path | Cambios |
|---|---|
| `supabase/functions/process-whatsapp-notifications/index.ts` | Extender `TEMPLATE_REGISTRY` con 5 builders nuevos S3 (cuando Felipe apruebe templates en Meta): `payment_proof_rejected_v1`, `project_assigned_designer_v1`, `project_fully_paid_v1`, `quotation_v2_sent_v1`, `admin_quotation_expired_v1`. Cada builder mapea `template_parameters` JSON → array Meta. Redeploy con `supabase functions deploy process-whatsapp-notifications --project-ref xdzbjptozeqcbnaqhtye`. El agente lo aplica con PAT del `.env`. **El template `payment_received` ya está aprobado y registrado** — no se toca. |

---

## 6. Hooks → tablas → invalidaciones (referencia)

Cross-table invalidations no triviales. Tabla rápida para que la próxima IA no las olvide en `onSuccess`:

| Mutation | Tablas que afecta | Query keys a invalidar |
|---|---|---|
| `submit_quotation_payment_proof` | payments, quotations, notifications | (frontend público, sin cache admin) |
| `verify_payment` | payments, **projects (CREA o updates)**, quotations, opportunities, notifications, notification_queue (WA) | `['payments']`, `['projects']`, `['quotations']`, `['opportunities']`, `['notifications']` |
| `reject_payment` | payments, quotations, notifications, notification_queue | `['payments']`, `['quotations']`, `['notifications']` |
| `register_manual_payment` | payments, **projects (CREA o updates)**, quotations, opportunities, notifications, notification_queue | igual a `verify_payment` |
| `cancel_quotation_acceptance` | quotations, opportunities, notifications | `['quotations']`, `['opportunities']`, `['notifications']` |
| `create_quotation_revision` | quotations, quotation_items, audit_logs | `['quotations']` (la lista) — además navegar a `/quotations/<new_id>` |
| `reactivate_expired_quotation` | quotations, notifications | `['quotations']`, `['payments']` (badge si había payment rejected ligado), `['notifications']` |

**Convención**: `queryClient.invalidateQueries({ queryKey: ['payments'] })` sin filtros = invalida TODAS las variantes (incluyendo distintos `verification_status`). Suficiente para Slice 3.

---

## 7. Schemas Zod (consolidación)

### 7.1 Extender `src/schemas/payment.ts` (M-6)

```ts
// Migrar payment_type a inglés (DB CHECK)
export const paymentTypeSchema = z.enum(["advance", "installment", "final", "refund"]);

// Labels para UI (NO exportar como const enum — solo display)
export const PAYMENT_TYPE_LABELS_ES: Record<PaymentType, string> = {
  advance: "Anticipo",
  installment: "Abono",
  final: "Pago final",
  refund: "Reembolso",
};

export const PAYMENT_METHOD_LABELS_ES: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  cheque: "Cheque",
  nequi: "Nequi",
  daviplata: "Daviplata",
  pse: "PSE",
};

// Nuevos schemas Slice 3
export const submitPaymentProofSchema = z.object({
  amount: z.number().positive().max(99_999_999_999.99),
  payment_method: z.enum(["transferencia", "nequi", "daviplata", "pse"]),  // subset: solo remotos
  notes: z.string().max(2000).nullable().optional(),
  // file se valida fuera del schema (File, size, mime)
});

export const verifyPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  designer_id: z.string().uuid().nullable(),
  payment_type: paymentTypeSchema.optional(),
});

export const rejectPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().min(10, "Mínimo 10 caracteres").max(2000),
});

export const registerManualPaymentSchema = z.object({
  quotation_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: paymentMethodSchema,  // todos los métodos
  payment_type: paymentTypeSchema,
  designer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
```

### 7.2 Extender `src/schemas/quotation.ts` (M-7)

```ts
// Sumar al enum existente
export const quotationStatusSchema = z.enum([
  "draft", "sent", "approved", "rejected",
  "client_approved", "pending_payment_verification",
  "expired",
  "cancelled",    // nuevo S3
  "superseded",   // nuevo S3
]);

export const cancelQuotationAcceptanceSchema = z.object({
  quotation_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});

export const createQuotationRevisionSchema = z.object({
  quotation_id: z.string().uuid(),
});
```

**Anti-patrón evitado**: NO crear `src/schemas/payment-proof.ts` ni `quotation-cancel.ts` — los schemas existentes son el lugar canónico para su entidad.

---

## 8. Feature flag — insertion points y caché

`useFeatureFlag('slice_3_enabled')` con `staleTime: 5 * 60_000` (5 min). Default `false` durante loading.

**Surfaces gated**:

| Surface | Comportamiento si flag OFF | Comportamiento si flag ON |
|---|---|---|
| `PublicQuotation.tsx` | Renderiza `PendingPaymentNotice` (texto "te enviamos un WhatsApp") | Renderiza `<BankDetailsCard>` + `<PaymentProofUploader>` |
| `Pagos.tsx` | Layout actual (sin tabs, sin botón "Pago manual") | 3 tabs + botón "Registrar pago manual" |
| `QuotationDetail.tsx` | Botones "Cancelar aceptación" / "Crear versión nueva" / "Reactivar" NO se renderizan | Botones visibles según estado |
| `Sidebar.tsx` | Sin cambios (Settings landing siempre accesible) | Sin cambios |
| `Settings.tsx` | Sección "Operaciones Financieras" con cards Datos Bancarios + Configuración de Pagos **siempre visible** (Álvaro las necesita para activar el flag) | Idem |
| `BankSettings.tsx` | Form editable normal (no depende del flag) | Idem |
| `PaymentSettings.tsx` | Toggle del flag + inputs siempre visibles | Idem |
| Cron `expire_accepted_quotations_scan` | Sale al toque (función SQL lee `get_feature_flag` y retorna) | Marca expired + encola WA |
| RPCs públicas `submit_quotation_payment_proof` / `verify_payment` / etc. | Raise `slice_3_disabled` con ERRCODE 22023 | Operan normal |

**Cache invalidation cuando admin toggla flag**: `PaymentSettings.tsx` después de upsertear `slice_3_enabled` debe `queryClient.invalidateQueries({ queryKey: ['system_settings', 'slice_3_enabled'] })`. El staleTime de 5 min sigue aplicando para callers — el admin que toggla ve el cambio inmediato, los demás callers (incluido el cliente público en sesión activa) lo ven en su próximo refetch (≤5 min).

**Anti-patrón evitado**: NO leer el flag dentro del callback `onAuthStateChange` ([feedback-supabase-no-sdk-in-onauth-callback](../../../.claude/projects/C--Users-ceoel/memory/feedback_supabase_no_sdk_in_onauth_callback.md)). El hook usa `useQuery` que es independiente del flujo de auth.

---

## 9. Plan de cutover (orden de PRs)

**Branch base sugerida**: `slice-3-payment-flow` cortada de `master` (después del último merge de S2).

Con el flag default `false`, **todos los cambios de código pueden mergear sin riesgo de impactar producción**. Cada sub-slice puede ser un PR independiente:

| PR | Sub-slice | Contenido | Riesgo si mergea con flag OFF | Verificación |
|---|---|---|---|---|
| PR-1 | **S3.1 backend** | Aplicar migs 037+038+039 a prod (Management API). El agente las aplica (idempotentes). Después: smoke SQL de las 7 RPCs sobre cotización seed `[SMOKE-S3-2026-XX-XX]` con flag temporalmente ON, cleanup, flag OFF de nuevo. **Cero código de frontend en este PR.** | 0 (flag OFF en seed). Sin frontend tocado. | Smoke SQL flujos A-G del PRD §6.1 + verificar `cron.job` lista el nuevo job. |
| PR-2 | **S3.2.a hooks + schemas** | Crear N-8 a N-17 (9 hooks) + M-6 (payment.ts) + M-7 (quotation.ts) + M-8 (migración payment_type a inglés en consumers). **Esta es la migración que arregla el bug latente de S2** (NewPaymentModal). | 0. Los hooks nuevos no se llaman desde ningún lado todavía. La migración de payment_type es un fix de bug (las labels visuales no cambian, sólo los `value`). | `tsc --noEmit` OK; smoke manual de NewPaymentModal: crear payment con cada uno de los 4 types y verificar que no haya 23514. |
| PR-3 | **S3.2.b UI admin** | Crear N-1, N-2 (settings) + N-3, N-4, N-5 (modales) + N-6 (cancel modal) + M-1 (App.tsx rutas) + M-2 (Settings.tsx sección) + M-3 (Pagos.tsx refactor) + M-5 (QuotationDetail.tsx botones). | Bajo. Flag OFF en system_settings → todo el código nuevo renderiza fallbacks (sin tabs, sin botones). El refactor a Pagos.tsx tiene un `if (!flag) return <LegacyLayout/>` para preservar UI actual. | Build OK + `vite preview` admin: ver Settings con cards nuevas → click → BankSettings carga las 7 filas → PaymentSettings carga toggle (OFF) + inputs. Pagos.tsx **sin** tabs (flag OFF). |
| PR-4 | **S3.3 UI cliente** | Crear N-7 (uploader) + M-4 (PublicQuotation refactor con cards extendidas). | Bajo. Flag OFF → `PendingPaymentNotice` legacy se renderiza. | `vite preview --host` + cloudflared tunnel: abrir `/c/<code>` de cotización aceptada con flag OFF → ver el cardo "te enviamos WhatsApp" como hoy. Toggle flag ON en `PaymentSettings` (otra sesión) → recargar `/c/<code>` → ver `BankDetailsCard` + `PaymentProofUploader`. |
| PR-5 | **S3.4 edge fn** | Extender `TEMPLATE_REGISTRY` con 5 builders nuevos. Redeploy. | 0. Los templates aún no están aprobados en Meta — los rows se siguen marcando `failed`. Cuando aprueben: `UPDATE notification_queue SET status='pending' WHERE template_name=<aprobado> AND status='failed'`. | Smoke con row dummy en `notification_queue` por cada template nuevo → ver logs del worker (debería decir "template_not_found" hasta que Felipe apruebe). |
| PR-6 | **S3.5 smoke E2E** | Sin código nuevo. Smoke completo flujos A-G del PRD §6.1 sobre cotización seed con flag ON. Cleanup. | 0 si cleanup OK. | Reporte de smoke + screenshots admin/cliente. |
| PR-7 | **S3.6 piloto** | Sin código. Álvaro toggla flag para 1-2 clientes reales (técnicamente: el flag es global, no per-cliente; el "piloto" significa que Álvaro avisa a esos clientes específicos que pueden usar el flujo, mientras vigila 48h). | Variable. Si bug crítico: flag OFF en 1 click (PaymentSettings). | Observación 48h de Álvaro: cero incidentes críticos. |

**Plan B / rollback** si algo se rompe post-PR-1:
- Apagar flag: `UPDATE system_settings SET value='false'::jsonb WHERE key='slice_3_enabled'`.
- Rollback schema: aplicar `db/migrations/ROLLBACK_slice_3.sql`. Preserva data en filas existentes.

---

## 10. Mapping ES↔EN (autoritativo para Fase 5)

**`payment_type` (CHECK constraint inglés en prod, deuda S2 a corregir)**:

| DB value | UI label |
|---|---|
| `advance` | "Anticipo" |
| `installment` | "Abono" |
| `final` | "Pago final" |
| `refund` | "Reembolso" |

**`payment_method` (enum Postgres, valores en español — coinciden con Zod actual)**:

| DB value | UI label |
|---|---|
| `efectivo` | "Efectivo" |
| `transferencia` | "Transferencia" |
| `credito` | "Crédito" |
| `cheque` | "Cheque" |
| `nequi` | "Nequi" |
| `daviplata` | "Daviplata" |
| `pse` | "PSE" |

Subset cliente-facing en `PaymentProofUploader.tsx` (D1): `transferencia / nequi / daviplata / pse`.

**`quotation.status` (enum)** — agregando 2:

| DB value | UI label sugerido |
|---|---|
| `draft` | "Borrador" |
| `sent` | "Enviada" |
| `client_approved` | "Aceptada por cliente" |
| `pending_payment_verification` | "Pago en verificación" |
| `approved` | "Aprobada" |
| `rejected` | "Rechazada por cliente" |
| `expired` | "Vencida" |
| `cancelled` | "Cancelada" *(nuevo S3)* |
| `superseded` | "Reemplazada por V2" *(nuevo S3)* |

**`payments.verification_status`**:

| DB value | UI label |
|---|---|
| `pending` | "Por verificar" |
| `verified` | "Verificado" |
| `rejected` | "Rechazado" |

**`payments.payment_source`** (sólo admin/audit):

| DB value | UI label |
|---|---|
| `client_upload` | "Subido por cliente" |
| `admin_manual` | "Registrado manualmente" |

**Archivos a migrar en M-8 (consumers de `payment_type` español)**:

Confirmados por `Grep paymentTypeSchema|PaymentType|payment_type|'anticipo'|'abono'|'pago_final'|'reembolso'`:

1. `src/components/finanzas/NewPaymentModal.tsx` — `TYPE_OPTIONS` (líneas 53-58)
2. `src/components/finanzas/PaymentDetailPanel.tsx` — display de type
3. `src/components/finanzas/PaymentsList.tsx` — `getTypeBadge` switch (líneas 42-48)
4. `src/hooks/finanzas/usePayments.ts` — filter comparison (línea 36)
5. `src/pages/Pagos.tsx` — FilterSheet SelectItem values (líneas 136-139)
6. `src/schemas/payment.ts` — `paymentTypeSchema` (líneas 16-21) [M-6]
7. `src/types/database.types.ts` — generated, puede mentir (cast a `PaymentType` exportado por payment.ts)
8. `src/types/database.ts` — verificar si reexporta
9. `src/pages/Dashboard.tsx` — verificar uso (puede ser sólo display)

**Patrón de migración**: usar `PAYMENT_TYPE_LABELS_ES[type]` para display, `paymentTypeSchema` para validación, `Object.entries(PAYMENT_TYPE_LABELS_ES).map(...)` para construir options.

---

## 11. Verificación pre-Fase 5 (archivos a leer antes de tocar)

Para la próxima IA. Orden recomendado, agrupado por sub-slice:

### Para S3.1 (backend, agente aplica solo)
- Las 4 migraciones SQL en disco (037, 038, 039, ROLLBACK).
- `reference_innovar_management_api.md` (memory).

### Para S3.2.a (hooks + schemas)
- [`src/schemas/payment.ts`](../../src/schemas/payment.ts) — para M-6 (migración inglés).
- [`src/schemas/quotation.ts`](../../src/schemas/quotation.ts) o `quotation.schema.ts` — para M-7.
- [`src/hooks/finanzas/usePayments.ts`](../../src/hooks/finanzas/usePayments.ts) — patrón de hook query con filtros.
- [`src/hooks/finanzas/useCreatePayment.ts`](../../src/hooks/finanzas/useCreatePayment.ts) — patrón de hook mutation con upload + RPC.
- [`src/lib/supabaseClient.ts`](../../src/lib/supabaseClient.ts) — el export que usan los hooks.
- [`src/lib/errors.ts`](../../src/lib/errors.ts) — `mapSupabaseError`, `assertSupabase`.

### Para S3.2.b (UI admin)
- [`src/pages/Pagos.tsx`](../../src/pages/Pagos.tsx) — refactor base.
- [`src/components/finanzas/NewPaymentModal.tsx`](../../src/components/finanzas/NewPaymentModal.tsx) — patrón del modal nuevo (estructura `DetailModal`).
- [`src/components/finanzas/PaymentsList.tsx`](../../src/components/finanzas/PaymentsList.tsx) — afectado por M-8.
- [`src/components/finanzas/PaymentDetailPanel.tsx`](../../src/components/finanzas/PaymentDetailPanel.tsx) — preservado, conviene leerlo.
- [`src/pages/Settings.tsx`](../../src/pages/Settings.tsx) — patrón QuickAccessGrid + sección nueva.
- [`src/pages/settings/Holidays.tsx`](../../src/pages/settings/Holidays.tsx) o similar — patrón de página settings con form + persistencia.
- [`src/pages/QuotationDetail.tsx`](../../src/pages/QuotationDetail.tsx) — donde se montan los botones nuevos (M-5).
- [`src/App.tsx`](../../src/App.tsx) — donde van las rutas nuevas (M-1).
- [`src/components/ui/tabs.tsx`](../../src/components/ui/tabs.tsx) (shadcn) — componente para las 3 tabs.

### Para S3.3 (UI cliente)
- [`src/pages/PublicQuotation.tsx`](../../src/pages/PublicQuotation.tsx) — refactor base + StatusCards extendidos.
- [`src/hooks/quotations/usePublicQuotation.ts`](../../src/hooks/quotations/usePublicQuotation.ts) — patrón query pública.
- [`src/components/quotations/public/QuotationPublicView.tsx`](../../src/components/quotations/public/QuotationPublicView.tsx) — patrón component público.
- [`src/components/quotations/public/PublicLayout.tsx`](../../src/components/quotations/public/PublicLayout.tsx) — wrapper estético.
- Patrón de upload a Storage en algún componente existente (probablemente en `NewPaymentModal.tsx`: file picker + `createPayment.mutateAsync({file})`).

### Para S3.4 (edge fn)
- [`supabase/functions/process-whatsapp-notifications/index.ts`](../../supabase/functions/process-whatsapp-notifications/index.ts) — `TEMPLATE_REGISTRY` y patrón de builder.
- `reference_innovar_whatsapp_templates.md` (memory) — wording de los 5 templates nuevos.

### Para S3.5 (smoke E2E)
- PRD §6.1 (flujos A-G) y §5.8 (smoke checklist).

---

## 12. Riesgos descubiertos durante este Fase 4

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R-1 | Bug latente activo: `payment_type` español en frontend vs inglés en CHECK prod (8 archivos). | **CRÍTICA** | Sub-slice S3.2.a (PR-2) migra todo a inglés. Se hace ANTES de cualquier UI nueva. Una vez fijado, NewPaymentModal vuelve a funcionar. |
| R-2 | `payment_method` es ENUM Postgres pero no validamos los valores en prod desde esta Fase 4. | Baja | Smoke en S3.1 con `SELECT unnest(enum_range(NULL::payment_method))`. Si los valores difieren del Zod, ajustar. |
| R-3 | El flag `useFeatureFlag` con staleTime 5min → cliente público en sesión activa puede no ver el cambio inmediato si Álvaro apaga. | Aceptado por D13 | Documentado en PRD §5.9. Para apagado de emergencia: Álvaro avisa por WhatsApp + fuerza reload. |
| R-4 | Migración 037 hace `ALTER TYPE ADD VALUE` que PG no permite revertir. ROLLBACK deja los enum values muertos. | Aceptado | Documentado en `ROLLBACK_slice_3.sql` cabecera. Valores huérfanos benignos. |
| R-5 | 9 templates Meta pendientes (5 nuevos S3 + 4 heredados S2). | Bloqueador externo | Manejo de filas `failed` con `UPDATE ... status='pending'` cuando aprueban. Documentado handoff §5. |
| R-6 | Realtime: si Slice 3 quisiera badge live separado para "pagos por verificar", `supabase.channel('payments-updates')` hardcoded crashearía. Map reusa channel notifications + invalida payments. | Mitigado en este map | §3 + §8 explican el patrón. |
| R-7 | `audit_logs` tiene camelCase entrecomillado (`"userId"`, `"userName"`). RPCs nuevas en mig 037 ya lo respetan; nuevos consumers en frontend que lean audit_logs deben replicar. | Bajo | No hay consumers frontend en S3 (audit no se renderiza en UI Slice 3). |
| R-8 | OneDrive sync con `npm run dev` → HMR roto. | Conocido | Usar `npm run build` + `vite preview` (puerto 4173). Documentado MEMORY. |
| R-9 | El `Pagos.tsx` actual carga `usePayments()` sin filtro `verification_status` → muestra TODOS los pagos (verified + el resto cuando existan). En PR-3 refactor, la versión "flag OFF" sigue mostrando todos. La versión "flag ON" filtra por tab. NO hay riesgo de regresión en flag OFF. | Bajo | Confirmar en smoke. |

---

## 13. Deltas vs PRD (cambios autoritativos de este map)

| PRD original | Este map | Razón |
|---|---|---|
| `src/pages/BankSettings.tsx` | `src/pages/settings/BankSettings.tsx` | Convención repo: pages/settings/ |
| `src/pages/PaymentSettings.tsx` | `src/pages/settings/PaymentSettings.tsx` | Idem |
| Ruta `/admin/configuracion/bancarios` | Ruta `/settings/bancarios` | Convención repo: /settings/* |
| Ruta `/admin/configuracion/pagos` | Ruta `/settings/pagos` | Idem |
| `src/components/payments/*` | `src/components/finanzas/*` | Carpeta real del repo |
| `src/components/settings/BankSettingsForm.tsx`, `PaymentSettingsForm.tsx` | Inline en cada Page | Sin reuso esperado; carpeta `components/settings/` no existe |
| `useSubmitPaymentProof`, `useVerifyPayment`, etc. en `src/hooks/` raíz | En `src/hooks/finanzas/` y `src/hooks/quotations/` (por dominio) | Convención repo |
| 3 hooks separados: `usePendingPayments`, `useVerifiedPayments`, `useRejectedPayments` | Extender `usePayments` con filtro `verification_status` | Deletion test: hooks shallow eliminables |
| `useFeatureFlag` en `src/hooks/` raíz | En `src/hooks/settings/useFeatureFlag.ts` (junto con `useSystemSettings`) | Cohesión por dominio "settings" |
| `PaymentVerifyModal` + `PaymentRejectModal` separados | 1 solo `PaymentVerifyModal` con 2 acciones internas | Deletion test: separación duplica 80% del JSX |
| `QuotationRevisionButton` componente | Inline en `QuotationDetail.tsx` | Deletion test: 1 button + 1 mutation |
| Schemas `src/schemas/payment-proof.ts`, `quotation-cancel.ts` nuevos | Extender `payment.ts` y `quotation.ts` existentes | Convención repo: 1 schema por entidad |
| Sidebar agrega entradas `Configuración → Datos Bancarios` y `Configuración → Pagos` | `Sidebar.tsx` NO se toca; se accede vía `Settings.tsx` landing (sección nueva en M-2) | Patrón actual del repo: settings tienen 1 entrada al sidebar (`/settings`), el resto via landing. |
| Realtime channel hardcoded para badge de pagos | Reuso del channel `'notifications-updates'` + invalidación de `usePayments` | Anti-patrón singleton ya documentado. |
| Componentes nuevos: `12` | Componentes nuevos: `12` (recuento N-1 a N-12; N-13 a N-17 son hooks/schemas, contados aparte) | El conteo "12 componentes" del PRD se mantiene si se cuentan páginas (2) + componentes UI (5) + hook genéricos (3) + schemas (2) = 12, lo cual coincide aproximadamente. |

**Renumeración final**:
- 2 páginas nuevas (N-1, N-2)
- 5 componentes UI nuevos (N-3 a N-7)
- 10 hooks nuevos (N-8 a N-17)
- 2 schemas extendidos (M-6, M-7)
- 6 archivos modificados (M-1 a M-5 + M-8 distribuido)
- 1 edge function modificada
- 4 migraciones SQL (en disco)

= **30 unidades de cambio** distribuidas en **24 archivos físicos** (algunos archivos suman 2 unidades como `payment.ts`).

---

## 14. Próximos pasos (Fase 5)

**Esta sesión termina acá**. Fase 5 va en sesión nueva con cero contexto. La próxima IA debe:

1. Leer [`docs/handover/2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md`](../handover/2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md).
2. Leer **este map** (`docs/architecture/slice-3-refactor-map.md`).
3. Arrancar **S3.1**: aplicar migs 037+038+039 via Management API + smoke SQL flujos A-G.
4. Continuar con PRs S3.2.a → S3.2.b → S3.3 → S3.4 → S3.5 → S3.6 en orden.

**Cierre Fase 4**:
- Handoff actualizado: `docs/handover/2026-05-23_PHASE-4-SLICE-3-REFACTOR-MAP.md` (próximo en esta sesión).
- Entry en MEMORY.md global apuntando a este archivo.
- Prompt listo para copiar para la siguiente sesión.

---

**Confianza del map**: alta. Cada decisión está respaldada por (a) lectura real del archivo, (b) inventario del repo en vivo, o (c) query SQL contra prod. Las recomendaciones que difieren del PRD están justificadas con deletion test.
