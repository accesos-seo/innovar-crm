# Cuestionarios de Configuración

CRM — Cocinas Integrales Pereira

_Versión canónica reconciliada (19/06/2026) desde la entrega completa en Word. Las Preguntas 1 y 9 del Cuestionario 2 quedaron sin respuesta del cliente (decisiones abiertas). Mapa de conformidad: ver 00-matriz-segmentacion-brechas.md._

*Instrucciones: Por favor responda cada pregunta en el espacio indicado. Sus respuestas se usarán para configurar el sistema exactamente como usted lo necesita. No hay respuestas incorrectas.*

## **Cuestionario 1: Cierres Contables y Gastos de Empresa**

*Estas respuestas definen cómo el cierre de cada proyecto debe tratar los gastos que no pertenecen a un proyecto específico (nómina, dietas, arriendo, bodega) y qué reporte espera ver al cerrar un proyecto.*

**Pregunta 1**

Los gastos de empresa/bodega (nómina, dietas, arriendo, servicios): ¿deben repartirse entre los proyectos activos del período o quedarse como gasto general sin tocar los proyectos?

*¿Por qué importa? Es la decisión central: cambia el cálculo de utilidad de cada cierre de proyecto.*

**Su respuesta:Los gastos de bodega son completamente independientes de los proyectos. Se registran en el módulo de Contabilidad como gastos operativos generales y nunca tocan los números de ningún proyecto. Cada proyecto tiene sus propios gastos de materiales y mano de obra registrados directamente en él.**

**Esto significa que la utilidad de un proyecto se calcula así:**

**Utilidad proyecto \= Precio cobrado − Gastos propios del proyecto**

**Y el cierre contable del período consolida por separado los dos mundos:**

**Resultado del período \= (Suma utilidades proyectos) − (Gastos operativos bodega del período)**

---

**Por qué esta decisión es correcta para Innovar:**

**Repartir los gastos de bodega entre proyectos (costeo absorbente) agregaría una capa de complejidad innecesaria — tendrías que definir una base de reparto (¿por tiempo? ¿por valor?) y los números de cada proyecto cambiarían según cuántos proyectos hubiera ese mes, haciendo imposible comparar la salud de un proyecto con otro.**

**Al mantenerlos separados, el arqueo por proyecto te dice exactamente lo que necesitas: ¿este proyecto fue rentable o no? Y el cierre del período te dice: ¿el negocio como un todo fue rentable o no?**

**Las categorías de gastos de bodega ya están activas. Cuando Render termine el deploy del último push, el formulario de contabilidad mostrará exactamente:**

* **Arriendo**  
* **Luz / Energía**  
* **Agua**  
* **Internet**  
* **Insumos de aseo**  
* **Insumos papelería**  
* **Cortesía atención cliente**  
* **Gasolina vehículos**  
* **Mantenimiento moto**  
* **Mantenimiento bodega**  
* **Mantenimiento maquinaria**  
* **Nómina trabajadores**  
* **Otro**

**Pregunta 2**

Si se reparten: ¿por partes iguales entre los proyectos activos, o proporcional al valor de cada proyecto?

*¿Por qué importa? Define la fórmula exacta del prorrateo.*

**Su respuesta: actualmente esta separado y ese monto se suma  totalmente en bloque al valor gastos de proyectos a cerrar. En el cierre contable solo entran los proyectos que ya estan terminados y que han sido cancelados al 100%. De esta forma tenemos control de los gastos.**

**Pregunta 3**

¿Qué período cubre un proyecto para efectos del cierre: desde la fecha del anticipo hasta la entrega, u otra regla?

*¿Por qué importa? Determina qué gastos de empresa "caen" dentro de cada proyecto.*

**Su respuesta:**    **¿Qué período cubre un proyecto para efectos del cierre, y cuándo entran los gastos de bodega?**

---

**Los proyectos no tienen período fijo**

Un proyecto no entra al cierre por sus fechas (anticipo, instalación, entrega) — entra cuando el admin lo archiva y decide incluirlo. Dos proyectos de enero y tres de abril pueden cerrarse juntos en junio si el admin así lo decide. La app no valida ni restringe eso.

Esto tiene una implicación importante: la "salud" de un proyecto se mide por sus propios gastos vs. su precio de venta, no por cuándo ocurrió. El cierre es simplemente el momento en que ese proyecto sale del tablero activo y queda registrado oficialmente.

---

**Los gastos de bodega sí tienen una regla de período**

El sistema toma todos los gastos operativos (arriendo, nómina, gasolina, etc.) registrados **desde la fecha del último cierre confirmado hasta el día en que se crea el nuevo cierre**. No usa las fechas que el admin escribe en el formulario — usa la fecha real del cierre anterior como punto de corte.

