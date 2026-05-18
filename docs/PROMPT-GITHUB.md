# Prompt para pedirle a Claude que haga push a GitHub

Copia y pega este texto al inicio de cualquier conversación nueva con Claude:

---

## PROMPT (copiar todo el bloque)

```
Haz push de los cambios actuales a GitHub.

Contexto:
- Proyecto: CRM Innovar App
- Carpeta: C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main
- Repo: https://github.com/accesos-seo/Crm-app-innovar
- Rama: master
- Cuenta GitHub: accesos-seo (GitHub CLI ya autenticado)
- PowerShell: usar ; para encadenar comandos, no &&

Pasos que debes seguir:
1. Ir a la carpeta del proyecto
2. Ejecutar git status para ver qué cambió
3. Hacer git add, commit y push
4. Confirmarme con el link al repo cuando esté listo

No me preguntes nada, hazlo directamente.
```

---

## Cuándo usar este prompt

- Cuando termines cambios y quieras guardarlos en GitHub
- Al inicio de una sesión nueva donde necesites subir actualizaciones
- Si Claude no sabe dónde está el proyecto o cómo subir los cambios

## Qué NO necesitas hacer

- No tienes que explicar la estructura del proyecto
- No tienes que buscar contraseñas (ya está autenticado con gh CLI)
- No tienes que abrir PowerShell tú mismo (Claude lo hace)

## Si Claude pide algo que no entiendes

Respóndele exactamente esto:

```
No soy técnico. Dame el comando exacto para copiar y pegar en PowerShell.
```
