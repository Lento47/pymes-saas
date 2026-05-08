import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Hook para mantener la bandeja en sync con eventos del workspace.
 * Escucha actualizaciones de conversaciones y refresca la lista del inbox.
 */
export function useInboxSocket() {
  const qc = useQueryClient();

  const handleConversationUpdated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [qc]);

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket) return;

    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [handleConversationUpdated]);
}
