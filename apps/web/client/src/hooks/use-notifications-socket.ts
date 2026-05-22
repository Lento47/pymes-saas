import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

interface Notification {
  id: string;
  read_at?: string | null;
  body?: string;
  title?: string;
  type?: string;
  created_at?: string;
}

interface NotificationsCache {
  data: Notification[];
  meta?: { total?: number };
}

interface UnreadCountCache {
  count: number;
}

/**
 * Hook global para notificaciones en tiempo real.
 * Montar una sola vez en el layout protegido (sidebar o App).
 * Invalida el cache de notifications y el unread-count automáticamente.
 */
export function useNotificationsSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket) return;

    const handleNotification = (notification: Record<string, unknown>) => {
      // Agregar al cache sin refetch
      qc.setQueryData(['/api/notifications'], (old: NotificationsCache | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: [notification as unknown as Notification, ...(old.data ?? [])],
          meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
        };
      });

      // Actualizar badge de no leídas
      qc.setQueryData(['/api/notifications/unread-count'], (old: UnreadCountCache | undefined) => {
        if (!old) return { count: 1 };
        return { count: (old.count ?? 0) + 1 };
      });
    };

    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [qc]);
}
