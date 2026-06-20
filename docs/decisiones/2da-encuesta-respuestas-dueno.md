# 2ª Encuesta Innovar CRM — Respuestas del dueño (Robert)

> **Fuente:** `docs/2Da encuesta innovar CRM Robert.docx` (respuestas del cliente, 2026-06-19).
> Convierte y reconcilia las **6 decisiones pendientes** que bloqueaban Comercial / Diseño / Producción / plano de Visita Técnica. Con esto, **las 8 decisiones del dueño quedan respondidas**.
> El cliente redacta cada respuesta como insumo para la "carta magna" (la constitución del flujo del sistema).

## Mapa de decisiones → implementación

| Doc # | Nuestra Q | Módulo | Decisión (resumen) | Impacto |
|---|---|---|---|---|
| **1** | Q3 | Visita Técnica / Comercial | **Sí**, el plano PDF se almacena y debe ser **visible para diseñador y comercial desde la cotización**. El 3D no lo reemplaza. | Surface del plano + flujo lineal visita→cotización→diseño→producción |
| **2** | Q4 (C2-Q9) | Diseño / Comercial | El diseñador inicia **al verificar el pago del anticipo** (criterio original correcto). Excepción: `super_admin` puede "iniciar sin anticipo" con justificación registrada. | Trigger ya correcto; **falta solo el override super_admin** |
| **3** | Q5 (C2-Q1) | Diseño | **Sí, límite: 2 rondas en modelado + 1 en render, contadas POR ETAPA.** Ronda 3+ → cobro extra pactado, notifica al cliente y **bloquea** hasta confirmación. Solo `super_admin` libera rondas sin cobro. | Contadores existen; falta tope + cobro + bloqueo + override |
| **4** | Q6 | Comercial / pipeline | Nunca indefinido. Estados: **Activo → En seguimiento (días 1-7) → En pausa (días 8-30) → Archivado (día 30+)**. Anticipo pagado **no** se archiva automático. Reactivación >90 días → revisión de precios. | Máquina de estados + jobs por umbral de días + guardas |
| **5** | Q7 | Diseño / Portal cliente | **Renders estáticos, mínimo 3 ángulos.** NO visor 3D interactivo. Galería en portal del cliente + anotaciones sobre imagen + aprobar con botón + descarga alta resolución. Antes/después opcional. | Portal de aprobación de diseño (no existe hoy) |
| **6** | Q8 | Producción | **Sin diseño:** reparaciones, reposiciones, acabados, puertas de reposición, catálogo estándar. Comercial marca en bajo valor; **admin aprueba** sobre umbral (ej. $500k). Producción no decide. Adendum: "ejecución directa" = categoría propia sin diseño/render/despiece; jefe de taller es la autoridad técnica. | Flag + aprobación por umbral + routing + clasificación |

**Parámetros configurables** que el cliente dejó como ejemplo (→ a `system_settings`, editables por admin, con defaults sensatos):
- Cobro por ronda adicional de diseño: **$80.000–$150.000 COP** según complejidad.
- Umbral de valor para exigir aprobación de admin en "sin diseño": **$500.000 COP**.
- Días de transición de estados: seguimiento 1-7, pausa 8-30, archivado 30+, revisión de precios 90.

---

## 1. (Q3) ¿El plano de la visita queda almacenado en el sistema?

**Pregunta:** la visita registra medidas y fotos, pero no el plano de GoodNotes. ¿El técnico carga el plano PDF para el diseñador, o el 3D ya lo cubre?

**R/ Sí, el plano debe quedar almacenado, y el 3D no lo reemplaza** — son elementos distintos en momentos distintos.

- **Por qué el PDF de GoodNotes es irremplazable:** el plano anotado captura lo que los campos numéricos no pueden — posición de tomas de corriente, columnas/vigas, tuberías, irregularidades de pared, nichos de ventana, el concepto inicial dibujado. El 3D es el producto final; el diseñador usa el plano como insumo. Sin él, reconstruye el espacio a partir de números sueltos → errores y retrasos.
- **Lo que ya hace hoy:** el portal del medidor permite subir el PDF, comprimirlo (10-12 MB → <1 MB) y almacenarlo vinculado a la visita. *El archivo ya está en el sistema.*
- **Lo que falta (visibilidad y flujo, no almacenamiento):**
  1. Diseñador y comercial **no tienen pantalla** donde ver la visita completa (medidas + fotos + PDF) al cotizar/diseñar.
  2. La visita **no está conectada a la cotización**: falta un botón **"crear cotización desde esta visita"** que pre-llene datos.
  3. El diseñador **no tiene portal propio** donde recibir las visitas asignadas.

**Para la carta magna:** flujo lineal y trazable — **Visita técnica** (medidas + fotos + PDF del plano + firma) → **Cotización** (creada desde la visita, hereda datos, visualiza el plano en pantalla) → **Diseño** (recibe la cotización aprobada con acceso al plano, crea el 3D) → **Producción**. El plano es el documento técnico de referencia y debe ser accesible para diseñador y comercial **directamente desde la cotización asociada**, sin pasos intermedios.

