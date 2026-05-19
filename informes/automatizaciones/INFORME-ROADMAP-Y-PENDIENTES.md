# Roadmap y Pendientes — Innovar CRM

**Para**: Cliente Innovar / Gerencia
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Este documento es el **inventario consolidado de pendientes, mejoras sugeridas y roadmap a futuro** para Innovar CRM, identificados durante la auditoría completa del sistema realizada el 19 de mayo de 2026.

Los pendientes están **priorizados y categorizados** para facilitar la toma de decisiones de inversión y planeación.

---

## 1. Pendientes inmediatos (alta prioridad)

Tareas que conviene atender en los próximos 1-2 sprints porque tienen impacto directo en operación o seguridad.

### 1.1 Cargar inventario inicial de materiales
- **Severidad**: Alta para operación
- **Esfuerzo**: 4-8 horas (depende de la cantidad de materiales)
- **Acción**: importar desde Excel o cargar manualmente vía panel de Configuración → Materiales
- **Estado**: tabla `materials` actualmente con **0 registros**

### 1.2 Verificar columna `projects.data_origin` en producción
- **Severidad**: Media-Alta (riesgo de regresión)
- **Esfuerzo**: 5 minutos (1 SQL) + posible ajuste de código
- **Acción**: ejecutar `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='data_origin'`
- **Riesgo**: si la columna no existe, los INSERTs en proyecto pueden fallar (bug histórico documentado en `bug_innovar_data_origin_phantom_column.md`)

### 1.3 Reconectar Vercel al repositorio correcto
- **Severidad**: Media
- **Esfuerzo**: 15 minutos
- **Acción**: en el dashboard de Vercel, desconectar el repo viejo (`Rvirona/CRM-INNOVAR-APP`) y conectar a `accesos-seo/innovar-crm:master`
- **Beneficio**: auto-deploy en cada push (actualmente requiere deploy manual)

### 1.4 Verificar configuración del servidor Express
- **Severidad**: Media
- **Esfuerzo**: 30 minutos
- **Acción**: configurar variables de entorno del backend Express. El error `supabaseUrl is required` en `server/controllers/quotation.controller.ts:15` aparece en consola cuando se invoca el motor de pricing server-side.
- **Workaround actual**: el frontend tiene fallback hardcoded con los precios anteriores, por lo que las cotizaciones siguen funcionando

### 1.5 Completar entradas en `system_dictionary`
- **Severidad**: Baja-Media
- **Esfuerzo**: 1-2 horas
- **Acción**: documentar internamente cada componente del sistema (50 triggers + edge functions + cron jobs) en la tabla `system_dictionary`
- **Beneficio**: inventario centralizado consultable desde el panel de administración

---

## 2. Mejoras técnicas de mediano plazo

### 2.1 Tests automatizados de los engines de pricing
- **Esfuerzo**: 8-16 horas
- **Beneficio**: protección de regresiones matemáticas en cálculos de cotización
- **Cobertura sugerida**: los 6 motores (cocina, closet, tv_center, especiales, puerta, mesones)

### 2.2 Limpiar errores de TypeScript preexistentes
- **Esfuerzo**: 16-24 horas
- **Beneficio**: calidad de código general y prevención de bugs sutiles
- **Estado actual**: 37 errores baseline en `tsc-errors.log`

### 2.3 Mejorar handler de sesión rota
- **Esfuerzo**: ya implementado parcialmente — pulir detalles
- **Estado actual**: v3 implementado el 19/05/2026 con ventana móvil de 30s, hard fallback en 3s
- **Mejora pendiente**: telemetría de cuántas veces se dispara el recovery (métricas)

### 2.4 Agregar caso PG `42703` en `mapSupabaseError`
- **Esfuerzo**: 1 hora
- **Acción**: editar `src/lib/errors.ts::mapSupabaseError` para capturar el código `42703` (undefined_column) y devolver un error legible `SCHEMA_MISMATCH`
- **Beneficio**: futuros bugs de columnas fantasma serán obvios en consola

### 2.5 `useWhatsApp.ts` sin `withTimeout` envoltorio
- **Esfuerzo**: 30 minutos
- **Acción**: agregar `withTimeout` al query de `useWhatsApp.ts:33` para consistencia con los demás hooks
- **Beneficio**: comportamiento uniforme de timeouts en toda la app

### 2.6 Regenerar `db/supabase_schema.sql` desde producción
- **Esfuerzo**: 30 minutos
- **Acción**: ejecutar `supabase db dump --schema public > db/supabase_schema.sql`
- **Beneficio**: schema local refleja la realidad de producción (actualmente está desactualizado)

### 2.7 Consolidar `audit_log` y `audit_logs`
- **Esfuerzo**: 4-8 horas
- **Acción**: decidir cuál es la oficial, migrar datos de la otra y borrarla. Actualizar triggers para apuntar a la única
- **Beneficio**: claridad en la auditoría

