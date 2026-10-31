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

  if (job.type === TASK_TYPES.IMAGE_BATCH_PROCESS) {
    const allImages = [];
    let totalPixels = 0;
    let processedImagesCount = 0;

    for (const t of completedTasks) {
      if (t.result?.images) {
        allImages.push(...t.result.images);
      }
      totalPixels += t.result?.totalPixels || 0;
      processedImagesCount += t.result?.processedCount || 0;
    }

    job.result = {
      ...(job.result || {}),
      images: allImages.sort((a, b) => a.imageIndex - b.imageIndex),
      totalPixels,
      processedImagesCount,
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
