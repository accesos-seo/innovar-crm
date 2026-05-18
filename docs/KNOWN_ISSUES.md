# 🐛 Known Issues — Ruido y problemas conocidos

> Si ves algo raro en producción, **busca aquí primero**. Si no está, agrégalo cuando lo resuelvas.
>
> Este archivo guarda 2 tipos de cosas:
> 1. **Ruido externo** — errores que parecen bugs pero no lo son (extensiones, scripts de terceros, etc.)
> 2. **Bugs conocidos sin resolver** — los reales, con plan de fix

---

## 1. 🟢 Ruido externo (NO son bugs del CRM)

### 1.1 Errores de extensiones de navegador en consola

**Síntoma**:
```
[FrameManager] Failed to get frame manager configuration.
    injected.js:4

Unchecked runtime.lastError: Could not establish connection.
Receiving end does not exist.
```

**Origen**: Extensiones de Chrome inyectadas en la página. Patrones que lo delatan:
- Archivo `injected.js` (nombre estándar de scripts de extensión)
- `chrome.runtime.lastError` (API exclusiva de extensiones)
- Aparecen en TODA URL, no en una específica
- Aparecen también en otros sitios web

**Extensiones candidatas habituales**:
- Password managers (LastPass, 1Password, Bitwarden)
- Grabadores de sesión (Loom, Tango, Selene)
- Bloqueadores de ads (uBlock, AdGuard)
- Asistentes de IA (Grammarly, ChatGPT for Chrome)

**Cómo verificar** (30 segundos):
1. Abre la app en modo **incógnito** (Ctrl+Shift+N) — Chrome no carga extensiones
2. Si los errores desaparecen → es extensión, ignorar
3. Si persisten → reporta como bug real

**Impacto**: ❌ Ninguno. La app funciona perfectamente. Solo molesta visualmente en DevTools.

**¿Por qué no los silenciamos?**: porque no podemos. Las extensiones se ejecutan en un contexto fuera del control de la página. Solo el dueño del navegador puede desinstalarlas.

**Mitigación a futuro**: cuando integremos **Sentry** (planificado en Fase 3), configuraremos `ignoreErrors` para filtrar estos patrones automáticamente y que no contaminen los reportes de producción.

---

### 1.2 Warning de React DevTools en producción

**Síntoma**: `Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools`

**Origen**: el bundle de desarrollo de React. En producción aparece si el build no se hizo en modo `production`.

**Mitigación**: el deploy en Vercel debería usar `npm run build` que ya compila en modo producción. Si el mensaje aparece, verificar que las variables de entorno de Vercel estén correctas.

---

### 1.3 `Refresh Token Not Found` / `Invalid Refresh Token` en consola

**Síntoma**: aparece en la consola al cargar la app por primera vez tras varios días sin uso.

**Origen**: el token de sesión de Supabase expiró. **Es comportamiento esperado.**

**Manejo en el código**: `src/lib/supabaseClient.ts` intercepta este error específicamente y limpia el `localStorage`. El usuario es redirigido a `/login` automáticamente.

**Impacto**: ❌ Ninguno funcional. Solo un mensaje en consola.

---

## 2. ⚠️ Bugs conocidos sin resolver

### 2.1 ⚠️ Trigger `handle_new_user` asigna rol `admin` por defecto

**Severidad**: 🔴 Crítico (escalada de privilegios)

**Estado**: El frontend ya se corrigió en Fase 1 para asignar `'comercial'`. El **trigger de Postgres** todavía asigna `'admin'`.

**Impacto**: si alguien se registra directamente vía Supabase Auth (no a través del flujo de usuarios del CRM), obtiene rol `admin`.

**Mitigación temporal**: el frontend re-asigna `'comercial'` después si detecta que es la primera vez del usuario. Pero esto solo funciona si el flujo pasa por `authStore.ensureProfile`.

**Fix definitivo**: migración SQL en Fase 2 (`002_fix_handle_new_user_default_role.sql`).

---

### 2.2 ⚠️ RLS demasiado permisiva en la mayoría de tablas

**Severidad**: 🟡 Importante

**Estado**: la mayoría de tablas tienen `CREATE POLICY ... FOR ALL TO authenticated USING (true)`. Cualquier usuario autenticado puede leer/editar/borrar TODO.

**Impacto**: un operario puede técnicamente borrar todos los proyectos. La UI lo restringe en frontend, pero **el frontend NO es seguridad**.

**Mitigación**: planeado para Fase 3 — políticas RLS granulares que verifiquen `get_my_role()`.

---

### 2.3 ⚠️ Sin paginación server-side en listados grandes

**Severidad**: 🟡 Importante (escalabilidad)

**Estado**: hooks como `useClients`, `useProjects`, `useLeads` traen TODA la tabla. La paginación ocurre 100% en cliente.

**Impacto**: con 2.000+ filas la página queda lenta. Con 10.000+ se vuelve inusable.

**Fix**: planeado para Fase 3 (3.3 en `ROADMAP.md`).

---

### 2.4 ⚠️ Columnas en camelCase entre comillas

**Severidad**: 🟢 Cosmético

**Estado**: `materials.photoUrl`, `materials.sortOrder`, `pricing_catalog.previousValue`, `pricing_catalog.lastUpdated` requieren comillas dobles en SQL por ser camelCase.

**Impacto**: confunde al escribir queries manuales en el SQL Editor de Supabase.

**Fix**: pendiente de decidir en Fase 2 si renombrar a snake_case (rompe el frontend hasta migrar todos los consumers).

---

## 3. 📋 Cómo reportar un nuevo issue

### Si ves algo raro en consola o UI:

1. **Verifica que no esté ya documentado aquí.**
2. **Verifica que NO sea ruido externo:**
   - Repro en incógnito → si desaparece, es extensión
   - Repro en otro browser → si desaparece, es algo específico de tu setup
3. **Si es bug real**, agrega una entrada en la sección 2 con:
   - **Síntoma**: qué ves
   - **Cuándo aparece**: condiciones de repro
   - **Severidad**: 🔴 crítico (bloquea) / 🟡 importante / 🟢 cosmético
   - **Impacto**: qué pasa por consecuencia
   - **Plan**: a qué fase del `ROADMAP.md` pertenece, o fix inline si es trivial

### Si el bug es de seguridad:

NO lo escribas aquí (este archivo es público en el repo). Repórtalo en privado al admin del proyecto.

---

## 4. 🔍 Cómo diagnosticar un error desconocido

Checklist rápido cuando algo falla:

1. **¿Aparece en incógnito?** → si no, es extensión
2. **¿Pasa en otro browser?** → si no, es config local
3. **¿Pasa en otra cuenta de usuario?** → si no, es problema de RLS o data
4. **¿Toast en español de la app?** → entonces sí es nuestro, lee el mensaje
5. **¿Pantalla de Error Boundary?** → revisa "Detalles técnicos" en modo dev
6. **¿Console error técnico crudo?** → ese es el path roto, copia el stack y busca

---

## 5. 🛠️ Comandos útiles para debugging

```bash
# Ver versión del build desplegado
curl https://crm-innovar-app-2026.vercel.app/ | grep -i version

# Ver logs de Vercel en tiempo real
vercel logs crm-innovar-app-2026 --follow

# Limpiar caché local (cuando algo "está raro" sin razón aparente)
# En el browser: F12 → Application → Storage → Clear site data

# Resetear caché de React Query (en consola del browser)
window.location.reload()  # forzado
```
