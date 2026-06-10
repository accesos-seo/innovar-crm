import { useQuery } from '@tanstack/react-query';

export type TrackingPhaseState = 'done' | 'current' | 'pending';

export interface TrackingPhase {
  key: string;
  label: string;
  reached_at: string | null;
  state: TrackingPhaseState;
}

export interface TrackingPhoto {
  stage: 'diseno' | 'produccion' | 'final';
  url: string;
  caption: string | null;
  created_at: string;
}

export interface PublicProjectTrackingData {
  project: {
    name: string;
    work_type: string;
    status: string;
    client_first_name: string;
  };
  timeline: TrackingPhase[];
  photos: TrackingPhoto[];
  payments: {
    total: number;
    advance_paid: number;
    balance_due: number;
    is_fully_paid: boolean;
  };
  installation: {
    scheduled_at: string | null;
    estimated_date: string | null;
    duration_days: number | null;
  };
  contact: {
    label: string;
    whatsapp_url: string | null;
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TrackingNotFoundError extends Error {
  constructor() {
    super('not_found');
    this.name = 'TrackingNotFoundError';
  }
}

/**
 * Lee el portal público "Mi Proyecto" por tracking_token. SIN auth:
 * llama la Edge Function public-project-tracking (verify_jwt=false).
 * Token inválido o proyecto archivado/eliminado → TrackingNotFoundError.
 */
export function usePublicProjectTracking(token: string | undefined) {
  return useQuery<PublicProjectTrackingData, Error>({
    queryKey: ['public-project-tracking', token],
    enabled: !!token && UUID_RE.test(token),
    staleTime: 1000 * 30,
    retry: (failureCount, error) =>
      !(error instanceof TrackingNotFoundError) && failureCount < 2,
    queryFn: async () => {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${base}/functions/v1/public-project-tracking?token=${encodeURIComponent(token!)}`,
      );
      if (res.status === 404 || res.status === 400) throw new TrackingNotFoundError();
      if (!res.ok) throw new Error('No pudimos cargar tu proyecto. Intenta de nuevo.');
      return (await res.json()) as PublicProjectTrackingData;
    },
  });
}