---

## 3. Mejoras funcionales sugeridas

### 3.1 UI administrativa para editar `pricing_catalog`
- **Esfuerzo**: 8-16 horas
- **Beneficio**: el negocio podría editar precios desde el panel de la app en lugar de Supabase Studio
- **Ya tiene**: la pantalla existe (`/settings/pricing`) — falta verificar que esté completamente funcional

### 3.2 Filtro `is_active=true` en `PricingService.loadCatalog()`
- **Esfuerzo**: 1 hora
- **Beneficio**: permite descontinuar precios sin eliminarlos físicamente (campo `active` boolean)
- **Acción**: agregar `WHERE active=true` en la query

### 3.3 `MesonesTemplate.tsx` para PDFs de mesones
- **Esfuerzo**: 4-8 horas
- **Beneficio**: completar la feature de PDF para el módulo de mesones
- **Estado actual**: falta el template específico

### 3.4 `MesonesModule.tsx` con `initialData`
- **Esfuerzo**: 2-4 horas
- **Beneficio**: restaurar la configuración guardada cuando se reabre una cotización con mesones

### 3.5 Dashboard de monitoreo en tiempo real
- **Esfuerzo**: 16-24 horas
- **Beneficio**: ver en vivo cuántos mensajes hay en cola, cuántas tareas se escalaron, cuántos eventos por día
- **Componentes**:
  - Mensajes WhatsApp por minuto/hora/día
  - Tasa de delivery (sent vs delivered vs read)
  - Tareas escaladas por vencimiento
  - Eventos de auditoría agregados

### 3.6 Sistema de email transaccional
- **Esfuerzo**: 8-16 horas
- **Beneficio**: enviar emails de cotización, confirmaciones, reportes
- **Estado actual**: existe el trigger `tr_on_new_lead_email` pero la edge function asociada no está confirmada

### 3.7 Métricas de NPS automáticas
- **Esfuerzo**: 4-8 horas
- **Acción**: calcular NPS agregado a partir de `satisfaction_surveys.would_recommend` y mostrarlo en dashboard
- **Beneficio**: indicador clave de calidad del servicio al cliente

---

## 4. Mejoras de seguridad y hardening

### 4.1 Endurecer GRANTs SQL del rol `anon`
- **Esfuerzo**: 1-2 horas
- **Acción**: revocar `DELETE`, `TRUNCATE`, `UPDATE` del rol `anon` en todas las tablas. Solo dejar `SELECT` donde se necesite y `INSERT` puntual donde corresponda (captación de leads pública)
- **Estado actual**: el rol `anon` tiene permisos sobre-permisivos en todas las tablas inspeccionadas
- **Justificación**: aunque RLS protege actualmente, es deuda de seguridad — RLS y GRANTs son defensa en profundidad

### 4.2 Políticas Storage del bucket `avatars`
- **Esfuerzo**: 30 minutos
- **Acción**: aplicar el SQL que está en `CLAUDE.md` del proyecto para definir políticas de Storage del bucket `avatars`
- **Estado actual**: pendiente en lista de tareas

### 4.3 Rate limiting en captación pública de leads
- **Esfuerzo**: 4-8 horas
- **Acción**: agregar rate limit a la policy `Permitir captación de leads pública` para evitar abuso (ej. máximo 5 leads por IP por hora)
- **Beneficio**: previene spam y ataque DoS al formulario público

---

## 5. Performance y escalabilidad

### 5.1 Índices en columnas de filtro
- **Esfuerzo**: 2-4 horas
- **Acción**: revisar plan de queries comunes y crear índices sobre `name`, `created_at`, `user_id`, `project_id`, `client_id` donde no existan
- **Beneficio**: queries más rápidas a medida que crece el volumen

### 5.2 Particionamiento de `audit_log`
- **Esfuerzo**: 4-8 horas
- **Acción**: cuando `audit_log` supere los 100,000 registros, particionar por mes para mantener performance
- **Estado actual**: 162 registros — no urgente

### 5.3 Cache de queries frecuentes
- **Esfuerzo**: 8-16 horas
- **Acción**: implementar React Query con `staleTime` más largo para queries que cambian poco (lista de festivos, catálogo de precios)
- **Estado actual**: parcialmente implementado (staleTime 5min por defecto)

---

## 6. Documentación pendiente

### 6.1 Lista completa de Edge Functions
- **Esfuerzo**: 30 minutos
- **Acción**: revisar Dashboard de Supabase y listar todas las edge functions con su propósito
- **Beneficio**: completar el inventario de automatizaciones (actualmente 1 confirmada + 4 inferidas)

### 6.2 Diagramas de flujo
- **Esfuerzo**: 4-8 horas
- **Beneficio**: diagramas visuales de los procesos principales del negocio
- **Herramientas sugeridas**: Mermaid (texto-a-diagrama, embebible en MD)

