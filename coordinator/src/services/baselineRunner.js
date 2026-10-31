import { Job } from '../models/Job.js';
import { TASK_TYPES } from 'meshcompute-shared/constants.js';
import { runImageBatchProcess } from '../../../worker-agent/src/tasks/imageBatchProcess.js';

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs single-machine baseline calculation for a job.
 * @param {string|mongoose.Types.ObjectId} jobId
 * @returns {Promise<Object>}
 */
export async function runBaseline(jobId) {
  const job = await Job.findById(jobId);
  if (!job) throw new Error('Job not found');

  const startTime = Date.now();

  if (job.type === TASK_TYPES.IMAGE_BATCH_PROCESS) {
    const totalImages = parseInt(job.params?.totalImages, 10) || 24;
    const filterType = job.params?.filterType || 'EDGE_SOBEL';

    // Run sequentially on single core
    runImageBatchProcess({
      startIndex: 0,
      count: totalImages,
      filterType,
      width: 160,
      height: 120,
    });

    const durationMs = Date.now() - startTime;
    job.baseline = {
      durationMs,
      processedCount: totalImages,
    };
    await job.save();

    return { durationMs, processedCount: totalImages };
  } else {
    // MONTE_CARLO_PI
    const totalSamples = job.params?.totalSamples || 100_000_000;
    const rng = mulberry32(123456789);
    let inside = 0;

    for (let i = 0; i < totalSamples; i++) {
      const x = rng();
      const y = rng();
      if (x * x + y * y <= 1) {
        inside++;
      }
    }

    const durationMs = Date.now() - startTime;
    const piEstimate = (4 * inside) / totalSamples;

    job.baseline = {
      durationMs,
      piEstimate,
    };
    await job.save();

    return { durationMs, piEstimate };
  }
}
