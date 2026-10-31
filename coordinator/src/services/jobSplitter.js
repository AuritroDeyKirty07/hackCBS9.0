import { Task } from '../models/Task.js';
import { TASK_TYPES, TASK_STATUS, LIMITS } from 'meshcompute-shared/constants.js';

/**
 * Generates a deterministic 32-bit unsigned integer seed from jobId and index.
 */
export function generateDeterministicSeed(jobId, index) {
  const str = `${jobId.toString()}-${index}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Splits a Job into Task records.
 * @param {Object} job - Mongoose Job document
 * @returns {Promise<Array>} Array of created Task documents
 */
export async function splitJobIntoTasks(job) {
  const taskDocs = [];

  if (job.type === TASK_TYPES.IMAGE_BATCH_PROCESS) {
    const totalImages = parseInt(job.params.totalImages, 10) || 24;
    const chunkSize = Math.max(1, parseInt(job.params.chunkSize, 10) || 2);
    const filterType = job.params.filterType || 'EDGE_SOBEL';

    let currentIndex = 0;
    let taskIndex = 0;

    while (currentIndex < totalImages) {
      const count = Math.min(chunkSize, totalImages - currentIndex);

      taskDocs.push({
        job: job._id,
        index: taskIndex,
        type: TASK_TYPES.IMAGE_BATCH_PROCESS,
        params: {
          startIndex: currentIndex,
          count,
          filterType,
          width: 160,
          height: 120,
        },
        status: TASK_STATUS.PENDING,
        attempt: 1,
        maxAttempts: LIMITS.MAX_ATTEMPTS,
        history: [],
      });

      currentIndex += count;
      taskIndex++;
    }
  } else {
    // MONTE_CARLO_PI
    const { totalSamples, chunkSize } = job.params;
    const chunk = Math.min(
      Math.max(chunkSize || LIMITS.DEFAULT_CHUNK_SIZE, LIMITS.MIN_CHUNK_SIZE),
      LIMITS.MAX_CHUNK_SIZE
    );

    let remaining = totalSamples;
    let taskIndex = 0;

    while (remaining > 0) {
      const samples = Math.min(remaining, chunk);
      const seed = generateDeterministicSeed(job._id, taskIndex);

      taskDocs.push({
        job: job._id,
        index: taskIndex,
        type: TASK_TYPES.MONTE_CARLO_PI,
        params: {
          samples,
          seed,
        },
        status: TASK_STATUS.PENDING,
        attempt: 1,
        maxAttempts: LIMITS.MAX_ATTEMPTS,
        history: [],
      });

      remaining -= samples;
      taskIndex++;
    }
  }

  const createdTasks = await Task.insertMany(taskDocs);
  job.totalTasks = createdTasks.length;
  await job.save();

  return createdTasks;
}
