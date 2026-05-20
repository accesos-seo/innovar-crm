# CRM Innovar — Guía para Claude

> Este archivo es leído automáticamente por Claude al abrir esta carpeta.
> Contiene todo lo necesario para trabajar en el proyecto sin preguntas.

---

## Identidad del proyecto

- **Nombre:** CRM Innovar App
- **Propósito:** CRM para empresa de cocinas y muebles (cotizaciones, clientes, proyectos, agenda, finanzas)
- **Dueño:** No es técnico — todas las instrucciones deben ser de copiar y pegar
- **Carpeta real del proyecto:** `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
- **Alias en OneDrive (mismo contenido, sincronizado):** `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main`

> **IMPORTANTE:** Usar siempre la ruta del **Escritorio** para comandos de git y deploy. Las tareas PowerShell en background se cuelgan en rutas de OneDrive — dar siempre comandos al usuario para ejecutar en su terminal.

---

## GitHub

| Campo | Valor |
|---|---|
| Repositorio de trabajo | https://github.com/accesos-seo/innovar-crm |
| Rama | `master` |
| Cuenta GitHub | `accesos-seo` |
| Autenticación | GitHub CLI (`gh`) ya instalado y autenticado |

### Hacer push (copiar y pegar)

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; git add ARCHIVO1 ARCHIVO2; git commit -m "DESCRIPCION"; git push origin master
```

> Siempre especificar los archivos individualmente en `git add` — nunca usar `git add .` para evitar subir archivos sensibles.

### Verificar estado antes de subir

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; git status
```

---

## Vercel — Deploy

| Campo | Valor |
|---|---|
| Proyecto activo | `crm-innovar-app-2026` |
| URL de producción | https://crm-innovar-app-2026.vercel.app |
| Project ID | `prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi` |
| Team ID | `team_K7m1K8aMiKR36myzPROYViA8` |
| Token | En `.env` del proyecto como `VERCEL_TOKEN` |
| Repo conectado en Vercel | `Rvirona/CRM-INNOVAR-APP` (rama `main`) ⚠️ |

> **ADVERTENCIA CRÍTICA — Repo desconectado:** Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, pero el trabajo real va a `accesos-seo/innovar-crm:master`. Los push automáticos NO disparan deploys en Vercel. Hay que hacer deploy manual cada vez.

### Hacer deploy manual a Vercel (copiar y pegar)

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; npx vercel --prod --token TU_VERCEL_TOKEN_AQUI --yes
```

### Disparar redeploy vía API (cuando Claude lo hace)

```bash
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_K7m1K8aMiKR36myzPROYViA8&forceNew=1" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"crm-innovar-app-2026","project":"prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi","gitSource":{"type":"github","repoId":"1210035787","ref":"main"}}'
```

### Variables de entorno en Vercel (ya configuradas)

| Variable | ID en Vercel | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | `VOe0hiQcqJEWVtDb` | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `Ef4LwttryZf6qBnR` | clave anon del `.env` local |

---

## Supabase

| Campo | Valor |
|---|---|
| Project ID | `xdzbjptozeqcbnaqhtye` |
| URL | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| Claves | En `.env` del proyecto |

> **ADVERTENCIA:** El Supabase MCP conectado en este entorno Claude es `Light_House` y `Swarm Agentes MD` — NO el proyecto Innovar. No usar el MCP para queries de Innovar.

### Bucket de avatares (Storage)

Si el avatar no se sube, ejecutar en SQL Editor de Supabase:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Avatar upload authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatar update authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');
```

---

## Stack técnico

- **Frontend:** React 19 + TypeScript + Vite 6
- **UI:** shadcn/ui + Tailwind CSS 4
- **Base de datos:** Supabase (PostgreSQL + Storage)
- **Servidor local:** Node.js + Express (`server.ts`)
- **Deploy:** Vercel (proyecto `crm-innovar-app-2026`)

## Estructura de carpetas

```
src/
  pages/        → Páginas (Dashboard, Proyectos, Cotizaciones, Profile...)
  components/   → Componentes reutilizables y templates PDF
  hooks/        → Hooks de datos (conexión a Supabase)
  features/     → Módulos del cotizador paramétrico
    kitchen/      → Cocinas (server-side via Edge Function)
    closets/      → Closets (client-side)
    doors/        → Puertas (client-side, reescrito)
    mesones/      → Mesones (client-side, nuevo)
    tv_center/    → Centro TV (client-side)
    special_finishes/ → Acabados especiales (client-side)
    hardware/     → Herrajes (client-side)
  store/        → Estado global (Zustand)
