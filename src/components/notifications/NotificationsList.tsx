import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useMarkAsRead } from '@/hooks/notifications/useMarkAsRead';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Notification } from '@/types/database';
import { getNotificationIcon } from '../layout/NotificationBell';
import { Button } from '@/components/ui/button';
import { Loader2, BellOff } from 'lucide-react';

interface NotificationsListProps {
  filterType: string;
  searchQuery?: string;
}

export function NotificationsList({ filterType, searchQuery }: NotificationsListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useNotifications(filterType, searchQuery);
  const markAsRead = useMarkAsRead();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card/30 rounded-lg border border-border/10">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Cargando notificaciones...</p>
      </div>
    );
  }

  const notifications = data?.pages.flatMap(p => p.data) || [];

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-card/30 rounded-lg border border-border/10 border-dashed">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <BellOff className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {searchQuery && searchQuery.trim().length > 0 ? 'Sin resultados' : 'No tienes notificaciones'}
        </h3>
        <p className="text-muted-foreground max-w-sm mt-1">
          {searchQuery && searchQuery.trim().length > 0
            ? `No se encontraron notificaciones que coincidan con "${searchQuery.trim()}".`
            : filterType === 'all'
              ? 'Estás al día. Aquí aparecerán las alertas sobre tus visitas y proyectos.'
              : filterType === 'unread'
                ? 'No tienes notificaciones pendientes. Buen trabajo.'
                : 'No hay notificaciones para este filtro.'}
        </p>
      </div>
    );
  }

  // Group by date logic
  const grouped = notifications.reduce((acc, notif) => {
    const date = parseISO(notif.created_at);
    let key = 'Anteriores';
    if (isToday(date)) key = 'HOY';
    else if (isYesterday(date)) key = 'AYER';
    else if (date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) key = 'ESTA SEMANA';
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Group ordering logic
  const order = ['HOY', 'AYER', 'ESTA SEMANA', 'Anteriores'];
  const sortedKeys = Object.keys(grouped).sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const handleItemClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markAsRead.mutateAsync(notif.id);
    }
    if (notif.action_url) {
      const taskState =
        notif.related_id &&
        (notif.action_url === '/agenda/tareas' || notif.related_table === 'tasks')
          ? { state: { taskId: notif.related_id } }
          : undefined;
      navigate(notif.action_url, taskState);
    }
  };

  return (
    <div className="space-y-8">
      {sortedKeys.map(key => (
        <div key={key} className="space-y-4">
          <div className="flex items-center gap-4">
            <h4 className="text-sm font-black tracking-widest uppercase text-muted-foreground w-32 shrink-0">{key}</h4>
            <div className="h-[1px] w-full bg-border/40" />
          </div>

          <div className="flex flex-col gap-2">
            {grouped[key].map(notif => (
              <div 
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`
                  relative overflow-hidden rounded-lg p-4 flex gap-4 items-start transition-all cursor-pointer group
                  border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5
                  ${!notif.is_read 
                    ? 'bg-primary/5 border-primary/20' 
                    : 'bg-card border-border/20 hover:bg-muted/20'}
                `}
              >
                {!notif.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                
                <div className="flex-shrink-0 mt-1 p-2 rounded-full bg-background border border-border/10 shadow-sm">
                  {getNotificationIcon(notif.notification_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h5 className={`text-base leading-tight truncate ${!notif.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {notif.title}
                    </h5>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                      {format(parseISO(notif.created_at), 'h:mm a', { locale: es })}
                    </span>
                  </div>
                  
                  {notif.body && (
                    <p className="mt-1 text-sm text-muted-foreground max-w-2xl line-clamp-2">
                      {notif.body}
                    </p>
                  )}
                </div>
                
                {notif.priority === 2 && !notif.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse absolute top-4 right-4 shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasNextPage && (
        <div className="pt-4 flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => fetchNextPage()} 
            disabled={isFetchingNextPage}
            className="w-full max-w-sm uppercase tracking-widest text-xs font-bold border-border/50 text-muted-foreground hover:text-foreground"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cargando...
              </>
            ) : (
              'Cargar más'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
