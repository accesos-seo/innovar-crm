import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Download,
  FileUp,
  History,
  Loader2,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuthStore } from '@/store/authStore';
import { useCreateTask } from '@/hooks/tareas/useCreateTask';
import { useUpdateTask } from '@/hooks/tareas/useUpdateTask';
import {
  getProjectFileUrl,
  ProductionFileEntry,
  ProductionProject,
  ProjectFileKind,
  PRODUCTION_COLUMNS,
  useDeleteProjectFile,
  useProductionTasks,
  useProjectStatusHistory,
  useUploadProjectFile,
  WORK_TYPE_LABELS,
  ALLOWED_FILE_EXTENSIONS,
} from '@/hooks/produccion/useProductionBoard';

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCTION_COLUMNS.map((c) => [c.id, c.title])
);
STATUS_LABELS.contacto = 'Contacto';
STATUS_LABELS.cotizacion_aprobada = 'Cotización aprobada';
STATUS_LABELS.completado = 'Completado';

function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), withTime ? "d MMM yyyy, HH:mm" : 'd MMM yyyy', { locale: es });
  } catch {
    return '—';
  }
}

function fileLabel(entry: ProductionFileEntry) {
  return entry.name ?? entry.nombre ?? entry.tipo ?? 'archivo';
}

function fileDate(entry: ProductionFileEntry) {
  return entry.uploaded_at ?? (entry as { subido_en?: string }).subido_en ?? entry.generado_en ?? null;
}

interface WorkshopSheetProps {
  project: ProductionProject | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Ficha de taller: detalle productivo de un proyecto (PRD-produccion-taller.md). */
export function WorkshopSheet({ project, isOpen, onClose }: WorkshopSheetProps) {
  const { profile } = useAuthStore();
  const role = profile?.role ?? '';
  const canManageFiles = ['admin', 'super_admin', 'diseno'].includes(role);
  const hideAmounts = role === 'produccion';

  if (!project) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 gap-0">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/10">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle className="text-xl font-black uppercase tracking-tighter">
                {project.name}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground font-medium">
                {project.client?.name ?? 'Sin cliente'} · {WORK_TYPE_LABELS[project.work_type] ?? project.work_type}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(`/produccion/ficha/${project.id}`, '_blank', 'noopener')}
              className="gap-2 border-border/50 font-bold uppercase text-xs tracking-widest h-10 rounded-none shrink-0"
            >
              <Printer className="w-4 h-4" />
              Imprimir ficha
            </Button>
          </div>
        </SheetHeader>

