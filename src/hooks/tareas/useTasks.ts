import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Task } from "@/types/database";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";

export function useTasks(filters?: {
  category?: string;
  assigned_to?: string;
  priority?: number;
  status?: string;
  searchTerm?: string;
}) {
  const { user, profile } = useAuthStore();

  return useQuery({
    queryKey: ["tasks", filters, user?.id],
    enabled: !!user && !!profile,
    queryFn: async (): Promise<Task[]> => {
      assertSupabase(supabase);
      if (!user || !profile) return [];

      let query = supabase
        .from("tasks")
        .select(
          `
          id, title, description, status, priority, due_date, task_category,
          kanban_order, tags, estimated_hours, actual_hours, completed_at,
          created_at, updated_at,
          assigned_user:assigned_to(id, full_name, role, avatar_url),
          creator:created_by(id, full_name),
          project:project_id(id, name),
          client:client_id(id, name),
          comments:task_comments(count),
          attachments:task_attachments(count)
        `
        )
        .is("appointment_type", null)
        .order("kanban_order", { ascending: true })
        .order("created_at", { ascending: false });

      // Role-based filtering
      if (profile.role === "diseno" || profile.role === "produccion") {
        query = query.eq("assigned_to", user.id);
      }

      if (filters?.category && filters.category !== "all") {
        query = query.eq("task_category", filters.category);
      }
      if (filters?.assigned_to && filters.assigned_to !== "all") {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.priority !== undefined && filters.priority !== -1) {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.searchTerm) {
        query = query.ilike("title", `%${filters.searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw mapSupabaseError(error);
      return (data as unknown as Task[]) || [];
    },
  });
}
