# 📚 Documentación — Innovar CRM

Bienvenido. Esta carpeta es la **fuente única de verdad** sobre cómo funciona el sistema, cómo está organizado y hacia dónde va.

---

## 🧭 Por dónde empezar

| Si eres… | Empieza por |
|---|---|
| **Dev nuevo en el proyecto** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) → [`CONVENTIONS.md`](./CONVENTIONS.md) |
| **Necesitas conocer las tablas** | [`DATABASE.md`](./DATABASE.md) |
| **Vas a escribir un hook / página nueva** | [`CONVENTIONS.md`](./CONVENTIONS.md) |
| **Retomas el proyecto tras una pausa** | [`../HANDOVER.md`](../HANDOVER.md) |
| **Planeando el siguiente sprint** | [`ROADMAP.md`](./ROADMAP.md) |
| **Quieres saber qué se hizo cuándo** | [`changelog/`](./changelog/) |
| **Ves un error raro en consola o UI** | [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) |

---

## 📖 Contenido

### Documentos vivos (se actualizan continuamente)

- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — El modelo mental del sistema: capas, flujo de datos, decisiones técnicas.
- **[`DATABASE.md`](./DATABASE.md)** — Las tablas de Supabase: campos, relaciones, propósito de negocio.
- **[`CONVENTIONS.md`](./CONVENTIONS.md)** — Cómo escribir hooks, manejar errores, nombrar archivos, etc.
- **[`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)** — Ruido externo (extensiones, etc.) y bugs conocidos sin resolver.
- **[`ROADMAP.md`](./ROADMAP.md)** — Fases de mejora pendientes con prioridad y esfuerzo estimado.

### Changelog (registro histórico inmutable)

- **[`changelog/`](./changelog/)** — Un archivo por fase completada. Sirve para entender por qué el código está como está.

### Migraciones de base de datos

- **[`../db/migrations/`](../db/migrations/README.md)** — SQL aplicado al schema de Supabase, con su estado (pendiente / aplicada).

---

## 🤝 Cómo contribuir a esta doc

- **Cuando agregas una tabla** → actualiza `DATABASE.md`
- **Cuando cambias un patrón de código** → actualiza `CONVENTIONS.md`
- **Cuando completas una fase del roadmap** → muévela de `ROADMAP.md` a `changelog/YYYY-MM-DD-nombre.md`
- **Cuando tomas una decisión arquitectónica importante** → un párrafo en `ARCHITECTURE.md` (o un ADR aparte si es grande)

> Regla de oro: si te tomó más de 30 minutos descubrir algo del sistema, **documéntalo**. La próxima persona (incluido tú mismo en 3 meses) te lo va a agradecer.

---

## 🏷️ Convenciones de esta documentación

- **Severidad de issues**: 🔴 crítico (bloquea uso) / 🟡 importante (afecta calidad) / 🟢 mejora (nice to have)
- **Estado de items**: ⏳ pendiente / 🚧 en progreso / ✅ completado / ❌ descartado
- **Idioma**: español por defecto. Términos técnicos del stack (React, TypeScript, Supabase, RLS, etc.) se dejan en inglés.
