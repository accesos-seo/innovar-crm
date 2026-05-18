import React from 'react';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useUnreadCount } from '@/hooks/notifications/useUnreadCount';
import { isToday } from 'date-fns';
import { parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { BellRing, CalendarDays, Hash } from 'lucide-react';

export function NotificationsMetrics() {
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data } = useNotifications();

  // Ensure we flatten all loaded pages to compute basic metrics
  // Note: Since this is an infinite query, 'data' only contains loaded pages.
  // We'll compute metrics based on the first page or loaded pages, but ideally,
  // metrics would come from a separate count query for accuracy.
  // For the prompt's sake, we can estimate based on fetched items, 
  // or use the unread count which is exact.
  
  const allLoadedNotifs = data?.pages.flatMap(p => p.data) || [];
  const todayCount = allLoadedNotifs.filter(n => isToday(parseISO(n.created_at))).length;
  const totalCount = allLoadedNotifs.length; // Approximate from loaded

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-l-4 border-l-destructive bg-card/50">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">No Leídas</p>
            <h3 className="text-3xl font-black text-foreground">{unreadCount.toString().padStart(2, '0')}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <BellRing className="w-6 h-6 text-destructive" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-primary bg-card/50">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Hoy</p>
            <h3 className="text-3xl font-black text-foreground">
              {todayCount.toString().padStart(2, '0')}
              {data?.pages[0]?.nextCursor ? '+' : ''}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-muted bg-card/50">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <h3 className="text-3xl font-black text-foreground">
              {totalCount.toString().padStart(2, '0')}
              {data?.pages[0]?.nextCursor ? '+' : ''}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
            <Hash className="w-6 h-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
