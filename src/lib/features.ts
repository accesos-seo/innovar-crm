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
} as const;

export type FeatureFlag = keyof typeof FEATURES;
