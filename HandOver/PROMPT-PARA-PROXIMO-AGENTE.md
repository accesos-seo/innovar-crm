# Prompt para el próximo agente IA — Innovar CRM

> **Cómo usarlo:** Copia todo el contenido entre las líneas `---` y pégalo como tu primer mensaje al iniciar la sesión nueva. Reemplaza nada — está listo para usar.

---

Hola. Estoy continuando un trabajo de varias sesiones en mi CRM **Innovar** (gestión de cocinas, closets, mesones, cotizaciones). La sesión anterior (con Claude Sonnet 4.7, 19/05/2026) avanzó pero dejó un bug crítico abierto. Te entrego el handover formal y URLs clave para que te orientes rápido.

## Ubicaciones que necesitas

| Recurso | Path / URL |
|---|---|
| **Proyecto local** ⭐ | `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main` |
| **Informe técnico de la sesión anterior** ⭐ **LEE ESTO PRIMERO** | `HandOver/HANDOVER-2026-05-19-sesion-claude.md` (~20KB, 8 secciones, todo lo necesario) |
| **Memoria persistente del proyecto** (auto-cargada en tu contexto) | `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\project_innovar.md` |
| **Memoria general** (auto-cargada) | `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` |
| **Repo GitHub** | `https://github.com/accesos-seo/innovar-crm.git` (rama `master`) |
| **Supabase Dashboard del proyecto** | `https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye` |
| **Supabase SQL Editor** (para que me pases queries a ejecutar) | `https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/sql/new` |
| **Vercel** | `crm-innovar-app-2026.vercel.app` (auto-deploy roto: repo mismatch documentado en memoria) |

## Qué pasó en la sesión anterior — resumen general

El agente anterior heredó un handover previo con 5 prioridades. Al auditar, descubrió que **4 de las 5 ya estaban implementadas** — solo faltaba migrar TV Center y Acabados Especiales al patrón server-side de Cocinas (precios en `pricing_catalog` de Supabase en lugar de hardcoded en archivos `logic.ts`). Decidió ir más allá y migrar también Closets, Puertas Interiores y Mesones — completando la unificación arquitectónica de todo el pricing del sistema.

**Resultado de la migración:**
- 10 archivos nuevos (5 SQL migrations + 5 engines server-side)
- 13 archivos modificados (schemas, services, controller switch, hooks, logic.ts marcados @deprecated)
- 0 regresiones de TypeScript (mantiene los 37 errores baseline)
- Build de Vite pasa
- **NO desplegado todavía.** Las 5 migraciones SQL están pendientes de aplicar en Supabase Dashboard, y el código no se ha pusheado a GitHub.

**El bug que NO resolvimos:** ciertos módulos del CRM (Proyectos, Cotizaciones, Materiales, Tarifas, Festivos, Auditoría, WhatsApp) quedan en skeleton durante 30-100 segundos y terminan en error de timeout o tabla vacía. Otros módulos (Dashboard, Directorio, Pagos, Tareas, Citas) cargan rápido.

El agente probó 5 hipótesis razonables y las descartó experimentalmente:

1. ❌ `retry: 0` en hooks → removido de 21 hooks, bug persiste
2. ❌ Timeouts largos → reducidos 15s→8s y 20s→10s, bug persiste
3. ❌ Token de refresh stale → forzado signOut limpio, bug persiste
4. ❌ **RLS con recursión infinita** → desactivado en 7 tablas (`projects`, `quotations`, `quotation_items`, `materials`, `pricing_catalog`, `holidays`, `profiles`) → **bug persiste igual**
5. ❌ JOINs anidados PostgREST → `materials` y `holidays` cuelgan con `SELECT *` simple sin JOIN

Importante: **no es RLS, ya está experimentalmente descartado.** El handover tiene la tabla completa en la sección 3.2.

## Tu siguiente acción inmediata

1. **Lee `HandOver/HANDOVER-2026-05-19-sesion-claude.md` completo.** Es la fuente de verdad. Tiene timeline, evidencia experimental, paths exactos, comandos copy-paste y el plan estructurado en fases A/B/C.

2. **Confírmame si ya reactivé RLS.** Al cerrar la sesión anterior estaba pendiente que yo ejecutara el SQL `ENABLE ROW LEVEL SECURITY` en las 7 tablas. Si no lo hice, debe ser tu primera acción darme ese SQL.

3. **Arranca por la Fase A del plan en el handover.** Necesito recolectar 3 piezas de evidencia que me faltaron darle al agente anterior:
   - Output completo del bloque `🔬 DIAGNÓSTICO DE CONEXIÓN INNOVAR` en la consola del navegador (la herramienta ya está instalada en `src/lib/connection-diagnostic.ts`).
   - Screenshot de la pestaña Network de DevTools para un request a Supabase que cuelgue, expandido con Status code, Time y Response.
   - Output de la query SQL `SELECT column_name FROM information_schema.columns WHERE table_name='clients'` comparado contra los campos referenciados en `useLeads.ts` líneas 40-54 (precedente: bug `data_origin` documentado en memoria).

4. **No repitas hipótesis ya descartadas.** Si crees que vale la pena revisarlas, justifícalo con un ángulo nuevo.

## Reglas operativas que ya tiene memorizadas el sistema

- **PowerShell + OneDrive es lento.** Nunca corras git/build/deploy en background. Pásame los comandos para que los ejecute manualmente en mi terminal.
- **El MCP de Supabase NO tiene acceso al proyecto Innovar.** Solo a Light_House y Swarm Agentes MD. Para queries SQL en Innovar pásame el script y yo lo ejecuto en el SQL Editor.
- **Path correcto del proyecto** es `OneDrive\Escritorio\mi proyect\...`, NO `OneDrive\Documentos\...` (este último es solo mirror parcial con `ONBOARDING.md`).
- **`puerta` (singular) ≠ `puertas` (plural)** — singular = módulo de puertas interiores (nuevo), plural = repuestos de cocina (legacy). No mezclar.
- **Yo no programo.** Confío en tu criterio para decidir el siguiente paso. Cuando termines una tarea, sigues a la siguiente sin consultarme.

## Lo que espero de ti

Resultado optimizado, claro, estructurado, escalable. Reportes concisos. No me preguntes lo que ya está documentado en el handover. Pregunta solo lo que ese documento no aclare.

**Empieza leyendo el handover.** Después dime el plan y arrancamos.

---

*Prompt generado el 2026-05-19 al cierre de la sesión con Claude Sonnet 4.7. Si pasa demasiado tiempo entre sesiones, el bug puede haber evolucionado — el handover sigue siendo la fuente de verdad de lo que ya se descartó.*
