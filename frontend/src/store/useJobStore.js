import { create } from 'zustand';
import { api } from '../lib/api.js';

export const useJobStore = create((set, get) => ({
  jobs: [],
  currentJob: null,
  currentTasks: [],
  activities: [],
  isLoading: false,

  fetchJobs: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/jobs');
      set({ jobs: res.data.jobs || [], isLoading: false });
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      set({ isLoading: false });
    }
  },

  fetchJobById: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/jobs/${id}`);
      set({
        currentJob: res.data.job,
        currentTasks: res.data.tasks || [],
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch job:', err);
      set({ isLoading: false });
    }
  },

  addActivity: (message, type = 'info') => {
    const activity = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    set((state) => ({
      activities: [activity, ...state.activities.slice(0, 49)],
    }));
  },

  handleJobUpdate: (updatedJob) => {
    set((state) => {
      // Update in jobs list
      const nextJobs = state.jobs.map((j) =>
        j._id === updatedJob.jobId || j._id === updatedJob._id
          ? { ...j, ...updatedJob }
          : j
      );

      // Update currentJob if viewing it
      let nextCurrent = state.currentJob;
      if (
        nextCurrent &&
        (nextCurrent._id === updatedJob.jobId || nextCurrent._id === updatedJob._id)
      ) {
        nextCurrent = {
          ...nextCurrent,
          ...updatedJob,
          result: {
            ...nextCurrent.result,
            ...(updatedJob.result || {}),
            ...(updatedJob.partialPi ? { piEstimate: updatedJob.partialPi } : {}),
          },
        };
      }

      return { jobs: nextJobs, currentJob: nextCurrent };
    });
  },

  handleTaskUpdate: (updatedTask) => {
    set((state) => {
      let nextTasks = state.currentTasks;
      if (
        state.currentJob &&
        (state.currentJob._id === updatedTask.jobId || state.currentJob._id.toString() === updatedTask.jobId)
      ) {
        const index = nextTasks.findIndex(
          (t) => t._id === updatedTask.taskId || t._id.toString() === updatedTask.taskId
        );
        if (index >= 0) {
          nextTasks = [...nextTasks];
          nextTasks[index] = { ...nextTasks[index], ...updatedTask };
        }
      }
      return { currentTasks: nextTasks };
    });
  },
}));
