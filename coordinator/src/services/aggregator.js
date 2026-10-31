import { Job } from '../models/Job.js';
import { Task } from '../models/Task.js';
import { JOB_STATUS, TASK_STATUS, DASH_EVENTS } from 'meshcompute-shared/constants.js';

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

  let totalInside = 0;
  let totalCount = 0;

  for (const t of completedTasks) {
    if (t.result && typeof t.result.inside === 'number' && typeof t.result.total === 'number') {
      totalInside += t.result.inside;
      totalCount += t.result.total;
    }
  }

  job.completedTasks = completedTasks.length;
  job.result.insideCount = totalInside;
  job.result.totalCount = totalCount;

  if (totalCount > 0) {
    job.result.piEstimate = (4 * totalInside) / totalCount;
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
      partialPi: job.result.piEstimate,
      durationMs: job.timing.durationMs,
      result: job.result,
    });
  }

  return job;
}