### 6.3 Manual de mantenimiento técnico
- **Esfuerzo**: 8-16 horas
- **Audiencia**: equipo técnico interno del cliente
- **Contenido**: cómo desplegar, cómo debugear, cómo agregar nuevos módulos

### 6.4 Guías de usuario por rol
- **Esfuerzo**: 16-24 horas
- **Beneficio**: 4 manuales específicos (uno por rol) en lugar del manual general actual

---

## 7. Funcionalidades por desarrollar (nuevas)

### 7.1 Integración con sistemas contables externos
- **Beneficio**: exportar cierres contables a Siigo, ContaPyme, etc.
- **Complejidad**: alta

### 7.2 Generación de facturas electrónicas DIAN
- **Beneficio**: cumplir normatividad fiscal colombiana
- **Complejidad**: alta (requiere proveedor especializado)

### 7.3 App móvil para producción
- **Beneficio**: el equipo de planta podría actualizar estados desde el celular
- **Complejidad**: alta

### 7.4 Portal de cliente
- **Estado actual**: tracking público existe (link con token)
- **Mejora**: portal de cliente con login para ver historial completo, descargar PDFs, hacer pagos
- **Complejidad**: media

### 7.5 Importador masivo de leads
- **Beneficio**: cargar leads desde Excel/CSV
- **Complejidad**: media

### 7.6 Pricing por bodega/sucursal
- **Beneficio**: si Innovar abre nuevas sucursales con costos diferentes
- **Complejidad**: media

### 7.7 Multi-moneda
- **Beneficio**: cotizar en USD, EUR si hay clientes internacionales
- **Complejidad**: media

### 7.8 Workflow visual editor
- **Beneficio**: el negocio podría modificar flujos sin desarrollo
- **Complejidad**: muy alta

---

## 8. Roadmap sugerido por trimestre

### Q1 2026 (próximo trimestre — junio a agosto)
- ✅ Cargar inventario de materiales
- ✅ Verificar y arreglar `projects.data_origin`
- ✅ Reconectar Vercel al repo correcto
- ✅ Configurar env vars del server Express
- ✅ Endurecer GRANTs SQL
- ✅ Documentar edge functions oficialmente
- ✅ Crear tests automatizados de pricing engines

### Q2 2026 (septiembre a noviembre)
- Dashboard de monitoreo en tiempo real
- Sistema de email transaccional
- Métricas de NPS automáticas
- Consolidación de auditoría
- UI administrativa de pricing
- Diagramas de flujo de procesos

### Q3 2026 (diciembre a febrero 2027)
- Importador masivo de leads
- Generación de facturas electrónicas DIAN
- Portal de cliente con login
- Multi-moneda (si aplica)

### Q4 2026 (marzo a mayo 2027)
- Integración con sistema contable externo
- App móvil para producción
- Pricing multi-sucursal (si aplica)

---

## 9. Resumen — Priorización ejecutiva

### Imprescindibles próximos 30 días
1. Cargar materiales
2. Verificar `data_origin` en projects
3. Reconectar Vercel
4. Endurecer GRANTs

### Mejoras notables próximos 90 días
1. Tests de pricing engines
2. Dashboard de monitoreo
3. Email transaccional
4. Métricas NPS
5. Documentación oficial de edge functions

### Visión a 6-12 meses
1. Portal de cliente
2. Facturas electrónicas
3. App móvil
4. Integración contable

---

## 10. Indicadores para medir el éxito de las mejoras

| Mejora | KPI a monitorear | Meta esperable |
|---|---|---|
| Cargar materiales | Items en catálogo | >100 en 60 días |
| Endurecer GRANTs | Permisos sobre-permisivos a anon | 0 |
| Tests de pricing | Cobertura | >80% |
| Dashboard | Tiempo de respuesta a incidentes | -50% |
| Email transaccional | Tasa de delivery | >95% |
| NPS automático | NPS agregado | >60 |
| Reconectar Vercel | Deploys manuales | 0/mes |

---

## Conclusión

Innovar CRM está en un **estado funcional y estable** con automatizaciones robustas en producción. El roadmap presentado prioriza:

1. **Corto plazo**: tareas administrativas pendientes que liberan valor inmediato (materiales, env vars, GRANTs).
2. **Mediano plazo**: visibilidad operativa (dashboard, métricas) y aseguramiento de calidad (tests).
3. **Largo plazo**: expansión funcional (portal cliente, facturas, app móvil).

La inversión sugerida está distribuida para que cada trimestre entregue valor concreto al negocio sin grandes saltos de complejidad.

---

*Roadmap generado el 19 de mayo de 2026 a partir del análisis completo del sistema en producción. Las estimaciones son aproximadas y deben validarse con el equipo de desarrollo antes de comprometer plazos.*
