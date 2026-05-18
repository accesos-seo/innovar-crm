**Patrón escalable y reutilizable para flujos de captura, inspección y conversión entre entidades de negocio.**

> **Versión:** 2.0  ·  **Clasificación:** Técnico  ·  **Alcance:** Sistemas Frontend / Fullstack

---

## 1. Propósito y Alcance del Documento
Este documento define la arquitectura de referencia para implementar un Pipeline Genérico de Conversión de Entidades (PGCE): un patrón de diseño de software que describe cómo una entidad de negocio de tipo Origen (ej. solicitud, oportunidad, pedido, ticket) puede ser capturada, inspeccionada y convertida en una entidad de tipo Destino (ej. cotización, propuesta, factura, orden de trabajo) de manera estructurada, escalable y con mínima fricción para el usuario.

El patrón es completamente agnóstico al dominio de negocio. Las referencias a "Solicitud" y "Cotización" usadas en ejemplos de código son instancias ilustrativas del patrón y no constituyen una dependencia conceptual del mismo.

> ⚠️ **Principio Rector**
> Ningún módulo del sistema debe conocer la existencia interna del otro. La comunicación entre entidades ocurre exclusivamente a través de identificadores, interfaces contractuales y funciones adaptadoras. El acoplamiento cero entre módulos es condición necesaria, no opcional.

### 1.1. Casos de uso que resuelve este patrón
El siguiente listado enumera escenarios de negocio donde el PGCE aplica de forma directa:
* Solicitud de servicio → Cotización formal
* Oportunidad comercial → Propuesta de venta
* Carrito de compra → Pedido confirmado
* Ticket de soporte → Orden de trabajo interna
* Cotización aprobada → Factura de cobro
* Prospecto calificado → Contrato de cliente

---

## 2. Definición del Pipeline: Las 5 Fases
El proceso se divide en 5 fases lógicas completamente independientes entre sí. Cada fase puede ser probada, desplegada y mantenida de forma autónoma.

| Fase | Nombre | Responsabilidad |
| :--- | :--- | :--- |
| **F1** | **Captura (Origen)** | El actor (usuario interno o externo) registra una entidad Origen a través de un formulario de intención. El sistema asigna el estado inicial definido en la FSM. |
| **F2** | **Cola de Trabajo** | Los gestores visualizan una tabla paginada de entidades. El sistema aplica renderizado condicional: las entidades en estado inicial son destacadas con un indicador visual (`StatusBadge`), actuando como bandeja de entrada priorizada. |
| **F3** | **Inspección (Modal)** | Al seleccionar un registro, se levanta un componente de superposición (`PreviewDialog`) en modo solo lectura. Esto permite revisar la entidad sin perder el contexto de la cola de trabajo. |
| **F4** | **Transición** | Dentro del `PreviewDialog`, existe una acción primaria (CTA). Al activarla, el sistema redirige al módulo Destino inyectando el identificador de la entidad Origen en la URL como Query Parameter. |
| **F5** | **Inyección (Destino)** | El módulo Destino detecta el identificador en la URL, levanta una interfaz de confirmación y aplica la función adaptadora (Mapper) para pre-poblar automáticamente los campos del formulario Destino. |

---

## 3. Enrutamiento Desacoplado (Routing)
El enrutamiento del sistema debe garantizar que los módulos Origen y Destino sean completamente independientes. Ninguno debe tener referencias internas al otro; la única dependencia permitida es el identificador de entidad viajando como Query Parameter en la URL.

### 3.1. Estructura lógica de rutas recomendada

