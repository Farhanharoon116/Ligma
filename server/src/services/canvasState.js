import Event from '../models/Event.js';

/**
 * Replay all events for a session in chronological order to derive current canvas state.
 * Returns a Map<nodeId, nodeObject> (including deleted nodes flagged with deleted:true).
 *
 * @param {string} sessionId
 * @returns {Promise<Map<string, Object>>}
 */
export async function deriveState(sessionId) {
  const events = await Event.find({ sessionId }).sort({ timestamp: 1 }).lean();
  const nodeMap = new Map();

  for (const event of events) {
    const { type, payload } = event;

    switch (type) {
      case 'canvas:node_create': {
        nodeMap.set(payload.nodeId, { ...payload, deleted: false });
        break;
      }
      case 'canvas:node_update': {
        const existing = nodeMap.get(payload.nodeId);
        if (existing && !existing.deleted) {
          nodeMap.set(payload.nodeId, {
            ...existing,
            ...payload.changes,
            vectorClock: payload.vectorClock || existing.vectorClock
          });
        }
        break;
      }
      case 'canvas:node_delete': {
        const existing = nodeMap.get(payload.nodeId);
        if (existing) {
          nodeMap.set(payload.nodeId, { ...existing, deleted: true });
        }
        break;
      }
      case 'canvas:node_lock': {
        const existing = nodeMap.get(payload.nodeId);
        if (existing) {
          nodeMap.set(payload.nodeId, { ...existing, lockedBy: payload.lockedBy });
        }
        break;
      }
      default:
        break;
    }
  }

  return nodeMap;
}

/**
 * Derive state and return only active (non-deleted) nodes as an array.
 *
 * @param {string} sessionId
 * @returns {Promise<Object[]>}
 */
export async function getActiveNodes(sessionId) {
  const nodeMap = await deriveState(sessionId);
  return Array.from(nodeMap.values()).filter((n) => !n.deleted);
}
