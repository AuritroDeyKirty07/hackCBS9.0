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
    const matrixSize = parseInt(job.params?.matrixSize, 10) || 1000;
    let completedRows = 0;
    let totalFlops = 0;
    let totalSumOfSquares = 0.0;
    const previewGrid = Array.from({ length: 5 }, () => Array(5).fill(0));

    for (const t of completedTasks) {
      completedRows += t.result?.rowCount || 0;
      totalFlops += t.result?.flops || 0;
      totalSumOfSquares += t.result?.sumOfSquares || 0.0;

      if (Array.isArray(t.result?.sampleValues)) {
        for (const item of t.result.sampleValues) {
          if (item.row < 5 && item.col < 5) {
            previewGrid[item.row][item.col] = item.val;
          }
        }
      }
    }

    const durationMs = job.timing?.durationMs || (job.timing?.startedAt ? Date.now() - new Date(job.timing.startedAt).getTime() : 1);
    const gflops = totalFlops > 0 && durationMs > 0 ? parseFloat((totalFlops / (durationMs * 1e6)).toFixed(2)) : 0;
    const frobeniusNorm = Math.sqrt(Math.max(0, totalSumOfSquares)).toFixed(3);

    job.result = {
      ...(job.result || {}),
      matrixSize,
      completedRows,
      totalFlops,
      gflops,
      frobeniusNorm,
      previewGrid,
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
