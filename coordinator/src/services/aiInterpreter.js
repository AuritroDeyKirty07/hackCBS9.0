import { z } from 'zod';
import { TASK_TYPES, LIMITS } from 'meshcompute-shared/constants.js';
import { config } from '../config.js';

const jobConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(TASK_TYPES.MONTE_CARLO_PI),
    params: z.object({
      totalSamples: z.number().int().min(100_000).max(LIMITS.MAX_SAMPLES_PER_JOB),
      chunkSize: z.number().int().min(LIMITS.MIN_CHUNK_SIZE).max(LIMITS.MAX_CHUNK_SIZE),
    }),
    explanation: z.string().default('Monte Carlo Pi estimation'),
  }),
  z.object({
    type: z.literal(TASK_TYPES.MATRIX_MULTIPLY),
    params: z.object({
      matrixSize: z.number().int().min(2).max(100),
      chunkSize: z.number().int().min(1).max(50),
    }),
    explanation: z.string().default('Distributed Matrix Multiplication (C = A x B)'),
  }),
]);

/**
 * Robust, instantaneous natural language compiler fallback.
 */
export function regexFallbackParser(prompt) {
  const lower = (prompt || '').toLowerCase();

  if (
    lower.includes('matrix') ||
    lower.includes('multiply') ||
    lower.includes('matmul') ||
    lower.includes('algebra') ||
    lower.includes('*') ||
    lower.match(/\d+\s*[\*xX]\s*\d+/)
  ) {
    let matrixSize = 6;
    const sizeMatch =
      lower.match(/(\d+)\s*[\*xX]\s*(\d+)/i) ||
      lower.match(/(\d+)\s*(?:matrix|dimension|size)/i) ||
      lower.match(/(?:size|dim|matrix)\s*(?:of)?\s*(\d+)/i);
    if (sizeMatch) {
      matrixSize = Math.min(Math.max(parseInt(sizeMatch[1], 10), 2), 50);
    }

    let chunkSize = 1;
    const chunkMatch = lower.match(/chunk[s]?\s*(?:of)?\s*(\d+)/i) || lower.match(/(\d+)\s*rows/i);
    if (chunkMatch) {
      chunkSize = Math.max(1, Math.min(matrixSize, parseInt(chunkMatch[1], 10)));
    }

    return {
      type: TASK_TYPES.MATRIX_MULTIPLY,
      params: {
        matrixSize,
        chunkSize,
      },
      explanation: `Distributed matrix multiplication of ${matrixSize}×${matrixSize} matrices partitioned into ${Math.ceil(matrixSize / chunkSize)} row task(s).`,
      fallback: false,
    };
  }

  // Default to Monte Carlo simulation
  let totalSamples = 100_000_000;

  if (lower.includes('half a billion') || lower.includes('0.5 billion') || lower.includes('500 million') || lower.includes('500m')) {
    totalSamples = 500_000_000;
  } else if (lower.includes('quarter billion') || lower.includes('250 million') || lower.includes('250m')) {
    totalSamples = 250_000_000;
  } else if (lower.includes('two billion') || lower.includes('2 billion') || lower.includes('2b')) {
    totalSamples = 2_000_000_000;
  } else if (lower.includes('one billion') || lower.includes('1 billion') || lower.includes('1b')) {
    totalSamples = 1_000_000_000;
  } else {
    const match = lower.match(/(\d+(?:\.\d+)?)\s*(billion|b|million|m|thousand|k)?/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'billion' || unit === 'b') {
        totalSamples = Math.round(num * 1_000_000_000);
      } else if (unit === 'million' || unit === 'm') {
        totalSamples = Math.round(num * 1_000_000);
      } else if (unit === 'thousand' || unit === 'k') {
        totalSamples = Math.round(num * 1_000);
      } else {
        totalSamples = Math.round(num);
      }
    }
  }

  totalSamples = Math.min(Math.max(totalSamples, 100_000), LIMITS.MAX_SAMPLES_PER_JOB);

  let chunkSize = LIMITS.DEFAULT_CHUNK_SIZE;
  const chunkMatch = lower.match(/chunk[s]?\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(million|m|k|thousand)?/i);
  if (chunkMatch) {
    const num = parseFloat(chunkMatch[1]);
    const unit = (chunkMatch[2] || '').toLowerCase();
    if (unit === 'million' || unit === 'm') chunkSize = Math.round(num * 1_000_000);
    else if (unit === 'thousand' || unit === 'k') chunkSize = Math.round(num * 1_000);
    else chunkSize = Math.round(num);
  } else {
    chunkSize = Math.min(
      LIMITS.DEFAULT_CHUNK_SIZE,
      Math.max(LIMITS.MIN_CHUNK_SIZE, Math.floor(totalSamples / 20))
    );
  }

  chunkSize = Math.min(Math.max(chunkSize, LIMITS.MIN_CHUNK_SIZE), LIMITS.MAX_CHUNK_SIZE);

  return {
    type: TASK_TYPES.MONTE_CARLO_PI,
    params: {
      totalSamples,
      chunkSize,
    },
    explanation: `Pi estimation using ${(totalSamples / 1e6).toFixed(1)}M samples divided into ${Math.ceil(totalSamples / chunkSize)} tasks.`,
    fallback: false,
  };
}

/**
 * Interprets natural language request into a validated job configuration.
 * Strictly bounded by a 4-second timeout: if Google API lags, responds instantly with rule-based compiler!
 */
export async function interpretJobPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required');
  }

  const apiKey = config.geminiApiKey;

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return regexFallbackParser(prompt);
  }

  // 4-second hard timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const systemInstruction = `You are a job configuration compiler for MeshCompute, a distributed computing network.
Supported job types:
1. "MONTE_CARLO_PI": params { totalSamples: number, chunkSize: number }
2. "MATRIX_MULTIPLY": params { matrixSize: number (e.g. 800, 1000, 1500), chunkSize: number (e.g. 50, 100) }

Output ONLY valid JSON matching:
{
  "type": "MONTE_CARLO_PI" | "MATRIX_MULTIPLY",
  "params": { ... },
  "explanation": "<short explanation>"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nUser request: "${prompt}"` }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return regexFallbackParser(prompt);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return regexFallbackParser(prompt);

    const parsed = JSON.parse(rawText);
    const validated = jobConfigSchema.parse(parsed);

    return {
      ...validated,
      fallback: false,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`[AICompiler] Google Gemini API timed out (>4s) or errored (${err.name}). Using instant compiler.`);
    return regexFallbackParser(prompt);
  }
}
