import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WS_EVENTS } from 'meshcompute-shared/constants.js';
import { getSystemInfo, getDynamicMetrics } from './sysinfo.js';
import { executeTask } from './taskRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COORDINATOR_URL = process.env.COORDINATOR_URL || 'http://localhost:4000';
const WORKER_TOKEN = process.env.WORKER_TOKEN || 'meshcompute-dev-token';
const WORKER_NAME = process.env.WORKER_NAME || `worker-${Math.floor(Math.random() * 900 + 100)}`;
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS || '4', 10);

// Persist workerId across restarts
const idFilePath = path.resolve(process.cwd(), `.worker-id-${WORKER_NAME}`);
let workerId;

try {
  if (fs.existsSync(idFilePath)) {
    workerId = fs.readFileSync(idFilePath, 'utf8').trim();
  }
  if (!workerId) {
    workerId = crypto.randomUUID();
    fs.writeFileSync(idFilePath, workerId, 'utf8');
  }
} catch (err) {
  workerId = crypto.randomUUID();
}

console.log(`=================================================`);
console.log(`  MeshCompute Worker Agent: ${WORKER_NAME}`);
console.log(`  Worker ID: ${workerId}`);
console.log(`  Connecting to: ${COORDINATOR_URL}/workers`);
console.log(`=================================================`);

const sysInfo = getSystemInfo();
let activeTasks = 0;
let heartbeatInterval = null;

const socket = io(`${COORDINATOR_URL}/workers`, {
  auth: { token: WORKER_TOKEN },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on('connect', () => {
  console.log(`[Worker] Connected to coordinator with socket id: ${socket.id}`);

  // 1. Register with coordinator
  socket.emit(WS_EVENTS.WORKER_REGISTER, {
    workerId,
    name: WORKER_NAME,
    platform: sysInfo.platform,
    cpuCores: sysInfo.cpuCores,
    totalRamMB: sysInfo.totalRamMB,
    maxConcurrentTasks: MAX_CONCURRENT_TASKS,
  });

  // 2. Start heartbeat loop
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const dynamic = getDynamicMetrics();
    socket.emit(WS_EVENTS.WORKER_HEARTBEAT, {
      workerId,
      cpuLoad: dynamic.cpuLoad,
      freeRamMB: dynamic.freeRamMB,
      activeTasks,
      ts: Date.now(),
    });
  }, 3000);
});

socket.on(WS_EVENTS.WORKER_REGISTERED, (data) => {
  console.log(`[Worker] Registration confirmed by coordinator:`, data);
});

// Handle assigned computational task
socket.on(WS_EVENTS.TASK_ASSIGN, async (taskData) => {
  const { taskId, jobId, index, attempt, type, params } = taskData;
  activeTasks++;
  console.log(`[Worker] Received task #${index} (job: ${jobId}, attempt: ${attempt})`);

  // Notify coordinator that task has started
  socket.emit(WS_EVENTS.TASK_STARTED, { taskId, attempt });

  try {
    const result = await executeTask({ taskId, type, params });
    console.log(`[Worker] Completed task #${index} in ${result.computeMs}ms (${result.inside}/${result.total} inside circle)`);

    socket.emit(WS_EVENTS.TASK_RESULT, {
      taskId,
      jobId,
      attempt,
      result,
    });
  } catch (err) {
    console.error(`[Worker] Error executing task #${index}:`, err.message);
    socket.emit(WS_EVENTS.TASK_ERROR, {
      taskId,
      attempt,
      message: err.message,
    });
  } finally {
    activeTasks = Math.max(0, activeTasks - 1);
  }
});

socket.on('disconnect', (reason) => {
  console.warn(`[Worker] Disconnected from coordinator: ${reason}`);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
});

socket.on('connect_error', (err) => {
  console.error(`[Worker] Connection error: ${err.message}`);
});

process.on('SIGINT', () => {
  console.log('\n[Worker] Shutting down agent...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  socket.disconnect();
  process.exit(0);
});
