import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Ruler, Plug, Wrench, Hammer, NotebookPen, ImagePlus } from 'lucide-react';
import { VisitPhotoUploader } from './VisitPhotoUploader';
import {
  type VisitMeasurementsV1,
  VISIT_SERVICE_KEYS,
  VISIT_SERVICE_LABELS,
  visitMeasurementsV1Schema,
  emptyVisitMeasurementsV1,
} from '@/lib/schemas/visit-measurements';

interface VisitMeasurementsFormProps {
  visitId: string;
  initialValues?: Partial<VisitMeasurementsV1>;
  initialPhotos?: string[];
  initialNotes?: string;
  onSubmit: (data: {
    measurements: VisitMeasurementsV1;
    photoPaths: string[];
    notes: string;
  }) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

type SectionKey = 'espacio' | 'conexiones' | 'estado' | 'servicios' | 'notas' | 'fotos';

const SECTIONS: Array<{ key: SectionKey; label: string; Icon: typeof Ruler }> = [
  { key: 'espacio', label: 'Espacio', Icon: Ruler },
  { key: 'conexiones', label: 'Conexiones', Icon: Plug },
  { key: 'estado', label: 'Estado actual', Icon: Wrench },
  { key: 'servicios', label: 'Servicios a cotizar', Icon: Hammer },
  { key: 'notas', label: 'Notas', Icon: NotebookPen },
  { key: 'fotos', label: 'Fotos', Icon: ImagePlus },
];

/**
 * Form de captura en sitio. 6 secciones colapsables. Submit valida con Zod
 * y delega al caller (que invocará `useFinishVisit`).
 */
export function VisitMeasurementsForm({
  visitId,
  initialValues,
  initialPhotos = [],
  initialNotes = '',
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: VisitMeasurementsFormProps) {
  const [data, setData] = useState<VisitMeasurementsV1>({
    ...emptyVisitMeasurementsV1(),
    ...(initialValues ?? {}),
  });
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['espacio']));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const update = <K extends keyof VisitMeasurementsV1>(
    key: K,
    value: VisitMeasurementsV1[K]
  ) => setData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = visitMeasurementsV1Schema.safeParse(data);
    const errs: Record<string, string> = {};

    if (!result.success) {
      for (const issue of result.error.issues) {
        errs[issue.path.join('.')] = issue.message;
      }
    }
    if (photos.length < 3) {
      errs['photos'] = 'Se requieren al menos 3 fotos';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // abrir primera sección con error
      const firstErr = Object.keys(errs)[0].split('.')[0] as SectionKey;
      const candidate = SECTIONS.find((s) => s.key === firstErr || s.key === 'fotos');
      if (candidate) setOpenSections((p) => new Set([...p, candidate.key]));
      return;
    }

