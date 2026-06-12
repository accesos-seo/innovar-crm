# Vercel — Deploy de Innovar CRM

> Extraído del CLAUDE.md raíz el 2026-06-12 (optimización de arnés). Fuente de verdad operativa.

## Datos del proyecto

| Campo | Valor |
|---|---|
| Proyecto activo | `crm-innovar-app-2026` |
| URL de producción | https://crm-innovar-app-2026.vercel.app |
| Project ID | `prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi` |
| Team ID | `team_K7m1K8aMiKR36myzPROYViA8` |
| Token | En `.env` del proyecto como `VERCEL_TOKEN` |
| Repo conectado en Vercel | `Rvirona/CRM-INNOVAR-APP` (rama `main`) ⚠️ |

> **ADVERTENCIA CRÍTICA — Repo desconectado:** Vercel está conectado a
> `Rvirona/CRM-INNOVAR-APP:main`, pero el trabajo real va a `accesos-seo/innovar-crm:master`.
> Los push automáticos NO disparan deploys en Vercel. **Deploy manual después de cada push**
> (modo trabajo en vivo, orden del 2026-06-12: el agente lo ejecuta tras build verde).

## Deploy manual (CLI)

```powershell
Set-Location "D:\Agents-automations\04-Innovar"; npx vercel --prod --token TU_VERCEL_TOKEN_AQUI --yes
```

## Redeploy vía API (cuando lo dispara el agente)

```bash
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_K7m1K8aMiKR36myzPROYViA8&forceNew=1" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"crm-innovar-app-2026","project":"prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi","gitSource":{"type":"github","repoId":"1210035787","ref":"main"}}'
```

## Variables de entorno en Vercel (ya configuradas)

| Variable | ID en Vercel | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | `VOe0hiQcqJEWVtDb` | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `Ef4LwttryZf6qBnR` | clave anon del `.env` local |

## Pendiente estructural

- [ ] Conectar Vercel al repo correcto `accesos-seo/innovar-crm:master` para deploys automáticos
      (mientras tanto: deploy manual obligatorio tras cada push).
