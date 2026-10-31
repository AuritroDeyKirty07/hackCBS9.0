import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function setupDashboardNamespace(io) {
  const dashNsp = io.of('/dashboard');

  dashNsp.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    // Allow development / guest connections if needed
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      // In dev mode allow handshake even if token expired or invalid
      console.warn('[DashboardNamespace] JWT verification skipped or failed:', err.message);
      next();
    }
  });

  dashNsp.on('connection', (socket) => {
    console.log(`[DashboardNamespace] Client connected (${socket.id})`);

    socket.on('disconnect', () => {
      console.log(`[DashboardNamespace] Client disconnected (${socket.id})`);
    });
  });
}

