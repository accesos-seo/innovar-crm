import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';
import { toast } from 'sonner';

interface VisitPhotoUploaderProps {
  visitId: string;
  /** Paths ya subidos (persisted). El uploader maneja el delta. */
  value: string[];
  onChange: (paths: string[]) => void;
  /** Cuenta mínima requerida (default 3 = invariant del trigger DB). */
  minPhotos?: number;
  /** Cuenta sugerida (UX hint). */
  recommendedPhotos?: number;
  disabled?: boolean;
}

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
const MAX_SIDE = 1920;
const JPEG_QUALITY = 0.85;
const BUCKET = 'visit_photos';

/**
 * Comprime una imagen client-side: resize lado mayor a MAX_SIDE + recodifica
 * JPEG quality 0.85. Reduce típicamente 5MB → 800KB. Fallback nativo con
 * canvas; no requiere `browser-image-compression`.
 *
 * HEIC/HEIF no se pueden decodificar en canvas en todos los browsers; en ese
 * caso se sube el archivo original (Meta WhatsApp lo acepta hasta 10MB).
 */
async function compressImage(file: File): Promise<File> {
  const isHeic = /heic|heif/i.test(file.type);
  if (isHeic) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    el.src = dataUrl;
  });

  const { width: w0, height: h0 } = img;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob falló'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function randomId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID?.()) || `${Date.now()}-${Math.random()}`;
}

export function VisitPhotoUploader({
  visitId,
  value,
  onChange,
  minPhotos = 3,
  recommendedPhotos = 5,
  disabled = false,
}: VisitPhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadThumb = useCallback(
    async (path: string) => {
      assertSupabase(supabase);
      if (thumbUrls[path]) return;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) {
        setThumbUrls((prev) => ({ ...prev, [path]: data.signedUrl }));
      }
    },
    [thumbUrls]
  );

  // Carga thumbnails de paths ya subidos.
  value.forEach((p) => {
    if (!thumbUrls[p]) void loadThumb(p);
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    assertSupabase(supabase);
    setUploading(true);

    const newPaths: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!ALLOWED_MIMES.includes(file.type)) {
          toast.error('Formato no soportado', { description: file.name });
          continue;
        }
        const compressed = await compressImage(file);
        const ext = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${visitId}/${randomId()}.${ext}`;
        const { error: upErr } = await supabase!.storage
          .from(BUCKET)
          .upload(path, compressed, {
            cacheControl: '3600',
            upsert: false,
            contentType: compressed.type,
          });
        if (upErr) throw mapSupabaseError(upErr);
        newPaths.push(path);
      }
      if (newPaths.length > 0) {
        onChange([...value, ...newPaths]);
        toast.success(`${newPaths.length} foto(s) subida(s)`);
      }
    } catch (err) {
      notifyError(err, 'Error subiendo fotos');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (path: string) => {
    if (disabled) return;
    assertSupabase(supabase);
    try {
      const { error } = await supabase!.storage.from(BUCKET).remove([path]);
      if (error) throw mapSupabaseError(error);
      onChange(value.filter((p) => p !== path));
      setThumbUrls((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    } catch (err) {
      notifyError(err, 'No se pudo borrar la foto');
    }
  };

  const count = value.length;
  const meetsMin = count >= minPhotos;
  const meetsRecommended = count >= recommendedPhotos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Fotos del lugar
          </span>
          <Badge
            variant={meetsMin ? 'default' : 'outline'}
            className={meetsMin ? '' : 'border-orange-500 text-orange-500'}
          >
            {count} / {minPhotos} mínimo
          </Badge>
          {meetsMin && !meetsRecommended && (
            <Badge variant="outline" className="text-[10px]">
              Sugerido {recommendedPhotos}+
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_MIMES.join(',')}
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-1.5" />
            {uploading ? 'Subiendo…' : 'Agregar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.setAttribute('capture', 'environment');
                inputRef.current.click();
              }
            }}
            className="sm:hidden"
          >
            <Camera className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border/50 rounded-md">
          Subí al menos {minPhotos} fotos del espacio (frente, lateral, conexiones).
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((path) => (
            <div
              key={path}
              className="relative group aspect-square rounded-md overflow-hidden border border-border/50 bg-muted/30"
            >
              {thumbUrls[path] ? (
                <img
                  src={thumbUrls[path]}
                  alt="Foto visita"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  Cargando…
                </div>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => void handleRemove(path)}
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition disabled:cursor-not-allowed"
                aria-label="Eliminar foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
