// Encuesta pública de satisfacción (PRD-postventa-garantias.md).
// El cliente llega por WhatsApp con /encuesta/:token — mobile-first, sin login.
// RPCs públicas: get_public_survey / submit_public_survey (migración 055).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Check, Star } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import { supabase } from '@/lib/supabaseClient';
import { PremiumLoader } from '@/components/shared/PremiumLoader';
import { PublicLayout } from '@/components/quotations/public/PublicLayout';
import NotFoundPage from '@/pages/NotFound';
import { cn } from '@/lib/utils';

const WORK_TYPE_LABELS: Record<string, string> = {
  cocina: 'cocina',
  closet: 'closet',
  puertas: 'puertas',
  centro_tv: 'centro de TV',
  otro: 'proyecto',
};

interface SurveyInfo {
  project_name: string;
  client_first_name: string;
  work_type: string | null;
  already_responded: boolean;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'already_responded' }
  | { kind: 'ready'; info: SurveyInfo }
  | { kind: 'error' };

const QUESTIONS = [
  { key: 'overall', label: '¿Cómo fue tu experiencia en general?' },
  { key: 'quality', label: 'Calidad del producto' },
  { key: 'punctuality', label: 'Puntualidad en la entrega' },
  { key: 'service', label: 'Atención del equipo' },
] as const;

type QuestionKey = (typeof QUESTIONS)[number]['key'];

