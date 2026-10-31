import { io } from 'socket.io-client';

const COORDINATOR_URL = import.meta.env.VITE_COORDINATOR_URL || 'http://localhost:4000';

let dashboardSocket = null;

export function getDashboardSocket() {
  if (!dashboardSocket) {
    const token = localStorage.getItem('token');
    dashboardSocket = io(`${COORDINATOR_URL}/dashboard`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return dashboardSocket;
}
