import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, ExternalLink, ImagePlus, Link2, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import { useSetting } from '@/hooks/settings/useSystemSettings';
import { Button } from '@/components/ui/button';

type PhotoStage = 'diseno' | 'produccion' | 'final';

const STAGE_LABELS: Record<PhotoStage, string> = {
  diseno: 'Diseño',
  produccion: 'Producción',
  final: 'Final',
};

interface ProjectPhotoRow {
  id: string;
  stage: PhotoStage;
  photo_url: string;
  caption: string | null;
  created_at: string;
  signed_url?: string | null;
}

interface Props {
  projectId: string;
  trackingToken: string | null | undefined;
}

const SEND_ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'No tienes permisos para enviar el link.',
  template_not_approved: 'La template de Meta aún no está aprobada.',
  project_not_found: 'El proyecto no está disponible.',
  client_without_phone: 'El cliente no tiene WhatsApp registrado.',
  already_pending: 'Ya hay un envío pendiente en la cola.',
  missing_base_url: 'Falta configurar la URL pública en Parámetros.',
};

/**
 * Card "Portal del cliente" (PRD-portal-cliente.md): link copiable del portal
 * público /proyecto/:token, envío por WhatsApp (template tracking_link_v1) y
 * gestor de fotos del avance (bucket project-photos + tabla project_photos).
 */
export function ClientPortalCard({ projectId, trackingToken }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<PhotoStage>('produccion');
  const [caption, setCaption] = useState('');

  const { data: baseUrlSetting } = useSetting<{ url?: string } | string>('public_app_base_url');
  const { data: autosendSetting } = useSetting<string>('portal_link_autosend');

  const baseUrl =
    typeof baseUrlSetting === 'string' ? baseUrlSetting : baseUrlSetting?.url ?? null;
  const portalUrl =
    baseUrl && trackingToken
      ? `${baseUrl.replace(/\/+$/, '')}/proyecto/${trackingToken}`
      : null;
  const templateApproved = autosendSetting === 'true';

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['project_photos', projectId],
    queryFn: async (): Promise<ProjectPhotoRow[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('project_photos')
        .select('id, stage, photo_url, caption, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw mapSupabaseError(error);
      const rows = (data ?? []) as ProjectPhotoRow[];
      return Promise.all(
        rows.map(async (row) => {
          if (/^https?:\/\//.test(row.photo_url)) return { ...row, signed_url: row.photo_url };
          const { data: signed } = await supabase!.storage
            .from('project-photos')
            .createSignedUrl(row.photo_url, 3600);
          return { ...row, signed_url: signed?.signedUrl ?? null };
        }),
      );
    },
  });

  const sendLink = useMutation({
    mutationFn: async () => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('send_tracking_link', {
        p_project_id: projectId,
      });
      if (error) throw mapSupabaseError(error);
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(SEND_ERROR_MESSAGES[result.error ?? ''] ?? 'No se pudo enviar el link.');
      }
    },
    onSuccess: () => toast.success('Link encolado: el cliente lo recibirá por WhatsApp.'),
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      assertSupabase(supabase);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('project-photos')
        .upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { error: insErr } = await supabase.from('project_photos').insert({
        project_id: projectId,
        stage,
        photo_url: path,
        caption: caption.trim() || null,
      });
      if (insErr) {
        // No dejar huérfano el archivo si la fila no se pudo crear
        await supabase.storage.from('project-photos').remove([path]);
        throw mapSupabaseError(insErr);
      }
    },
    onSuccess: () => {
      setCaption('');
      qc.invalidateQueries({ queryKey: ['project_photos', projectId] });
      toast.success('Foto subida al portal del cliente.');
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo subir la foto.'),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: ProjectPhotoRow) => {
      assertSupabase(supabase);
      if (!/^https?:\/\//.test(photo.photo_url)) {
        await supabase.storage.from('project-photos').remove([photo.photo_url]);
      }
      const { error } = await supabase.from('project_photos').delete().eq('id', photo.id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project_photos', projectId] });
      toast.success('Foto eliminada.');
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo eliminar la foto.'),
  });

  const handleCopy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Link copiado al portapapeles.');
    } catch {
      toast.error('No se pudo copiar el link.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error('Formato no soportado. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La foto supera el límite de 10 MB.');
      return;
    }
    uploadPhoto.mutate(file);
  };

  return (
    <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
      <div className="p-6 border-b border-border/10 bg-muted/20">
        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Portal del Cliente
        </h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Link de seguimiento */}
        {portalUrl ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Link de seguimiento
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={portalUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 h-12 rounded-none border border-border/50 bg-muted/20 px-3 text-xs text-foreground font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-none shrink-0"
                onClick={handleCopy}
                aria-label="Copiar link"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-none shrink-0"
                aria-label="Abrir portal"
                render={(triggerProps) => (
                  <a {...triggerProps} href={portalUrl} target="_blank" rel="noopener noreferrer" />
                )}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <div title={templateApproved ? undefined : 'Template pendiente de aprobación Meta'}>
              <Button
                className="w-full h-12 rounded-none text-[10px] font-bold uppercase tracking-widest"
                disabled={!templateApproved || sendLink.isPending}
                onClick={() => sendLink.mutate()}
              >
                <Send className="w-4 h-4 mr-2" />
                {sendLink.isPending ? 'Encolando…' : 'Enviar por WhatsApp'}
              </Button>
              {!templateApproved && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Template pendiente de aprobación Meta — mientras tanto, copia y comparte el link.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Este proyecto aún no tiene token de seguimiento.
          </p>
        )}

        {/* Fotos del proyecto */}
        <div className="space-y-3 border-t border-border/10 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Fotos del proyecto
          </p>
          <div className="flex items-center gap-2">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PhotoStage)}
              className="h-12 rounded-none border border-border/50 bg-background px-2 text-xs font-bold uppercase tracking-wider text-foreground"
              aria-label="Etapa de la foto"
            >
              {(Object.keys(STAGE_LABELS) as PhotoStage[]).map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Descripción (opcional)"
              className="flex-1 min-w-0 h-12 rounded-none border border-border/50 bg-background px-3 text-xs text-foreground"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            className="w-full h-12 rounded-none text-[10px] font-bold uppercase tracking-widest"
            disabled={uploadPhoto.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            {uploadPhoto.isPending ? 'Subiendo…' : 'Subir foto'}
          </Button>

          {photosLoading ? (
            <p className="text-xs text-muted-foreground italic">Cargando fotos…</p>
          ) : photos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Sin fotos aún. Las fotos que subas acá las ve el cliente en su portal.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <li key={photo.id} className="relative group aspect-square">
                  {photo.signed_url ? (
                    <img
                      src={photo.signed_url}
                      alt={photo.caption ?? STAGE_LABELS[photo.stage]}
                      loading="lazy"
                      className="w-full h-full object-cover rounded-sm border border-border/20"
                    />
                  ) : (
                    <div className="w-full h-full rounded-sm border border-border/20 bg-muted/30" />
                  )}
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-sm bg-black/70 text-[9px] font-bold uppercase tracking-wider text-white">
                    {STAGE_LABELS[photo.stage]}
                  </span>
                  <button
                    onClick={() => deletePhoto.mutate(photo)}
                    disabled={deletePhoto.isPending}
                    aria-label="Eliminar foto"
                    className="absolute top-1 right-1 w-7 h-7 rounded-sm bg-black/70 text-white/90 hidden group-hover:flex items-center justify-center hover:bg-red-600/90 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
