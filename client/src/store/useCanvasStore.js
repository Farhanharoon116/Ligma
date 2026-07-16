import { create } from 'zustand';

/**
 * Zustand store for canvas nodes and remote cursor positions.
 * Nodes are keyed by nodeId in a Map for O(1) look-ups.
 */
export const useCanvasStore = create((set, get) => ({
  nodes:   new Map(), // Map<nodeId, nodeObject>
  cursors: {},        // { [userId]: { x, y } }

  /** Replace the entire node map (used on session:init). */
  setNodes: (nodesArray) => {
    const map = new Map();
    for (const node of nodesArray) map.set(node.nodeId, node);
    set({ nodes: map });
  },

  addNode: (node) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(node.nodeId, node);
      return { nodes };
    }),

  updateNode: (nodeId, changes, vectorClock) =>
    set((state) => {
      const nodes    = new Map(state.nodes);
      const existing = nodes.get(nodeId);
      if (existing) {
        nodes.set(nodeId, {
          ...existing,
          ...changes,
          vectorClock: vectorClock ?? existing.vectorClock
        });
      }
      return { nodes };
    }),

  deleteNode: (nodeId) =>
    set((state) => {
      const nodes    = new Map(state.nodes);
      const existing = nodes.get(nodeId);
      if (existing) nodes.set(nodeId, { ...existing, deleted: true });
      return { nodes };
    }),

  lockNode: (nodeId, lockedBy) =>
    set((state) => {
      const nodes    = new Map(state.nodes);
      const existing = nodes.get(nodeId);
      if (existing) nodes.set(nodeId, { ...existing, lockedBy });
      return { nodes };
    }),

  setCursor:    (userId, pos) =>
    set((state) => ({ cursors: { ...state.cursors, [userId]: pos } })),

  removeCursor: (userId) =>
    set((state) => {
      const cursors = { ...state.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  /** Return only non-deleted nodes as an array. */
  getActiveNodes: () =>
    Array.from(get().nodes.values()).filter((n) => !n.deleted)
}));
