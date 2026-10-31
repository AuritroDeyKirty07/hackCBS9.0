import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import os from 'os';
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

// Deterministic workerId based on WORKER_NAME (survives restarts in any directory)
const sanitizedName = WORKER_NAME.replace(/[^a-zA-Z0-9_-]/g, '_');
const idFilePath = path.resolve(os.homedir(), `.meshcompute-worker-${sanitizedName}.id`);
let workerId;

try {
  if (fs.existsSync(idFilePath)) {
    workerId = fs.readFileSync(idFilePath, 'utf8').trim();
  }
} catch (e) {}

if (!workerId) {
  const hash = crypto.createHash('sha256').update(`meshcompute-${WORKER_NAME}-${os.hostname()}`).digest('hex');
  workerId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  try {
    fs.writeFileSync(idFilePath, workerId, 'utf8');
  } catch (e) {}
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

  socket.emit(WS_EVENTS.WORKER_REGISTER, {
    workerId,
    name: WORKER_NAME,
    platform: sysInfo.platform,
    cpuCores: sysInfo.cpuCores,
    totalRamMB: sysInfo.totalRamMB,
    maxConcurrentTasks: MAX_CONCURRENT_TASKS,
  });

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

socket.on(WS_EVENTS.TASK_ASSIGN, async (taskData) => {
  const { taskId, jobId, index, attempt, type, params } = taskData;
  activeTasks++;
  console.log(`[Worker] Received task #${index} (job: ${jobId}, attempt: ${attempt})`);

  socket.emit(WS_EVENTS.TASK_STARTED, { taskId, attempt });

  try {
    const result = await executeTask({ taskId, type, params });
    if (type === 'IMAGE_BATCH_PROCESS') {
      console.log(`[Worker] Completed task #${index} in ${result.computeMs}ms (${result.processedCount} images rendered & filtered)`);
    } else {
      console.log(`[Worker] Completed task #${index} in ${result.computeMs}ms (${result.inside}/${result.total} inside circle)`);
    }

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
