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
// ───────────────────────────────────────────────────────────────────────────
// IMPORTANTE — URL DEL WEBSOCKET
//
// DEV: EL HOOK ASUME QUE EL BACKEND NESTJS CORRE EN `:4000` EN EL MISMO HOST
//      DEL FRONTEND (CONFIGURACION DEFAULT DE `pnpm dev`). SI ALGUIEN CORRE
//      EL BACKEND EN OTRO PUERTO, ESTO ROMPE — AGREGAR `VITE_WS_URL` SI HACE
//      FALTA SER FLEXIBLE.
//
// PROD: USA `VITE_API_URL` (ej. `https://api.pymeshub.lat`) PARA QUE EL WS
//       VAYA A RAILWAY, NO A CLOUDFLARE PAGES (QUE ES SOLO ESTATICO).
//       SI `VITE_API_URL` NO ESTA SETEADO EN CLOUDFLARE, CAE A
//       `window.location.origin` QUE NO TIENE WS — LA UI EN VIVO NO FUNCIONA.
// ───────────────────────────────────────────────────────────────────────────
const WS_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : (import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin;

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
