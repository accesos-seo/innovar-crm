import React, { useState } from 'react';
import { useTaskComments } from '@/hooks/tareas/useTaskComments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function TaskComments({ taskId }: { taskId: string }) {
  const { data: comments, addComment } = useTaskComments(taskId);
  const [newComment, setNewComment] = useState('');

  const handleSend = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync(newComment.trim());
    setNewComment('');
  };

  return (
    <div className="space-y-4 pb-8">
      <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">
        Comentarios ({comments?.length || 0})
      </h4>
      
      <div className="space-y-4 mb-4">
        {comments?.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={comment.author?.avatar_url || ''} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {comment.author?.full_name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 bg-muted/20 p-3 rounded-lg border border-border/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs text-foreground">{comment.author?.full_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="text-sm text-foreground/80">{comment.content}</p>
            </div>
          </div>
        ))}
        {comments?.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No hay comentarios todavía.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Textarea 
          placeholder="Escribe un comentario..." 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px] text-sm resize-none"
        />
        <Button 
          onClick={handleSend} 
          disabled={!newComment.trim() || addComment.isPending}
          className="self-end text-xs tracking-widest uppercase font-bold"
        >
          {addComment.isPending ? 'Enviando...' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
}
