import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import workerRoutes from './routes/workers.js';
import jobsRoutes from './routes/jobs.js';
import { errorHandler } from './middleware/error.js';
import { setupWorkerNamespace } from './sockets/workerNamespace.js';
import { setupDashboardNamespace } from './sockets/dashboardNamespace.js';
import { startHeartbeatMonitor } from './services/heartbeatMonitor.js';

const app = express();
const server = http.createServer(app);

// CORS configuration for REST & Sockets
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or workers)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for hackathon local network
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.set('io', io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/jobs', jobsRoutes);

// Error middleware
app.use(errorHandler);

// Setup Socket namespaces
setupWorkerNamespace(io);
setupDashboardNamespace(io);

// Start Heartbeat monitor
let heartbeatInterval = null;

// Connect to MongoDB and start listening
async function bootstrap() {
  try {
    console.log(`[Coordinator] Connecting to MongoDB: ${config.mongoUri}`);
    await mongoose.connect(config.mongoUri);
    console.log('[Coordinator] Connected to MongoDB successfully.');

    heartbeatInterval = startHeartbeatMonitor(io, config);

    server.listen(config.port, () => {
      console.log(`=================================================`);
      console.log(`  MeshCompute Coordinator running on port ${config.port}`);
      console.log(`  Worker WS:    ws://localhost:${config.port}/workers`);
      console.log(`  Dashboard WS: ws://localhost:${config.port}/dashboard`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error('[Coordinator] Startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Coordinator] Gracefully shutting down...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  await mongoose.disconnect();
  server.close(() => {
    console.log('[Coordinator] Server stopped.');
    process.exit(0);
  });
});

bootstrap();

export { app, server, io };

