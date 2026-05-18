import React, { useRef } from 'react';
import { useTaskAttachments } from '@/hooks/tareas/useTaskAttachments';
import { Button } from '@/components/ui/button';
import { Paperclip, FileText, Image as ImageIcon, Download, Loader2 } from 'lucide-react';

export function TaskAttachments({ taskId }: { taskId: string }) {
  const { data: attachments, uploadAttachment } = useTaskAttachments(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadAttachment.mutateAsync(e.target.files[0]);
    }
  };

  const getIconForType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-blue-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Adjuntos ({attachments?.length || 0})
        </h4>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
          className="text-xs uppercase tracking-widest font-bold border-dashed border-primary/50 text-primary hover:bg-primary/10"
        >
          {uploadAttachment.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Paperclip className="w-3 h-3 mr-1" />}
          Subir archivo
        </Button>
      </div>

      <div className="space-y-2">
        {attachments?.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-2 rounded bg-muted/10 border border-border/30 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              {getIconForType(file.mime_type)}
              <span className="text-sm font-medium truncate text-foreground">{file.file_name}</span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">({formatSize(file.file_size)})</span>
            </div>
            <a 
              href={file.file_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-1 hover:bg-background rounded text-primary"
              aria-label="Descargar"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        ))}
        {attachments?.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No hay archivos adjuntos.</p>
        )}
      </div>
    </div>
  );
}