Ejemplo concreto:

* Último cierre confirmado: 28 de febrero  
* Nuevo cierre creado: 17 de junio  
* Gastos de bodega incluidos: todos los registrados entre el 1 de marzo y el 17 de junio, sin excepción

Si nunca ha habido un cierre anterior, toma **todos los gastos de bodega que existan en el sistema** desde el principio.

---

**Lo que esto significa para el negocio**

Los gastos de bodega no se asignan a proyectos individuales — se acumulan en el tiempo y se descuentan como bloque al hacer el cierre. El resultado del período queda así:

**Utilidad neta del período \= Suma de utilidades de proyectos cerrados − Total gastos de bodega acumulados desde el cierre anterior**

Esto es correcto para Innovar porque permite ver dos cosas por separado: **¿cada proyecto fue rentable?** y **¿el negocio en su conjunto fue rentable en este período?**

**Pregunta 4**

¿Un cierre debe poder reabrirse si llega un gasto tardío (una factura que llega después)? ¿Quién autoriza la reapertura?

*¿Por qué importa? Define permisos y auditoría del módulo de cierres.*

**Su respuesta:**    **¿Debe poder reabrirse un cierre por un gasto tardío?**

No. La política quedó definida: los gastos tardíos van al período siguiente, no reabren el cierre anterior. El sistema incluso muestra un aviso en el diálogo de revertir recordándole esto al CEO antes de actuar.

**¿Quién autoriza la reapertura?**

Solo el **Super Admin (CEO)**. Los admins ya no ven el botón de revertir — no pueden ni intentarlo. El router rechaza cualquier llamada que no venga de un super\_admin a nivel de servidor.

* La reapertura requiere **motivo obligatorio** (mínimo 10 caracteres) antes de poder ejecutar la acción  
* El motivo queda guardado en la tabla `closureAuditLog` junto con quién lo hizo, cuándo, cuántos proyectos se desvincularon y el estado anterior — trazabilidad completa  
* El botón de revertir es invisible para admins, solo aparece en la sesión de super\_admin

En resumen: un cierre confirmado es inamovible para todos excepto el CEO, y si el CEO lo abre, queda registrado.

---

**Pregunta 5**

Las dietas y extras de los empleados: ¿se registran por empleado y por día, o como un monto global por semana/quincena?

*¿Por qué importa? Define el nivel de detalle del formulario de gastos.*

**Su respuesta: No hay dietas para empleados pero si existiera un gasto extra por este tipo entra directamente como gasto de bodega o operacion no iria amarrado a ningun proyecto.**

**Pregunta 6**

Al cerrar un proyecto, ¿qué espera ver en el reporte? (utilidad neta, margen %, comparativo cotizado vs. real, lista de gastos)

*¿Por qué importa? Define el contenido del cierre y de su versión imprimible.*

**Su respuesta:Lo que muestra el cierre contable en la aplicación hoy**

---

### **Qué datos se capturan al crear el cierre**

**Cuando se crea un cierre contable, el sistema toma una "foto" de cada proyecto del período. Esa foto queda grabada en la tabla `accountingClosureProjects` con estos valores:**

* **Nombre del proyecto**  
* **Valor cotizado (`projectValue`) — el total de la cotización aprobada por el cliente**  
* **Total cobrado (`totalPaid`) — suma de todos los pagos registrados contra ese proyecto**  
* **Total de gastos (`totalExpenses`) — suma de todos los gastos directos imputados al proyecto**  
* **Utilidad (`profit`) — calculada como valor cotizado menos gastos del proyecto**

**Aparte, todos los gastos de bodega del período (arriendo, energía, nómina, etc.) se graban en `accountingClosureOperationalExpenses` con su categoría, descripción, monto y fecha.**

---

### **Reporte Ejecutivo — el PDF principal**

**Este documento está pensado para la gerencia. Lo que muestra:**

**Encabezado del documento: nombre de la empresa, número de cierre, período cubierto, estado (borrador o confirmado) y fecha de generación. A la derecha, quién lo creó y quién lo aprobó con su fecha.**

**Tabla de proyectos, una fila por proyecto con estas columnas:**

| Proyecto | Cotizado | Cobrado | Saldo Pendiente | Gastos Proyecto | Utilidad | Margen % |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

* **Cotizado es el valor pactado con el cliente en la cotización aprobada — lo que se esperaba recibir.**  
* **Cobrado es lo que efectivamente entró a caja de ese proyecto.**  
* **Saldo pendiente es cotizado menos cobrado — lo que el cliente aún debe. Aparece en rojo si es positivo, porque es dinero que no ha entrado.**  
* **Gastos proyecto son los gastos directos registrados contra ese proyecto (materiales, mano de obra, servicios, transporte, etc.).**  
* **Utilidad es cotizado menos gastos. Si es negativa, la celda aparece en rojo.**  
* **Margen % es utilidad dividida por el valor cotizado. Si es negativo, en rojo.**

