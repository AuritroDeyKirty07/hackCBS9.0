import { describe, it, expect } from 'vitest';
import { regexFallbackParser } from '../src/services/aiInterpreter.js';

describe('AI Interpreter Fallback Parser', () => {
  it('parses "half a billion samples"', () => {
    const config = regexFallbackParser('Estimate pi using half a billion samples');
    expect(config.params.totalSamples).toBe(500_000_000);
    expect(config.fallback).toBeDefined();
  });

  it('parses "500 million samples with chunks of 5 million"', () => {
    const config = regexFallbackParser('Please calculate pi using 500 million samples in chunks of 5 million');
    expect(config.params.totalSamples).toBe(500_000_000);
    expect(config.params.chunkSize).toBe(5_000_000);
  });

  it('parses shorthand expressions like "2b" and "50m"', () => {
    const config1 = regexFallbackParser('run 2b samples');
    expect(config1.params.totalSamples).toBe(2_000_000_000);

    const config2 = regexFallbackParser('test with 50m points');
    expect(config2.params.totalSamples).toBe(50_000_000);
  });
});

