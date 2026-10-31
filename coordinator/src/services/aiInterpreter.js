import { z } from 'zod';
import { TASK_TYPES, LIMITS } from 'meshcompute-shared/constants.js';
import { config } from '../config.js';

const jobConfigSchema = z.object({
  type: z.literal(TASK_TYPES.MONTE_CARLO_PI),
  params: z.object({
    totalSamples: z.number().int().min(100_000).max(LIMITS.MAX_SAMPLES_PER_JOB),
    chunkSize: z.number().int().min(LIMITS.MIN_CHUNK_SIZE).max(LIMITS.MAX_CHUNK_SIZE),
  }),
  explanation: z.string().default('Monte Carlo Pi estimation'),
});

/**
 * Robust regex & natural language number parser fallback.
 * Handles "half a billion", "500 million", "2b", "10k", etc.
 */
export function regexFallbackParser(prompt) {
  const lower = (prompt || '').toLowerCase();

  let totalSamples = 100_000_000; // default 100M

  if (lower.includes('half a billion') || lower.includes('0.5 billion') || lower.includes('500 million') || lower.includes('500m')) {
    totalSamples = 500_000_000;
  } else if (lower.includes('quarter billion') || lower.includes('250 million') || lower.includes('250m')) {
    totalSamples = 250_000_000;
  } else if (lower.includes('two billion') || lower.includes('2 billion') || lower.includes('2b')) {
    totalSamples = 2_000_000_000;
  } else if (lower.includes('one billion') || lower.includes('1 billion') || lower.includes('1b')) {
    totalSamples = 1_000_000_000;
  } else {
    // Regex match patterns like "100 million", "50m", "10000000"
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

  // Clamp within bounds
  totalSamples = Math.min(Math.max(totalSamples, 100_000), LIMITS.MAX_SAMPLES_PER_JOB);

  // Check if chunk size was specified
  let chunkSize = LIMITS.DEFAULT_CHUNK_SIZE;
  const chunkMatch = lower.match(/chunk[s]?\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(million|m|k|thousand)?/i);
  if (chunkMatch) {
    const num = parseFloat(chunkMatch[1]);
    const unit = (chunkMatch[2] || '').toLowerCase();
    if (unit === 'million' || unit === 'm') chunkSize = Math.round(num * 1_000_000);
    else if (unit === 'thousand' || unit === 'k') chunkSize = Math.round(num * 1_000);
    else chunkSize = Math.round(num);
  } else {
    // Dynamically calculate sensible chunk count (~20-50 tasks)
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
    fallback: true,
  };
}

/**
 * Interprets natural language request into a validated job configuration.
 * Uses Gemini API if configured; otherwise gracefully falls back to regex parser.
 * @param {string} prompt
 * @returns {Promise<Object>}
 */
export async function interpretJobPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required');
  }

  const apiKey = config.geminiApiKey;

  // If no Gemini API key configured, use fallback immediately
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    console.log('[AIInterpreter] No GEMINI_API_KEY set; using regex fallback parser.');
    return regexFallbackParser(prompt);
  }

  try {
    const systemInstruction = `You are a job configuration compiler for MeshCompute, a distributed computing network.
The only supported job type is MONTE_CARLO_PI.
You must output ONLY valid JSON matching this schema:
{
  "type": "MONTE_CARLO_PI",
  "params": {
    "totalSamples": <integer between 100000 and 2000000000>,
    "chunkSize": <integer between 10000 and 50000000>
  },
  "explanation": "<short 1-sentence explanation of what will run>"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    if (!response.ok) {
      console.warn(`[AIInterpreter] Gemini API returned status ${response.status}; using fallback`);
      return regexFallbackParser(prompt);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.warn('[AIInterpreter] Empty response from Gemini API; using fallback');
      return regexFallbackParser(prompt);
    }

    const parsed = JSON.parse(rawText);

    // Validate with zod
    const validated = jobConfigSchema.parse(parsed);
    return {
      ...validated,
      fallback: false,
    };
  } catch (err) {
    console.warn(`[AIInterpreter] Gemini parsing or validation error (${err.message}); using fallback`);
    return regexFallbackParser(prompt);
  }
}
