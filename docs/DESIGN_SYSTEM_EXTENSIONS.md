# Innovar CRM — Design System Extensions (2026-05-24)

**Documento:** Propuesta de 12 reglas adicionales para profundizar el design system  
**Para:** Revisar, ajustar, aprobar, y luego documentar en `DESIGN_SYSTEM_RULES.md` final  
**Status:** 🔵 PROPOSAL — Esperando feedback del usuario

---

## Resumen ejecutivo

El design system actual cubre:
- ✅ Input heights, border styles, spacing
- ✅ Dropdown/Select patterns
- ✅ Button variants
- ✅ Typography hierarchy
- ✅ Color semántica base

**Pero faltan:**
- ❌ Mapeo de colores POR ESTADO (pending/verified/rejected/etc)
- ❌ Iconografía estándar (qué ícono para cada acción)
- ❌ Animaciones y transiciones
- ❌ Validación visual y mensajes de error
- ❌ Responsive rules específicas
- ❌ Catálogo de componentes reutilizables
- ❌ Patrón de toasts/notificaciones
- ❌ Convenciones de wording/copy
- ❌ Confirmaciones destructivas
- ❌ Empty states
- ❌ Data display (tablas)
- ❌ Loading states

Estas 12 extensiones **evitan que la IA invente** en cada una de estas áreas.

---

## 1. STATE COLORS & BADGES

### Problema
Cada estado visual diferente del sistema actualmente se ve sin reglas claras:
- Un payment "pending" podría ser amarillo o naranja
- Un quotation "cancelled" podría ser rojo o gris
- Los iconos y labels van por sidebar/modal

### Solución
```typescript
// src/lib/state-config.ts — CENTRALIZADO

export const PAYMENT_STATE_CONFIG = {
  pending: {
    color: "bg-amber-100 text-amber-900",
    icon: "Clock", // lucide-react
    label: "Pendiente de verificación",
    tooltip: "En proceso de validación. El cliente debe enviar comprobante.",
  },
  verified: {
    color: "bg-emerald-100 text-emerald-900",
    icon: "CheckCircle2",
    label: "Verificado",
    tooltip: "Validado. Se creará el proyecto automáticamente.",
  },
  rejected: {
    color: "bg-red-100 text-red-900",
    icon: "XCircle",
    label: "Rechazado",
    tooltip: "No válido. Se notificará al cliente.",
  },
};

export const QUOTATION_STATE_CONFIG = {
  draft: {
    color: "bg-slate-100 text-slate-900",
    icon: "FileText",
    label: "Borrador",
  },
  sent: {
    color: "bg-blue-100 text-blue-900",
    icon: "Send",
    label: "Enviada",
  },
  client_approved: {
    color: "bg-emerald-100 text-emerald-900",
    icon: "CheckCircle2",
    label: "Aprobada por cliente",
  },
  pending_payment: {
    color: "bg-amber-100 text-amber-900",
    icon: "Clock",
    label: "En espera de pago",
  },
  cancelled: {
    color: "bg-gray-100 text-gray-900",
    icon: "Ban",
    label: "Cancelada",
  },
  superseded: {
    color: "bg-indigo-100 text-indigo-900",
    icon: "GitBranch",
    label: "Reemplazada",
  },
};

// Uso en componentes:
<Badge 
  variant="default" 
  className={PAYMENT_STATE_CONFIG[payment.status].color}
>
  <Icon name={PAYMENT_STATE_CONFIG[payment.status].icon} className="w-3 h-3 mr-2" />
  {PAYMENT_STATE_CONFIG[payment.status].label}
</Badge>
```

### Checklist
- [ ] Estados mapeados con color + icono + label + tooltip
- [ ] Archivo centralizado en `src/lib/state-config.ts`
- [ ] Jamás hardcodear "bg-yellow-100" o icono en un componente
- [ ] La IA valida estados contra este archivo antes de usarlos

---

## 2. ICONOGRAFÍA ESTÁNDAR

