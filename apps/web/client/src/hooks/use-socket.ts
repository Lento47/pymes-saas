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
// In dev the Vite server runs on :5000 but the NestJS backend (and its
// Socket.io server) runs on :4000. Connect directly to avoid proxy issues.
// In production the WS server is co-located so we use a relative path.
const WS_URL =
  import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : window.location.origin;

export function connectSocket() {
  if (_socket?.connected) return _socket;

  const token = getAuthToken();
  if (!token) return null;

  _socket = io(`${WS_URL}/ws`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
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
