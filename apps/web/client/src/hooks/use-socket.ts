import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { getAuthToken } from '@/lib/api';

// Socket singleton — una sola conexión para toda la app
let _socket: Socket | null = null;

export function getSocket(): Socket | null {
  return _socket;
}

/**
 * Inicializa la conexión WebSocket con el token JWT actual.
 * Llamar una sola vez al hacer login (en App.tsx o en el hook useAuth).
 *
 * Seguro para llamar múltiples veces: si el socket está healthy lo reusa,
 * si está desconectado/reconectando lo reemplaza por uno nuevo.
 */
// ───────────────────────────────────────────────────────────────────────────
// IMPORTANTE — URL DEL WEBSOCKET
//
// DEV: backend NestJS corre en :4000 en el mismo host.
//
// PROD: usa `VITE_WS_URL`; si no existe, deriva desde el API host configurado.
// ───────────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? import.meta.env.API_URL;

function originFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, window.location.origin).origin;
  } catch {
    return null;
  }
}

const WS_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : (import.meta.env.VITE_WS_URL as string | undefined)
    ?? originFromUrl(API_BASE as string | undefined)
    ?? window.location.origin;

export function connectSocket() {
  // If socket exists and is healthy (connected or actively reconnecting), reuse it
  if (_socket?.connected || _socket?.active) return _socket;

  // If socket exists but is dead, clean it up first
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }

  const token = getAuthToken();
  if (!token) return null;

  // Exponential backoff with jitter so an upstream outage doesn't cause every
  // tab in every browser to slam the backend with synchronized retries.
  // socket.io's algorithm: min(reconnectionDelay * 2^attempt, reconnectionDelayMax)
  // ± randomizationFactor.
  _socket = io(`${WS_URL}/ws`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
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
  _socket?.removeAllListeners();
  _socket?.disconnect();
  _socket = null;
}