### Problema
Cada acción podría tener un ícono diferente:
- "Confirmar" → Check? CheckCircle? CheckCircle2? ✓?
- "Eliminar" → Trash? Trash2? Delete? X?
- "Cargar" → Upload? Plus? File?

### Solución
```typescript
// src/lib/icon-map.ts

export const ICON_MAP = {
  // CRUD
  create: "Plus",
  read: "Eye",
  edit: "Pencil",
  delete: "Trash2",
  
  // Confirmación
  confirm: "CheckCircle2",
  cancel: "X",
  back: "ArrowLeft",
  close: "X",
  
  // Estados
  pending: "Clock",
  success: "CheckCircle2",
  error: "AlertCircle",
  warning: "AlertTriangle",
  info: "Info",
  
  // Datos
  download: "Download",
  upload: "Upload",
  search: "Search",
  filter: "Filter",
  
  // UI
  menu: "Menu",
  settings: "Settings",
  more: "MoreVertical",
  sort: "ArrowUpDown",
  
  // Acciones específicas
  verify: "Check",
  reject: "Ban",
  send: "Send",
  edit_inline: "Pencil",
  duplicate: "Copy",
  archive: "Archive",
  restore: "RefreshCw",
};

// Uso:
import { icons } from "lucide-react";
const IconComponent = icons[ICON_MAP.verify];
<IconComponent className="w-4 h-4" />

// O con componente wrapper:
<Icon name={ICON_MAP.verify} />
```

### Checklist
- [ ] Archivo `src/lib/icon-map.ts` creado
- [ ] Todas las acciones que necesitas listadas
- [ ] Jamás `<Plus />` directo — usar `<Icon name={ICON_MAP.create} />`
- [ ] Si necesitas un icono nuevo, agregarlo al mapa ANTES de usarlo

---

## 3. ANIMACIONES ESTÁNDAR

### Problema
Framer-motion sin reglas:
- Un modal podría entrar con `fadeIn` o `slideUp`
- Un botón podría tener hover instantáneo o con transición
- Inconsistencia visual

### Solución
```typescript
// src/lib/animations.ts

export const ANIMATIONS = {
  // Page transitions
  pageEnter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  
  // Modal/Dialog
  modalEnter: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.15, ease: "easeInOut" },
  },
  
  // Hover effects (via CSS, no framer)
  // Use Tailwind: transition-all duration-150 ease-in-out
  
  // Loading spinner
  spinnerRotate: {
    animate: { rotate: 360 },
    transition: { duration: 2, repeat: Infinity, ease: "linear" },
  },
  
  // Toast entrance
  toastSlideIn: {
    initial: { x: 400, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 400, opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  // Error shake
  shake: {
    animate: { x: [0, -10, 10, -10, 0] },
    transition: { duration: 0.2 },
  },
};

// Uso:
<motion.div {...ANIMATIONS.pageEnter}>
  <LeadCreate />
</motion.div>

<motion.div {...ANIMATIONS.modalEnter}>
  <Dialog>
    {/* Modal content */}
  </Dialog>
</motion.div>
```

### Checklist
- [ ] Durations estándar: 200ms para page, 150ms para modal, 2s para spinner
- [ ] Easing: easeOut entrada, easeInOut modales
- [ ] Hover: siempre `transition-all duration-150` en Tailwind
- [ ] Jamás animaciones por encima de 300ms (siente lenta)
- [ ] La IA valida contra este archivo

---

## 4. VALIDACIÓN & ERROR MESSAGES

### Problema
Mensajes genéricos o inconsistentes:
- "Error al guardar"
- "Formato incorrecto"
- "Campo requerido"

