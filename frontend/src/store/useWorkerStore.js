import { create } from 'zustand';
import { api } from '../lib/api.js';

export const useWorkerStore = create((set, get) => ({
  workers: [],
  isLoading: false,

  fetchWorkers: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/workers');
      set({ workers: res.data.workers || [], isLoading: false });
    } catch (err) {
      console.error('Failed to fetch workers:', err);
      set({ isLoading: false });
    }
  },

  deleteWorker: async (workerId) => {
    try {
      await api.delete(`/workers/${workerId}`);
      set((state) => ({
        workers: state.workers.filter((w) => w.workerId !== workerId && w._id !== workerId),
      }));
    } catch (err) {
      console.error('Failed to delete worker:', err);
    }
  },

  cleanupOfflineWorkers: async () => {
    try {
      await api.delete('/workers/cleanup/offline');
      set((state) => ({
        workers: state.workers.filter((w) => w.status === 'online'),
      }));
    } catch (err) {
      console.error('Failed to cleanup offline workers:', err);
    }
  },

  handleWorkerUpdate: (updatedWorker) => {
    set((state) => {
      const index = state.workers.findIndex((w) => w.workerId === updatedWorker.workerId);
      if (index >= 0) {
        const next = [...state.workers];
        next[index] = { ...next[index], ...updatedWorker };
        return { workers: next };
      } else {
        return { workers: [updatedWorker, ...state.workers] };
      }
    });
  },
}));

