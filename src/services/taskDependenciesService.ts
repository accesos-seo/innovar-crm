import { supabase } from "@/lib/supabaseClient";

export interface TaskDependency {
  id: string;
  blocker_task_id: string;   // UUID
  blocked_task_id: string;   // UUID
  created_at: string;
  blocker_task?: { id: string; title: string; status: string };
  blocked_task?: { id: string; title: string; status: string };
}

/** Retorna true si el status de una tarea indica que está completada */
export function isDepCompleted(status?: string): boolean {
  if (!status) return false;
  return ["completado", "completed", "cerrado", "done", "finalizado"].some((k) =>
    status.toLowerCase().includes(k)
  );
}

/** Tareas que deben terminar antes que esta pueda empezar (la bloquean) */
export async function getBlockingTasks(taskId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*, blocker_task:tasks!task_dependencies_blocker_fkey(id, title, status)")
    .eq("blocked_task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) { console.error("getBlockingTasks:", error); return []; }

  return (data ?? []).map((d: any) => ({
    ...d,
    blocker_task: d.blocker_task ?? {
      id: d.blocker_task_id,
      title: `Tarea #${d.blocker_task_id.slice(0, 8)}`,
      status: "",
    },
  }));
}

/** Tareas que esperan a que esta termine (están bloqueadas por esta) */
export async function getBlockedTasks(taskId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*, blocked_task:tasks!task_dependencies_blocked_fkey(id, title, status)")
    .eq("blocker_task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) { console.error("getBlockedTasks:", error); return []; }

  return (data ?? []).map((d: any) => ({
    ...d,
    blocked_task: d.blocked_task ?? {
      id: d.blocked_task_id,
      title: `Tarea #${d.blocked_task_id.slice(0, 8)}`,
      status: "",
    },
  }));
}

/**
 * Crea una dependencia blocker → blocked.
 * Valida: no auto-dependencia, no duplicado, no ciclo (RPC primero, BFS fallback).
 */
export async function createTaskDependency(
  blockerTaskId: string,
  blockedTaskId: string
): Promise<TaskDependency | null> {
  if (blockerTaskId === blockedTaskId)
    throw new Error("Una tarea no puede depender de sí misma");

  const { data: existing } = await supabase
    .from("task_dependencies")
    .select("id")
    .eq("blocker_task_id", blockerTaskId)
    .eq("blocked_task_id", blockedTaskId)
    .maybeSingle();
  if (existing) throw new Error("Esta dependencia ya existe");

  const { data: cycleOk, error: cycleErr } = await supabase.rpc(
    "check_task_dependency_cycle",
    { p_blocker: blockerTaskId, p_blocked: blockedTaskId }
  );
  if (cycleErr) {
    const wouldCycle = await checkCycleClientSide(blockerTaskId, blockedTaskId);
    if (wouldCycle) throw new Error("Esta dependencia crearía un ciclo");
  } else if (cycleOk === false) {
    throw new Error("Esta dependencia crearía un ciclo");
  }

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({ blocker_task_id: blockerTaskId, blocked_task_id: blockedTaskId })
    .select()
    .single();
  if (error) throw error;
  return data as TaskDependency;
}

/** Elimina una dependencia por su ID */
export async function deleteTaskDependency(dependencyId: string): Promise<void> {
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", dependencyId);
  if (error) throw error;
}

/**
 * Retorna dos sets para indicadores visuales en la lista de tareas:
 * - withDeps: tareas que tienen alguna dependencia (blocker o blocked)
 * - blocked:  tareas que están esperando a otra (son el "blocked")
 */
export async function loadAllDependencySets(): Promise<{
  withDeps: Set<string>;
  blocked: Set<string>;
}> {
  const { data } = await supabase
    .from("task_dependencies")
    .select("blocker_task_id, blocked_task_id");
  const withDeps = new Set<string>();
  const blocked = new Set<string>();
  (data ?? []).forEach((d: any) => {
    withDeps.add(d.blocker_task_id);
    withDeps.add(d.blocked_task_id);
    blocked.add(d.blocked_task_id);
  });
  return { withDeps, blocked };
}

// ─── Privado ────────────────────────────────────────────────────────────────

/**
 * BFS client-side: retorna true si agregar (blocker→blocked) crearía un ciclo.
 *
 * Queremos agregar: blockerTaskId → blockedTaskId
 * Ciclo existe si ya hay un camino: blockedTaskId →...→ blockerTaskId
 * BFS parte desde blockedTaskId y sigue arcos existentes (blocker→blocked).
 * Si alcanza blockerTaskId → el arco nuevo cerraría el ciclo.
 */
async function checkCycleClientSide(
  blockerTaskId: string,
  blockedTaskId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("blocker_task_id, blocked_task_id");
  if (error || !data) return false;

  const graph = new Map<string, Set<string>>();
  data.forEach((d: any) => {
    if (!graph.has(d.blocker_task_id)) graph.set(d.blocker_task_id, new Set());
    graph.get(d.blocker_task_id)!.add(d.blocked_task_id);
  });

  const visited = new Set<string>();
  const queue = [blockedTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === blockerTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of graph.get(current) ?? []) queue.push(neighbor);
  }
  return false;
}