```tsx
// Estructura genérica de rutas (compatible con React Router, Next.js, etc.)
<Routes>
  {/* ── Módulo Origen ────────────────────────────────────── */}
  <Route path="/:entidad-origen"       element={<EntityList   origin="origen"  />} />
  <Route path="/:entidad-origen/nueva" element={<EntityBuilder type="origen"   />} />

  {/* ── Módulo Destino ───────────────────────────────────── */}
  <Route path="/:entidad-destino"       element={<EntityList   origin="destino" />} />

  {/*
   *  La ruta de creación DEBE aceptar Query Parameters opcionales.
   *  ?source_id=<id>  →  activa la inyección automática de datos.
   *  Sin el parámetro, el formulario inicia vacío (flujo manual).
   */}
  <Route path="/:entidad-destino/nueva" element={<EntityBuilder type="destino"  />} />
</Routes>

Decisión de diseño: URL sobre estado global
Se prefiere el Query Parameter (?source_id=123) sobre el estado global (Redux/Zustand) porque la URL preserva el contexto ante una recarga de página, apertura en nueva pestaña, o envío del enlace a otro usuario. El estado global falla en todos estos escenarios sin implementación adicional.

4. Catálogo de Componentes

Para garantizar la reutilización, la interfaz debe dividirse en los siguientes componentes modulares con responsabilidades únicas y bien delimitadas (Principio de Responsabilidad Única, SRP).

Componente	Tipo	Responsabilidad única
StatusBadge	UI Presentacional	Recibe un estado (string/enum) y devuelve una etiqueta con color e ícono. Sin lógica de negocio. Completamente reutilizable en cualquier tabla.
EntityList / DataGrid	UI Contenedor	Lista paginada o virtualizada de entidades. Delega la visualización de estado a StatusBadge. Emite eventos al seleccionar un registro.
PreviewDialog	UI Modal	Contenedor genérico que recibe un ID, ejecuta el fetch de datos y muestra el resumen. Incluye el CTA de conversión. Solo lectura por contrato.
EntityBuilder / FormEngine	Motor de Formulario	Formulario complejo (React Hook Form o equivalente) con capacidad de recibir valores iniciales masivos vía reset() o setValue(). Agnóstico al origen.
DataImporter	UI Utilitario	Botón y modal dentro del Destino que permite buscar y seleccionar entidades Origen manualmente. Alternativa al flujo guiado por URL.
ConversionMapper	Utilidad Pura	Función adaptadora que transforma un objeto Origen en un objeto Destino parcial. Sin efectos secundarios. Testeable de forma aislada.
IConvertibleEntity	Contrato / Interfaz	Interfaz TypeScript que toda entidad Origen debe implementar para ser compatible con DataImporter y ConversionMapper. Garantiza interoperabilidad.
5. Patrones de Diseño y Estructuras Lógicas
A. Máquina de Estados Finita (FSM) para Entidades

El estado de cualquier entidad no debe ser un string arbitrario. Debe definirse como un tipo estricto que centralice la lógica de transición y prevenga estados inválidos.

code
TypeScript
download
content_copy
expand_less
// contracts/entity-states.ts
// Plantilla genérica: reemplazar con los estados del dominio específico

export enum SourceEntityState {
  PENDING     = "PENDING",     // Estado inicial · Muestra indicador visual destacado
  IN_PROGRESS = "IN_PROGRESS", // En gestión  · Indicador visual neutro
  CONVERTED   = "CONVERTED",   // Convertida    · Ocultar del selector DataImporter
  CLOSED      = "CLOSED",      // Cerrada       · Solo visible en histórico
}

// Mapa de transiciones válidas
export const VALID_TRANSITIONS: Record<SourceEntityState, SourceEntityState[]> = {
  [SourceEntityState.PENDING]:     [SourceEntityState.IN_PROGRESS, SourceEntityState.CLOSED],
  [SourceEntityState.IN_PROGRESS]: [SourceEntityState.CONVERTED,  SourceEntityState.CLOSED],
  [SourceEntityState.CONVERTED]:   [],   // Estado terminal: no permite más transiciones
  [SourceEntityState.CLOSED]:      [],   // Estado terminal
};

// Guardia de transición — validar antes de persistir cambios de estado
export const canTransition = (from: SourceEntityState, to: SourceEntityState): boolean =>
  VALID_TRANSITIONS[from].includes(to);

Estado CONVERTED: comportamiento esperado en la UI
Las entidades en estado CONVERTED deben: (1) Mostrar un badge diferenciado en la tabla. (2) Ser excluidas del selector DataImporter para evitar doble conversión. (3) Permanecer visibles en la lista general con filtro opcional.

B. Interfaz Contractual IConvertibleEntity

Garantiza la interoperabilidad entre el DataImporter y cualquier entidad Origen.

code
TypeScript
download
content_copy
expand_less
// contracts/convertible-entity.interface.ts

export interface IConvertibleEntity {
  readonly id:          string;            // Identificador único e inmutable
  readonly displayName: string;            // Texto legible para mostrar en selectores
  readonly state:       string;            // Estado actual (debe ser SourceEntityState)
  readonly createdAt:   Date;              // Timestamp de creación
  readonly metadata:    Record<string, unknown>; // Campos arbitrarios del dominio
}

export type MappedFormData<T> = Partial<T> & {
  source_id:   string;   // Referencia trazable al Origen (NUNCA debe omitirse)
  source_type: string;   // Tipo de entidad Origen (para auditoría)
};
C. Función Adaptadora (Mapper)

Es una función pura: dado el mismo input, produce siempre el mismo output, sin llamadas a API y sin estado mutable.

code
TypeScript
download
content_copy
expand_less
// utils/entity-mapper.ts
import type { IConvertibleEntity, MappedFormData } from "@/contracts/convertible-entity.interface";

export type EntityMapper<TSource extends IConvertibleEntity, TDestForm> =
  (source: TSource) => MappedFormData<TDestForm>;

export const createGenericMapper = <TSource extends IConvertibleEntity, TDest>(
  fieldMap: Partial<Record<keyof TDest, keyof TSource["metadata"]>>,
  sourceType: string
): EntityMapper<TSource, TDest> => {
  return (source: TSource): MappedFormData<TDest> => {
    const mapped: Partial<TDest> = {};

    for (const [destKey, sourceKey] of Object.entries(fieldMap)) {
      const value = source.metadata[sourceKey as string];
      if (value !== undefined) {
        (mapped as Record<string, unknown>)[destKey] = value;
      }
    }

    return {
      ...mapped,
      source_id:   source.id,       // Trazabilidad garantizada
      source_type: sourceType,      // Auditoría garantizada
    };
  };
};

### D. Componente `StatusBadge` Genérico
Puramente presentacional. Recibe un estado y una configuración; no contiene lógica de negocio. Se basa en clases inyectadas para permitir animaciones de UX (como titileo) sin acoplar el componente a un dominio específico.

```tsx
// components/ui/StatusBadge.tsx
import { LucideIcon } from "lucide-react";