## 2. (Q4 / C2-Q9) ¿Cuándo inicia el trabajo del diseñador?

**Pregunta:** hoy inicia al verificar el pago del anticipo; antes pediste que fuera al aprobar la cotización. ¿Cuál?

**R/ Al verificar el pago del anticipo. El criterio original es el correcto.**

- **Por qué NO al aprobar la cotización:** una cotización aprobada es intención, no compromiso. Es común que el cliente apruebe, el diseñador invierta 2-4 h en el 3D, y luego no pague o pida cambios mayores → trabajo gratis y capacidad ocupada. El anticipo es cuando la intención se vuelve contrato.
- **Flujo en 3 estados:** *Cotización aprobada* (genera orden de anticipo; el diseñador no recibe nada) → *Anticipo registrado y verificado* (el sistema notifica al diseñador y crea la tarea con plano + medidas + fotos + tipo + fecha) → *Diseño en proceso*.
- **Excepción:** proyectos de alto valor o clientes recurrentes pueden requerir iniciar antes del pago. El sistema debe permitir que un **`super_admin`** marque manualmente **"iniciar diseño sin anticipo"** con justificación registrada.

**Para la carta magna:** el disparador oficial es la **verificación del pago del anticipo**, no la aprobación de la cotización. El sistema bloquea la asignación al diseñador hasta que el pago esté confirmado, **con una única excepción autorizable solo por `super_admin` con registro de la razón.**

## 3. (Q5 / C2-Q1) ¿Límite de rondas de cambios en diseño?

**Pregunta:** hoy son ilimitadas. ¿Mantener o poner límite? Si límite: ¿cuántas y por etapa o sobre el diseño completo?

**R/ Establece un límite.** Los cambios ilimitados son el principal generador de pérdidas ocultas en diseño a medida (el 20% de clientes consume el 80% del tiempo de diseño).

- **Estructura:** Ronda 1 (entrega del 3D inicial) y Ronda 2 (aplica cambios; última incluida en el precio). **Ronda 3 en adelante = costo fijo pactado** (ej. $80.000–$150.000 COP según complejidad): el sistema registra la solicitud, notifica el costo al cliente, y **espera aprobación antes de continuar**.
- **Por etapa (no sobre el diseño completo):** modelado y render son trabajos distintos.
  - **Modelado 3D:** define estructura/dimensiones/materiales; cambios costosos (rehacer geometría). **2 rondas incluidas.**
  - **Render/presentación:** iluminación, acabados, colores; cambios rápidos. **1 ronda incluida.**
  - Si el cliente agota modelado y durante el render pide cambios que modifican la estructura, **cuenta como ronda de modelado adicional**, no de render.
- **En el sistema:** cada entrega del diseñador activa la ronda del cliente; al recibir correcciones, cuenta y muestra "Ronda 1 de 2 incluidas". En la ronda 3 genera notificación de cobro y **bloquea el avance** hasta confirmación. El admin ve cuántas rondas lleva cada proyecto.

**Para la carta magna:** el diseño incluye **2 rondas de cambios en modelado y 1 en render, contadas por separado.** A partir de la ronda adicional el sistema genera cobro extra pactado, notifica al cliente, y el diseñador no continúa hasta que haya confirmación. **Solo `super_admin`** puede liberar rondas adicionales sin cobro, con registro de la justificación.

## 4. (Q6) ¿Qué ocurre si el cliente nunca aprueba?

**Pregunta:** hoy hay recordatorios a 5 h y 48 h, y alerta manual al día 4. Si sigue sin responder: ¿pausa, archiva o permanece activo?

**R/ Estados progresivos con tiempos definidos, nunca indefinido.** Un proyecto sin respuesta que permanece activo distorsiona métricas y crea cartera ilusoria.

- **Días 1-4 — Seguimiento automático** (ya implementado): recordatorios 5 h y 48 h + alerta manual al comercial al día 4.
- **Días 5-7 — Contacto directo del comercial:** tarea asignada con fecha límite. El comercial marca: confirmó / pidió más tiempo (con fecha) / sin respuesta.
- **Días 8-14 → En pausa oficial:** si no hubo contacto o el cliente no cumplió, pasa automático a **"En pausa"**: se **libera el slot del diseñador**, sale de reportes activos, y el cliente recibe notificación formal (sin presión) de que puede reactivarlo.
- **Día 30 → Archivado:** tras 30 días en pausa sin respuesta, pasa a **"Archivado"** (no eliminado: medidas, planos y cotización quedan guardados). Reactivable con un clic.
- **>90 días archivado → revisión de cotización obligatoria:** al reactivar, el sistema marca "requiere revisión de precios" antes de continuar.
- **Casos especiales:** (1) el tono de las comunicaciones en pausa/archivo debe ser de **disponibilidad, no presión**. (2) **Proyectos con anticipo ya pagado NUNCA se archivan automáticamente** — alerta especial que exige gestión activa del admin hasta resolver el tema financiero.

