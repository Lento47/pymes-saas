import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Global hook for real-time contact updates.
 * Mount once in the protected layout (sidebar).
 */
export function useContactsSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket) return;

    const handleContactUpdated = () => {
      qc.invalidateQueries({ queryKey: ['/api/contacts'] });
    };

    socket.on('contact:updated', handleContactUpdated);

    return () => {
      socket.off('contact:updated', handleContactUpdated);
    };
  }, [qc]);
}