### Solución
```typescript
// src/lib/validation-messages.ts

export const VALIDATION_MESSAGES = {
  // Generic
  required: (field: string) => `${field} es obligatorio`,
  invalid_format: (field: string) => `Formato de ${field} inválido`,
  
  // Specific
  email: "Formato de email inválido (ej: user@ejemplo.com)",
  phone: "Teléfono incompleto (formato +código país + número)",
  phone_with_country: (country: string) => 
    `Teléfono debe incluir código ${country} (ej: +57XXXXXXXXXX)`,
  url: "URL inválida (ej: https://ejemplo.com)",
  
  // Numbers
  min_value: (field: string, min: number) => 
    `${field} debe ser al menos ${min}`,
  max_value: (field: string, max: number) => 
    `${field} no puede superar ${max}`,
  min_length: (field: string, len: number) => 
    `${field} debe tener al menos ${len} caracteres`,
  max_length: (field: string, len: number) => 
    `${field} no puede superar ${len} caracteres`,
  
  // Conditional
  conditional_required: (field1: string, field2: string) =>
    `${field1} es obligatorio cuando ${field2} está seleccionado`,
};

// Uso en Zod:
const schema = z.object({
  email: z.string().email(VALIDATION_MESSAGES.email),
  phone: z.string().regex(
    /^\+\d{11,15}$/,
    VALIDATION_MESSAGES.phone
  ),
});

// En Toast:
toast.error("No pudimos guardar", {
  description: VALIDATION_MESSAGES.email
});
```

### Checklist
- [ ] Todos los mensajes centralizados
- [ ] Mensajes específicos (no genéricos)
- [ ] Incluir ejemplos en el error ("ej: +57XXXXXXXXXX")
- [ ] Toast error + descripción específica (nunca solo título)

---

## 5. RESPONSIVE DESIGN

### Problema
Layouts que se ven mal en mobile/tablet sin reglas claras.

### Solución
```typescript
// BREAKPOINTS (Tailwind estándar)
// Mobile: <640px (default, no prefijo)
// Tablet: ≥768px (md:)
// Desktop: ≥1024px (lg:)
// XL: ≥1280px (xl:)

// REGLAS ESPECÍFICAS

// Inputs
// ❌ w-64 (se rompe en mobile)
// ✅ w-full (mobile) → md:w-80 (tablet)

// Grid
// ❌ grid-cols-3 (muy apretado en mobile)
// ✅ grid-cols-1 md:grid-cols-2 lg:grid-cols-3

// Buttons
// ❌ px-8 py-2 (toca bordes en mobile)
// ✅ w-full sm:w-auto px-4 sm:px-8

// Fonts
// ❌ text-lg siempre
// ✅ text-sm md:text-base lg:text-lg

// Modals
// ❌ max-w-2xl (no cabe en mobile)
// ✅ max-w-lg md:max-w-2xl (o usar full width con padding)

// Tables
// ❌ nunca mostrar todas las columnas en mobile
// ✅ Horizontal scroll O stack vertical en mobile

// Ejemplo correcto:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Items aquí */}
</div>

<div className="w-full md:w-80">
  <Input placeholder="..." />
</div>

<button className="w-full sm:w-auto px-4 sm:px-8 h-12">
  Enviar
</button>

// Para modales:
<DialogContent className="w-full mx-4 max-w-lg">
  {/* Content */}
</DialogContent>
```

### Checklist
- [ ] Nunca width fijo (siempre `w-full` base)
- [ ] Grids siempre responden: `cols-1 md:cols-2 lg:cols-3`
- [ ] Padding en mobile: `px-4` base, `md:px-8` desktop
- [ ] Fonts cambian: `text-sm md:text-base`
- [ ] Testear en: 375px (iPhone), 768px (tablet), 1024px (desktop)

---

## 6. CATÁLOGO DE COMPONENTES REUTILIZABLES

### Problema
Crear un componente nuevo cuando ya existe uno similar.

