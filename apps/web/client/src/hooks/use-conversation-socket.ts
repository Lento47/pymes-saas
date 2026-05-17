import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Hook para mensajes en tiempo real dentro de una conversación.
 * Entra al room cuando se monta y sale cuando se desmonta.
 *
 * Flujo de media entrante:
 *   1. Socket message:new → mensaje ya enriquecido (has_media, media_type, media_status, etc.)
 *      El backend usa el mismo serializer (serializeMessageForClient) que GET /messages.
 *   2. Socket message:media-ready → media descargada a MinIO, actualizar solo ese mensaje
 *      en el cache sin refetch completo.
 *
 * @param conversationId - ID de la conversación abierta
 *
 * @example
 * // En conversation.tsx:
 * useConversationSocket(id);
 */
export function useConversationSocket(conversationId: string) {
  const qc = useQueryClient();

  const MESSAGES_KEY = ['/api/conversations', conversationId, 'messages'];

  const handleNewMessage = useCallback(
    (message: any) => {
      // Insert optimista — muestra el mensaje al instante
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

      // Actualizar inbox del workspace
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
      // Update solo ese mensaje en cache — sin refetch
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
      // Actualizar el inbox list
      qc.invalidateQueries({ queryKey: ['/api/conversations'] });
      // Si aplica a esta conversación, actualizar su cache
      if (update.id === conversationId) {
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