export default function PublicSurvey() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [ratings, setRatings] = useState<Record<QuestionKey, number>>({
    overall: 0, quality: 0, punctuality: 0, service: 0,
  });
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !supabase) {
        setState({ kind: 'not_found' });
        return;
      }
      const { data, error } = await supabase.rpc('get_public_survey', { p_token: token });
      if (cancelled) return;
      if (error) {
        setState({ kind: 'error' });
        return;
      }
      const result = data as Record<string, unknown> | null;
      if (!result || result.error === 'not_found') setState({ kind: 'not_found' });
      else if (result.error === 'expired') setState({ kind: 'expired' });
      else if (result.already_responded === true) setState({ kind: 'already_responded' });
      else setState({ kind: 'ready', info: result as unknown as SurveyInfo });
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  if (!FEATURES.postventaEnabled) {
    return <NotFoundPage />;
  }

  const allRated = QUESTIONS.every((q) => ratings[q.key] > 0);
  const canSubmit = allRated && wouldRecommend !== null && !submitting;

  const submit = async () => {
    if (!token || !supabase || !canSubmit) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc('submit_public_survey', {
      p_token: token,
      p_overall: ratings.overall,
      p_quality: ratings.quality,
      p_punctuality: ratings.punctuality,
      p_service: ratings.service,
      p_would_recommend: wouldRecommend,
      p_comments: comments || null,
    });
    setSubmitting(false);
    const result = data as Record<string, unknown> | null;
    if (error || !result) {
      setState({ kind: 'error' });
      return;
    }
    if (result.error === 'already_responded') {
      setState({ kind: 'already_responded' });
      return;
    }
    if (result.error) {
      setState({ kind: result.error === 'expired' ? 'expired' : 'error' });
      return;
    }
    // CTA de reseña en Google solo con experiencia ≥ 4
    if (ratings.overall >= 4 && supabase) {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'google_review_url')
        .maybeSingle();
      const url = ((setting?.value as string) ?? '').toString().replace(/^"|"$/g, '');
      if (url) setReviewUrl(url);
    }
    setSubmitted(true);
  };

  if (state.kind === 'loading') {
    return (
      <PublicLayout>
        <div className="bg-card border border-border/40 rounded-sm p-16 flex flex-col items-center gap-4">
          <PremiumLoader size="md" text="Cargando tu encuesta" />
        </div>
      </PublicLayout>
    );
  }

  if (state.kind === 'not_found' || state.kind === 'expired') {
    return (
      <PublicLayout>
        <FriendlyMessage
          title={state.kind === 'expired' ? 'Esta encuesta ya venció' : 'No encontramos tu encuesta'}
          body="Si quieres contarnos cómo fue tu experiencia, escríbenos por WhatsApp — nos encanta escucharte."
        />
      </PublicLayout>
    );
  }

  if (state.kind === 'already_responded') {
    return (
      <PublicLayout>
        <FriendlyMessage
          title="¡Ya recibimos tu respuesta!"
          body="Gracias por tomarte el tiempo. Tu opinión nos ayuda a mejorar cada proyecto."
          positive
        />
      </PublicLayout>
    );
  }

  if (state.kind === 'error') {
    return (
      <PublicLayout>
        <div className="bg-card border border-border/40 rounded-sm px-6 py-12 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-muted-foreground max-w-sm">
            No pudimos cargar la encuesta. Revisa tu conexión e intenta de nuevo.
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="bg-card border border-border/40 rounded-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
          <div className="px-6 sm:px-10 py-12 flex flex-col items-center text-center gap-5">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-black tracking-tight text-foreground">
              ¡Gracias por tu opinión!
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              Tu respuesta nos ayuda a seguir haciendo cocinas y muebles de los que
              nos sentimos orgullosos.
            </p>
            {reviewUrl && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 h-14 px-8 inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-sm rounded-sm hover:opacity-90 transition-opacity"
              >
                <Star className="w-4 h-4" />
                ¿Nos dejas una reseña en Google?
              </a>
            )}
          </div>
        </div>
      </PublicLayout>
    );
  }

  const { info } = state;
  const workLabel = WORK_TYPE_LABELS[info.work_type ?? ''] ?? 'proyecto';

  return (
    <PublicLayout>
      <section className="bg-card border border-border/40 rounded-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
        <div className="px-6 sm:px-10 py-8 space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-primary/80">
            Encuesta de satisfacción · 1 minuto
          </span>
          <h1 className="font-heading text-2xl font-black tracking-tight text-foreground">
            ¿Cómo fue tu experiencia con tu {workLabel}, {info.client_first_name}?
          </h1>
          <p className="text-sm text-muted-foreground">
            {info.project_name} · Tu opinión nos ayuda a mejorar.
          </p>
        </div>
      </section>

      <section className="bg-card border border-border/40 rounded-sm px-6 sm:px-10 py-8 space-y-8">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{q.label}</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} de 5 estrellas`}
                  onClick={() => setRatings((r) => ({ ...r, [q.key]: value }))}
                  className="p-1.5 -m-0.5 touch-manipulation"
                >
                  <Star
                    className={cn(
                      'w-9 h-9 transition-colors',
                      value <= ratings[q.key]
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-border hover:text-amber-400/50'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-3 pt-2 border-t border-border/15">
          <p className="text-sm font-semibold text-foreground pt-4">¿Nos recomendarías?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWouldRecommend(true)}
              className={cn(
                'h-14 rounded-sm border font-bold text-sm transition-colors',
                wouldRecommend === true
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/40 text-foreground hover:border-primary/50'
              )}
            >
              Sí, claro
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              className={cn(
                'h-14 rounded-sm border font-bold text-sm transition-colors',
                wouldRecommend === false
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background border-border/40 text-foreground hover:border-foreground/50'
              )}
            >
              No
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            ¿Algo más que quieras contarnos? <span className="text-muted-foreground font-normal">(opcional)</span>
          </p>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Lo que más te gustó, lo que mejorarías…"
            className="w-full bg-background border border-border/40 rounded-sm p-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 resize-none"
          />
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className={cn(
            'w-full h-14 rounded-sm font-bold text-sm transition-all',
            canSubmit
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {submitting ? 'Enviando…' : 'Enviar mi opinión'}
        </button>
        {!allRated && (
          <p className="text-center text-[11px] text-muted-foreground">
            Califica las 4 preguntas y dinos si nos recomendarías para enviar.
          </p>
        )}
      </section>
    </PublicLayout>
  );
}

function FriendlyMessage({ title, body, positive }: { title: string; body: string; positive?: boolean }) {
  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
      <div className="px-6 sm:px-10 py-12 flex flex-col items-center text-center gap-4">
        {positive ? (
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Check className="w-6 h-6 text-primary" />
          </div>
        ) : (
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        )}
        <h1 className="font-heading text-xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
      </div>
    </div>
  );
}
