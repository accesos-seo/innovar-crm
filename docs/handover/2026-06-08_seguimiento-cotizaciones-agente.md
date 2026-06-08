# Handoff — Agente: Seguimiento de Cotizaciones D+3/D+7
**Fecha:** 2026-06-08  
**Rama:** `ux-fixes`  
**Commit:** `c796e4b`  
**Estado:** ✅ Completo — build limpio, workflow activo, EF desplegada

---

## Qué se construyó

El módulo "Seguimiento de Cotizaciones" pasó de ser una página con tabla estática a un **panel de control operativo real**. Ahora tiene 4 capacidades nuevas conectadas a infraestructura real:

### 1. Workflow n8n — D+3/D+7 (backend real)
- **ID:** `LwKmUoeNc2TQqERQ`
- **Nombre:** "Innovar — Seguimiento Cotizaciones D+3/D+7"
- **Estado actual:** ACTIVO, `DRY_RUN=true`
- **Cron:** todos los días a las 9:00 AM Bogotá
- **Webhook:** `https://estancias-atlas-n8n.heh8a3.easypanel.host/webhook/seguimiento-cotizaciones`
- **Lógica de clasificación:**
  - D+3: cotizaciones pendientes con 3–6 días desde creación
  - D+7: cotizaciones pendientes con 7+ días desde creación
  - Skipea cotizaciones alertadas en las últimas 12 horas (evita spam)
- **Con DRY_RUN=true:** clasifica, loguea y responde qué haría, pero NO inserta en cola WhatsApp ni actualiza `alert_sent_at`
- **Para activar producción:** en n8n, nodo "Config", cambiar `DRY_RUN` a `false`. Requiere que `slice_3_enabled=true` y templates Meta aprobadas.

### 2. Toggle ON/OFF en el panel (UI ↔ n8n real)
- Botón en el header del panel de configuración
- Llama al proxy Supabase → n8n API para activar/desactivar el workflow
- Refleja el estado real del workflow al cargar la página
- Muestra punto verde/gris según estado activo/inactivo

### 3. Botón "Ejecutar ahora"
- Llama al webhook con `{all: true}`
- Muestra spinner mientras procesa
- Loguea el resultado de la última ejecución (con timestamp, conteo, log de items)

### 4. Botón "Recordatorio" por fila
- En cada cotización de la tabla, botón de acción que llama al webhook con `{quotation_id: <id>}`
- El workflow clasifica solo esa cotización y la procesa
- Mientras cualquier recordatorio está en proceso, todos los botones quedan deshabilitados (evita doble envío)

---

## Arquitectura de seguridad

```
Frontend (React)
    │
    ├── VITE_AGENT_SEGUIMIENTO_WORKFLOW_ID  ← solo un ID, no secreto
    ├── VITE_N8N_BASE_URL                   ← hostname público, no secreto
    │
    └── Llama a: Supabase EF n8n-proxy (con anon key)
                        │
                        └── N8N_TOKEN (Supabase Vault) → n8n API
```

**Regla:** El JWT de n8n NUNCA llega al browser. El token vive solo en Supabase Vault, lo lee la Edge Function server-side.

---

## Archivos modificados / creados

| Archivo | Cambio |
|---|---|
| `src/pages/SeguimientoCotizaciones.tsx` | Reescritura completa — 4 features operativos |
| `supabase/functions/n8n-proxy/index.ts` | Nueva EF — proxy seguro para n8n API |
| `.env` | Agregadas `VITE_N8N_BASE_URL` + `VITE_AGENT_SEGUIMIENTO_WORKFLOW_ID` |

El `.env` no se commitea (tiene credenciales). Los valores nuevos que necesita el proyecto local:
```
VITE_N8N_BASE_URL=https://estancias-atlas-n8n.heh8a3.easypanel.tool
VITE_AGENT_SEGUIMIENTO_WORKFLOW_ID=LwKmUoeNc2TQqERQ
```

---

## Infraestructura desplegada

### Edge Function `n8n-proxy`
- **Proyecto:** `xdzbjptozeqcbnaqhtye` (Innovar CRM)
- **Deployada:** ✅ `2026-06-08`
- **GET** `?workflow_id=X` → devuelve estado del workflow (active: true/false)
- **POST** `?workflow_id=X` con `{action: 'activate'|'deactivate'}` → togglea el workflow

### Secret `N8N_TOKEN` en Supabase Vault
- Cargado vía Management API (`2026-06-08`)
- Accesible desde la EF como `Deno.env.get('N8N_TOKEN')`

---

## Estado de activación (pendientes antes de producción)

| Condición | Estado |
|---|---|
| `slice_3_enabled` en Supabase | `FALSE` — intencional hasta templates aprobadas |
| Templates Meta WhatsApp | Ver `innovar_meta_templates_pendientes.md` — Heduin responsable |
| `DRY_RUN` en workflow n8n | `true` — cambiar a `false` cuando ambas condiciones anteriores estén OK |
| Template `quotation_expiry_3d` | **APROBADA** ✅ — ya lista para D+3 |

---

## Cómo verificar que funciona (DRY_RUN)

1. Abrir el CRM en la página `/agentes/seguimiento-cotizaciones`
2. El toggle debe mostrar el estado real del workflow (verde = activo)
3. Clic en "Ejecutar ahora" → debe aparecer un log con cuántas cotizaciones clasificó y cuáles son D+3 vs D+7
4. En la tabla, botón "Recordatorio" en cualquier fila → log del resultado para esa cotización
5. En n8n → workflow "Innovar — Seguimiento Cotizaciones D+3/D+7" → últimas ejecuciones

---

## Próximos pasos

1. **Aprobar templates Meta** faltantes (Heduin) → ver `innovar_meta_templates_pendientes.md`
2. **Activar producción:** cuando templates OK → `slice_3_enabled=true` + `DRY_RUN=false` en n8n
3. **Push y deploy:** `git push origin ux-fixes` cuando Robert dé el OK → Vercel auto-deploy
