import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  projectInsertSchema,
  projectUpdateSchema,
  validateProjectFinance,
  type Project,
  type ProjectInsert,
  type ProjectUpdate,
} from "@/schemas/project";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";

const PROJECTS_KEY = "projects";

// ── Listar proyectos (con filtros) ───────────────────────────────────────────
export const useProjects = (filters?: {
  status?: string;
  designer_id?: string;
  client_id?: string;
  is_archived?: boolean;
  approved_quotation_id?: string;
}) => {
  return useQuery({
    queryKey: [PROJECTS_KEY, filters],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Project[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from("projects")
        .select(
          `
          *,
          client:clients(id, name, email, whatsapp_phone),
          designer:profiles!projects_designer_id_fkey(id, full_name, avatar_url),
          created_by_user:profiles!projects_created_by_fkey(id, full_name)
        `
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.designer_id) query = query.eq("designer_id", filters.designer_id);
      if (filters?.client_id) query = query.eq("client_id", filters.client_id);
      if (filters?.approved_quotation_id) {
        query = query.eq("approved_quotation_id", filters.approved_quotation_id);
      }
      if (filters?.is_archived !== undefined) {
        query = query.eq("is_archived", filters.is_archived);
      } else {
        query = query.eq("is_archived", false);
      }

      const response = (await query) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as Project[]) || [];
    },
  });
};

// ── Obtener proyecto por ID ──────────────────────────────────────────────────
export const useProject = (id: string | null) => {
  return useQuery({
    queryKey: [PROJECTS_KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Project | null> => {
      if (!id) return null;
      assertSupabase(supabase);

      const query = supabase
        .from("projects")
        .select(
          `
          *,
          client:clients(*),
          designer:profiles!projects_designer_id_fkey(*),
          quotation:quotations(*),
          created_by_user:profiles!projects_created_by_fkey(*)
        `
        )
        .eq("id", id)
        .single();

      const response = (await query) as any;
      const { data, error } = response;
      if (error) {
        const mapped = mapSupabaseError(error);
        // PGRST116 (not found) → return null instead of throwing
        if (mapped.code === "NOT_FOUND") return null;
        throw mapped;
      }
      return data as Project;
    },
  });
};

// ── Crear proyecto ───────────────────────────────────────────────────────────
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (
      projectData: Omit<ProjectInsert, "created_by" | "data_origin">
    ): Promise<Project> => {
      assertSupabase(supabase);

      const validated = projectInsertSchema.parse({
        ...projectData,
        created_by: user?.id,
        data_origin: "system",
      });

      const financeCheck = validateProjectFinance(validated);
      if (!financeCheck.valid) {
        throw new AppError("VALIDATION", financeCheck.error || "Datos financieros inválidos");
      }

      const { data, error } = await supabase
        .from("projects")
        .insert(validated)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al crear proyecto"),
  });
};

// ── Actualizar proyecto ──────────────────────────────────────────────────────
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProjectUpdate): Promise<Project> => {
      assertSupabase(supabase);

      const validated = projectUpdateSchema.parse({ id, ...updates });

      if (updates.total_amount !== undefined || updates.advance_amount !== undefined) {
        const financeCheck = validateProjectFinance({
          total_amount: updates.total_amount,
          advance_amount: updates.advance_amount,
        });
        if (!financeCheck.valid) {
          throw new AppError("VALIDATION", financeCheck.error || "Datos financieros inválidos");
        }
      }

      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, data.id] });
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al actualizar proyecto"),
  });
};

// ── Soft delete (archivar) ───────────────────────────────────────────────────
export const useArchiveProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("projects")
        .update({ is_archived: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: [PROJECTS_KEY] });
      const previousData = queryClient.getQueriesData<Project[]>({ queryKey: [PROJECTS_KEY] });
      queryClient.setQueriesData<Project[]>({ queryKey: [PROJECTS_KEY] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, is_archived: true } : p)) ?? old
      );
      return { previousData };
    },
    onError: (error, _id, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      notifyError(error, "Error al archivar proyecto");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
    },
  });
};

// ── Subir archivo 3D y actualizar proyecto ───────────────────────────────────
export const useUpload3DFile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      fileName,
    }: {
      projectId: string;
      file: File;
      fileName: string;
    }) => {
      assertSupabase(supabase);

      // 1. Upload al bucket project-files (mismo de la ficha de taller; el
      //    bucket legacy project-3d-files nunca existió en prod)
      const filePath = `${projectId}/design3d/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw mapSupabaseError(uploadError);

      // 2. Read current files for append + version calculation
      const { data: project, error: readErr } = await supabase
        .from("projects")
        .select("design_3d_files")
        .eq("id", projectId)
        .single();
      if (readErr) {
        await supabase.storage.from("project-files").remove([filePath]);
        throw mapSupabaseError(readErr);
      }

      const currentFiles = ((project?.design_3d_files as any[]) || []) as any[];
      const newVersion = currentFiles.length + 1;

      // 3. Append — formato estandarizado {path, name, ...} (bucket privado:
      //    la URL se resuelve al descargar con getProjectFileUrl)
      const newFile = {
        path: filePath,
        name: fileName,
        version: newVersion,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.id ?? null,
      };

      const { data, error } = await supabase
        .from("projects")
        .update({ design_3d_files: [...currentFiles, newFile] })
        .eq("id", projectId)
        .select()
        .single();

      if (error) {
        await supabase.storage.from("project-files").remove([filePath]);
        throw mapSupabaseError(error);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, data.id] });
    },
    onError: (error) => notifyError(error, "Error al subir archivo 3D"),
  });
};
