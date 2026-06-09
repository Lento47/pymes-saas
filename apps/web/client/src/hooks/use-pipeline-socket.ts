import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './use-socket';

/**
 * Global hook for real-time pipeline/deal updates.
 * Mount once in the protected layout (sidebar).
 */
export function usePipelineSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket() ?? connectSocket();
    if (!socket) return;

    const invalidatePipeline = () => {
      qc.invalidateQueries({ queryKey: ['/api/pipeline/stages'] });
    };

    socket.on('deal:created', invalidatePipeline);
    socket.on('deal:updated', invalidatePipeline);
    socket.on('deal:stage_changed', invalidatePipeline);
    socket.on('deal:won', invalidatePipeline);
    socket.on('deal:lost', invalidatePipeline);

    return () => {
      socket.off('deal:created', invalidatePipeline);
      socket.off('deal:updated', invalidatePipeline);
      socket.off('deal:stage_changed', invalidatePipeline);
      socket.off('deal:won', invalidatePipeline);
      socket.off('deal:lost', invalidatePipeline);
    };
  }, [qc]);
}
