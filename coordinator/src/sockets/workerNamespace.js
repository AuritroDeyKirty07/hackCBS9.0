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

        // Remove any offline/stale duplicate records for this worker name
        await Worker.deleteMany({
          name: workerName,
          workerId: { $ne: workerId },
          status: WORKER_STATUS.OFFLINE,
        });

        // Upsert worker record in DB by workerId so machine name changes update in-place
        const worker = await Worker.findOneAndUpdate(
          { workerId },
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
        if (!task) return;

        // Never trust the task's stored display name as proof of who sent the event.
        if (!currentWorkerId || task.assignedWorkerId !== currentWorkerId) {
          console.warn(
            `[WorkerNamespace] Rejecting TASK_STARTED for task #${task.index}: socket worker ${currentWorkerId || 'unknown'} is not the assigned worker ${task.assignedWorkerId || 'none'}`
          );
          return;
        }

        if (task.attempt !== attempt || task.status !== TASK_STATUS.ASSIGNED) return;

        const worker = await Worker.findOne({ workerId: currentWorkerId });
        if (!worker) return;

        task.status = TASK_STATUS.RUNNING;
        task.startedAt = new Date();
        // Refresh the human-readable name from the authenticated socket's worker record.
        task.assignedWorkerName = worker.name;
        await task.save();

        io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
          taskId: task._id.toString(),
          jobId: task.job.toString(),
          index: task.index,
          status: task.status,
          workerId: currentWorkerId,
          workerName: worker.name,
          assignedWorkerName: worker.name,
          attempt: task.attempt,
          startedAt: task.startedAt,
        });
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

        // Ignore duplicate, late or stale results. A result is only valid from
        // the worker currently assigned to this exact attempt.
        if (task.status === TASK_STATUS.COMPLETED) {
          console.log(`[WorkerNamespace] Task #${task.index} already completed; duplicate result ignored.`);
          return;
        }
        if (task.attempt !== attempt) {
          console.log(
            `[WorkerNamespace] Stale result ignored for task #${task.index}: received attempt ${attempt}, current attempt ${task.attempt}`
          );
          return;
        }
        if (
          !currentWorkerId ||
          task.assignedWorkerId !== currentWorkerId ||
          ![TASK_STATUS.ASSIGNED, TASK_STATUS.RUNNING].includes(task.status)
        ) {
          console.warn(
            `[WorkerNamespace] Rejecting result for task #${task.index}: sender=${currentWorkerId || 'unknown'}, assigned=${task.assignedWorkerId || 'none'}, status=${task.status}`
          );
          return;
        }

        const executor = await Worker.findOne({ workerId: currentWorkerId });
        if (!executor) {
          console.warn(`[WorkerNamespace] Result sender ${currentWorkerId} has no registered worker record.`);
          return;
        }

        const computeMs = Number.isFinite(result?.computeMs) ? result.computeMs : 0;
        let isValid = true;
        let validationError = null;

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
            validationError = 'Invalid Monte Carlo result payload';
          }
        } else if (task.type === 'MATRIX_MULTIPLY') {
          const expectedRows = task.params.rowCount;
          const expectedStart = task.params.startRow;
          if (
            !result ||
            !Number.isFinite(result.flops) ||
            result.rowCount !== expectedRows ||
            result.startRow !== expectedStart ||
            !Array.isArray(result.computedRows) ||
            result.computedRows.length !== expectedRows
          ) {
            isValid = false;
            validationError = 'Invalid matrix multiplication result payload';
          }
        }

        if (!isValid) {
          console.error(`[WorkerNamespace] ${validationError} for task ${taskId}`);
          task.history.push({
            workerId: executor.workerId,
            workerName: executor.name,
            attempt,
            outcome: 'invalid_result',
            at: new Date(),
            startedAt: task.startedAt,
            completedAt: new Date(),
            computeMs,
          });

          const failedAt = new Date();
          if (task.attempt >= task.maxAttempts) {
            task.status = TASK_STATUS.FAILED;
            await task.save();
            await Job.findByIdAndUpdate(task.job, {
              status: JOB_STATUS.FAILED,
              'result.error': `Task #${task.index} returned invalid results after ${task.attempt} attempts`,
              'timing.finishedAt': failedAt,
            });
            io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
              jobId: task.job.toString(),
              status: JOB_STATUS.FAILED,
              error: `Task #${task.index} returned invalid results after ${task.attempt} attempts`,
            });
          } else {
            task.status = TASK_STATUS.PENDING;
            task.attempt += 1;
            task.assignedTo = null;
            task.assignedWorkerId = null;
            task.assignedWorkerName = null;
            task.assignedAt = null;
            task.startedAt = null;
            await task.save();
          }

          executor.activeTasks = Math.max(0, (executor.activeTasks || 0) - 1);
          await executor.save();
          io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
            taskId: task._id.toString(),
            jobId: task.job.toString(),
            index: task.index,
            status: task.status,
            workerId: task.status === TASK_STATUS.PENDING ? null : executor.workerId,
            workerName: task.status === TASK_STATUS.PENDING ? null : executor.name,
            assignedWorkerName: task.status === TASK_STATUS.PENDING ? null : executor.name,
            attempt: task.attempt,
          });
          if (task.status === TASK_STATUS.PENDING) runScheduler(io);
          return;
        }

        // Persist the actual sender, not merely the worker name copied at assignment time.
        const completedAt = new Date();
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = completedAt;
        task.completedByWorkerId = executor.workerId;
        task.completedByWorkerName = executor.name;
        task.assignedWorkerId = executor.workerId;
        task.assignedWorkerName = executor.name;
        task.result = { ...result, computeMs };
        task.history.push({
          workerId: executor.workerId,
          workerName: executor.name,
          attempt,
          outcome: 'success',
          at: completedAt,
          startedAt: task.startedAt,
          completedAt,
          computeMs,
        });
        await task.save();

        executor.activeTasks = Math.max(0, (executor.activeTasks || 0) - 1);
        executor.stats.tasksCompleted = (executor.stats.tasksCompleted || 0) + 1;
        executor.stats.totalComputeMs = (executor.stats.totalComputeMs || 0) + computeMs;
        await executor.save();

        io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
          workerId: executor.workerId,
          name: executor.name,
          status: executor.status,
          activeTasks: executor.activeTasks,
          stats: executor.stats,
        });

        io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
          taskId: task._id.toString(),
          jobId: task.job.toString(),
          index: task.index,
          status: task.status,
          workerId: executor.workerId,
          workerName: executor.name,
          assignedWorkerName: executor.name,
          completedByWorkerId: executor.workerId,
          completedByWorkerName: executor.name,
          attempt: task.attempt,
          result: task.result,
          history: task.history,
        });

        try {
          await updateJobAggregation(jobId || task.job.toString(), io);
        } catch (aggErr) {
          console.error('[WorkerNamespace] Aggregation error:', aggErr);
        }

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
        if (task.attempt !== attempt || task.assignedWorkerId !== currentWorkerId) return;

        const executor = await Worker.findOne({ workerId: currentWorkerId });
        const failedAt = new Date();
        task.history.push({
          workerId: executor?.workerId || currentWorkerId,
          workerName: executor?.name || task.assignedWorkerName,
          attempt,
          outcome: `worker_error: ${message}`,
          at: failedAt,
          startedAt: task.startedAt,
          completedAt: failedAt,
        });

        if (task.attempt >= task.maxAttempts) {
          task.status = TASK_STATUS.FAILED;
          await task.save();
          await Job.findByIdAndUpdate(task.job, {
            status: JOB_STATUS.FAILED,
            'result.error': `Task #${task.index} failed after ${task.attempt} attempts: ${message}`,
            'timing.finishedAt': failedAt,
          });
          io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
            jobId: task.job.toString(),
            status: JOB_STATUS.FAILED,
            error: `Task #${task.index} failed after ${task.attempt} attempts`,
          });
        } else {
          task.status = TASK_STATUS.PENDING;
          task.attempt += 1;
          task.assignedTo = null;
          task.assignedWorkerId = null;
          task.assignedWorkerName = null;
          task.assignedAt = null;
          task.startedAt = null;
          await task.save();
        }

        if (executor) {
          executor.activeTasks = Math.max(0, (executor.activeTasks || 0) - 1);
          await executor.save();
        }

        io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
          taskId: task._id.toString(),
          jobId: task.job.toString(),
          index: task.index,
          status: task.status,
          workerId: task.status === TASK_STATUS.PENDING ? null : currentWorkerId,
          workerName: task.status === TASK_STATUS.PENDING ? null : executor?.name,
          assignedWorkerName: task.status === TASK_STATUS.PENDING ? null : executor?.name,
          attempt: task.attempt,
        });

        if (task.status === TASK_STATUS.PENDING) runScheduler(io);
      } catch (err) {
        console.error('[WorkerNamespace] Task error handler failed:', err);
      }
    });

    // 6. Socket Disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`[WorkerNamespace] Socket disconnected (${socket.id}): ${reason}`);
      if (currentWorkerId) {
        const worker = await Worker.findOne({ workerId: currentWorkerId });
        // Only mark offline if this disconnected socket is still the active socket (prevents race condition on fast reconnect)
        if (worker && (!worker.socketId || worker.socketId === socket.id)) {
          worker.status = WORKER_STATUS.OFFLINE;
          worker.socketId = null;
          worker.activeTasks = 0;
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