**Fila de proyectos con pérdida: la fila completa tiene fondo rosado y aparece la etiqueta "▼ PÉRDIDA" junto al nombre del proyecto. Esto permite identificar de un vistazo qué proyectos salieron mal sin necesidad de leer todos los números.**

**Fila de totales al pie de la tabla consolida todo el período.**

**Resumen financiero debajo de la tabla, en tarjetas:**

* **Total cotizado (ventas del período)**  
* **Total cobrado \+ saldo pendiente consolidado**  
* **Gastos de proyectos (suma de lo gastado directamente en cada trabajo)**  
* **Gastos de bodega/empresa (arriendo, nómina, servicios generales — separados de los gastos de proyecto)**  
* **Utilidad neta del período con su margen porcentual sobre ventas**

**Esta separación entre gastos de proyecto y gastos de bodega es importante: permite ver cuánto pesó cada uno. Un período puede tener buena utilidad bruta por proyecto pero utilidad neta baja si los gastos de bodega fueron altos.**

**Sección de firmas con tres líneas: quien elaboró el cierre, quien lo aprobó, y una línea para Gerencia General.**

---

### **Anexo de Gastos — el PDF de detalle**

**Este documento se imprime aparte, para archivo contable o para responder preguntas específicas. Tiene dos secciones:**

**Sección 1 — Gastos de bodega por categoría:**

**Agrupa todos los gastos operativos del período en 13 categorías: arriendo, luz/energía, agua, internet, insumos de aseo, insumos de papelería, cortesía atención cliente, gasolina vehículos, mantenimiento moto, mantenimiento bodega, mantenimiento maquinaria, nómina trabajadores, y otro. Cada categoría muestra el listado de gastos (fecha, descripción, monto) con su subtotal. Al final, total general de bodega.**

**Sección 2 — Gastos por proyecto:**

**Por cada proyecto del período, aparece un bloque con:**

* **Encabezado del proyecto en verde teal con el nombre**  
* **Franja de comparativo cotizado vs real: muestra el valor cotizado, el total de gastos reales y la diferencia — en verde si el proyecto fue rentable, en rojo si los gastos superaron lo cotizado. Esto responde directamente "¿cuánto cobré vs en qué lo gasté?"**  
* **Desglose por categoría de gasto: materiales, mano de obra, alquiler, servicios, transporte, mantenimiento, otros — cada categoría con su listado de gastos individuales (fecha, descripción, monto) y subtotal.**

---

### **Por qué importa esta separación**

**El ejecutivo responde: *¿Cómo le fue al negocio este período?* Es para decidir, no para auditar.**

**El anexo responde: *¿Por qué le fue así?* Si un proyecto tuvo margen bajo, el anexo muestra exactamente en qué se gastó el dinero y en qué categoría se fue. Si los gastos de bodega están disparados, el anexo muestra en qué categoría específica.**

**Juntos definen el contenido completo del cierre: el ejecutivo te dice el resultado, el anexo te dice por qué llegaste a ese resultado.**

---

### **Lo que el sistema calcula automáticamente**

* **Saldo pendiente por proyecto y total**  
* **Margen % sobre valor cotizado**  
* **Diferencia cotizado vs gastos reales por proyecto (con indicador visual)**  
* **Total gastos bodega del período**  
* **Utilidad neta separando gastos directos de gastos generales**  
* **Identificación automática de proyectos con pérdida**

**Pregunta 7**

¿Quién puede hacer cierres además de gerencia? (¿el contador tendrá su propio usuario?)

*¿Por qué importa? Define roles y permisos del módulo de cierres.*

**Su respuesta: solo super admin/ceo**

## **Cuestionario 2: Ciclo de Diseño y Aprobaciones**

*Estas respuestas definen cómo construiremos el flujo completo: modelado 3D → su aprobación → render → su aprobación → producción, incluyendo aprobaciones desde el link del proyecto y aprobaciones delegadas por WhatsApp para clientes mayores. Responda con el detalle que usa en el día a día — no hay respuestas incorrectas.*

**Pregunta 1**

¿Cuántas rondas de cambios incluye cada etapa de diseño (modelado y render)? ¿Son ilimitadas o hay un tope antes de cobrar ajustes adicionales?

*¿Por qué importa? Define cuándo el sistema permite devolver un diseño a "en ajustes" y si debe avisar cuando se supere el tope.*

**Su respuesta: ¿Cuántas rondas de cambios por etapa?**

