import { useEffect } from 'react';
import { socket } from '../socket';
import { useSessionStore } from '../store/useSessionStore';
import { useCanvasStore }  from '../store/useCanvasStore';
import { useTaskStore }    from '../store/useTaskStore';

/**
 * Connects the Socket.IO client, joins the session room, and registers all
 * real-time event listeners.  Must be mounted inside a component that has
 * access to a valid session (sessionId + userId).
 */
export function useSocket() {
  const {
    sessionId, userId, role, name, lastEventId,
    setLastEventId, addUser, removeUser
  } = useSessionStore();

  const { setNodes, addNode, updateNode, deleteNode, lockNode, setCursor, removeCursor } =
    useCanvasStore();

  const { setTasks, addTask, updateTask } = useTaskStore();

  useEffect(() => {
    if (!sessionId || !userId) return;

    // ── Apply a single event from replay ────────────────────────────────────
    function applyEvent(event) {
      const { type, payload } = event;
      switch (type) {
        case 'canvas:node_create':
          addNode(payload);
          break;
        case 'canvas:node_update':
          updateNode(payload.nodeId, payload.changes, payload.vectorClock);
          break;
        case 'canvas:node_delete':
          deleteNode(payload.nodeId);
          break;
        case 'canvas:node_lock':
          lockNode(payload.nodeId, payload.lockedBy);
          break;
        default:
          break;
      }
    }

    // ── Connect and join session room ────────────────────────────────────────
    function joinSession() {
      socket.emit('session:user_join', { sessionId, userId, name, role, lastEventId });
    }

    socket.connect();

    if (socket.connected) {
      joinSession();
    } else {
      socket.once('connect', joinSession);
    }

    // ── Event listeners ──────────────────────────────────────────────────────

    socket.on('session:init', ({ nodes, tasks }) => {
      setNodes(nodes);
      setTasks(tasks);
    });

    socket.on('session:replay', ({ events }) => {
      for (const event of events) {
        applyEvent(event);
        if (event._id) setLastEventId(event._id);
      }
    });

    socket.on('session:user_join', ({ userId: uid, name: uname, role: urole }) => {
      addUser({ userId: uid, name: uname, role: urole });
    });

    socket.on('session:user_leave', ({ userId: uid }) => {
      removeUser(uid);
      removeCursor(uid);
    });

    socket.on('canvas:node_create', (data) => {
      addNode(data);
      if (data.eventId) setLastEventId(data.eventId);
    });

    socket.on('canvas:node_update', ({ nodeId, changes, vectorClock, eventId }) => {
      updateNode(nodeId, changes, vectorClock);
      if (eventId) setLastEventId(eventId);
    });

    socket.on('canvas:node_delete', ({ nodeId, eventId }) => {
      deleteNode(nodeId);
      if (eventId) setLastEventId(eventId);
    });

    socket.on('canvas:node_lock', ({ nodeId, lockedBy, eventId }) => {
      lockNode(nodeId, lockedBy);
      if (eventId) setLastEventId(eventId);
    });

    socket.on('cursor:move', ({ userId: uid, x, y }) => {
      setCursor(uid, { x, y });
    });

    socket.on('task:update', ({ action, task }) => {
      if (action === 'create') addTask(task);
      else if (action === 'update') updateTask(task);
    });

    socket.on('error:unauthorized', ({ message }) => {
      console.warn('[socket] Unauthorized:', message);
    });

    socket.on('error:server', ({ message }) => {
      console.error('[socket] Server error:', message);
    });

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      socket.off('connect',          joinSession);
      socket.off('session:init');
      socket.off('session:replay');
      socket.off('session:user_join');
      socket.off('session:user_leave');
      socket.off('canvas:node_create');
      socket.off('canvas:node_update');
      socket.off('canvas:node_delete');
      socket.off('canvas:node_lock');
      socket.off('cursor:move');
      socket.off('task:update');
      socket.off('error:unauthorized');
      socket.off('error:server');
      socket.disconnect();
    };
    // Zustand store actions are stable references (never change between renders),
    // so they are safe to omit from the dependency array. Re-connecting the socket
    // on every render would cause infinite loops; we only want this effect to run
    // once when the session identity is first established.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId]);
}
