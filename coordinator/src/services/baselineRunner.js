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
 * Executes on a single core sequentially without cluster parallelization.
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
    const width = parseInt(job.params?.width, 10) || 240;
    const height = parseInt(job.params?.height, 10) || 180;

    // For larger workloads, benchmark a representative sample on single core to avoid event-loop blocking
    const sampleCount = Math.min(totalImages, 20);
    const sampleStart = Date.now();

    runImageBatchProcess({
      startIndex: 0,
      count: sampleCount,
      filterType,
      width,
      height,
    });

    const sampleElapsedMs = Date.now() - sampleStart;
    const durationMs = sampleCount === totalImages
      ? sampleElapsedMs
      : Math.round((sampleElapsedMs / sampleCount) * totalImages);

    job.baseline = {
      durationMs,
      processedCount: totalImages,
    };
    await job.save();

    return { durationMs, processedCount: totalImages };
  } else {
    // MONTE_CARLO_PI
    const totalSamples = job.params?.totalSamples || 100_000_000;
    const sampleSize = Math.min(totalSamples, 20_000_000);
    const rng = mulberry32(123456789);
    let inside = 0;

    const sampleStart = Date.now();
    for (let i = 0; i < sampleSize; i++) {
      const x = rng();
      const y = rng();
      if (x * x + y * y <= 1) {
        inside++;
      }
    }
    const sampleElapsedMs = Date.now() - sampleStart;
    const durationMs = sampleSize === totalSamples
      ? sampleElapsedMs
      : Math.round((sampleElapsedMs / sampleSize) * totalSamples);

    const piEstimate = (4 * inside) / sampleSize;

    job.baseline = {
      durationMs,
      piEstimate,
    };
    await job.save();

    return { durationMs, piEstimate };
  }
}
