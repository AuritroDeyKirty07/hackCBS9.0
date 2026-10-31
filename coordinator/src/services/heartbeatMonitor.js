import { Worker } from '../models/Worker.js';
import { Task } from '../models/Task.js';
import { Job } from '../models/Job.js';
import {
  WORKER_STATUS,
  TASK_STATUS,
  JOB_STATUS,
  DASH_EVENTS,
} from 'meshcompute-shared/constants.js';
import { runScheduler } from './scheduler.js';

/**
 * Requeues tasks currently assigned to a worker that went offline or disconnected.
 * @param {Object} worker - Mongoose Worker document
 * @param {string} reason - 'worker_timeout' | 'socket_disconnect'
 * @param {Object} io - Socket.io instance
 */
export async function requeueWorkerTasks(worker, reason, io) {
  const activeTasks = await Task.find({
    assignedWorkerId: worker.workerId,
    status: { $in: [TASK_STATUS.ASSIGNED, TASK_STATUS.RUNNING] },
  });

  if (activeTasks.length === 0) return;

  console.log(`[HeartbeatMonitor] Requeuing ${activeTasks.length} task(s) from worker ${worker.workerId} (${reason})`);

  let shouldReschedule = false;

  for (const task of activeTasks) {
    if (task.attempt >= task.maxAttempts) {
      task.status = TASK_STATUS.FAILED;
      task.history.push({
        workerId: worker.workerId,
        attempt: task.attempt,
        outcome: `${reason}_max_attempts_exceeded`,
        at: new Date(),
      });
      await task.save();

      // Mark the parent job as failed
      await Job.findByIdAndUpdate(task.job, {
        status: JOB_STATUS.FAILED,
        'result.error': `Task #${task.index} failed after ${task.attempt} attempts (${reason})`,
        'timing.finishedAt': new Date(),
      });

      io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
        jobId: task.job.toString(),
        status: JOB_STATUS.FAILED,
        error: `Task #${task.index} failed after ${task.attempt} attempts`,
      });
    } else {
      task.history.push({
        workerId: worker.workerId,
        attempt: task.attempt,
        outcome: reason,
        at: new Date(),
      });
      task.status = TASK_STATUS.PENDING;
      task.attempt += 1;
      task.assignedTo = null;
      task.assignedWorkerId = null;
      task.assignedAt = null;
      await task.save();
      shouldReschedule = true;
    }

    io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
      taskId: task._id.toString(),
      jobId: task.job.toString(),
      index: task.index,
      status: task.status,
      workerId: null,
      attempt: task.attempt,
    });
  }

  // Reset worker active tasks
  worker.activeTasks = 0;
  await worker.save();

  if (shouldReschedule) {
    runScheduler(io);
  }
}

/**
 * Starts the periodic heartbeat monitor loop.
 * @param {Object} io - Socket.io instance
 * @param {Object} config - Environment config
 * @returns {NodeJS.Timeout}
 */
export function startHeartbeatMonitor(io, config) {
  const intervalMs = config.heartbeatIntervalMs || 3000;
  const timeoutMs = config.heartbeatTimeoutMs || 10000;
  const taskTimeoutMs = config.taskTimeoutMs || 60000;

  const timer = setInterval(async () => {
    try {
      const now = Date.now();
      const cutoff = new Date(now - timeoutMs);

      // 1. Detect workers with timed-out heartbeats
      const timedOutWorkers = await Worker.find({
        status: { $ne: WORKER_STATUS.OFFLINE },
        lastHeartbeatAt: { $lt: cutoff },
      });

      for (const worker of timedOutWorkers) {
        console.warn(`[HeartbeatMonitor] Worker ${worker.workerId} (${worker.name}) timed out. Marking offline.`);
        worker.status = WORKER_STATUS.OFFLINE;
        worker.socketId = null;
        await worker.save();

        io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
          workerId: worker.workerId,
          status: WORKER_STATUS.OFFLINE,
          activeTasks: 0,
        });

        await requeueWorkerTasks(worker, 'worker_timeout', io);
      }

      // 2. Check for hung/stuck tasks exceeding taskTimeoutMs
      const taskCutoff = new Date(now - taskTimeoutMs);
      const hungTasks = await Task.find({
        status: { $in: [TASK_STATUS.ASSIGNED, TASK_STATUS.RUNNING] },
        assignedAt: { $lt: taskCutoff },
      });

      for (const task of hungTasks) {
        console.warn(`[HeartbeatMonitor] Task #${task.index} (id: ${task._id}) timed out after ${taskTimeoutMs}ms`);
        if (task.attempt >= task.maxAttempts) {
          task.status = TASK_STATUS.FAILED;
          task.history.push({
            workerId: task.assignedWorkerId,
            attempt: task.attempt,
            outcome: 'task_execution_timeout_max_attempts',
            at: new Date(),
          });
          await task.save();
        } else {
          task.history.push({
            workerId: task.assignedWorkerId,
            attempt: task.attempt,
            outcome: 'task_execution_timeout',
            at: new Date(),
          });
          task.status = TASK_STATUS.PENDING;
          task.attempt += 1;
          task.assignedTo = null;
          task.assignedWorkerId = null;
          await task.save();
          runScheduler(io);
        }
      }
    } catch (err) {
      console.error('[HeartbeatMonitor] Error in check interval:', err);
    }
  }, intervalMs);

  return timer;
}