**Actualmente el sistema no tiene tope. Los campos `modeladoRevisionNumber` y `renderRevisionNumber` son contadores libres que se incrementan indefinidamente cada vez que se reenvía al cliente. No existe ninguna validación en el backend que bloquee o avise cuando se supera un número determinado.**

**Esto importa porque defines dos cosas distintas:**

**¿Cuántas rondas incluye el contrato? Eso es política comercial tuya, no una restricción técnica automática. Las opciones prácticas para el sistema son:Sin restricción en el sistema (estado actual): el conteo existe para visibilidad y trazabilidad pero nunca frena el flujo.**

**Pregunta 2**

Cuando el cliente pide cambios al modelado o al render, ¿quién recibe y registra hoy esos comentarios? (el diseñador, el comercial, gerencia)

*¿Por qué importa? Determina a quién le llega la notificación de "cambios solicitados" y quién puede editar el diseño.*

**Su respuesta:** **¿Cuándo el cliente pide cambios al modelado o al render, quién recibe y registra esos comentarios?**

---

**Quién puede solicitar los cambios**

Tres actores pueden presionar "Solicitar Cambios" desde el panel:

* El **cliente** desde su portal público (con token)  
* El **comercial** desde el panel interno, actuando como intermediario  
* El **admin / super\_admin** desde el panel interno

El **diseñador no puede rechazar** — su único rol en esta etapa es entregar versiones.

---

**Qué se registra obligatoriamente**

Cuando alguien presiona "Solicitar Cambios" se abre un modal con dos campos requeridos:

1. **Quién comunicó los cambios**: cuatro opciones — Cliente (portal), Comercial presencial, Comercial WhatsApp, Comercial teléfono. Esto resuelve el caso más común: el cliente llamó al comercial, el comercial entra al sistema y registra los cambios en su nombre.  
2. **Descripción de los cambios**: texto libre obligatorio. No se puede confirmar sin escribir qué se debe cambiar.

Todo queda grabado en el historial del proyecto con la fuente, la descripción y quién ejecutó la acción en el sistema.

---

**Quién recibe notificación**

Al confirmar, el sistema dispara notificaciones en cadena:

* **Diseñador asignado**: recibe notificación in-app \+ se crea automáticamente una tarea con prioridad alta y plazo de 48 horas con el detalle de los cambios. Si el diseñador tiene teléfono registrado, el panel ofrece abrir WhatsApp directo a su número con el mensaje preescrito. Si no hay diseñador asignado, el WhatsApp va al número fijo de INNOVAR como fallback.  
* **Admin y CEO (todos los super\_admin)**: reciben notificación push e in-app con el texto "Informado por \[fuente\]" y el extracto del cambio. Quien ejecutó la acción no se notifica a sí mismo. Esto da trazabilidad completa a gerencia sin que tengan que revisar cada proyecto manualmente.

---

**Qué pasa con el proyecto**

El estado vuelve a `en_diseno`. El campo `clientApprovalNotes` guarda los cambios solicitados y aparece visible en la ficha del proyecto como un banner naranja "Últimos cambios solicitados". El campo `changesRequestedAt` registra la fecha exacta, lo que permite al sistema detectar que la próxima entrega es una re-entrega y activar el diálogo de canal de cambios.

---

**El ciclo completo de una ronda de cambios**

* Cliente ve los renders → comercial recibe el pedido por WhatsApp → entra al panel y presiona "Solicitar Cambios" → elige "Comercial WhatsApp" → escribe los cambios → confirma  
* Diseñador recibe notificación \+ tarea. Admin/CEO reciben copia.  
* Diseñador actualiza los renders, presiona "Enviar Renders" (que ya detecta revisión ≥ 1\) → modal pregunta cómo llegaron los cambios → elige "WhatsApp" → confirma  
* Se envía WhatsApp al cliente con el nuevo enlace al portal. Admin/CEO reciben notificación de que hay nueva versión lista.  
* Cliente aprueba desde el portal, o el comercial aprueba con motivo delegado desde el panel.

**Pregunta 3**

¿La aprobación del modelado debe hacerla el cliente final desde su link del proyecto, o también vale que un miembro del equipo la registre en su nombre después de una llamada?

*¿Por qué importa? Define los botones del portal público y el registro interno de aprobaciones.*

**Su respuesta:Sí, ambas vías son válidas y las dos están implementadas.**

---

**Vía principal — Cliente desde su link público**

**El cliente recibe el link por WhatsApp sin necesidad de login ni app. Lo abre en el navegador del celular y desde ahí tiene dos botones:**

