
# Arquitectura del Sistema de Cotización Universal

Este documento define las reglas de ingeniería para crear cualquier módulo de cotización en este proyecto. Todo nuevo producto DEBE seguir estrictamente esta arquitectura de 4 capas (Separation of Concerns).

## REGLA 1: Capa de Lógica Pura (Engine)
Ruta: `/src/features/[producto]/logic.ts`
- Aquí residen las matemáticas. Nada de React.
- Debe exportar un `interface [Producto]Input` con los datos que ingresa el usuario.
- Debe contener constantes o diccionarios de precios.
- Debe exportar una función matemática pura que calcule: áreas, subtotales, descuentos y totales.

## REGLA 2: Capa Adaptadora (Hooks)
Ruta: `/src/hooks/use-[producto]-calculator.ts`
- Es el puente entre el formulario UI y la Lógica Pura.
- Recibe un objeto (ej. formData), formatea los datos y ejecuta el motor matemático.
- Usa `useMemo` para no recalcular si no hay cambios.

## REGLA 3: Capa de Interfaz de Usuario (UI)
Ruta: `/src/features/[producto]/[Producto]Cotizador.tsx`
- Contiene el formulario (inputs, selects) usando TailwindCSS.
- Se conecta al custom hook de la Regla 2.
- Muestra los resultados en tiempo real en la pantalla.

## REGLA 4: Capa de PDF de Alta Ingeniería
Ruta: `/src/components/pdf/templates/[Producto]Template.tsx`
- Es un componente React de diseño editorial preparado para ser capturado de forma invisible (html-to-image).
- DEBE respetar 5 sub-capas visuales:
  1. Identidad (Header corporativo y fecha).
  2. Relación (Datos del cliente).
  3. Ingeniería (Tabla de especificaciones del producto, áreas, medidas y textos descriptivos de "Lo que incluye").
  4. Conversión (Desglose numérico: subtotal, transporte, descuento, total final).
  5. Presencia (Footer con firmas y contacto).
