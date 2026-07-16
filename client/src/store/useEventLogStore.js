import { create } from 'zustand';

/**
 * Lightweight store for the in-app activity / event log.
 * Events are prepended (newest first) and capped at 200 entries.
 */
export const useEventLogStore = create((set) => ({
  events: [],

  addEvent: (event) =>
    set((state) => ({
      events: [{ id: crypto.randomUUID(), ts: Date.now(), ...event }, ...state.events].slice(0, 200)
    })),

  clearEvents: () => set({ events: [] })
}));
