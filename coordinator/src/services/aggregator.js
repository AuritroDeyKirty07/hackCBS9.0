import { Job } from '../models/Job.js';
import { Task } from '../models/Task.js';
import { TASK_TYPES, JOB_STATUS, TASK_STATUS, DASH_EVENTS } from 'meshcompute-shared/constants.js';

/**
 * Updates partial and final aggregation for a job when a task finishes.
 * @param {string|mongoose.Types.ObjectId} jobId
 * @param {Object} io - Socket.io instance
 * @returns {Promise<Object>} Updated job
 */
export async function updateJobAggregation(jobId, io = null) {
  const job = await Job.findById(jobId);
  if (!job) return null;

  // Fetch all completed tasks for this job
  const completedTasks = await Task.find({
    job: jobId,
    status: TASK_STATUS.COMPLETED,
  });

  job.completedTasks = completedTasks.length;

  if (job.type === TASK_TYPES.MATRIX_MULTIPLY) {
    const matrixSize = parseInt(job.params?.matrixSize, 10) || 6;
    let completedRows = 0;
    const fullMatrix = Array.from({ length: matrixSize }, () => Array(matrixSize).fill(0));

    for (const t of completedTasks) {
      completedRows += t.result?.rowCount || 0;
      if (Array.isArray(t.result?.computedRows)) {
        for (const item of t.result.computedRows) {
          if (item.row < matrixSize && Array.isArray(item.values)) {
            fullMatrix[item.row] = item.values;
          }
        }
      }
    }

    job.result = {
      ...(job.result || {}),
      matrixSize,
      completedRows,
      fullMatrix,
    };
  } else {
    // MONTE_CARLO_PI
    let totalInside = 0;
    let totalCount = 0;

    for (const t of completedTasks) {
      if (t.result && typeof t.result.inside === 'number' && typeof t.result.total === 'number') {
        totalInside += t.result.inside;
        totalCount += t.result.total;
      }
    }

    job.result = {
      ...(job.result || {}),
      insideCount: totalInside,
      totalCount: totalCount,
      piEstimate: totalCount > 0 ? (4 * totalInside) / totalCount : null,
    };
  }

  // Check if job is fully completed
  if (job.completedTasks >= job.totalTasks && job.totalTasks > 0) {
    job.status = JOB_STATUS.COMPLETED;
    job.timing.finishedAt = new Date();
    if (job.timing.startedAt) {
      job.timing.durationMs = job.timing.finishedAt.getTime() - new Date(job.timing.startedAt).getTime();
    }
  }

  await job.save();

  // Emit dashboard update if socket is present
  if (io) {
    io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
      jobId: job._id.toString(),
      status: job.status,
      completedTasks: job.completedTasks,
      totalTasks: job.totalTasks,
      partialPi: job.result?.piEstimate,
      durationMs: job.timing.durationMs,
      result: job.result,
    });
  }

  return job;
}