### Solución
```typescript
// INVENTORY OF COMPONENTS (en docs/COMPONENT_INVENTORY.md)

// BUTTONS
PrimaryButton
  → uso: CTAs principales (registrar, guardar, enviar)
  → props: label, icon, loading, disabled
  → ej: <PrimaryButton label="Registrar" icon={Zap} />

Button variant="default"
  → uso: acciones secundarias
  → props: children, disabled

Button variant="outline"
  → uso: acciones terciarias
  → props: children

Button variant="ghost"
  → uso: cancelar, volver, dismiss
  → props: children

Button variant="destructive"
  → uso: confirmar eliminar/rechazar
  → props: children

// INPUTS
Input
  → uso: texto, números, emails simple
  → props: placeholder, type, disabled

EmailInputField
  → uso: SIEMPRE para emails (valida automáticamente)
  → props: label, placeholder, error

WhatsAppField
  → uso: SIEMPRE para teléfonos (selector código país)
  → props: label, countries, onChange, initialValue

Textarea
  → uso: textos largos, motivos, notas
  → props: placeholder, rows

// SELECTS
Select + SelectTrigger + SelectContent + SelectItem
  → uso: dropdowns
  → props: onValueChange, value

// CHECKS
Checkbox
  → uso: toggles, multi-select (en grid)
  → props: checked, onCheckedChange

RadioGroup + RadioGroupItem + Label
  → uso: single-select (vertical o horizontal)
  → props: value, onValueChange

// FEEDBACK
Badge
  → uso: estados, tags, etiquetas
  → props: variant, children

Dialog + DialogContent + DialogHeader + DialogTitle + DialogFooter
  → uso: modales
  → props: open, onOpenChange

// DISPLAY
DataTable
  → uso: tablas de datos
  → props: columns, data, enableSort, enableFilter

EmptyState
  → uso: cuando no hay resultados
  → props: icon, title, description, cta

DetailView / FullscreenDetail
  → uso: vistas detalladas (lectura)
  → props: data, title

// CUSTOM (Innovar-specific)
DetailModal
  → uso: edición inline de detalles
  → props: open, data, fields, onSave

DetailModalInlineEdit
  → uso: editar campos individuales
  → props: field, value, onSave

PremiumModalShell
  → uso: modales premium con estilo marca
  → props: open, title, children

CategoryHeader
  → uso: header de páginas con icon
  → props: title, subtitle, icon, onBack

FilterSheet
  → uso: filtros desplegables
  → props: filters, onApply

// NEVER CREATE:
❌ `CustomButton` (usa Button + PrimaryButton)
❌ `SmartInput` (usa Input + EmailInputField + WhatsAppField)
❌ `PopupModal` (usa Dialog)
❌ `CardContainer` (usa card class)
```

### Checklist
- [ ] Inventario documentado
- [ ] Jamás crear si ya existe
- [ ] Si necesitas variante nueva, extender existente (variant prop)
- [ ] La IA valida contra este inventario

---

## 7. TOASTS & NOTIFICACIONES

### Problema
Toasts genéricos sin contexto.

### Solución
```typescript
// src/lib/toast-patterns.ts

import { toast } from "sonner";

export const ToastPatterns = {
  // Success
  successSave: (entity: string = "cambios") => {
    toast.success(`${entity} guardado`, {
      description: `Se guardó correctamente.`,
    });
  },
  
  successCreate: (entity: string) => {
    toast.success(`${entity} creado`, {
      description: `Se creó exitosamente. Puedes verlo en la lista.`,
    });
  },
  
  successDelete: (entity: string) => {
    toast.success(`${entity} eliminado`, {
      description: `Se eliminó correctamente.`,
    });
  },
  
  // Errors
  errorSave: (reason?: string) => {
    toast.error("No pudimos guardar", {
      description: reason || "Revisa los datos e intenta nuevamente.",
    });
  },
  
  errorNetwork: () => {
    toast.error("Problema de conexión", {
      description: "Revisa tu conexión a internet.",
    });
  },
  
  errorUnauthorized: () => {
    toast.error("No tienes permisos", {
      description: "Contacta al administrador si crees que es un error.",
    });
  },
  
  // Warnings
  warningUnsavedChanges: () => {
    toast("Cambios sin guardar", {
      description: "Usa 'Guardar' antes de salir de esta página.",
    });
  },
  
  // Info
  infoProcessing: (action: string) => {
    toast.info(`${action}...`, {
      description: "Por favor espera.",
    });
  },
};

// Uso:
try {
  await savePayment();
  ToastPatterns.successSave("Pago");
} catch (error) {
  ToastPatterns.errorSave(error.message);
}
```