* **Aprobar — escribe su nombre y confirma. El sistema graba `modeladoApprovedAt`, `modeladoApprovedBy` con el nombre que escribió, avanza el estado del proyecto (`pendiente_modelado` → `pendiente_render` si es modelado; `pendiente_render` → `aprobacion_final` si son renders), calcula la fecha estimada de instalación en 25 días hábiles, crea una tarea automática para el diseñador y envía notificaciones push al equipo.**  
* **Solicitar cambios — escribe qué quiere cambiar. El proyecto vuelve a `en_diseno`, el diseñador recibe tarea \+ notificación, y admin/CEO reciben copia.**

**Esta es la ruta normal para la gran mayoría de clientes.**

---

**Vía secundaria — Comercial registra en nombre del cliente**

**Para clientes que aprobaron por teléfono, presencial o WhatsApp directo sin abrir el link, el comercial o admin entra al panel interno y presiona "Aprobar Diseño". Esto abre el modal de aprobación delegada que exige elegir obligatoriamente el motivo: Presencial, WhatsApp familiar, Teléfono o WhatsApp cliente. El sistema graba `modeladoApprovedBy` como `"[nombre del admin] (delegado — WhatsApp familiar)"` y notifica a los demás admins con el motivo. El historial queda limpio y distingue claramente una aprobación directa del cliente de una delegada.**

---

**La diferencia en el historial**

| Quién aprobó | Cómo queda registrado |
| ----- | ----- |
| **Cliente desde el link** | **`"Juan Pérez"`** |
| **Comercial en nombre del cliente** | **`"María López (delegado — presencial)"`** |

**Pregunta 4**

Para clientes mayores que delegan en un familiar: ¿qué evidencia es suficiente para registrar la aprobación? (captura del chat de WhatsApp, nota de voz, correo)

*¿Por qué importa? La evidencia queda guardada junto a la aprobación para evitar disputas de "yo nunca aprobé eso".*

**Su respuesta:¿Para clientes mayores que delegan en un familiar, qué evidencia es suficiente para registrar la aprobación?**

---

**Lo que el sistema acepta hoy como evidencia**

**Cuando el comercial registra una aprobación delegada (en nombre del cliente), el modal le pide tres cosas:**

1. **Motivo obligatorio — cómo aprobó: Presencial, WhatsApp familiar, Teléfono, WhatsApp cliente. Sin esto el botón no se activa.**  
2. **Nota libre opcional — texto donde el comercial puede escribir cualquier detalle adicional: "El hijo confirmó que el padre vio el diseño y está de acuerdo", "Llamada de 10 minutos, aprobó todo".**  
3. **Archivo adjunto opcional — captura de pantalla del chat de WhatsApp, foto de un correo, imagen de cualquier comunicación. Se sube directamente desde el celular o computador del comercial (JPG, PNG o PDF, máximo 10MB), queda almacenado en el servidor y vinculado al evento de aprobación en el historial del proyecto.**

---

**Qué queda registrado en el historial**

**Cada aprobación delegada genera una entrada inamovible en el historial del proyecto con: fecha y hora exacta, quién del equipo ejecutó el registro, el motivo (ej. "WhatsApp familiar"), la nota si la escribió, y un enlace directo al archivo adjunto si lo subió. Eso no se puede editar ni borrar después.**

---

**Qué es suficiente en la práctica**

**Para el 80% de los casos — cliente mayor que aprueba por llamada o WhatsApp con el hijo — basta el motivo \+ una nota corta. El campo de archivo es para los casos donde el comercial ya tiene la captura del chat en el celular y la sube en el momento, que es cuando más valor tiene: no requiere ningún esfuerzo extra si ya tienes la captura.**

**Si el cliente dice después "yo nunca aprobé eso", el sistema muestra: quién registró la aprobación, cuándo, bajo qué motivo, y opcionalmente el archivo que lo respalda.**

**Pregunta 5**

¿Qué datos del familiar que aprueba debemos guardar? (nombre, parentesco, teléfono)

*¿Por qué importa? Queda en el historial del proyecto junto a la evidencia de la aprobación.*

**Su respuesta:¿Qué datos del familiar que aprueba debemos guardar?**

---

**Lo que el sistema guarda hoy del familiar**

**Cuando el comercial registra una aprobación delegada y el motivo es "WhatsApp familiar" (o cualquier otro), el modal le pide ahora de forma explícita:**

**Nombre del familiar — campo de texto libre. Ej: "Carlos Pérez". Opcional pero visible, el comercial sabe que debe llenarlo.**

**Parentesco — campo de texto libre. Ej: "hijo", "esposa", "hermano", "apoderado". Sin lista cerrada para no limitar casos reales.**

**Ambos campos se graban en el historial del proyecto como `"Familiar: Carlos Pérez (hijo)"` dentro de la entrada de aprobación, junto al motivo (cómo aprobó), la nota libre, y el archivo adjunto si lo subió.**

