import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Singleton Socket.IO client.
 * autoConnect: false — we connect manually after the user joins a session.
 */
export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});
