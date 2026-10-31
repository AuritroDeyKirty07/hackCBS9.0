import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meshcompute',
  jwtSecret: process.env.JWT_SECRET || 'meshcompute-dev-secret-key-2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '3000', 10),
  heartbeatTimeoutMs: parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '10000', 10),
  taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '60000', 10),
  maxSamplesPerJob: parseInt(process.env.MAX_SAMPLES_PER_JOB || '2000000000', 10),
  maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '3', 10),
};