**Teléfono — no se pide. Si el familiar ya está en los contactos del comercial, guardarlo aquí es redundante. Si en un caso particular importa, el comercial puede escribirlo en la nota libre.**

---

**Qué queda en el historial ante una disputa**

**Una entrada inamovible con: fecha y hora, quién del equipo registró la aprobación, el motivo (ej. "WhatsApp familiar"), el nombre y parentesco del familiar que aprobó, la nota adicional si la escribió, y el enlace al archivo de evidencia adjunto si lo subió. Todo junto, en un solo registro, sin edición posterior posible.**

**Pregunta 6**

Si el cliente no aprueba en varios días, ¿a los cuántos días enviamos recordatorio y cuántos recordatorios máximo?

*¿Por qué importa? Configura los recordatorios automáticos por WhatsApp.*

**Su respuesta:¿Si el cliente no aprueba en varios días, qué pasa?**

**El sistema ahora envía recordatorios automáticos en tres etapas desde el momento en que se entrega el diseño al cliente:**

**T+5 horas — WhatsApp automático al cliente repitiendo el link del portal con el mensaje: *"Te recordamos que tu Modelado 3D / Renders está esperando tu revisión y aprobación."***

**T+48 horas (Día 2\) — Segundo WhatsApp al cliente con mensaje más directo: *"Aún estamos esperando tu aprobación, por favor revísalo cuando puedas."***

**T+96 horas (Día 4\) — Sin más WhatsApp al cliente. Se dispara una notificación interna a todos los comerciales y admins: *"\[Nombre cliente\] lleva más de 4 días sin aprobar el diseño. Contacto manual necesario."***

**El contador se reinicia a cero automáticamente cada vez que el equipo envía una nueva versión al cliente (modelado o renders). Si el cliente aprueba o solicita cambios antes de que se cumplan los tiempos, los recordatorios se detienen solos porque el proyecto sale del estado `pendiente_modelado` / `pendiente_render`.**

**Pregunta 7**

¿La producción debe quedar BLOQUEADA hasta que el render esté aprobado, o hay excepciones donde se arranca sin esa aprobación?

*¿Por qué importa? Define si el sistema impide mover el proyecto a producción sin aprobación registrada.*

   **¿La producción debe quedar bloqueada hasta que el render esté aprobado?**

No hay bloqueo duro. El sistema aplica **advertencia con override** según el caso:

**Proyectos con diseño completo:** cuando el admin pulsa "Pasar a Producción", el sistema verifica si hay `rendersApprovedAt` registrado. Si no lo hay (porque el cliente aprobó por teléfono y nadie lo registró formalmente), aparece un modal ámbar avisando la situación. El admin puede cancelar o confirmar — si confirma, el proyecto avanza a despiece normalmente.

**Proyectos que aprueban por portal o aprobación delegada:** pasan directo sin ver ningún aviso, porque `rendersApprovedAt` ya queda registrado automáticamente en ambos flujos.

**Proyectos sin proceso de diseño (`skipDesignProcess`):** van directamente a taller desde `cotizacion_aprobada`/`adelanto_recibido` por un botón separado. No pasan por el flujo de renders, así que el chequeo no aplica.

En todos los casos queda trazabilidad en el historial del proyecto.

**Pregunta 8**

¿En qué formato se entregan el modelado y el render al cliente? (imágenes, PDF, video) ¿Tamaño máximo aproximado de los archivos?

*¿Por qué importa? Configura qué tipos de archivo acepta el sistema y cómo se muestran en el portal del cliente.*

**Su respuesta: ¿En qué formato se entregan el modelado y el render al cliente?**

**El sistema acepta y gestiona dos tipos de archivo: imágenes (JPG/PNG) y PDF. El límite es 12MB por archivo, sin restricción en cantidad. Las imágenes pasan por compresión automática en el cliente antes de subirse (máx 1920px de ancho, calidad 80%). Los PDFs se suben tal cual sin compresión.**

**En el portal del cliente, el sistema ya distingue entre ambos tipos — las imágenes se muestran en galería visual y los PDFs se muestran con un ícono de documento para abrir/descargar. El filtro de tipos inválidos rechaza cualquier archivo que no sea imagen o PDF con un mensaje de error claro.**

**Pregunta 9**

El aviso al diseñador para iniciar el diseño: ¿debe salir cuando el cliente aprueba la cotización o cuando se verifica el pago del anticipo (60%)? Respondiendo la pregunta: el diseñador recibe la notificación *"✨ Cliente Confirmado \- Iniciar Diseño"* únicamente cuando el admin marca que el anticipo fue recibido, moviendo el proyecto a `adelanto_recibido`. Antes de ese momento, aunque la cotización esté aprobada, el diseñador no recibe ningún aviso.

