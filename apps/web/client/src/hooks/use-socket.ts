import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api';

// Socket singleton — una sola conexión para toda la app
let _socket: Socket | null = null;

export function getSocket(): Socket | null {
  return _socket;
}

/**
 * Inicializa la conexión WebSocket con el token JWT actual.
 * Llamar una sola vez al hacer login (en App.tsx o en el hook useAuth).
 */
export function connectSocket() {
  if (_socket?.connected) return _socket;

  const token = getAuthToken();
  if (!token) return null;

  _socket = io('/ws', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  _socket.on('connect', () => {
    console.log('[WS] Conectado:', _socket?.id);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[WS] Desconectado:', reason);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[WS] Error de conexión:', err.message);
  });

  return _socket;
}

/**
 * Desconectar y limpiar el socket (llamar al hacer logout).
 */
export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}