### Checklist
- [ ] Success: verde, icono checkmark, duración 3s
- [ ] Error: rojo, icono X, duración 5s
- [ ] Warning: naranja, icono alerta, duración 7s
- [ ] Info: azul, icono info, duración 4s
- [ ] SIEMPRE: título + descripción (nunca solo título)
- [ ] Descripción específica (qué pasó, qué hacer)

---

## 8. WORDING & COPY CONVENTIONS

### Problema
Tone of voice inconsistente, labels no estándar.

### Solución
```typescript
// src/lib/copy.ts

export const COPY = {
  // BUTTONS
  buttons: {
    save: "Guardar",
    cancel: "Cancelar",
    back: "Volver",
    create: "Crear",
    edit: "Editar",
    delete: "Eliminar",
    close: "Cerrar",
    confirm: "Confirmar",
    submit: "Enviar",
    search: "Buscar",
    filter: "Filtrar",
    reset: "Restablecer",
    export: "Exportar",
    import: "Importar",
    download: "Descargar",
    upload: "Cargar archivo",
    retry: "Reintentar",
    next: "Siguiente",
    prev: "Anterior",
    continue: "Continuar",
  },
  
  // LABELS
  labels: {
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    date: "Fecha",
    time: "Hora",
    status: "Estado",
    priority: "Prioridad",
    description: "Descripción",
    notes: "Notas",
    attachments: "Archivos adjuntos",
  },
  
  // PLACEHOLDERS
  placeholders: {
    search: "Buscar por nombre, email, teléfono...",
    email: "ejemplo@correo.com",
    name: "Ej. Carlos Rodríguez",
    phone: "Ej. +57 300 123 4567",
    message: "Escribe tu mensaje aquí...",
  },
  
  // EMPTY STATES
  empty: {
    noData: "Sin resultados",
    noDataDescription: "No hay datos para mostrar. Intenta ajustar tus filtros.",
    noPagosDescription: "Los pagos aparecerán aquí cuando los clientes envíen los comprobantes.",
    noNotificationsDescription: "Tu bandeja está vacía. No hay nuevas notificaciones.",
  },
  
  // CONFIRMATIONS
  confirmations: {
    deleteItem: (item: string) => `¿Eliminar ${item}? Esta acción no se puede deshacer.`,
    cancelAction: (action: string) => `¿Cancelar ${action}? Esta acción no se puede deshacer.`,
  },
  
  // ERRORS
  errors: {
    required: (field: string) => `${field} es obligatorio`,
    invalid: (field: string) => `${field} no es válido`,
    tryAgain: "Intenta nuevamente en unos segundos.",
    contactSupport: "Si el problema persiste, contacta al soporte.",
  },
  
  // LOADING
  loading: {
    saving: "Guardando...",
    processing: "Procesando...",
    loading: "Cargando...",
    submitting: "Enviando...",
  },
};

// Uso:
<Button>{COPY.buttons.save}</Button>
<FormLabel>{COPY.labels.name}</FormLabel>
<Input placeholder={COPY.placeholders.email} />
toast.error(COPY.errors.required("Nombre"))
```

### Checklist
- [ ] NUNCA: "OK", "Error", "Hecho"
- [ ] SÍ: "Guardar", "Proceso completado", "Volver"
- [ ] SIEMPRE específico: no "Formato incorrecto" sino "Email debe ser usuario@dominio.com"
- [ ] UI siempre en español (database en inglés)
- [ ] Tone amigable, profesional (no robótico)

---

## 9. CONFIRMACIONES DESTRUCTIVAS

### Problema
Usuarios eliminando/cancelando sin querer.