*¿Por qué importa? Hoy sale al verificar el pago; usted pidió que fuera con la aprobación. Confírmenos la regla final.*

**Su respuesta:** ⏳ **Pendiente — el cliente no respondió.** Decisión abierta y conflicto conocido: hoy el aviso al diseñador (*"✨ Cliente Confirmado - Iniciar Diseño"*) se dispara al verificar el pago del anticipo (estado `adelanto_recibido`); el cliente había pedido que se disparara al **aprobar la cotización**. Requiere confirmación expresa del cliente antes de cambiar la regla.

**Pregunta 10**

Las fotos y medidas que se toman en la visita técnica: ¿quién las toma y deben aparecerle al diseñador en la ficha del proyecto automáticamente?

*¿Por qué importa? Conecta la visita técnica con el diseño sin pasos manuales.*

**Su respuesta:** Perfecto. Así funciona el proceso completo en INNOVAR:

#### El flujo desde la visita técnica hasta el diseño

Cuando un cliente confirma que quiere una cocina, closet o cualquier trabajo, el primer paso no es diseñar — es medir. El técnico de medidas recibe la asignación, va a la obra, y abre el portal desde su celular o iPad.

En campo, el técnico crea la visita, selecciona el tipo de trabajo, registra los datos del cliente y empieza a tomar medidas. Los campos aparecen según el tipo de proyecto: para una cocina pide ancho total, alto del cielo raso, profundidad, medidas de ventana. Para un closet pide nicho, alto y profundidad. Todo en centímetros, campo por campo, sin confusión.

Mientras mide, también fotografía el espacio. Toma fotos del espacio general, de la ventana, de los puntos hidráulicos, de los tomacorrientes, de los detalles que el diseñador necesita ver. Las sube directamente desde la cámara del celular, se comprimen automáticamente y quedan guardadas en el sistema. Después exporta el plano que dibujó en GoodNotes como PDF, lo sube, y el sistema lo comprime con Ghostscript antes de almacenarlo.

Cuando todo está completo, el técnico presiona "Enviar al equipo". En ese instante el admin, el comercial y los diseñadores reciben una notificación push con el nombre del cliente, el tipo de trabajo y la dirección.

#### Lo que ve el diseñador

El diseñador no espera WhatsApp, no persigue fotos, no pregunta medidas. Cuando abre la ficha del proyecto en el sistema, encuentra una sección llamada **Levantamiento técnico** que tiene todo lo que tomó el medidor:

- **Las fotos organizadas en galería** — no mezcladas, sino categorizadas. El diseñador sabe exactamente cuál foto muestra la ventana, cuál muestra el punto hidráulico, cuál es la vista general. Puede abrirlas en pantalla completa para ver los detalles.
- **Las medidas como tabla de referencia** — ancho total, alto del cielo, profundidad, medidas de ventana. Esos datos están ahí cuando el diseñador abre el software de diseño para empezar a modelar.
- **El PDF del plano anotado** — el dibujo a mano que hizo el técnico en GoodNotes con todas las acotaciones. El diseñador lo abre directamente desde la ficha del proyecto con un clic.
- **Las notas técnicas** — observaciones que el medidor dejó sobre columnas, tuberías existentes, tomas de corriente mal ubicadas, irregularidades del espacio. Cosas que no aparecen en una foto pero que el diseñador necesita saber antes de proponer un diseño.

#### Por qué esto cambia el proceso de diseño

El diseñador llega al proyecto con contexto completo. No empieza desde cero preguntando. No espera que alguien le mande archivos. No trabaja con medidas aproximadas porque "el técnico no se acordaba bien del ancho exacto". El tiempo entre visita técnica y primer boceto de diseño baja dramáticamente porque no hay pasos manuales en el medio. Y si hay alguna duda sobre el espacio — ¿había una columna en ese rincón? ¿cómo estaba orientada la ventana? — la respuesta está en las fotos, no en la memoria de alguien.

**Pregunta 11**

¿El cliente final debe ver el historial de versiones del diseño (V1, V2, V3) en su portal, o solo la última versión vigente?

*¿Por qué importa? Define la galería de diseño del portal del cliente.*

**Su respuesta:** El cliente ve solo la versión vigente, no el historial.

El portal del cliente muestra únicamente la versión actual del diseño — la que el equipo considera lista para presentar. No ve V1, V2, V3 en secuencia. No ve los intentos anteriores, las correcciones intermedias, los cambios que se descartaron.

