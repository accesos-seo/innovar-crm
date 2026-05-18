import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { TaskAttachment } from '@/types/database';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

export function useTaskAttachments(taskId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  const query = useQuery({
    queryKey: ['task_attachments', taskId],
    retry: 0,
    queryFn: async (): Promise<TaskAttachment[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw mapSupabaseError(error);
      return (data as TaskAttachment[]) || [];
    },
    enabled: !!taskId
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      assertSupabase(supabase);
      if (!user) throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión.");

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(`${taskId}/${file.name}`, file);

      if (uploadError) throw mapSupabaseError(uploadError);

      const { data: publicUrl } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(`${taskId}/${file.name}`);

      const { data, error } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        uploaded_by: user.id,
        file_name: file.name,
        file_url: publicUrl.publicUrl,
        file_size: file.size,
        mime_type: file.type
      }).select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // to update count
    },
    onError: (error) => notifyError(error, "Error al subir archivo")
  });

  return { ...query, uploadAttachment };
}
