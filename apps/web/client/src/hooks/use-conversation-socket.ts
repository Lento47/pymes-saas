import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

interface Message {
  id: string;
  has_media?: boolean;
  media_type?: string;
  media_status?: string;
  media_download_url?: string;
  media_mime_type?: string | null;
  media_filename?: string | null;
  media_caption?: string | null;
  message_type?: string;
  body_text?: string;
  body_html?: string;
  content?: string;
  [key: string]: unknown;
}

interface MessagesCache {
  data: Message[];
  meta?: { total?: number };
}

/**
 * Hook para mensajes en tiempo real dentro de una conversación.
 * Entra al room cuando se monta y sale cuando se desmonta.
 *
 * Flujo de media entrante:
 *   1. message:new → insert optimista + invalidate messages + inbox
 *   2. Si parece media, invalidate diferido a 1.5s (captura media async)
 *   3. message:media-ready → update solo ese mensaje en cache, sin refetch
 *
 * @param conversationId - ID de la conversación abierta
 *
 * @example
 * // En conversation.tsx:
 * useConversationSocket(id);
 */
export function useConversationSocket(conversationId: string) {
  const qc = useQueryClient();

  // Keep these aligned with ConversationPanel.tsx and InboxPage.tsx query keys.
  const MESSAGES_KEY = ["/api/conversations", conversationId, "messages"];
  const CONVERSATION_KEY = ["/api/conversations", conversationId];
  const CONVERSATIONS_KEY = ["/api/conversations"];

  function looksLikeMedia(message: Message): boolean {
    if (message.has_media || message.media_type) return true;
    const type = message.message_type;
    if (type === 'image' || type === 'document' || type === 'audio' || type === 'video' || type === 'sticker') return true;
    const text = message.body_text || message.body_html || message.content || '';
    return text.startsWith('\u{1F5BC}') || text.startsWith('\u{1F4C4}') || text.startsWith('\u{1F3AC}') || text.startsWith('\u{1F3A7}') || text.startsWith('\u{1F4AC}');
  }

  const handleNewMessage = useCallback(
    (message: Message) => {
      // 1. Insert optimista — muestra el mensaje al instante.
      qc.setQueryData(MESSAGES_KEY, (old: MessagesCache | undefined) => {
        if (!old) return old;
        const existingData = Array.isArray(old.data) ? old.data : [];
        const exists = existingData.some((m) => m.id === message.id);

        if (exists) {
          return {
            ...old,
            data: existingData.map((m) =>
              m.id === message.id ? { ...m, ...message } : m,
            ),
          };
        }

        return {
          ...old,
          data: [...existingData, message],
          meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
        };
      });

      // 2. Refetch inmediato — trae DTO enriquecido del backend.
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });

      // 3. Si parece media, refetch diferido — captura media async (MinIO).
      if (looksLikeMedia(message)) {
        window.setTimeout(() => {
          qc.invalidateQueries({ queryKey: MESSAGES_KEY });
        }, 1500);
      }
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
      if (payload.conversation_id !== conversationId) return;

      // Update solo ese mensaje en cache — sin refetch completo.
      qc.setQueryData(MESSAGES_KEY, (old: MessagesCache | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((m) =>
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
    (update: Record<string, unknown>) => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      if (update.id === conversationId) {
        qc.invalidateQueries({ queryKey: CONVERSATION_KEY });
        qc.invalidateQueries({ queryKey: MESSAGES_KEY });
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
