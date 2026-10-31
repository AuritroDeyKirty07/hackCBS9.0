import { create } from 'zustand';
import { api } from '../lib/api.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: true,

  fetchMe: async () => {
    const token = get().token;
    if (!token) {
      set({ user: null, isLoading: false });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.user, isLoading: false });
    } catch (err) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    set({ token, user });
    return user;
  },

  register: async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    set({ token, user });
    return user;
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