server/
  services/     → Motor de precios server-side
db/
  migrations/   → Migraciones de base de datos
```

---

## Arquitectura del cotizador — Patrón 3 capas

Cada módulo sigue:

```
src/features/[modulo]/logic.ts              → Motor puro (tipos, constantes, cálculo)
src/hooks/use-[modulo]-calculator.ts        → Hook React (useMemo sobre el motor)
src/features/[modulo]/[Modulo]Module.tsx    → UI (Card + footer con total)
```

El hub central es `src/components/quotations/steps/QuotationDesignStep.tsx`.
Todos los módulos notifican cambios vía `onDataChange(total, config)`.
El `config` se guarda en `item.configuration` en Supabase y alimenta los templates PDF.

### Templates PDF existentes

| Módulo | Template |
|---|---|
| Cocinas | `src/components/pdf/templates/KitchenTemplate.tsx` |
| Closets | `src/components/pdf/templates/ClosetTemplate.tsx` |
| Puertas | `src/components/pdf/templates/DoorsTemplate.tsx` |
| TV Center | `src/components/pdf/templates/TVCenterTemplate.tsx` |
| Herrajes | `src/components/pdf/templates/HardwareTemplate.tsx` |
| Acabados | `src/components/pdf/templates/SpecialFinishesTemplate.tsx` |
| Mesones | ⚠️ **Pendiente crear** |

---

## Pendientes conocidos

- [ ] `MesonesTemplate.tsx` — crear template PDF para mesones
- [ ] `MesonesModule` sin `initialData` — no restaura config guardada al reabrir cotización
- [ ] Conectar Vercel al repo correcto `accesos-seo/innovar-crm:master` para deploys automáticos
- [ ] Verificar políticas del bucket `avatars` en Supabase Storage (ver SQL arriba)
- [ ] Aplicar 7 migraciones SQL pendientes en Supabase Dashboard (ver `HandOver/STATE-OF-SYSTEM-2026-05-20.md` sección 3)

---

## Diagnóstico rápido: bug "módulos cuelgan en skeleton 10-30s"

**Síntoma típico en consola:**
```
supabaseClient.ts:188 [query-error] [...] → Operation timed out after 10000ms
```

**Causa raíz:** Token JWT vencido en `localStorage["innovar-auth-token"]`. El SDK Supabase no emite el error como string detectable (`"Refresh Token Not Found"`), solo timea.

**Fix instalado en código (2026-05-20):** `src/lib/supabaseClient.ts` ahora verifica el `exp` claim del JWT al cargar el módulo Y llama `getSession()` al primer timeout. Si está vencido, dispara `signOut` + redirect a `/login` automáticamente con toast visible.

**Si el bug vuelve a aparecer (recovery manual desde DevTools del navegador):**
```js
localStorage.removeItem('innovar-auth-token'); location.reload();
```

**NO probar de nuevo (hipótesis ya descartadas):**
- Bajar `retry: 0` en hooks → causa MÁS cuelgues
- Acortar timeouts (<5s) → rompe red lenta legítima
- Desactivar RLS → no es la causa
- Eliminar JOINs PostgREST → también fallan sin joins

**Ver detalles completos en:** `HandOver/STATE-OF-SYSTEM-2026-05-20.md` sección 2.

---

## Archivos que NUNCA deben subirse

| Archivo / Carpeta | Por qué |
|---|---|
| `.env` | Contiene claves privadas de Supabase y tokens |
| `.claude/` | Contiene tokens y permisos locales |
| `.vercel/` | Contiene IDs del proyecto Vercel |
| `node_modules/` | Dependencias (se instalan con `npm install`) |
| `*.log` | Logs de errores locales |

---

## Reglas de trabajo

1. El dueño NO es técnico — siempre dar comandos de copiar y pegar
2. Usar `;` para encadenar comandos en PowerShell (nunca `&&`)
3. No usar tareas PowerShell en background en rutas OneDrive — se cuelgan
4. Antes de cualquier push, confirmar con `git status` que no hay archivos sensibles
5. Nunca subir `.env` aunque el usuario lo pida explícitamente
6. El Supabase MCP del entorno NO corresponde al proyecto Innovar — no usarlo
7. Para deploys a Vercel: usar el comando `npx vercel --prod` o la API (ver sección Vercel)
8. Si hay error de autenticación GitHub: `gh auth status`
