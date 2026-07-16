import { create } from 'zustand';

/**
 * Zustand store for AI-detected action items (tasks).
 */
export const useTaskStore = create((set, get) => ({
  tasks: [],

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({
      // Deduplicate by _id
      tasks: [...state.tasks.filter((t) => t._id !== task._id), task]
    })),

  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t._id === task._id ? { ...t, ...task } : t))
    })),

  getActiveTasks:   () => get().tasks.filter((t) => !t.resolved),
  getResolvedTasks: () => get().tasks.filter((t) => t.resolved)
}));
