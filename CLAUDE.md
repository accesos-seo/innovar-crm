# CRM Innovar — Guía para Claude

> Este archivo es leído automáticamente por Claude al abrir esta carpeta.
> Contiene todo lo necesario para trabajar en el proyecto sin preguntas.

---

## Identidad del proyecto

- **Nombre:** CRM Innovar App
- **Propósito:** CRM para empresa de cocinas y muebles (cotizaciones, clientes, proyectos, agenda, finanzas)
- **Dueño:** No es técnico — todas las instrucciones deben ser de copiar y pegar
- **Carpeta del proyecto:** `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main`

---

## GitHub — todo lo que necesitas saber

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/accesos-seo/innovar-crm |
| Rama | `master` |
| Cuenta GitHub | `accesos-seo` |
| Autenticación | GitHub CLI (`gh`) ya instalado y autenticado |

### Cómo hacer push (comando completo, listo para usar)

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main"; git add .; git commit -m "DESCRIPCION"; git push origin master
```

Reemplaza `DESCRIPCION` con un resumen breve del cambio.

### Verificar antes de subir

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main"; git status
```

### Si el remote no responde

```powershell
git remote set-url origin https://github.com/accesos-seo/innovar-crm.git
```

---

## Archivos que NUNCA deben subirse

| Archivo / Carpeta | Por qué |
|---|---|
| `.env` | Contiene claves privadas de Supabase |
| `.claude/` | Contiene tokens y permisos locales |
| `node_modules/` | Dependencias (se instalan con `npm install`) |
| `*.log` | Logs de errores locales |

Todos están en `.gitignore`. Si aparecen en `git status`, NO hacer `git add` sobre ellos.

---

## Stack técnico

- **Frontend:** React + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS
- **Base de datos:** Supabase
- **Servidor:** Node.js + Express (`server.ts`)
- **Deploy:** Vercel

## Estructura de carpetas

```
src/
  pages/        → Páginas de la app (Clientes, Proyectos, Cotizaciones...)
  components/   → Componentes visuales reutilizables
  hooks/        → Lógica de datos (conexión a Supabase)
  features/     → Módulos de cotización por categoría (cocinas, closets...)
server/
  services/     → Motor de precios y cotizaciones
db/
  migrations/   → Cambios de base de datos
docs/           → Documentación del proyecto
```

---

## Reglas de trabajo

1. El dueño NO es técnico — siempre dar comandos de copiar y pegar
2. Usar `;` para encadenar comandos en PowerShell (no `&&`)
3. Antes de cualquier push, confirmar con `git status` que no hay archivos sensibles
4. Nunca subir `.env` aunque el usuario lo pida explícitamente
5. Si hay error de autenticación, verificar con `gh auth status`