export interface StatusConfig {
  label:     string;
  color:     string;
  bgColor:   string;
  icon?:     LucideIcon;
  iconClass?: string;
}

interface StatusBadgeProps<T extends string> {
  state:       T;
  configMap:   Record<T, StatusConfig>;
}

export const StatusBadge = <T extends string>(
  { state, configMap }: StatusBadgeProps<T>
) => {
  const config = configMap[state] ?? {
    label: state, color: "text-gray-800", bgColor: "bg-gray-100"
  };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${config.bgColor} ${config.color}`}>
      {Icon && <Icon size={12} className={config.iconClass} />}
      {config.label}
    </span>
  );
};

// ── Uso en el módulo de negocio (Ejemplo de inyección de UX) ───────────────
/*
import { Star } from "lucide-react";

export const MY_STATUS_CONFIG: Record<SourceEntityState, StatusConfig> = {
  PENDING: { 
    label: "Nueva",       
    bgColor: "bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)]", 
    color: "text-amber-500 border-amber-500/20",
    icon: Star, 
    iconClass: "fill-current animate-pulse" // <--- Animación inyectada sin acoplar el componente
  },
  IN_PROGRESS: { 
    label: "En proceso",  
    bgColor: "bg-blue-100",  
    color: "text-blue-800 border-blue-200" 
  }
};
*/

E. Transición con Contexto (CTA en el PreviewDialog)

Construye la URL de destino de forma dinámica inyectando el source_id.

code
Tsx
download
content_copy
expand_less
// components/PreviewDialog/ConversionCTA.tsx
import { useNavigate } from "react-router-dom";

interface ConversionCTAProps {
  sourceId:    string;
  targetPath:  string;
  label?:      string;
  onBeforeNavigate?: () => Promise<void>;
}

export const ConversionCTA = (
  { sourceId, targetPath, label = "Convertir", onBeforeNavigate }: ConversionCTAProps
) => {
  const navigate = useNavigate();

  const handleConvert = async () => {
    if (onBeforeNavigate) await onBeforeNavigate();
    const url = new URL(targetPath, window.location.origin);
    url.searchParams.set("source_id", sourceId);
    navigate(`${url.pathname}${url.search}`);
  };

  return <button onClick={handleConvert}>{label}</button>;
};
F. Motor de Destino con Inyección Automática

El EntityBuilder maneja el ciclo de vida asíncrono y los estados de concurrencia.

code
Tsx
download
content_copy
expand_less
// features/entity-builder/EntityBuilder.tsx
import { useEffect, useState, useRef } from "react";
import { useSearchParams }              from "react-router-dom";
import { useForm }                      from "react-hook-form";

interface EntityBuilderProps<TSource extends IConvertibleEntity, TDestForm> {
  fetchSource: (id: string) => Promise<TSource>;
  mapper:      EntityMapper<TSource, TDestForm>;
  onSourceAlreadyConverted?: (source: TSource) => void;
}

export const EntityBuilder = <TSource extends IConvertibleEntity, TDestForm>(
  { fetchSource, mapper, onSourceAlreadyConverted }: EntityBuilderProps<TSource, TDestForm>
) => {
  const [searchParams]                 = useSearchParams();
  const sourceId                        = searchParams.get("source_id");
  const { setValue, reset }             = useForm<TDestForm>();
  const [importState, setImportState]   = useState<"idle" | "loading" | "success" | "error" | "already_converted">("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sourceId) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setImportState("loading");

    fetchSource(sourceId)
      .then((source) => {
        if (source.state === SourceEntityState.CONVERTED) {
          setImportState("already_converted");
          onSourceAlreadyConverted?.(source);
          return;
        }

        const mappedData = mapper(source);
        Object.entries(mappedData).forEach(([key, value]) => {
          if (value !== undefined) {
            setValue(key as keyof TDestForm, value as TDestForm[keyof TDestForm]);
          }
        });

        setImportState("success");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setImportState("error");
      });

    return () => abortRef.current?.abort();
  }, [sourceId]);

  return (
    <div>
      {/* Renderizado condicional de UI según importState */}
      <DataImporter onSelect={(data) => reset(mapper(data) as TDestForm)} />
    </div>
  );
};
6. Manejo de Concurrencia: El Gap Crítico

El sistema debe prevenir conversiones duplicadas si múltiples usuarios acceden al mismo registro simultáneamente.

6.1. Bloqueo Optimista
code
TypeScript
download
content_copy
expand_less
// En el backend: endpoint de claim atómico
async claimEntity(id: string, userId: string): Promise<ClaimResult> {
  const result = await db.entities.updateOne(
    { id, state: SourceEntityState.PENDING }, // Solo actualizar si es PENDING
    { $set: { state: SourceEntityState.IN_PROGRESS, claimedBy: userId } }
  );

  if (result.modifiedCount === 0) {
    const current = await db.entities.findOne({ id });
    return { success: false, claimedBy: current?.claimedBy };
  }
  return { success: true };
}
6.2. Idempotencia en el Destino
code
TypeScript
download
content_copy
expand_less
// En el backend del módulo Destino
async createDestinationEntity(payload: CreateDestinationDto): Promise<DestinationEntity> {
  if (payload.source_id) {
    const existing = await db.destinations.findOne({ source_id: payload.source_id });
    if (existing) return existing; // Evita duplicados
  }
  return await db.destinations.create(payload);
}
7. Visibilidad de Entidades Convertidas en la UI
Contexto de UI	Comportamiento requerido	Razón
Cola de trabajo (lista principal)	Visible. Badge diferenciado (check verde). CTA deshabilitado.	Trazabilidad y auditoría del equipo.
DataImporter (selector en Destino)	Excluida por defecto. Filtro opcional para mostrarlas.	Prevenir doble conversión.
Historial / Reportes	Siempre visible con todos los estados.	Cumplimiento y análisis.
Modal de Preview (PreviewDialog)	Visible. Banner informativo indicando conversión. Enlace al Destino.	Transparencia y navegación.
8. Soporte de Doble Flujo de Entrada

El pipeline debe soportar dos formas de iniciar la conversión:

Flujo Guiado (desde Origen): PreviewDialog → CTA → Redirección con source_id en la URL → Inyección automática.

Flujo Directo (desde Destino): Ruta de creación directa → Formulario vacío → Selección manual vía DataImporter.

code
JavaScript
download
content_copy
expand_less
// Lógica de entrada en EntityBuilder (pseudo-código)
const sourceId = searchParams.get("source_id");

if (sourceId) {
  startAutoImport(sourceId); // Flujo guiado
} else {
  initEmptyForm(); // Flujo directo
}
9. Garantías de Escalabilidad

Bajo Acoplamiento (Loose Coupling): La entidad Origen no conoce al Destino.

Extensibilidad sin Modificación (OCP): Agregar un nuevo flujo solo requiere configurar un nuevo Mapper y Rutas.

Compatibilidad con SSR: Funciona con Next.js/Remix al usar URL searchParams.

Trazabilidad y Auditoría: source_id es obligatorio por contrato.

Testabilidad Aislada: Funciones puras fácilmente testeables.

10. Checklist de Implementación

Definir estados del Origen como enum con VALID_TRANSITIONS.

Implementar IConvertibleEntity en la entidad Origen.

Crear la función EntityMapper concreta.

Configurar las rutas desacopladas.

Implementar el claim atómico en el backend (Bloqueo Optimista).

Implementar verificación de idempotencia en el endpoint Destino.

Definir el configMap de StatusBadge.

Configurar el filtro de exclusión de estados CONVERTED en DataImporter.

Agregar banner informativo en el PreviewDialog para entidades convertidas.

Escribir tests unitarios para Mapper, FSM Guards y StatusBadge.

v2.0 — Arquitectura revisada y completada. Clasificación: Técnico — Interno.

code
Code
download
content_copy
expand_less