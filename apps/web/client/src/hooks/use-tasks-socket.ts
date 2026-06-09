import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Global hook for real-time task updates.
 * Mount once in the protected layout (sidebar).
 * Invalidates task queries when the backend emits task:updated.
 */
export function useTasksSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket) return;

    const handleTaskUpdated = () => {
      qc.invalidateQueries({ queryKey: ['/api/tasks'] });
      qc.invalidateQueries({ queryKey: ['/api/tasks/overdue'] });
    };

    socket.on('task:updated', handleTaskUpdated);

    return () => {
      socket.off('task:updated', handleTaskUpdated);
    };
  }, [qc]);
}