### Solución
```typescript
// Componente QuotationCancelModal.tsx (patrón a seguir)

export function DestructiveConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "Motivo (opcional)",
  confirmLabel = "Confirmar",
  isLoading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  reasonLabel?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  
  const handleConfirm = () => {
    onConfirm(reason);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <DialogTitle className="text-lg font-bold">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
        
        <FormItem className="mt-4">
          <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
            {reasonLabel}
          </FormLabel>
          <Textarea
            placeholder="Escribe aquí..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-24 rounded-none border-border/50"
          />
        </FormItem>
        
        <DialogFooter className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-none"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-12 rounded-none"
          >
            {isLoading ? "Confirmando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Uso:
<DestructiveConfirmationModal
  open={openCancel}
  onOpenChange={setOpenCancel}
  title="¿Cancelar aceptación?"
  description="Esto marcará la cotización como cancelada. El cliente NO podrá proceder con el pago."
  reasonLabel="Motivo de cancelación"
  confirmLabel="Confirmar cancelación"
  onConfirm={(reason) => handleCancel(reason)}
/>
```

### Checklist
- [ ] Icono warning (AlertTriangle rojo)
- [ ] Título claro: "¿Confirmar [acción]?"
- [ ] Descripción: qué pasará después
- [ ] Textarea opcional: motivo/comentario
- [ ] 2 botones: "Cancelar" (ghost) + "Confirmar" (destructive rojo)
- [ ] Jamás hacer destructivo sin confirmación explícita

---

## 10. EMPTY STATES

### Problema
Usuarios confundidos cuando no hay datos.

### Solución
```typescript
// src/components/EmptyState.tsx (ya existe, reforzar)

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  cta?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
          {description}
        </p>
      )}
      {cta && (
        <Button onClick={cta.onClick}>
          {cta.icon && <span className="mr-2">{cta.icon}</span>}
          {cta.label}
        </Button>
      )}
    </div>
  );
}

// Uso:
{payments.length === 0 ? (
  <EmptyState
    icon={<Inbox className="w-12 h-12" />}
    title="No hay pagos por verificar"
    description="Los pagos aparecerán aquí cuando los clientes envíen el comprobante."
    cta={{
      label: "Volver a Pagos",
      onClick: () => navigate("/pagos"),
      icon: <ArrowLeft className="w-4 h-4" />,
    }}
  />
) : (
  <PaymentsList payments={payments} />
)}
```

### Checklist
- [ ] Icono descriptivo
- [ ] Título claro (no genérico)
- [ ] Descripción: qué pueden hacer
- [ ] CTA opcional: dónde ir
- [ ] Usar EmptyState component existente

---

## 11. DATA DISPLAY (Tablas/Listas)

### Problema
Tablas con alturas inconsistentes, sin hover, headers pequeños.

### Solución
```typescript
// REGLAS para DataTable
- Header: uppercase, font-bold, text-[10px], bg-muted/50
- Row height: h-12 (consistente con inputs)
- Row hover: bg-muted/50 transition-colors
- Padding: px-4, py-3 (simétrico)
- Columnas de acción (últimas 3):
  - Edit: Pencil icon
  - Delete: Trash2 icon (solo si hay permisos)
  - View: Eye icon
- Gap entre celdas: espacio claro
- Sortable columns: icono ArrowUpDown pequeño

// Ejemplo HTML:
<table className="w-full">
  <thead className="bg-muted/50 border-b border-border/50">
    <tr>
      <th className="text-[10px] font-bold uppercase px-4 py-3">Nombre</th>
      <th className="text-[10px] font-bold uppercase px-4 py-3">Email</th>
      <th className="text-[10px] font-bold uppercase px-4 py-3">Acciones</th>
    </tr>
  </thead>
  <tbody>
    <tr className="h-12 hover:bg-muted/50 border-b border-border/50 transition-colors">
      <td className="px-4 py-3">Carlos</td>
      <td className="px-4 py-3">carlos@ejemplo.com</td>
      <td className="px-4 py-3 flex gap-2">
        <Button size="sm" variant="ghost"><Pencil /></Button>
        <Button size="sm" variant="ghost"><Trash2 /></Button>
      </td>
    </tr>
  </tbody>
</table>
```

