import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

export function useTaskComments(taskId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  const query = useQuery({
    queryKey: ['task_comments', taskId],
    queryFn: async (): Promise<any[]> => {
      assertSupabase(supabase);
      const q = supabase
        .from('task_comments')
        .select(`
          id, content, created_at, updated_at,
          author:author_id(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      const response = (await q) as any;
      const { data, error } = response;

      if (error) throw mapSupabaseError(error);
      return (data as any[]) || [];
    },
    enabled: !!taskId
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      assertSupabase(supabase);
      if (!user) throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión.");

      const { data, error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: user.id,
        content
      }).select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // to update count
    },
    onError: (error) => notifyError(error, "Error al agregar comentario")
  });

  return { ...query, addComment };
}
