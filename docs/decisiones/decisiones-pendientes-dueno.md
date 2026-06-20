# Decisiones que necesitamos de ti — Cocinas Integrales Pereira

Para terminar de dejar el sistema **exactamente como lo describiste**, hay unas pocas decisiones que **solo tú puedes tomar** porque dependen de cómo querés que funcione tu negocio. Todo lo demás (lo técnico, lo de configuración) lo resolvemos nosotros sin molestarte.

Son **8 preguntas**, agrupadas por área. Donde ayuda, te dejamos opciones. Respondé al lado de cada una.

---

## 💰 Finanzas (Cierres y Gastos)

**1. ¿Cómo querés que funcione el cierre contable?**
Hoy el sistema cierra **proyecto por proyecto**. Vos describiste un **cierre de período**: juntar varios proyectos terminados + los gastos de bodega del período en un solo cierre, con su Reporte Ejecutivo y su Anexo de gastos.
- *Por qué importa:* define cómo se calcula y se presenta la utilidad del negocio.
- *Recomendación nuestra:* construir el cierre de período por encima del actual (no perdés nada de lo que ya hay).
- **Tu decisión:** ¿Confirmás el cierre de período? (Sí / No / Hablémoslo)
- ✅ **RESPONDIDA (2026-06-19): Sí, se confirma el cierre de período.** → Implementado (capa de cierre de período + PDFs + reversión auditada).

**2. ¿Qué categorías de gasto de bodega querés?**
Hoy el sistema tiene **10** categorías (materiales, operativo, nómina, transporte, herramientas, servicios públicos, arriendo, subcontrato, dietas, otro). Vos pediste estas **13**: arriendo, luz/energía, agua, internet, insumos de aseo, insumos de papelería, cortesía atención cliente, gasolina vehículos, mantenimiento moto, mantenimiento bodega, mantenimiento maquinaria, nómina, otro.
- *Por qué importa:* son las etiquetas que vas a ver al registrar un gasto.
- **Tu decisión:** ¿**Agregamos** tus 13 a las que ya hay, o **reemplazamos** por exactamente tus 13?
- ✅ **RESPONDIDA (2026-06-19): Reemplazar — usamos exactamente las 13 (categorías de bodega).** → Implementado. (Nota técnica: las categorías de *proyecto* —materiales, subcontrato, transporte…— se conservan, porque el cierre calcula la utilidad de cada proyecto a partir de ellas; las 13 reemplazan solo el selector de bodega/empresa.)

---

## 📐 Visita Técnica

**3. El plano de la visita: ¿lo necesitás en el sistema?**
Vos mencionaste que el técnico exporta el plano dibujado a mano (de GoodNotes) en PDF. Hoy la visita guarda **medidas + fotos**, pero no el plano.
- *Por qué importa:* define si agregamos la carga de ese PDF a la ficha del proyecto.
- **Tu decisión:** ¿Querés que el técnico suba ese plano y quede visible para el diseñador, o el modelado 3D ya te cubre eso?

---

## 🎨 Diseño y Aprobaciones

**4. ¿Cuándo debe arrancar el diseñador?** *(la dejaste en blanco en el cuestionario)*
Hoy el diseñador recibe el aviso de "iniciar diseño" **cuando se verifica el pago del anticipo**. Vos habías pedido antes que fuera **al aprobar la cotización**.
- *Por qué importa:* define el momento exacto en que arranca todo el ciclo de diseño.
- **Tu decisión:** ¿Al **aprobar la cotización** o al **verificar el pago**?

**5. En el diseño (NO en la cotización): ¿hay un tope de rondas de cambios?** *(la dejaste en blanco)*
Aclaramos porque se presta a confusión: hablamos de los cambios al **diseño**, no a la cotización. Es cuando el diseñador ya le mostró al cliente el **modelado o los renders** y el cliente pide ajustes ("córrelo a la izquierda", "cámbialo de color", "agrégale una gaveta"). Hoy el cliente puede pedir **cambios ilimitados** sin costo extra.
- *Por qué importa:* define a partir de cuántos ajustes le empezás a cobrar un extra.
- **Tu decisión:** ¿Ilimitadas, o un **tope** (por ejemplo 2 o 3) antes de cobrar? Si hay tope: **¿cuántas rondas**, y se cuentan **por etapa** (modelado y renders por separado) o sobre **el diseño completo**?

**6. Si el cliente no aprueba ni después de los recordatorios, ¿qué hacemos?**
El sistema le va a recordar al cliente (a las 5h y a las 48h), y a los 4 días te avisa internamente "contacto manual". Pero si aun así **no responde nunca**...
- *Por qué importa:* define qué pasa con proyectos que quedan estancados esperando al cliente.
- **Tu decisión:** ¿El proyecto se **pausa**, se **archiva**, o se **mantiene activo** indefinidamente?

**7. Para aprobar el "modelado 3D", ¿qué le mostramos al cliente?**
Un archivo 3D real no se ve en un celular. Nosotros asumimos que le mandamos **imágenes/renders del modelo** para que apruebe.
- *Por qué importa:* mostrarle un **3D navegable** en el celular es mucho más trabajo; queremos confirmar tu expectativa antes.
- **Tu decisión:** ¿Te alcanza con **imágenes del modelado**, o esperás un **3D interactivo**?

---

## 🏭 Producción

**8. Proyectos "sin diseño" (van directo a taller): ¿quién y cuándo?**
Dijiste que algunos proyectos saltan el diseño y van directo a producción. Falta definir la regla.
- *Por qué importa:* define el atajo directo a taller.
- **Tu decisión:** ¿**Qué tipo de trabajos** saltan el diseño (¿puertas? ¿acabados?) y **quién lo decide** (el comercial, el admin)?

---

> Con estas 8 respuestas tenemos todo para que el sistema calce exactamente con tu operación. El resto del trabajo ya está especificado y lo ejecutamos nosotros.
