import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Hook para mensajes en tiempo real dentro de una conversación.
 * Entra al room cuando se monta y sale cuando se desmonta.
 *
 * Flujo de media entrante:
 *   1. message:new → mensaje con has_media=true, media_status='processing' (descarga en curso)
 *   2. message:media-ready → descarga completada, actualiza el mensaje en cache con URL y tipo
 *
 * @param conversationId - ID de la conversación abierta
 */
export function useConversationSocket(conversationId: string) {
  const qc = useQueryClient();
  const MESSAGES_KEY = ['/api/conversations', conversationId, 'messages'];

  const handleNewMessage = useCallback(
    (message: any) => {
      qc.setQueryData(MESSAGES_KEY, (old: any) => {
        if (!old) return old;
        const exists = old.data?.some((m: any) => m.id === message.id);
        if (exists) return old;
        return {
          ...old,
          data: [...(old.data ?? []), message],
          meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
        };
      });
      qc.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    [qc, conversationId],
  );

  const handleMediaReady = useCallback(
    (payload: {
      message_id: string;
      conversation_id: string;
      media_type: string;
      media_status: string;
      media_download_url: string;
      media_mime_type: string | null;
      media_filename: string | null;
      media_caption: string | null;
    }) => {
      // Update only the affected message in cache — no full refetch
      qc.setQueryData(MESSAGES_KEY, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((m: any) =>
            m.id === payload.message_id
              ? {
                  ...m,
                  has_media: true,
                  media_type: payload.media_type,
                  media_status: payload.media_status,
                  media_download_url: payload.media_download_url,
                  media_mime_type: payload.media_mime_type,
                  media_filename: payload.media_filename,
                  media_caption: payload.media_caption,
                }
              : m,
          ),
        };
      });
    },
    [qc, conversationId],
  );

  const handleConversationUpdated = useCallback(
    (update: any) => {
      qc.invalidateQueries({ queryKey: ['/api/conversations'] });
      if (update.id === conversationId) {
        qc.invalidateQueries({ queryKey: ['/api/conversations', conversationId] });
      }
    },
    [qc, conversationId],
  );

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket || !conversationId) return;

    socket.emit('join:conversation', conversationId);
    socket.on('message:new', handleNewMessage);
    socket.on('message:media-ready', handleMediaReady);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.emit('leave:conversation', conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:media-ready', handleMediaReady);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [conversationId, handleNewMessage, handleMediaReady, handleConversationUpdated]);
}
