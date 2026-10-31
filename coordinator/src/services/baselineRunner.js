import { Job } from '../models/Job.js';

/**
 * Seeded PRNG (mulberry32) for deterministic baseline comparison.
 */
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
 * Runs single-machine baseline Monte Carlo calculation for a job.
 * @param {string|mongoose.Types.ObjectId} jobId
 * @returns {Promise<Object>} { durationMs, piEstimate }
 */
export async function runBaseline(jobId) {
  const job = await Job.findById(jobId);
  if (!job) throw new Error('Job not found');

  const totalSamples = job.params.totalSamples;
  const startTime = Date.now();

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