**Para la carta magna:** secuencia **Activo → En seguimiento (días 1-7) → En pausa (días 8-30) → Archivado (día 30+)**. Ningún proyecto queda activo indefinidamente. Los proyectos con anticipo pagado no se archivan automáticamente. Los archivados se conservan indefinidamente pero requieren revisión de precios si se reactivan después de 90 días. El diseñador recupera su capacidad cuando el proyecto entra en pausa.

## 5. (Q7) Para aprobar el modelado 3D, ¿qué visualiza el cliente?

**Pregunta:** asumimos imágenes/renders. Un visor 3D interactivo en móvil es mucho más complejo. ¿Renders bastan o esperás 3D interactivo?

**R/ Las imágenes y renders son suficientes** — y son la elección correcta para este negocio.

- **Por qué NO visor 3D interactivo:** requiere exportar a glTF/WebGL, procesamiento extra del diseñador, render en tiempo real y dispositivos potentes → experiencia lenta y semanas de desarrollo. El cliente de cocinas en Pereira pregunta "¿cómo me queda la cocina?", no orbita un modelo. El render bien hecho comunica más en 3 s.
- **Lo que sí debe ofrecer el sistema:**
  - **Múltiples ángulos obligatorios:** mínimo **3 renders** por proyecto (frontal, perspectiva desde la entrada, detalle del área más compleja). Un solo ángulo → aprueba a ciegas y reclama en instalación.
  - **Comparativa antes/después (opcional):** foto del espacio vacío junto al render.
  - **Anotaciones sobre el render:** el cliente marca sobre la imagen qué cambiar (en vez de describir en texto) → menos malentendidos, menos rondas.
  - **Descarga en alta resolución:** para compartir por WhatsApp sin pixelar.
- **Excepción futura:** si el negocio crece a proyectos premium (apartamentos completos), evaluar Matterport o Sketchfab embebido como módulo opcional.

**Para la carta magna:** la aprobación se hace sobre **renders estáticos de mínimo 3 ángulos**. El diseñador sube las imágenes; el cliente las ve en **galería ordenada en su portal**, las **anota** para pedir cambios, y **aprueba con un botón** que dispara la siguiente etapa. **No se desarrolla visor 3D interactivo.** Antes/después opcional pero recomendado. Renders descargables en alta resolución.

## 6. (Q8) Proyectos que no requieren diseño

**Pregunta:** ¿qué tipos pueden saltar el diseño y pasar directo a taller? ¿Quién decide (comercial / admin / producción)?

**R/ Define la regla con claridad: la omisión del diseño es la excepción, no la norma, y debe quedar controlada.**

- **Pueden omitir diseño** (producto definido por medidas/materiales, sin decisiones estéticas): **puertas de reposición / cambio de color, acabados y retoques, reparaciones, reposiciones de piezas, productos de catálogo estándar.**
- **Siempre requieren diseño** (aunque parezcan simples): espacio nuevo, combinación de >2 módulos, restricciones (columnas/ventanas), o briefs vagos ("algo moderno", "como vi en Pinterest").
- **Autoridad en 2 niveles:**
  - **Comercial:** puede marcar "sin diseño" en bajo valor y alcance claro (reparaciones, reposiciones, acabados, puertas de reposición). El sistema registra quién y cuándo. Sin aprobación adicional.
  - **Admin:** aprueba la omisión en proyectos nuevos sobre un umbral (ej. **$500.000 COP**) o con módulos nuevos. El comercial solicita, el admin aprueba/rechaza desde su panel, queda el motivo.
  - **Producción nunca decide.** Si recibe algo ambiguo, lo devuelve al comercial/admin con observación.
- **En el sistema:** al crear el proyecto el comercial elige si requiere diseño. Si marca "sin diseño", exige **categoría** de la lista permitida y registra el usuario. Si supera el umbral, el botón se reemplaza por **"solicitar omisión de diseño"** (tarea de aprobación para el admin). Aprobada → el proyecto pasa de cotización pagada **directo a producción**.

**Adendum — Trabajos de ejecución directa (sin diseño, sin render, sin despiece):** puertas, reparaciones, muebles genéricos, acabados, reposiciones operan con lógica distinta. **No** pasan por modelado/render y van directo al taller. **No requieren despiece formal del sistema:** el **jefe de taller** interpreta el pedido (medidas + material + especificaciones del comercial/medidor) y define la ejecución — su criterio reemplaza al plano de producción. El sistema no debe exigir documentos que el taller no necesita. Flujo: cliente solicita → comercial registra pedido con medidas/especificaciones → pago/anticipo → taller ejecuta → instalación/entrega. El sistema debe **clasificar** estos trabajos como categoría propia para que **no aparezcan en reportes de diseño pendiente, no generen tareas para el diseñador, ni activen aprobación de renders**.

**Para la carta magna:** los **trabajos de ejecución directa** (puertas, reparaciones, muebles genéricos, acabados, reposiciones) no tienen etapa de diseño, no generan renders, y no requieren despiece formal. Van directo a taller tras el registro del pedido. El **jefe de taller es la autoridad técnica de ejecución**. El sistema los clasifica como **categoría independiente** para que no contaminen flujos ni reportes de los proyectos de diseño.
