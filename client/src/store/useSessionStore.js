import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Zustand store for the current user's session identity.
 * Persisted to localStorage so users survive page refreshes.
 */
export const useSessionStore = create(
  persist(
    (set) => ({
      sessionId:   null,
      userId:      null,
      role:        null,
      name:        null,
      users:       [],   // other participants: [{ userId, name, role }]
      lastEventId: null, // last event id received — used for reconnect replay

      setSession: ({ sessionId, userId, role, name }) =>
        set({ sessionId, userId, role, name }),

      setUsers: (users) => set({ users }),

      addUser: (user) =>
        set((state) => ({
          users: [
            ...state.users.filter((u) => u.userId !== user.userId),
            user
          ]
        })),

      removeUser: (userId) =>
        set((state) => ({
          users: state.users.filter((u) => u.userId !== userId)
        })),

      setLastEventId: (lastEventId) => set({ lastEventId }),

      clearSession: () =>
        set({ sessionId: null, userId: null, role: null, name: null, users: [], lastEventId: null })
    }),
    {
      name: 'ligma-session',
      // Only persist identity fields — not transient runtime state
      partialize: (state) => ({
        sessionId:   state.sessionId,
        userId:      state.userId,
        role:        state.role,
        name:        state.name,
        lastEventId: state.lastEventId
      })
    }
  )
);
