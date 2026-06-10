import React from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumLoader } from '@/components/shared/PremiumLoader';
import { useProject } from '@/hooks/useProjects';
import {
  ProductionFileEntry,
  useProductionTasks,
  WORK_TYPE_LABELS,
} from '@/hooks/produccion/useProductionBoard';

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return '—';
  }
}

const MEASUREMENT_LABELS: Record<string, string> = {
  ancho_pared_a: 'Ancho pared A',
  ancho_pared_b: 'Ancho pared B',
  altura: 'Altura',
  profundidad_max: 'Profundidad máx.',
  notas: 'Notas',
  fecha_levantamiento: 'Fecha levantamiento',
};

/**
 * Ficha de taller imprimible (/produccion/ficha/:id). Sin montos: va al banco
 * de trabajo. CSS @media print oculta el botón y fuerza fondo blanco.
 */
export default function ProduccionFichaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: tasks = [] } = useProductionTasks(id ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PremiumLoader size="md" text="Cargando ficha" />
      </div>
    );
  }
  if (!project) {
    return <p className="p-8 text-sm text-muted-foreground">Proyecto no encontrado.</p>;
  }

  const client = (project as { client?: { name?: string; whatsapp_phone?: string } }).client;
  const measurements = (project.initial_measurements ?? {}) as Record<string, unknown>;
  const measurementRows = Object.entries(measurements).filter(
    ([key, value]) => value != null && value !== '' && key !== 'tomado_por'
  );
  const despieces = (project.despiece_files ?? []) as ProductionFileEntry[];

  return (
    <div className="ficha-print min-h-screen bg-white text-zinc-900 p-8 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="no-print flex justify-end mb-6">
        <Button
          onClick={() => window.print()}
          className="gap-2 h-12 rounded-none font-bold uppercase text-xs tracking-widest"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
      </div>

      {/* Encabezado */}
      <header className="border-b-4 border-zinc-900 pb-4 mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Innovar · Ficha de taller</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">{project.name}</h1>
          <p className="text-sm text-zinc-600 mt-1">
            {client?.name ?? 'Sin cliente'} · {WORK_TYPE_LABELS[project.work_type] ?? project.work_type}
          </p>
        </div>
        <div className="w-12 h-12 bg-zinc-900 text-white flex items-center justify-center font-black text-2xl shrink-0">
          I
        </div>
      </header>

      {/* Fechas clave */}
      <section className="mb-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] border-b border-zinc-300 pb-1 mb-3">
          Fechas clave
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-1.5 font-bold w-1/2">Inicio de fabricación</td>
              <td className="py-1.5">{fmt((project as { fabrication_started_at?: string | null }).fabrication_started_at)}</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-1.5 font-bold">Días estimados de fabricación</td>
              <td className="py-1.5">{(project as { estimated_fabrication_days?: number | null }).estimated_fabrication_days ?? '—'}</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-1.5 font-bold">Instalación programada</td>
              <td className="py-1.5">{fmt(project.scheduled_install_date)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Medidas iniciales */}
      {measurementRows.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] border-b border-zinc-300 pb-1 mb-3">
            Medidas iniciales
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {measurementRows.map(([key, value]) => (
                <tr key={key} className="border-b border-zinc-100">
                  <td className="py-1.5 font-bold w-1/2">{MEASUREMENT_LABELS[key] ?? key}</td>
                  <td className="py-1.5">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Despieces */}
      <section className="mb-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] border-b border-zinc-300 pb-1 mb-3">
          Despieces ({despieces.length})
        </h2>
        {despieces.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin archivos de despiece.</p>
        ) : (
          <ul className="text-sm space-y-1 list-disc pl-5">
            {despieces.map((d, i) => (
              <li key={d.path ?? d.url ?? i}>
                {d.name ?? d.nombre ?? d.tipo ?? 'archivo'}
                {(d.uploaded_at ?? d.generado_en) && (
                  <span className="text-zinc-500"> — {fmt(d.uploaded_at ?? d.generado_en)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Checklist de producción */}
      <section className="mb-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] border-b border-zinc-300 pb-1 mb-3">
          Checklist de producción ({tasks.filter((t) => t.status === 'completado').length}/{tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin tareas de producción.</p>
        ) : (
          <ul className="text-sm space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="w-4 h-4 border border-zinc-400 inline-flex items-center justify-center text-[10px] font-black shrink-0">
                  {t.status === 'completado' ? '✓' : ''}
                </span>
                <span className={t.status === 'completado' ? 'line-through text-zinc-500' : ''}>{t.title}</span>
                {t.assigned_user && <span className="text-zinc-400 text-xs">({t.assigned_user.full_name})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notas */}
      {project.notes && (
        <section className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] border-b border-zinc-300 pb-1 mb-3">Notas</h2>
          <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
        </section>
      )}

      <footer className="pt-4 border-t border-zinc-300 text-[10px] text-zinc-400 uppercase tracking-widest">
        Generado el {format(new Date(), "d MMM yyyy, HH:mm", { locale: es })} · Innovar CRM
      </footer>
    </div>
  );
}
