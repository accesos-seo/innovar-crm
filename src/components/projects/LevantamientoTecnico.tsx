import React from "react";
import { Ruler, Camera, StickyNote, User, Plug, Layers, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-utils";
import {
  useProjectLevantamiento,
  type ProjectLevantamiento,
} from "@/hooks/useProjectLevantamiento";
import {
  VISIT_SERVICE_LABELS,
  type VisitServiceKey,
} from "@/lib/schemas/visit-measurements";

const FORMA_LABELS: Record<string, string> = {
  lineal: "Lineal",
  L: "En L",
  U: "En U",
  isla: "Isla",
  peninsula: "Península",
};
const VOLTAJE_LABELS: Record<string, string> = {
  "110": "110V",
  "220": "220V",
  ambos: "110V / 220V",
};
const GAS_LABELS: Record<string, string> = {
  natural: "Natural",
  propano: "Propano",
  ninguno: "Ninguno",
};
const PARED_LABELS: Record<string, string> = {
  drywall: "Drywall",
  mamposteria: "Mampostería",
  mixto: "Mixto",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground">
        {value === undefined || value === null || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function SubBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-primary/70" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function Measurements({ m }: { m: NonNullable<ProjectLevantamiento["measurements"]> }) {
  const espacio = (m as any).espacio ?? {};
  const conexiones = (m as any).conexiones ?? {};
  const estado = (m as any).estado ?? {};
  const servicios = ((m as any).servicios ?? {}) as Record<
    string,
    { incluido?: boolean; notas?: string }
  >;

  const incluidos = Object.entries(servicios).filter(([, v]) => v?.incluido);

  return (
    <div className="space-y-8">
      <SubBlock icon={Ruler} title="Espacio">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Field label="Largo" value={espacio.largo_cm ? `${espacio.largo_cm} cm` : null} />
          <Field label="Ancho" value={espacio.ancho_cm ? `${espacio.ancho_cm} cm` : null} />
          <Field label="Alto" value={espacio.alto_cm ? `${espacio.alto_cm} cm` : null} />
          <Field label="Forma" value={FORMA_LABELS[espacio.forma] ?? espacio.forma} />
        </div>
      </SubBlock>

      <SubBlock icon={Plug} title="Conexiones">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Field label="Agua" value={conexiones.agua?.ubicacion} />
          <Field
            label="Gas"
            value={
              conexiones.gas
                ? [GAS_LABELS[conexiones.gas.tipo] ?? conexiones.gas.tipo, conexiones.gas.ubicacion]
                    .filter(Boolean)
                    .join(" · ")
                : null
            }
          />
          <Field label="Voltaje" value={VOLTAJE_LABELS[conexiones.voltaje] ?? conexiones.voltaje} />
          <Field label="Desagüe" value={conexiones.desague?.ubicacion} />
        </div>
      </SubBlock>

      <SubBlock icon={Layers} title="Estado del lugar">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Field label="Tipo de pared" value={PARED_LABELS[estado.tipo_pared] ?? estado.tipo_pared} />
          <Field label="Tipo de piso" value={estado.tipo_piso} />
          <Field
            label="Remover cocina actual"
            value={estado.remover_cocina_actual ? "Sí" : "No"}
          />
        </div>
      </SubBlock>

      <SubBlock icon={ClipboardList} title="Servicios a cotizar">
        {incluidos.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin servicios marcados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {incluidos.map(([key, v]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <Badge variant="outline" className="uppercase text-[10px] font-bold">
                  {VISIT_SERVICE_LABELS[key as VisitServiceKey] ?? key}
                </Badge>
                {v?.notas ? (
                  <span className="text-[10px] text-muted-foreground pl-1">{v.notas}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SubBlock>

      {(m as any).notas ? (
        <SubBlock icon={StickyNote} title="Notas de medidas">
          <p className="text-sm text-muted-foreground leading-relaxed italic">{(m as any).notas}</p>
        </SubBlock>
      ) : null}
    </div>
  );
}

export function LevantamientoTecnico({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectLevantamiento(projectId);

  return (
    <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
      <div className="p-6 border-b border-border/10 bg-muted/20 flex justify-between items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Ruler className="w-4 h-4 text-primary" />
          Levantamiento Técnico
        </h3>
        {data?.realized_at ? (
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <User className="w-3 h-3" />
            <span>
              {data.visited_by_name ? `${data.visited_by_name} · ` : ""}
              {formatDateTime(data.realized_at)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-4 w-1/3 bg-muted/40 rounded animate-pulse" />
            <div className="grid grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : !data ? (
          <div className="text-center py-12 border-2 border-dashed border-border/10 rounded-sm bg-muted/5">
            <Ruler className="w-6 h-6 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground italic">
              Este proyecto aún no tiene un levantamiento técnico registrado.
            </p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">
              Aparecerá automáticamente al finalizar la visita
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {data.measurements ? (
              <Measurements m={data.measurements} />
            ) : (
              <p className="text-sm text-muted-foreground italic">Sin medidas registradas.</p>
            )}

            {/* Galería de fotos */}
            <SubBlock icon={Camera} title={`Fotos del lugar (${data.photoUrls.length})`}>
              {data.photoUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin fotos registradas.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {data.photoUrls.map((photo) => (
                    <button
                      key={photo.path}
                      type="button"
                      onClick={() => photo.url && window.open(photo.url, "_blank", "noopener")}
                      className={cn(
                        "relative aspect-square rounded-md overflow-hidden border border-border/50 bg-muted/30 group",
                        photo.url ? "cursor-zoom-in" : "cursor-default"
                      )}
                    >
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt="Foto del levantamiento"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                          No disponible
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </SubBlock>

            {/* Notas técnicas de la visita */}
            {data.notes ? (
              <SubBlock icon={StickyNote} title="Notas técnicas">
                <p className="text-sm text-muted-foreground leading-relaxed italic">{data.notes}</p>
              </SubBlock>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
