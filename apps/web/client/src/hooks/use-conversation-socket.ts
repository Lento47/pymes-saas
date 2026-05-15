import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Hook para mensajes en tiempo real dentro de una conversación.
 * Entra al room cuando se monta y sale cuando se desmonta.
 *
 * La forma en que el usuario ve el mensaje:
 *   1. Socket emite message:new → insert optimista en cache
 *   2. Invalidate → refetch trae DTO enriquecido del backend (has_media, media_download_url, etc.)
 *   3. Si parece media (imagen/video/audio), segundo refetch 1.5s después
 *      para capturar media que tarda en procesarse (downloadInboundMediaToStorage)
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

  /**
   * Heurística simple: detecta si el payload crudo del socket parece media.
   * El socket emite objetos Prisma sin enriquecer (has_media/media_type/media_download_url),
   * así que usamos body_text y message_type como señales.
   */
  function looksLikeMedia(message: any): boolean {
    if (message.has_media || message.media_type) return true;
    const type = message.message_type;
    if (type === 'image' || type === 'document' || type === 'audio' || type === 'video') return true;
    const text = message.body_text || '';
    return text.startsWith('🖼') || text.startsWith('📄') || text.startsWith('🎬') || text.startsWith('🎧');
  }

  const handleNewMessage = useCallback(
    (message: any) => {
      // 1. Insert optimista — muestra el mensaje al instante
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

      // 2. Refetch inmediato — trae el DTO enriquecido del backend
      qc.invalidateQueries({ queryKey: ['/api/conversations'] });
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });

      // 3. Si parece media, refetch diferido — captura media async (MinIO)
      if (looksLikeMedia(message)) {
        window.setTimeout(() => {
          qc.invalidateQueries({ queryKey: MESSAGES_KEY });
        }, 1500);
      }
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
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.emit('leave:conversation', conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [conversationId, handleNewMessage, handleConversationUpdated]);
}