### Checklist
- [ ] Headers: uppercase, bold, small
- [ ] Rows: h-12, hover state, border-bottom
- [ ] Actions column: 3 iconos máximo (edit, delete, view)
- [ ] Usar DataTable component si existe
- [ ] Responsive: horizontal scroll en mobile

---

## 12. LOADING STATES

### Problema
Estados sin feedback claro mientras se procesa.

### Solución
```typescript
// Patrones

// SKELETON
<Skeleton className="h-12 w-full rounded-none" />

// SPINNER + TEXT
<div className="flex items-center gap-2">
  <Loader className="w-4 h-4 animate-spin" />
  <span className="text-sm text-muted-foreground">Guardando...</span>
</div>

// BUTTON LOADING
<PrimaryButton
  label="Guardar"
  loading={isSaving}
  disabled={isSaving}
/>

// DISABLED INPUT
<Input disabled className="opacity-50 cursor-not-allowed" />

// FULL PAGE SKELETON
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
) : (
  <Form>{/* content */}</Form>
)}

// REGLAS
- Máximo 2 segundos antes de mostrar fallback
- Spinner siempre con texto explicativo
- No dejar loading infinito (timeout + error)
- Disabled state: cursor-not-allowed + opacity-50
```

### Checklist
- [ ] Skeleton para carga de datos
- [ ] Spinner + texto para acciones
- [ ] Button muestra loading state
- [ ] Inputs deshabilitados durante guardado
- [ ] Timeout máximo 2s + fallback si falla

---

## 📊 TABLA RESUMEN: Qué se agrega y por qué

| Categoría | Problema actual | Solución | Beneficio |
|-----------|---|---|---|
| 1. State Colors | Sin mapeo → colores al azar | `state-config.ts` centralizado | Consistencia visual, jamás inventa colores |
| 2. Iconografía | Ícono diferente por acción | `icon-map.ts` mapeo | Ícono same para same acción siempre |
| 3. Animaciones | Sin reglas de timing | `animations.ts` con duraciones | Transiciones predecibles, no lentas |
| 4. Validación | Mensajes genéricos | `validation-messages.ts` específico | Usuario entiende qué está mal |
| 5. Responsive | Layouts rotos en mobile | Breakpoint rules + checklist | Funciona en 375px, 768px, 1280px |
| 6. Componentes | Crear duplicate components | Inventory + "jamás crear sin revisar" | Reutilización, no overhead |
| 7. Toasts | "Error al guardar" genérico | `toast-patterns.ts` con contexto | Usuario sabe qué pasó y qué hacer |
| 8. Copy | Tone inconsistente | `copy.ts` centralizado | Voz profesional, consistente |
| 9. Confirmaciones | Sin protección destructiva | Modal warning + razón | Usuario no elimina por error |
| 10. Empty states | Bandeja vacía confunde | EmptyState + descripción + CTA | Usuario sabe qué hacer |
| 11. Data display | Tablas desordenadas | Row height, headers, hover rules | Profesional, escaneable |
| 12. Loading | Sin feedback claro | Skeleton, spinner, disabled state | Usuario no cree que se colgó |

---

## ✅ SIGUIENTE PASO

¿Cuáles de estas 12 categorías quieres que incorporemos PRIMERO?

**Opciones:**
1. **Las 12 juntas** — Documento DESIGN_SYSTEM_COMPLETE.md con todo + ejemplos
2. **Por prioridad** — ¿Cuáles son más críticas para S3.2.b?
3. **Iterativo** — Empezamos con 1-2 (State Colors, Iconografía) y avanzamos

Mi recomendación: **State Colors + Iconografía + Validación** son las que EVITAN MÁS errores. Las otras 9 son importantes pero más "nice to have".

¿Qué prefieres?
