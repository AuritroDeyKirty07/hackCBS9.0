/**
 * 32-bit Mulberry32 seeded pseudo-random number generator.
 * Fast, deterministic, and uniform.
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} Float in [0, 1)
 */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Executes a Monte Carlo Pi estimation batch.
 * @param {Object} params
 * @param {number} params.samples - Number of sample points
 * @param {number} params.seed - Deterministic seed
 * @returns {{ inside: number, total: number }}
 */
export function runMonteCarloPi({ samples, seed }) {
  const rng = mulberry32(seed);
  let inside = 0;

  for (let i = 0; i < samples; i++) {
    const x = rng();
    const y = rng();
    if (x * x + y * y <= 1) {
      inside++;
    }
  }

  return {
    inside,
    total: samples,
  };
}
