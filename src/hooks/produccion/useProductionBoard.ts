import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

// El enum project_status de prod (8 valores) difiere del ProjectStatus del
// repo (types/database.ts lista la versión vieja), así que el módulo define
// sus propios tipos estrechos. Fases visibles en el tablero: las 5 productivas.
export type ProductionStatus =
  | 'en_diseno'
  | 'aprobacion_final'
  | 'en_produccion'
  | 'listo_instalacion'
  | 'entregado';

export const PRODUCTION_COLUMNS: Array<{ id: ProductionStatus; title: string }> = [
  { id: 'en_diseno', title: 'Diseño' },
  { id: 'aprobacion_final', title: 'Aprobación final' },
  { id: 'en_produccion', title: 'En producción' },
  { id: 'listo_instalacion', title: 'Listo para instalar' },
  { id: 'entregado', title: 'Entregado' },
];

export const WORK_TYPE_LABELS: Record<string, string> = {
  cocina: 'Cocina',
  closet: 'Closet',
  puertas: 'Puertas',
  centro_tv: 'Centro TV',
  otro: 'Otro',
};

// Transiciones cuya ENTRADA dispara WhatsApp al cliente (triggers reales en
// prod sobre projects.status: fn_wa_project_status_change,
// notify_fabrication_started, fn_trigger_postventa, etc.).
export const WA_TRIGGER_STATUSES: ProductionStatus[] = [
  'en_produccion',
  'listo_instalacion',
  'entregado',
];

export interface ProductionFileEntry {
  // Formato nuevo (este módulo)
  path?: string;
  name?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  // Formato legacy (form de proyecto viejo)
  url?: string;
  nombre?: string;
  tipo?: string;
  generado_en?: string;
}

export interface ProductionProject {
  id: string;
  name: string;
  status: ProductionStatus;
  work_type: string;
  notes: string | null;
  total_amount: number | null;
  designer_id: string | null;
  scheduled_install_date: string | null;
  estimated_install_date: string | null;
  fabrication_started_at: string | null;
  materials_purchased_at: string | null;
  estimated_fabrication_days: number | null;
  modelado_revision_number: number;
  render_revision_number: number;
  modelado_approved_at: string | null;
  renders_approved_at: string | null;
  initial_measurements: Record<string, unknown> | null;
  design_3d_files: ProductionFileEntry[] | null;
  despiece_files: ProductionFileEntry[] | null;
  created_at: string;
  client: { id: string; name: string } | null;
  designer: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface ProductionBoardData {
  projects: ProductionProject[];
  /** ISO de la última entrada de project_status_history por proyecto (backfill 054 garantiza base). */
  phaseSince: Record<string, string>;
  /** Contador de tareas task_category='produccion' por proyecto. */
  taskCounts: Record<string, { done: number; total: number }>;
}

const BOARD_KEY = 'production-board';
const BOARD_STATUSES = PRODUCTION_COLUMNS.map((c) => c.id);

export function useProductionBoard() {
  return useQuery({
    queryKey: [BOARD_KEY],
    staleTime: 30_000,
    queryFn: async (): Promise<ProductionBoardData> => {
      assertSupabase(supabase);

      const { data: projects, error } = await supabase
        .from('projects')
        .select(
          `id, name, status, work_type, notes, total_amount, designer_id,
           scheduled_install_date, estimated_install_date, fabrication_started_at,
           materials_purchased_at, estimated_fabrication_days,
           modelado_revision_number, render_revision_number,
           modelado_approved_at, renders_approved_at,
           initial_measurements, design_3d_files, despiece_files, created_at,
           client:clients(id, name),
           designer:profiles!projects_designer_id_fkey(id, full_name, avatar_url)`
        )
        .in('status', BOARD_STATUSES)
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw mapSupabaseError(error);

      const rows = (projects ?? []) as unknown as ProductionProject[];
      const ids = rows.map((p) => p.id);

      const phaseSince: Record<string, string> = {};
      const taskCounts: Record<string, { done: number; total: number }> = {};

      if (ids.length > 0) {
        const [historyRes, tasksRes] = await Promise.all([
          supabase
            .from('project_status_history')
            .select('project_id, changed_at')
            .in('project_id', ids)
            .order('changed_at', { ascending: false }),
          supabase
            .from('tasks')
            .select('project_id, status')
            .eq('task_category', 'produccion')
            .in('project_id', ids),
        ]);
        if (historyRes.error) throw mapSupabaseError(historyRes.error);
        if (tasksRes.error) throw mapSupabaseError(tasksRes.error);

        // Ordenado desc → la primera fila por proyecto es la más reciente
        for (const row of historyRes.data ?? []) {
          if (!phaseSince[row.project_id]) phaseSince[row.project_id] = row.changed_at;
        }
        for (const t of tasksRes.data ?? []) {
          if (!t.project_id) continue;
          const entry = (taskCounts[t.project_id] ??= { done: 0, total: 0 });
          entry.total += 1;
          if (t.status === 'completado') entry.done += 1;
        }
      }

      return { projects: rows, phaseSince, taskCounts };
    },
  });
}

const MOVE_ERROR_MESSAGES: Record<string, string> = {
  project_not_found: 'El proyecto no está disponible.',
  same_status: 'El proyecto ya está en esa fase.',
  forbidden_transition: 'Tu rol no permite este movimiento de fase.',
};

/**
 * Mueve un proyecto de fase vía la RPC move_project_status (migración 054).
 * No usa useUpdateProject: el Zod del repo lista un enum project_status viejo
 * que rechazaría aprobacion_final/listo_instalacion. La RPC además valida la
 * transición por rol y guarda la nota en project_status_history.
 */
export function useMoveProjectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      toStatus,
      note,
    }: {
      projectId: string;
      toStatus: ProductionStatus;
      note?: string;
    }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('move_project_status', {
        p_project_id: projectId,
        p_to_status: toStatus,
        p_note: note?.trim() || null,
      });
      if (error) throw mapSupabaseError(error);
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(MOVE_ERROR_MESSAGES[result.error ?? ''] ?? 'No se pudo mover el proyecto.');
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOARD_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export interface StatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
  changed_by_profile: { id: string; full_name: string } | null;
}

