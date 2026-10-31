import { Task } from '../models/Task.js';
import { Worker } from '../models/Worker.js';
import { Job } from '../models/Job.js';
import {
  TASK_STATUS,
  WORKER_STATUS,
  JOB_STATUS,
  WS_EVENTS,
  DASH_EVENTS,
} from 'meshcompute-shared/constants.js';

let isScheduling = false;

/**
 * Pluggable Scheduler Strategy Interface
 */
export class RuleBasedSchedulerStrategy {
  /**
   * Sorts candidate workers based on available capacity and CPU load.
   */
  selectBestWorker(workerPool) {
    workerPool.sort((a, b) => {
      if (b.freeSlots !== a.freeSlots) {
        return b.freeSlots - a.freeSlots;
      }
      return a.lastCpuLoad - b.lastCpuLoad;
    });
    return workerPool[0] || null;
  }
}

// Active scheduler strategy instance
const currentStrategy = new RuleBasedSchedulerStrategy();

/**
 * Runs the scheduler to assign pending tasks to available workers.
 * @param {Object} io - Socket.io instance
 */
export async function runScheduler(io) {
  if (isScheduling) return;
  isScheduling = true;

  try {
    // 1. Find jobs that are running or pending
    const activeJobs = await Job.find({
      status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] },
    }).sort({ createdAt: 1 });

    if (activeJobs.length === 0) {
      return;
    }

    const activeJobIds = activeJobs.map((j) => j._id);

    // 2. Fetch pending tasks for these jobs
    const pendingTasks = await Task.find({
      job: { $in: activeJobIds },
      status: TASK_STATUS.PENDING,
    }).sort({ createdAt: 1, index: 1 });

    if (pendingTasks.length === 0) {
      return;
    }

    // 3. Find online workers
    const workers = await Worker.find({
      status: WORKER_STATUS.ONLINE,
      socketId: { $ne: null },
    });

    if (workers.length === 0) {
      return;
    }

    // Compute free slots for each worker
    const workerPool = workers
      .map((w) => {
        const freeSlots = Math.max(0, (w.maxConcurrentTasks || 4) - (w.activeTasks || 0));
        return {
          doc: w,
          freeSlots,
          lastCpuLoad: w.lastCpuLoad || 0,
        };
      })
      .filter((w) => w.freeSlots > 0);

    if (workerPool.length === 0) {
      return;
    }

    const workerSockets = io.of('/workers').sockets;

    // 4. Assign tasks
    for (const task of pendingTasks) {
      const selectedWorker = currentStrategy.selectBestWorker(workerPool);
      if (!selectedWorker || selectedWorker.freeSlots <= 0) {
        break;
      }

      const socket = workerSockets.get(selectedWorker.doc.socketId);
      if (!socket) {
        selectedWorker.freeSlots = 0;
        continue;
      }

      // Assign task to this worker
      task.status = TASK_STATUS.ASSIGNED;
      task.assignedTo = selectedWorker.doc._id;
      task.assignedWorkerId = selectedWorker.doc.workerId;
      task.assignedAt = new Date();
      await task.save();

      // Update worker activeTasks count
      selectedWorker.doc.activeTasks = (selectedWorker.doc.activeTasks || 0) + 1;
      await selectedWorker.doc.save();
      selectedWorker.freeSlots--;

      // If job was pending, mark as running and start timer
      const parentJob = activeJobs.find((j) => j._id.toString() === task.job.toString());
      if (parentJob && parentJob.status === JOB_STATUS.PENDING) {
        parentJob.status = JOB_STATUS.RUNNING;
        parentJob.timing.startedAt = new Date();
        await parentJob.save();

        io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
          jobId: parentJob._id.toString(),
          status: parentJob.status,
          timing: parentJob.timing,
        });
      }

      // Emit assignment to worker
      socket.emit(WS_EVENTS.TASK_ASSIGN, {
        taskId: task._id.toString(),
        jobId: task.job.toString(),
        index: task.index,
        attempt: task.attempt,
        type: task.type,
        params: task.params,
      });

      // Emit task update to dashboard
      io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
        taskId: task._id.toString(),
        jobId: task.job.toString(),
        index: task.index,
        status: task.status,
        workerId: selectedWorker.doc.workerId,
        attempt: task.attempt,
      });

      // Emit worker update to dashboard
      io.of('/dashboard').emit(DASH_EVENTS.WORKER_UPDATE, {
        workerId: selectedWorker.doc.workerId,
        status: selectedWorker.doc.status,
        activeTasks: selectedWorker.doc.activeTasks,
        lastCpuLoad: selectedWorker.doc.lastCpuLoad,
        lastFreeRamMB: selectedWorker.doc.lastFreeRamMB,
      });
    }
  } catch (err) {
    console.error('[Scheduler] Error during scheduling run:', err);
  } finally {
    isScheduling = false;
  }
}
