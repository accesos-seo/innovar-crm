import React, { useState } from 'react';
import { Bell, MapPin, CheckCircle, RefreshCcw, Info, Clock, AlertCircle, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useUnreadCount } from '@/hooks/notifications/useUnreadCount';
import { useMarkAsRead } from '@/hooks/notifications/useMarkAsRead';
import { useMarkAllAsRead } from '@/hooks/notifications/useMarkAllAsRead';
import { useRealtimeNotifications } from '@/hooks/notifications/useRealtimeNotifications';
import { Notification } from '@/types/database';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'booking_new':
      return <MapPin className="w-5 h-5 text-primary" />;
    case 'booking_reminder':
      return <Clock className="w-5 h-5 text-yellow-500" />;
    case 'booking_completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'booking_cancelled':
      return <AlertCircle className="w-5 h-5 text-destructive" />;
    case 'project_status':
      return <RefreshCcw className="w-5 h-5 text-primary" />;
    case 'system':
    default:
      return <Info className="w-5 h-5 text-muted-foreground" />;
  }
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  useRealtimeNotifications();
  const { data: count = 0 } = useUnreadCount();
  const { data } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Get first page and slice
  const notifications = data?.pages[0]?.data.slice(0, 15) || [];
  
  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);

  const handleNotificationClick = async (notif: Notification) => {
    setOpen(false);
    if (!notif.is_read) {
      await markAsRead.mutateAsync(notif.id);
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/agenda/recordatorios');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="relative text-muted-foreground hover:text-primary transition-colors duration-200 outline-none" 
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {count > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center text-[10px] text-white border-none rounded-full"
          >
            {count > 99 ? '99+' : count}
          </Badge>
        )}
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-[380px] p-0 bg-card border-border shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-sm tracking-tight text-foreground uppercase">Notificaciones</h3>
            {count > 0 && <span className="px-1.5 py-0.5 rounded bg-primary/20 text-[10px] font-bold text-primary">{count} nuevas</span>}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary flex-shrink-0"
              onClick={() => markAllAsRead.mutate()}
              title="Marcar todas como leídas"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-2 opacity-60">
              <Bell className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No hay notificaciones</p>
              <p className="text-xs text-muted-foreground">Estás al día con todo.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {unreadNotifications.length > 0 && (
                <div className="flex flex-col">
                  {unreadNotifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full text-left p-4 bg-primary/5 hover:bg-primary/10 border-b border-border/40 transition-colors cursor-pointer flex gap-4"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notif.notification_type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-bold text-foreground leading-snug">
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground pt-1 font-medium">
                          {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      {notif.priority === 2 && (
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse flex-shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {readNotifications.length > 0 && (
                <>
                  {unreadNotifications.length > 0 && (
                     <div className="bg-muted/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-y border-border/40">
                       Anteriores
                     </div>
                  )}
                  <div className="flex flex-col divide-y divide-border/20">
                    {readNotifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className="w-full text-left p-4 opacity-60 hover:opacity-100 hover:bg-muted/30 transition-all cursor-pointer flex gap-4"
                      >
                        <div className="flex-shrink-0 mt-0.5 grayscale">
                          {getNotificationIcon(notif.notification_type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-foreground/80 leading-snug">
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notif.body}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground pt-1">
                            {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-border/50 bg-muted/10">
          <Button 
            variant="ghost" 
            className="w-full text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
            onClick={handleViewAll}
          >
            Ver todas las notificaciones
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
