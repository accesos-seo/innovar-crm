// Feature flags para el cutover por slice del rediseño Lead → Proyecto.
// Cada flag se activa solo en su slice correspondiente. Todos arrancan en
// false (slice 1 = silencioso, solo DB). Ver
// docs/architecture/lead-to-project-refactor-map.md §6 para el plan.
export const FEATURES = {
  opportunitiesEnabled:       import.meta.env.VITE_FF_OPPORTUNITIES === 'true',
  visitsEnabled:              import.meta.env.VITE_FF_VISITS === 'true',
  publicBookingEnabled:       import.meta.env.VITE_FF_PUBLIC_BOOKING === 'true',
  quotationVersionsEnabled:   import.meta.env.VITE_FF_QUOTATION_VERSIONS === 'true',
  paymentVerificationEnabled: import.meta.env.VITE_FF_PAYMENT_VERIFICATION === 'true',
  agentA05Enabled:            import.meta.env.VITE_FF_AGENT_A05 === 'true',
  // Fase 4 — Cotización y Aprobación del Proyecto (cubre Slices 2-5 completos).
  // Cuando OFF: la ruta /cotizacion/:token devuelve 404, los botones de envío/lock
  // no aparecen en el CRM, y el flujo legacy (WhatsApp manual) sigue funcionando igual.
  phase4QuotationPublicEnabled: import.meta.env.VITE_FF_PHASE_4_QUOTATION_PUBLIC === 'true',
  // Portal del Cliente "Mi Proyecto" (migración 053 + EF public-project-tracking).
  // Cuando OFF: /proyecto/:token devuelve el 404 amable y el card interno no aparece.
  clientPortalEnabled: import.meta.env.VITE_FF_CLIENT_PORTAL === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURES;
