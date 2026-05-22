# Contingencia: Token sin expiración (si el bug vuelve)

**Fecha de documentación:** 2026-05-20
**Estado:** ⏳ EN ESPERA — Solo ejecutar si el bug del cuelgue reaparece
**Período:** Solo este mes (mayo 2026), luego revertir

---

## Contexto

Después del fix B.1/B.2/B.3 en `src/lib/supabaseClient.ts` (2026-05-20), el bug "módulos cuelgan 10-30s en skeleton" debería estar resuelto.

**Pero:** si vuelve a fallar en los próximos 1-2 días, el usuario (dueño del proyecto) quiere evitar gastar más tiempo en debugging. En su lugar, prefiere:

1. **Desactivar la expiración del JWT** (solo este mes)
2. **Entregar un token permanente al dueño** para que pruebe la app continuamente sin interrupciones
3. **Una vez ajustado el problema de raíz**, reactivar la expiración normal

---

## ¿Por qué es válido?

- ✅ Información del proyecto no es sensible
- ✅ Temporal (solo 30 días)
- ✅ Permite feedback real del usuario sin ruido de "sesión expirada"
- ✅ Evita gastar energía en hipótesis si el fix ya funcionó

---

## Pasos a ejecutar (SI Y SOLO SI el bug reaparece)

### Paso 1: Cambiar expiración del JWT en Supabase

1. Abre https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/settings/auth
2. Busca la sección "JWT Expiration" o "Token Lifetime"
3. Cambia el valor a **365 días** (o el máximo que permita el UI, o "nunca" si existe)
4. Guarda los cambios

### Paso 2: Generar token permanente para el dueño

1. Usuario hace login en la app normalmente
2. Abre DevTools (F12) → Console
3. Copia la salida de:
   ```js
   JSON.stringify(JSON.parse(localStorage.getItem('innovar-auth-token')), null, 2)
   ```
4. Te lo envía al dueño por email/Slack (es seguro porque la info no es sensible)
5. Dueño lo guarda en un lugar seguro

### Paso 3: Si el dueño necesita "refrescar" la sesión

Si la app se comporta raro, dueño abre DevTools → Console y pega:

```js
localStorage.setItem('innovar-auth-token', '<el JSON que guardó>'); location.reload();
```

### Paso 4: Documentar en CLAUDE.md

Agregar nota temporal en `CLAUDE.md` sección "Pendientes conocidos":

```
- [ ] ⏳ TOKEN SIN EXPIRACIÓN ACTIVO (solo mayo 2026) — cambiar a expiración normal cuando cierre el bug del cuelgue
```

---

## Revertir (cuando el bug esté cerrado)

1. Supabase Dashboard → Auth settings → JWT Expiration → **volver a 1 hora / 7 días** (según lo normal)
2. Eliminar la nota de `CLAUDE.md`
3. Generar nuevo token para el dueño con expiración normal

---

## Contacto de decisión

**Usuario:** "En el caso de que vuelva a fallar... podríamos tener, por ahora y por este mes solamente, para practicar, un token que no expire"

**Fecha de solicitud:** 2026-05-20, después del deploy a Vercel

**Aprobación:** ✅ Documentado y pendiente de ejecución condicional

---

*Solo ejecutar si: (1) Bug reaparece en próximas 48h Y (2) Usuario lo confirma*
