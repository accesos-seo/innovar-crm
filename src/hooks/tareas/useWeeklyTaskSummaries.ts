import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';

export interface WeeklyTaskSummary {
  id: string;
  user_id: string;
  summary_content: string;
  tasks_data?: {
    project_id: string | null;
    project_name: string;
    tasks: {
      id: string;
      title: string;
      due_date: string | null;
      status: string;
      url?: string;
    }[];
  }[];
  week_of: string;
  is_read: boolean;
  created_at: string;
}

export const useWeeklyTaskSummaries = () => {
  const { user } = useAuthStore();
  const [summaries, setSummaries] = useState<WeeklyTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchSummaries = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_weekly_summaries' as any)
          .select('*')
          .eq('user_id', user.id)
          .order('week_of', { ascending: false })
          .limit(2);

        if (fetchError) throw fetchError;
        setSummaries((data || []) as WeeklyTaskSummary[]);
      } catch (err) {
        console.error('Error fetching weekly task summaries:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
    const interval = setInterval(fetchSummaries, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const markAsRead = async (summaryId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('user_weekly_summaries' as any)
        .update({ is_read: true })
        .eq('id', summaryId);

      if (updateError) throw updateError;

      setSummaries(prev =>
        prev.map(s => s.id === summaryId ? { ...s, is_read: true } : s)
      );
    } catch (err) {
      console.error('Error marking summary as read:', err);
    }
  };

  const unreadCount = summaries.filter(s => !s.is_read).length;

  return { summaries, loading, error, unreadCount, markAsRead };
};
