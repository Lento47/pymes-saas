import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Hook para mensajes en tiempo real dentro de una conversación.
 * Entra al room cuando se monta y sale cuando se desmonta.
 *
 * @param conversationId - ID de la conversación abierta
 *
 * @example
 * // En conversation.tsx:
 * useConversationSocket(id);
 */
export function useConversationSocket(conversationId: string) {
  const qc = useQueryClient();

  const handleNewMessage = useCallback(
    (message: any) => {
      // Agregar el nuevo mensaje al cache de React Query sin refetch
      qc.setQueryData(
        ['conversation-messages', conversationId],
        (old: any) => {
          if (!old) return old;
          const exists = old.data?.some((m: any) => m.id === message.id);
          if (exists) return old;
          return {
            ...old,
            data: [...(old.data ?? []), message],
            meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
          };
        },
      );
    },
    [qc, conversationId],
  );

  const handleConversationUpdated = useCallback(
    (update: any) => {
      // Actualizar el inbox list
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (update.id === conversationId) {
        qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
        qc.invalidateQueries({ queryKey: ['/api/conversations', conversationId] });
      }
    },
    [qc, conversationId],
  );

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket || !conversationId) return;

    // Entrar al room de la conversación
    socket.emit('join:conversation', conversationId);
    socket.on('message:new', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.emit('leave:conversation', conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [conversationId, handleNewMessage, handleConversationUpdated]);
}
