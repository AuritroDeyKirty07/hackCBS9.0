import { Worker } from '../models/Worker.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import {
  WS_EVENTS,
  DASH_EVENTS,
  WORKER_STATUS,
  TASK_STATUS,
} from 'meshcompute-shared/constants.js';
import { runScheduler } from '../services/scheduler.js';
import { updateJobAggregation } from '../services/aggregator.js';
import { requeueWorkerTasks } from '../services/heartbeatMonitor.js';

export function setupWorkerNamespace(io) {
  const workersNsp = io.of('/workers');

  // Authentication middleware for worker connections
  workersNsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-worker-token'];
      if (!token) {
        return next(new Error('Authentication failed: missing workerToken'));
      }

      // Check if user exists with this workerToken
      const user = await User.findOne({ workerToken: token });
      if (user) {
        socket.userId = user._id;
      } else if (token === 'demo-token' || token === 'meshcompute-dev-token') {
        // Allow demo/dev tokens during testing
        socket.userId = null;
      } else {
        return next(new Error('Authentication failed: invalid workerToken'));
      }

      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  workersNsp.on('connection', (socket) => {
    let currentWorkerId = null;

    // 1. Worker Registration
    socket.on(WS_EVENTS.WORKER_REGISTER, async (data) => {
      try {
        const {
          workerId,
          name,
          platform,
          cpuCores,
          totalRamMB,
          maxConcurrentTasks,
        } = data;

        if (!workerId) {
          return socket.emit('error', { message: 'workerId is required' });
        }

        currentWorkerId = workerId;

        const workerName = name || `worker-${workerId.slice(0, 4)}`;

        // Remove any old duplicate records for this worker name
        await Worker.deleteMany({
          name: workerName,
          workerId: { $ne: workerId },
        });

        // Upsert worker record in DB by unique name
        const worker = await Worker.findOneAndUpdate(
          { name: workerName },
          {
            workerId,
            owner: socket.userId || null,
            name: workerName,
            platform: platform || 'unknown',
            cpuCores: cpuCores || 1,
            totalRamMB: totalRamMB || 1024,
            maxConcurrentTasks: maxConcurrentTasks || 4,
            status: WORKER_STATUS.ONLINE,
            socketId: socket.id,
            lastHeartbeatAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`[WorkerNamespace] Worker registered: ${worker.name} (${worker.workerId})`);

        socket.emit(WS_EVENTS.WORKER_REGISTERED, {
          ok: true,
          workerId: worker.workerId,
          heartbeatIntervalMs: 3000,
        });

        // Broadcast to dashboard
        io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
          workerId: worker.workerId,
          name: worker.name,
          platform: worker.platform,
          cpuCores: worker.cpuCores,
          totalRamMB: worker.totalRamMB,
          status: worker.status,
          activeTasks: worker.activeTasks || 0,
          lastCpuLoad: worker.lastCpuLoad || 0,
          lastFreeRamMB: worker.lastFreeRamMB || 0,
          stats: worker.stats,
        });

        // Worker just joined: trigger scheduler in case pending tasks exist
        runScheduler(io);
      } catch (err) {
        console.error('[WorkerNamespace] Registration error:', err);
      }
    });

    // 2. Worker Heartbeat
    socket.on(WS_EVENTS.WORKER_HEARTBEAT, async (data) => {
      try {
        const { workerId, cpuLoad, freeRamMB, activeTasks } = data;
        if (!workerId) return;

        const worker = await Worker.findOneAndUpdate(
          { workerId },
          {
            lastHeartbeatAt: new Date(),
            lastCpuLoad: typeof cpuLoad === 'number' ? Math.round(cpuLoad) : 0,
            lastFreeRamMB: typeof freeRamMB === 'number' ? Math.round(freeRamMB) : 0,
            activeTasks: typeof activeTasks === 'number' ? activeTasks : 0,
            status: WORKER_STATUS.ONLINE,
            socketId: socket.id,
          },
          { new: true }
        );

        if (worker) {
          io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
            workerId: worker.workerId,
            status: worker.status,
            activeTasks: worker.activeTasks,
            lastCpuLoad: worker.lastCpuLoad,
            lastFreeRamMB: worker.lastFreeRamMB,
          });
        }
      } catch (err) {
        console.error('[WorkerNamespace] Heartbeat error:', err);
      }
    });

    // 3. Task Started
    socket.on(WS_EVENTS.TASK_STARTED, async (data) => {
      try {
        const { taskId, attempt } = data;
        const task = await Task.findById(taskId);
        if (task && task.attempt === attempt && task.status === TASK_STATUS.ASSIGNED) {
          task.status = TASK_STATUS.RUNNING;
          await task.save();

          io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
            taskId: task._id.toString(),
            jobId: task.job.toString(),
            index: task.index,
            status: task.status,
            workerId: task.assignedWorkerId,
            attempt: task.attempt,
          });
        }
      } catch (err) {
        console.error('[WorkerNamespace] Task started error:', err);
      }
    });

    // 4. Task Result
    socket.on(WS_EVENTS.TASK_RESULT, async (data) => {
      try {
        const { taskId, jobId, attempt, result } = data;
        const task = await Task.findById(taskId);

        if (!task) {
          console.warn(`[WorkerNamespace] Result for unknown task: ${taskId}`);
          return;
        }

        // DUPLICATE / LATE RESULT PROTECTION
        if (task.status === TASK_STATUS.COMPLETED) {
          console.log(`[WorkerNamespace] Task #${task.index} is already completed. Discarding duplicate result.`);
          return;
        }

        if (task.attempt !== attempt) {
          console.log(
            `[WorkerNamespace] Discarding stale attempt result for task #${task.index} (received attempt ${attempt}, current is ${task.attempt})`
          );
          return;
        }

        // VALIDATION
        const computeMs = result?.computeMs || 0;
        let isValid = true;

        if (task.type === 'MONTE_CARLO_PI') {
          const { inside, total } = result || {};
          if (
            typeof inside !== 'number' ||
            typeof total !== 'number' ||
            inside < 0 ||
            inside > total ||
            total !== task.params.samples
          ) {
            isValid = false;
          }
        } else if (task.type === 'IMAGE_BATCH_PROCESS') {
          if (!result || !Array.isArray(result.images) || result.processedCount !== task.params.count) {
            isValid = false;
          }
        }

        if (!isValid) {
          console.error(`[WorkerNamespace] Invalid result received for task ${taskId}`);
          task.status = TASK_STATUS.PENDING;
          task.attempt += 1;
          task.history.push({
            workerId: task.assignedWorkerId,
            attempt,
            outcome: 'invalid_result',
            at: new Date(),
          });
          await task.save();
          runScheduler(io);
          return;
        }

        // Mark task completed
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date();
        task.result = { ...result, computeMs };
        task.history.push({
          workerId: task.assignedWorkerId,
          attempt,
          outcome: 'success',
          at: new Date(),
        });
        await task.save();

        // Update worker stats
        if (task.assignedWorkerId) {
          const worker = await Worker.findOne({ workerId: task.assignedWorkerId });
          if (worker) {
            worker.activeTasks = Math.max(0, (worker.activeTasks || 1) - 1);
            worker.stats.tasksCompleted = (worker.stats.tasksCompleted || 0) + 1;
            worker.stats.totalComputeMs = (worker.stats.totalComputeMs || 0) + (computeMs || 0);
            await worker.save();

            io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
              workerId: worker.workerId,
              status: worker.status,
              activeTasks: worker.activeTasks,
              stats: worker.stats,
            });
          }
        }

        // Notify dashboard
        io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
          taskId: task._id.toString(),
          jobId: task.job.toString(),
          index: task.index,
          status: task.status,
          workerId: task.assignedWorkerId,
          attempt: task.attempt,
          result: task.result,
        });

        // Trigger job aggregation
        await updateJobAggregation(jobId, io);

        // More work might be waiting: trigger scheduler
        runScheduler(io);
      } catch (err) {
        console.error('[WorkerNamespace] Task result error:', err);
      }
    });

    // 5. Task Error
    socket.on(WS_EVENTS.TASK_ERROR, async (data) => {
      try {
        const { taskId, attempt, message } = data;
        const task = await Task.findById(taskId);
        if (!task || task.status === TASK_STATUS.COMPLETED) return;

        if (task.attempt === attempt) {
          console.warn(`[WorkerNamespace] Task #${task.index} error from worker: ${message}`);
          if (task.attempt >= task.maxAttempts) {
            task.status = TASK_STATUS.FAILED;
            task.history.push({
              workerId: task.assignedWorkerId,
              attempt,
              outcome: `worker_error: ${message}`,
              at: new Date(),
            });
            await task.save();
          } else {
            task.status = TASK_STATUS.PENDING;
            task.attempt += 1;
            task.history.push({
              workerId: task.assignedWorkerId,
              attempt,
              outcome: `worker_error: ${message}`,
              at: new Date(),
            });
            task.assignedTo = null;
            task.assignedWorkerId = null;
            await task.save();
          }

          // Decrement worker active tasks
          if (task.assignedWorkerId) {
            await Worker.findOneAndUpdate(
              { workerId: task.assignedWorkerId },
              { $inc: { activeTasks: -1 } }
            );
          }

          runScheduler(io);
        }
      } catch (err) {
        console.error('[WorkerNamespace] Task error handler failed:', err);
      }
    });

    // 6. Socket Disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`[WorkerNamespace] Socket disconnected (${socket.id}): ${reason}`);
      if (currentWorkerId) {
        const worker = await Worker.findOne({ workerId: currentWorkerId });
        if (worker) {
          worker.status = WORKER_STATUS.OFFLINE;
          worker.socketId = null;
          await worker.save();

          io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
            workerId: worker.workerId,
            status: WORKER_STATUS.OFFLINE,
            activeTasks: 0,
          });

          // Requeue all active tasks for this disconnected worker
          await requeueWorkerTasks(worker, 'socket_disconnect', io);
        }
      }
    });
  });
}

