import { describe, it, expect } from 'vitest';
import { runMonteCarloPi, mulberry32 } from '../src/tasks/montecarloPi.js';

describe('Monte Carlo Pi Task Execution', () => {
  it('mulberry32 is completely deterministic with same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('calculates reproducible inside count with identical seed', () => {
    const res1 = runMonteCarloPi({ samples: 50_000, seed: 12345 });
    const res2 = runMonteCarloPi({ samples: 50_000, seed: 12345 });

    expect(res1.inside).toBe(res2.inside);
    expect(res1.total).toBe(50_000);
  });

  it('estimates Pi with reasonable precision for 500k samples', () => {
    const res = runMonteCarloPi({ samples: 500_000, seed: 9999 });
    const pi = (4 * res.inside) / res.total;

    // Pi is ~3.14159, with 500k samples error should be under 0.015
    expect(Math.abs(pi - Math.PI)).toBeLessThan(0.015);
  });
});