La razón es simple: mostrarle el historial completo al cliente genera confusión y conversaciones innecesarias. Si el cliente ve que hubo una V1 y una V2 antes de llegar a la V3 que está aprobando, la primera pregunta es "¿y por qué cambió esto?" o "¿me puedo quedar con ese detalle de la V1?". Eso abre discusiones que el equipo ya cerró internamente y alarga el proceso de aprobación.

El historial de versiones existe en el sistema — el equipo lo ve completo, con fechas, con los motivos de cambio registrados, con quién aprobó qué. Pero esa es información interna de gestión, no información del cliente.

#### Lo que sí ve el cliente en su portal

El cliente entra y encuentra su diseño vigente presentado de la mejor manera posible: las imágenes en alta calidad, organizadas, con el nombre del proyecto y el tipo de trabajo. Si hay múltiples espacios — cocina y closet en el mismo proyecto — los ve separados y claros. Ve el estado del proyecto en ese momento (en diseño, aprobado, en producción), los hitos que ya pasaron y los que vienen, y tiene un canal directo para aprobar o pedir ajustes. Lo que **no** ve: comentarios internos del equipo, versiones anteriores, notas de producción, costos, márgenes, ni ninguna comunicación interna.

#### Por qué esta distinción importa para la galería del portal

La galería del portal del cliente no es un repositorio de archivos — es una presentación. Debe verse como si un diseñador la hubiera curado para esa persona específica: una sola versión, bien presentada, con contexto claro sobre qué está mirando y qué se espera de él. El historial completo queda del lado del equipo, donde sirve para aprender, resolver disputas y tener trazabilidad total del proceso de diseño.

**Pregunta 12**

Cuando el render queda aprobado, ¿quién más debe enterarse además del diseñador? (producción, gerencia, comercial)

*¿Por qué importa? Configura la cadena de avisos del hito más importante del ciclo.*

**Su respuesta:** En INNOVAR, la aprobación del render no es solo un evento del diseñador — es una señal que activa a tres áreas al mismo tiempo.

#### Producción se entera primero

La aprobación del render es la luz verde para que producción empiece a planear. El jefe de taller recibe una notificación inmediata con el nombre del cliente, el tipo de trabajo y el proyecto. Eso le permite revisar la carga de trabajo, estimar cuándo puede entrar ese proyecto a fabricación, y anticipar los materiales que va a necesitar. Con la notificación automática, el jefe de taller ya está pensando en ese proyecto desde el momento en que el cliente dice que sí.

#### Comercial necesita saberlo para cerrar el ciclo con el cliente

El comercial que acompañó ese proyecto desde la cotización necesita saber que el diseño fue aprobado. Es su señal para hacer seguimiento al cliente, confirmar condiciones de entrega, aclarar dudas de última hora, y preparar el camino hacia la instalación. También es información de gestión: saber cuáles de sus proyectos activos ya tienen diseño aprobado le ayuda a priorizar.

#### Gerencia lo ve en el cuadro general, no en notificación individual

El CEO o gerente no necesita una notificación por cada render aprobado — eso sería ruido. Lo que sí necesita es que ese evento quede reflejado en el dashboard de trazabilidad del proyecto, para ver cuántos proyectos están en diseño aprobado, cuántos en producción, cuántos retrasados. La aprobación del render mueve el proyecto de una etapa a otra visualmente en el sistema; gerencia lo lee en el contexto del negocio completo.

#### El cliente también recibe confirmación

Cuando el comercial o el sistema confirma la aprobación, el cliente recibe un mensaje en su portal diciéndole que su diseño fue aprobado y que el proyecto pasa a la siguiente fase. Eso cierra el ciclo de comunicación con él.

#### Por qué importa que todos se enteren al mismo tiempo (justificación del cliente)

Porque la aprobación del render es el único momento del ciclo donde convergen todas las áreas de la empresa al mismo tiempo. Antes de ese hito cada área trabaja en su propio mundo; después, todas tienen trabajo concreto. Si ese hito no se comunica bien — si la información viaja por WhatsApp, si alguien se olvida de avisar, si el jefe de taller se entera dos días después — ese momento de sincronización se desperdicia.

**La cadena de avisos no es logística — es ritmo operativo.** Una empresa de cocinas integrales vive del tiempo entre "cliente aprueba" y "proyecto entregado". Si producción reacciona el mismo día, reserva espacio en taller esa semana; si se entera tres días después, ese espacio ya lo ocupó otro proyecto. Si el comercial sabe ese mismo día, llama al cliente mientras la emoción de la aprobación está fresca. Si gerencia ve el movimiento en el dashboard en tiempo real, toma decisiones de capacidad antes de que sean un problema. Por eso la cadena de avisos del render aprobado es la más importante del ciclo.

---

*Muchas gracias por sus respuestas. Una vez completado, comparta este documento de vuelta para que podamos configurar el sistema.*