    onSubmit({
      measurements: result.success ? result.data : data,
      photoPaths: photos,
      notes,
    });
  };

  const canSubmit = !disabled && !isSubmitting && photos.length >= 3;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {SECTIONS.map(({ key, label, Icon }) => {
        const isOpen = openSections.has(key);
        const sectionHasError = Object.keys(errors).some((k) => k.startsWith(key));
        return (
          <Card key={key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{label}</span>
                {sectionHasError && (
                  <span className="text-[10px] text-destructive uppercase tracking-wider font-bold">
                    Revisar
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {key === 'espacio' && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <FieldNumber
                        label="Largo (cm)"
                        value={data.espacio.largo_cm}
                        onChange={(v) =>
                          update('espacio', { ...data.espacio, largo_cm: v })
                        }
                        error={errors['espacio.largo_cm']}
                      />
                      <FieldNumber
                        label="Ancho (cm)"
                        value={data.espacio.ancho_cm}
                        onChange={(v) =>
                          update('espacio', { ...data.espacio, ancho_cm: v })
                        }
                        error={errors['espacio.ancho_cm']}
                      />
                      <FieldNumber
                        label="Alto (cm)"
                        value={data.espacio.alto_cm}
                        onChange={(v) =>
                          update('espacio', { ...data.espacio, alto_cm: v })
                        }
                        error={errors['espacio.alto_cm']}
                      />
                    </div>
                    <div>
                      <Label>Forma</Label>
                      <Select
                        value={data.espacio.forma}
                        onValueChange={(v: string | null) =>
                          v &&
                          update('espacio', {
                            ...data.espacio,
                            forma: v as VisitMeasurementsV1['espacio']['forma'],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lineal">Lineal</SelectItem>
                          <SelectItem value="L">En L</SelectItem>
                          <SelectItem value="U">En U</SelectItem>
                          <SelectItem value="isla">Con isla</SelectItem>
                          <SelectItem value="peninsula">Con península</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {key === 'conexiones' && (
                  <>
                    <div>
                      <Label>Toma de agua — ubicación</Label>
                      <Input
                        value={data.conexiones.agua.ubicacion}
                        onChange={(e) =>
                          update('conexiones', {
                            ...data.conexiones,
                            agua: { ubicacion: e.target.value },
                          })
                        }
                      />
                      {errors['conexiones.agua.ubicacion'] && (
                        <p className="text-xs text-destructive mt-1">
                          {errors['conexiones.agua.ubicacion']}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Gas</Label>
                      <Select
                        value={data.conexiones.gas.tipo}
                        onValueChange={(v: string | null) =>
                          v &&
                          update('conexiones', {
                            ...data.conexiones,
                            gas: {
                              ...data.conexiones.gas,
                              tipo: v as VisitMeasurementsV1['conexiones']['gas']['tipo'],
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ninguno">Ninguno</SelectItem>
                          <SelectItem value="natural">Gas natural</SelectItem>
                          <SelectItem value="propano">Propano</SelectItem>
                        </SelectContent>
                      </Select>
                      {data.conexiones.gas.tipo !== 'ninguno' && (
                        <Input
                          className="mt-2"
                          placeholder="Ubicación toma de gas"
                          value={data.conexiones.gas.ubicacion}
                          onChange={(e) =>
                            update('conexiones', {
                              ...data.conexiones,
                              gas: { ...data.conexiones.gas, ubicacion: e.target.value },
                            })
                          }
                        />
                      )}
                    </div>
                    <div>
                      <Label>Voltaje</Label>
                      <Select
                        value={data.conexiones.voltaje}
                        onValueChange={(v: string | null) =>
                          v &&
                          update('conexiones', {
                            ...data.conexiones,
                            voltaje: v as VisitMeasurementsV1['conexiones']['voltaje'],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="110">110 V</SelectItem>
                          <SelectItem value="220">220 V</SelectItem>
                          <SelectItem value="ambos">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Desagüe — ubicación</Label>
                      <Input
                        value={data.conexiones.desague.ubicacion}
                        onChange={(e) =>
                          update('conexiones', {
                            ...data.conexiones,
                            desague: { ubicacion: e.target.value },
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {key === 'estado' && (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remover-cocina"
                        checked={data.estado.remover_cocina_actual}
                        onCheckedChange={(v) =>
                          update('estado', {
                            ...data.estado,
                            remover_cocina_actual: Boolean(v),
                          })
                        }
                      />
                      <Label htmlFor="remover-cocina" className="text-sm font-normal">
                        Remover cocina/mueble existente
                      </Label>
                    </div>
                    <div>
                      <Label>Tipo de pared</Label>
                      <Select
                        value={data.estado.tipo_pared}
                        onValueChange={(v: string | null) =>
                          v &&
                          update('estado', {
                            ...data.estado,
                            tipo_pared: v as VisitMeasurementsV1['estado']['tipo_pared'],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="drywall">Drywall</SelectItem>
                          <SelectItem value="mamposteria">Mampostería</SelectItem>
                          <SelectItem value="mixto">Mixto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo de piso</Label>
                      <Input
                        value={data.estado.tipo_piso}
                        onChange={(e) =>
                          update('estado', { ...data.estado, tipo_piso: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}

                {key === 'servicios' && (
                  <div className="space-y-2">
                    {errors['servicios'] && (
                      <p className="text-xs text-destructive">{errors['servicios']}</p>
                    )}
                    {VISIT_SERVICE_KEYS.map((svc) => {
                      const current = data.servicios[svc] ?? { incluido: false, notas: '' };
                      return (
                        <div key={svc} className="border border-border/50 rounded-md p-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`svc-${svc}`}
                              checked={current.incluido}
                              onCheckedChange={(v) =>
                                update('servicios', {
                                  ...data.servicios,
                                  [svc]: { ...current, incluido: Boolean(v) },
                                })
                              }
                            />
                            <Label htmlFor={`svc-${svc}`} className="text-sm font-medium">
                              {VISIT_SERVICE_LABELS[svc]}
                            </Label>
                          </div>
                          {current.incluido && (
                            <Input
                              className="mt-2"
                              placeholder="Notas (medidas, materiales, observaciones)…"
                              value={current.notas}
                              onChange={(e) =>
                                update('servicios', {
                                  ...data.servicios,
                                  [svc]: { ...current, notas: e.target.value },
                                })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {key === 'notas' && (
                  <Textarea
                    rows={5}
                    placeholder="Observaciones generales de la visita…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}

                {key === 'fotos' && (
                  <>
                    <VisitPhotoUploader
                      visitId={visitId}
                      value={photos}
                      onChange={setPhotos}
                      disabled={disabled || isSubmitting}
                    />
                    {errors['photos'] && (
                      <p className="text-xs text-destructive">{errors['photos']}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background border-t border-border/50">
        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {isSubmitting ? 'Finalizando…' : 'Finalizar visita'}
        </Button>
        {photos.length < 3 && (
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Necesitás al menos 3 fotos para finalizar
          </p>
        )}
      </div>
    </form>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={error ? 'border-destructive' : ''}
      />
      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