        <div className="px-6 py-5">
          <Tabs defaultValue="resumen">
            <TabsList className="w-full">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="archivos">Archivos</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="pt-4">
              <ResumenTab project={project} hideAmounts={hideAmounts} />
            </TabsContent>
            <TabsContent value="archivos" className="pt-4">
              <FilesSection
                project={project}
                kind="design3d"
                title="Diseño 3D"
                entries={project.design_3d_files ?? []}
                canManage={canManageFiles}
              />
              <div className="mt-6">
                <FilesSection
                  project={project}
                  kind="despiece"
                  title="Despiece"
                  entries={project.despiece_files ?? []}
                  canManage={canManageFiles}
                />
              </div>
            </TabsContent>
            <TabsContent value="checklist" className="pt-4">
              <ChecklistTab projectId={project.id} />
            </TabsContent>
            <TabsContent value="historial" className="pt-4">
              <HistoryTab projectId={project.id} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Pestaña Resumen ──────────────────────────────────────────────────────────

function ResumenTab({ project, hideAmounts }: { project: ProductionProject; hideAmounts: boolean }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Fase actual', STATUS_LABELS[project.status] ?? project.status],
    ['Inicio fabricación', formatDate(project.fabrication_started_at)],
    ['Compra de materiales', formatDate(project.materials_purchased_at)],
    ['Días estimados de fabricación', project.estimated_fabrication_days ?? '—'],
    ['Instalación programada', formatDate(project.scheduled_install_date)],
    ['Instalación estimada', formatDate(project.estimated_install_date)],
    [
      'Revisiones de modelado',
      `${project.modelado_revision_number}${project.modelado_approved_at ? ` (aprobado ${formatDate(project.modelado_approved_at)})` : ''}`,
    ],
    [
      'Revisiones de render',
      `${project.render_revision_number}${project.renders_approved_at ? ` (aprobado ${formatDate(project.renders_approved_at)})` : ''}`,
    ],
  ];
  if (!hideAmounts) {
    rows.push([
      'Monto total',
      project.total_amount != null
        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(project.total_amount)
        : '—',
    ]);
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-border/10 pb-2">
            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
      {project.notes && (
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Notas</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Pestaña Archivos ─────────────────────────────────────────────────────────

function FilesSection({
  project,
  kind,
  title,
  entries,
  canManage,
}: {
  project: ProductionProject;
  kind: ProjectFileKind;
  title: string;
  entries: ProductionFileEntry[];
  canManage: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = useUploadProjectFile();
  const remove = useDeleteProjectFile();
  const [downloading, setDownloading] = React.useState<string | null>(null);

  const handleDownload = async (entry: ProductionFileEntry) => {
    const key = entry.path ?? entry.url ?? '';
    setDownloading(key);
    try {
      const url = await getProjectFileUrl(entry);
      if (!url) throw new Error('No se pudo generar el link de descarga.');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo descargar el archivo.');
    } finally {
      setDownloading(null);
    }
  };

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { projectId: project.id, kind, file },
      {
        onSuccess: () => toast.success('Archivo subido.'),
        onError: (err) => toast.error((err as Error).message || 'No se pudo subir el archivo.'),
      }
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-l-2 border-primary pl-2">
          {title} ({entries.length})
        </h4>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_FILE_EXTENSIONS.map((e) => `.${e}`).join(',')}
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="gap-2 border-border/50 font-bold uppercase text-[10px] tracking-widest h-8 rounded-none"
            >
              {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              Subir archivo
            </Button>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Sin archivos.</p>
      ) : (
        <ul className="divide-y divide-border/10 border border-border/10">
          {entries.map((entry, i) => {
            const key = entry.path ?? entry.url ?? String(i);
            return (
              <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fileLabel(entry)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {formatDate(fileDate(entry))}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(entry)}
                    disabled={downloading === key}
                    aria-label="Descargar"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                  >
                    {downloading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        remove.mutate(
                          { projectId: project.id, kind, entry },
                          {
                            onSuccess: () => toast.success('Archivo eliminado.'),
                            onError: (err) => toast.error((err as Error).message || 'No se pudo eliminar.'),
                          }
                        )
                      }
                      disabled={remove.isPending}
                      aria-label="Eliminar"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Pestaña Checklist ────────────────────────────────────────────────────────

function ChecklistTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useProductionTasks(projectId);
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const [newTitle, setNewTitle] = React.useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['production-tasks', projectId] });
    qc.invalidateQueries({ queryKey: ['production-board'] });
  };

  const handleToggle = async (taskId: string, done: boolean) => {
    try {
      await updateTask.mutateAsync({ id: taskId, updates: { status: done ? 'completado' : 'pendiente' } });
      invalidate();
    } catch {
      /* useUpdateTask ya notifica el error */
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({
        title,
        task_category: 'produccion',
        project_id: projectId,
        status: 'pendiente',
        priority: 0,
        kanban_order: 0,
        tags: [],
      });
      setNewTitle('');
      invalidate();
    } catch {
      /* useCreateTask ya notifica el error */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nueva tarea de producción"
          className="h-12 rounded-none border-border/50"
        />
        <Button
          onClick={handleCreate}
          disabled={createTask.isPending || !newTitle.trim()}
          className="h-12 rounded-none px-4 font-bold uppercase text-xs tracking-widest gap-2"
        >
          {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Agregar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-3">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Sin tareas de producción para este proyecto.</p>
      ) : (
        <ul className="divide-y divide-border/10 border border-border/10">
          {tasks.map((task) => {
            const done = task.status === 'completado';
            return (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  checked={done}
                  onCheckedChange={(checked) => handleToggle(task.id, checked === true)}
                  aria-label={task.title}
                />
                <span className={done ? 'text-sm text-muted-foreground line-through' : 'text-sm text-foreground'}>
                  {task.title}
                </span>
                {task.assigned_user && (
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
                    {task.assigned_user.full_name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Pestaña Historial ────────────────────────────────────────────────────────

function HistoryTab({ projectId }: { projectId: string }) {
  const { data: history = [], isLoading } = useProjectStatusHistory(projectId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-3">Cargando historial…</p>;
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">Sin movimientos registrados.</p>;
  }

  return (
    <ul className="space-y-3">
      {history.map((row) => (
        <li key={row.id} className="flex items-start gap-3 border-l-2 border-primary/30 pl-3">
          <History className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.from_status ? `${STATUS_LABELS[row.from_status] ?? row.from_status} → ` : ''}
              {STATUS_LABELS[row.to_status] ?? row.to_status}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {formatDate(row.changed_at, true)}
              {row.changed_by_profile ? ` · ${row.changed_by_profile.full_name}` : ' · Sistema'}
            </p>
            {row.note && <p className="text-xs text-muted-foreground mt-0.5 italic">«{row.note}»</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
