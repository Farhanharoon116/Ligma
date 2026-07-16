import { v4 as uuidv4 } from 'uuid';
import Event   from '../models/Event.js';
import Node    from '../models/Node.js';
import Task    from '../models/Task.js';
import Session from '../models/Session.js';
import { checkPermission } from './rbac.js';
import { increment, merge, mergeClocks } from '../services/vectorClock.js';
import { deriveState } from '../services/canvasState.js';
import { scheduleClassify } from '../services/gemini.js';

/**
 * Register all Socket.IO event handlers for a connected socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerHandlers(io, socket) {
  // ─── session:user_join ──────────────────────────────────────────────────────
  socket.on('session:user_join', async ({ sessionId, userId, name, role, lastEventId }) => {
    try {
      socket.data.userId    = userId;
      socket.data.sessionId = sessionId;
      socket.data.name      = name;
      socket.join(sessionId);

      // Upsert user in Session document (avoid duplicates)
      await Session.updateOne(
        { sessionId, 'users.userId': { $ne: userId } },
        { $push: { users: { userId, name, role } } }
      );

      // Notify other clients in the room
      socket.to(sessionId).emit('session:user_join', { userId, name, role });

      if (lastEventId) {
        // Reconnect path — replay only the events the client missed
        const lastEvent = await Event.findById(lastEventId).lean().catch((err) => {
          console.error('[socket] Failed to look up lastEventId:', err.message);
          return null;
        });
        let replayEvents;
        if (lastEvent) {
          replayEvents = await Event.find({
            sessionId,
            timestamp: { $gt: lastEvent.timestamp }
          }).sort({ timestamp: 1 }).lean();
        } else {
          // Unknown lastEventId — replay everything
          replayEvents = await Event.find({ sessionId }).sort({ timestamp: 1 }).lean();
        }
        socket.emit('session:replay', { events: replayEvents });
      } else {
        // Fresh join — derive full canvas state and send as snapshot
        const nodeMap = await deriveState(sessionId);
        const nodes   = Array.from(nodeMap.values()).filter((n) => !n.deleted);
        const tasks   = await Task.find({ sessionId }).lean();
        socket.emit('session:init', { nodes, tasks });
      }
    } catch (err) {
      console.error('[socket] session:user_join error:', err);
      socket.emit('error:server', { message: 'Failed to join session' });
    }
  });

  // ─── canvas:node_create ─────────────────────────────────────────────────────
  socket.on('canvas:node_create', async (data) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    if (!(await checkPermission(socket, sessionId, 'create'))) return;

    try {
      const userId     = socket.data.userId;
      const nodeId     = data.nodeId || uuidv4();
      const vectorClock = increment({}, userId);

      const payload = {
        nodeId,
        sessionId,
        type:     data.type  || 'sticky',
        text:     data.text  || '',
        x:        data.x     ?? 0,
        y:        data.y     ?? 0,
        width:    data.width  || 200,
        height:   data.height || 150,
        color:    data.color  || '#fef08a',
        lockedBy: null,
        vectorClock,
        acl: data.acl || { lead: true, contributor: true, viewer: false },
        deleted: false
      };

      const event = await Event.create({
        sessionId,
        type:      'canvas:node_create',
        payload,
        userId,
        timestamp: new Date()
      });

      // Update derived-state cache
      await Node.findOneAndUpdate(
        { sessionId, nodeId },
        { $set: payload },
        { upsert: true, new: true }
      );

      io.to(sessionId).emit('canvas:node_create', {
        ...payload,
        eventId: event._id.toString()
      });
    } catch (err) {
      console.error('[socket] canvas:node_create error:', err);
      socket.emit('error:server', { message: 'Failed to create node' });
    }
  });

  // ─── canvas:node_update ─────────────────────────────────────────────────────
  socket.on('canvas:node_update', async (data) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    if (!(await checkPermission(socket, sessionId, 'update'))) return;

    try {
      const userId                        = socket.data.userId;
      const { nodeId, changes, vectorClock: incomingClock } = data;

      const existingNode = await Node.findOne({ sessionId, nodeId }).lean();
      if (!existingNode) {
        socket.emit('error:server', { message: 'Node not found' });
        return;
      }

      if (existingNode.lockedBy && existingNode.lockedBy !== userId) {
        socket.emit('error:unauthorized', { message: 'Node is locked by another user' });
        return;
      }

      const existingClock = existingNode.vectorClock || {};

      // Increment incoming clock on behalf of this write
      const newIncomingClock = increment(incomingClock || existingClock, userId);

      // Existing field snapshot for conflict resolution
      const existingFields = {
        text:   existingNode.text,
        x:      existingNode.x,
        y:      existingNode.y,
        color:  existingNode.color,
        width:  existingNode.width,
        height: existingNode.height
      };

      // LWW merge — incoming update vs current persisted state
      const mergedFields = merge(newIncomingClock, existingClock, changes, existingFields);
      const mergedClock  = mergeClocks(newIncomingClock, existingClock);

      const payload = { nodeId, changes: mergedFields, vectorClock: mergedClock };

      const event = await Event.create({
        sessionId,
        type:      'canvas:node_update',
        payload,
        userId,
        timestamp: new Date()
      });

      // Update cache — only set the merged fields and new clock
      const updateSet = { vectorClock: mergedClock };
      for (const [k, v] of Object.entries(mergedFields)) {
        updateSet[k] = v;
      }
      await Node.findOneAndUpdate({ sessionId, nodeId }, { $set: updateSet });

      io.to(sessionId).emit('canvas:node_update', {
        nodeId,
        changes:     mergedFields,
        vectorClock: mergedClock,
        userId,
        eventId:     event._id.toString()
      });

      // Schedule AI classification only when text actually changed
      const latestText = mergedFields.text ?? existingNode.text;
      const textChanged = mergedFields.text !== undefined && mergedFields.text !== existingNode.text;
      console.log(`[socket] canvas:node_update nodeId=${nodeId} type=${existingNode.type} textChanged=${textChanged} textLen=${latestText?.length}`);
      if (textChanged && (existingNode.type === 'sticky' || existingNode.type === 'text') && latestText) {
        console.log(`[socket] Scheduling classification for nodeId=${nodeId}`);
        scheduleClassify(nodeId, latestText, sessionId, userId, socket.data.name, io);
      }
    } catch (err) {
      console.error('[socket] canvas:node_update error:', err);
      socket.emit('error:server', { message: 'Failed to update node' });
    }
  });

  // ─── canvas:node_delete ─────────────────────────────────────────────────────
  socket.on('canvas:node_delete', async ({ nodeId }) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    if (!(await checkPermission(socket, sessionId, 'delete'))) return;

    try {
      const userId = socket.data.userId;

      const event = await Event.create({
        sessionId,
        type:      'canvas:node_delete',
        payload:   { nodeId },
        userId,
        timestamp: new Date()
      });

      await Node.findOneAndUpdate({ sessionId, nodeId }, { $set: { deleted: true } });

      io.to(sessionId).emit('canvas:node_delete', {
        nodeId,
        userId,
        eventId: event._id.toString()
      });
    } catch (err) {
      console.error('[socket] canvas:node_delete error:', err);
      socket.emit('error:server', { message: 'Failed to delete node' });
    }
  });

  // ─── canvas:node_lock ───────────────────────────────────────────────────────
  socket.on('canvas:node_lock', async ({ nodeId, lock }) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;
    if (!(await checkPermission(socket, sessionId, 'lock'))) return;

    try {
      const userId = socket.data.userId;
      const node   = await Node.findOne({ sessionId, nodeId }).lean();
      if (!node) return;

      // Prevent stealing a lock held by another user
      if (lock && node.lockedBy && node.lockedBy !== userId) {
        socket.emit('error:unauthorized', { message: 'Node is already locked by another user' });
        return;
      }

      const lockedBy = lock ? userId : null;

      const event = await Event.create({
        sessionId,
        type:      'canvas:node_lock',
        payload:   { nodeId, lockedBy },
        userId,
        timestamp: new Date()
      });

      await Node.findOneAndUpdate({ sessionId, nodeId }, { $set: { lockedBy } });

      io.to(sessionId).emit('canvas:node_lock', {
        nodeId,
        lockedBy,
        userId,
        eventId: event._id.toString()
      });
    } catch (err) {
      console.error('[socket] canvas:node_lock error:', err);
      socket.emit('error:server', { message: 'Failed to lock node' });
    }
  });

  // ─── cursor:move ────────────────────────────────────────────────────────────
  // Broadcast only — not persisted to MongoDB
  socket.on('cursor:move', ({ x, y }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;
    // Relay cursor position to all OTHER clients in the room
    socket.to(sessionId).emit('cursor:move', { userId, x, y });
  });

  // ─── task:update (client-initiated, e.g. resolving a task) ─────────────────
  socket.on('task:update', async ({ taskId, resolved }) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;

    try {
      const task = await Task.findByIdAndUpdate(
        taskId,
        { $set: { resolved } },
        { new: true }
      ).lean();

      if (task) {
        io.to(sessionId).emit('task:update', { action: 'update', task });
      }
    } catch (err) {
      console.error('[socket] task:update error:', err);
    }
  });

  // ─── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { sessionId, userId } = socket.data;
    if (sessionId && userId) {
      socket.to(sessionId).emit('session:user_leave', { userId });
    }
  });
}
