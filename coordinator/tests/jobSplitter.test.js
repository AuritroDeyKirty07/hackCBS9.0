import { describe, it, expect } from 'vitest';
import { generateDeterministicSeed } from '../src/services/jobSplitter.js';

describe('Job Splitter & Deterministic Seeds', () => {
  it('generates deterministic unsigned 32-bit seeds', () => {
    const seed1 = generateDeterministicSeed('job-123', 0);
    const seed2 = generateDeterministicSeed('job-123', 0);
    const seed3 = generateDeterministicSeed('job-123', 1);

    expect(seed1).toBe(seed2);
    expect(seed1).not.toBe(seed3);
    expect(seed1).toBeGreaterThanOrEqual(0);
    expect(seed1).toBeLessThan(4294967296);
  });
});
