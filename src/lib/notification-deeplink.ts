import { Notification } from '@/types/database';

/**
 * Determines the React Router state to pass when navigating from a notification,
 * so the target page can auto-open the specific record's detail modal/panel.
 *
 * Full-page routes (/projects/:id, /quotations/:id, /soporte/:id) navigate via
 * the URL itself — no extra state needed. Only modal/panel pages need this.
 */
export function buildDeepLinkState(notif: Notification) {
  if (!notif.related_id || !notif.action_url) return undefined;
  const url = notif.action_url;
  if (url.startsWith('/tasks'))          return { state: { taskId:        notif.related_id } };
  if (url.startsWith('/agenda'))         return { state: { appointmentId: notif.related_id } };
  if (url.startsWith('/finanzas/pagos')) return { state: { paymentId:     notif.related_id } };
  return undefined;
}