export function useProjectStatusHistory(projectId: string | null) {
  return useQuery({
    queryKey: ['project-status-history', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<StatusHistoryRow[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('project_status_history')
        .select('id, from_status, to_status, note, changed_at, changed_by_profile:changed_by(id, full_name)')
        .eq('project_id', projectId!)
        .order('changed_at', { ascending: false });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as unknown as StatusHistoryRow[];
    },
  });
}

export interface ProductionTask {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  assigned_user: { id: string; full_name: string } | null;
}

export function useProductionTasks(projectId: string | null) {
  return useQuery({
    queryKey: ['production-tasks', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProductionTask[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, assigned_to, assigned_user:assigned_to(id, full_name)')
        .eq('project_id', projectId!)
        .eq('task_category', 'produccion')
        .order('created_at', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as unknown as ProductionTask[];
    },
  });
}

export type ProjectFileKind = 'design3d' | 'despiece';

const FILE_COLUMN: Record<ProjectFileKind, 'design_3d_files' | 'despiece_files'> = {
  design3d: 'design_3d_files',
  despiece: 'despiece_files',
};

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'skp', 'dwg', 'dxf', 'png', 'jpg', 'jpeg', 'webp'];

/**
 * Sube un archivo al bucket project-files y lo agrega al JSONB del proyecto
 * (formato estandarizado {path, name, uploaded_at, uploaded_by}). Relee el
 * JSONB antes del append para no pisar subidas concurrentes.
 */
export function useUploadProjectFile() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      projectId,
      kind,
      file,
    }: {
      projectId: string;
      kind: ProjectFileKind;
      file: File;
    }) => {
      assertSupabase(supabase);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        throw new Error(`Extensión no permitida. Usa: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`);
      }

      const path = `${projectId}/${kind}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('project-files')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (upErr) throw new Error(upErr.message);

      const column = FILE_COLUMN[kind];
      const { data: current, error: readErr } = await supabase
        .from('projects')
        .select(column)
        .eq('id', projectId)
        .single();
      if (readErr) {
        await supabase.storage.from('project-files').remove([path]);
        throw mapSupabaseError(readErr);
      }

      const entry = {
        path,
        name: file.name,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.id ?? null,
      };
      const existing = ((current as Record<string, unknown>)?.[column] as unknown[]) ?? [];
      const { error: updErr } = await supabase
        .from('projects')
        .update({ [column]: [...existing, entry] })
        .eq('id', projectId);
      if (updErr) {
        await supabase.storage.from('project-files').remove([path]);
        throw mapSupabaseError(updErr);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOARD_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProjectFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      kind,
      entry,
    }: {
      projectId: string;
      kind: ProjectFileKind;
      entry: ProductionFileEntry;
    }) => {
      assertSupabase(supabase);
      if (entry.path) {
        await supabase.storage.from('project-files').remove([entry.path]);
      }

      const column = FILE_COLUMN[kind];
      const { data: current, error: readErr } = await supabase
        .from('projects')
        .select(column)
        .eq('id', projectId)
        .single();
      if (readErr) throw mapSupabaseError(readErr);

      const existing = (((current as Record<string, unknown>)?.[column] as ProductionFileEntry[]) ?? []);
      const filtered = existing.filter((f) =>
        entry.path ? f.path !== entry.path : f.url !== entry.url
      );
      const { error: updErr } = await supabase
        .from('projects')
        .update({ [column]: filtered })
        .eq('id', projectId);
      if (updErr) throw mapSupabaseError(updErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BOARD_KEY] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/** Signed URL (1h) para un path del bucket project-files. */
export async function getProjectFileUrl(entry: ProductionFileEntry): Promise<string | null> {
  if (entry.url) return entry.url; // legacy: URL pública directa
  if (!entry.path || !supabase) return null;
  const { data } = await supabase.storage.from('project-files').createSignedUrl(entry.path, 3600);
  return data?.signedUrl ?? null;
}
