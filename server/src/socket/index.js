import { Server } from 'socket.io';
import { registerHandlers } from './handlers.js';

/**
 * Attach Socket.IO to the HTTP server and register all event handlers.
 *
 * @param {import('http').Server} httpServer
 * @param {string} clientUrl - allowed CORS origin
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer, clientUrl) {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);
    // Ensure socket.data is always initialised
    socket.data.userId    = null;
    socket.data.sessionId = null;
    socket.data.name      = '';

    registerHandlers(io, socket);
  });

  return io;
}
