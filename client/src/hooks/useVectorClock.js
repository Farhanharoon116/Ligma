import { useSessionStore } from '../store/useSessionStore';

// Module-level singleton so all hooks share the same clock state
const clockStore = new Map(); // nodeId → { [userId]: counter }

/**
 * Provides vector clock helpers tied to the current user.
 * All callers share the same underlying clockStore (module singleton).
 */
export function useVectorClock() {
  const userId = useSessionStore((s) => s.userId);

  /**
   * Increment the local user's counter for nodeId.
   * Returns the updated clock object.
   */
  function incrementClock(nodeId) {
    const current  = clockStore.get(nodeId) || {};
    const newClock = { ...current, [userId]: (current[userId] || 0) + 1 };
    clockStore.set(nodeId, newClock);
    return newClock;
  }

  /** Read the current clock for nodeId without incrementing. */
  function getClock(nodeId) {
    return clockStore.get(nodeId) || {};
  }

  /** Overwrite the clock for nodeId (used after receiving a server update). */
  function setClock(nodeId, clock) {
    if (clock) clockStore.set(nodeId, clock);
  }

  return { incrementClock, getClock, setClock };
}
