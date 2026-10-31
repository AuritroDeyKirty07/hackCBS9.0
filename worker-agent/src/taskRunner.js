import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { TASK_TYPES } from 'meshcompute-shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerScriptPath = path.resolve(__dirname, 'workerThread.js');

/**
 * Runs a whitelisted computational task in a separate background worker_thread.
 * @param {Object} taskData
 * @param {string} taskData.taskId
 * @param {string} taskData.type
 * @param {Object} taskData.params
 * @returns {Promise<Object>}
 */
export function executeTask({ taskId, type, params }) {
  return new Promise((resolve, reject) => {
    // Whitelist check
    if (!Object.values(TASK_TYPES).includes(type)) {
      return reject(new Error(`Rejected task type not in whitelist: ${type}`));
    }

    const worker = new Worker(workerScriptPath);

    worker.on('message', (msg) => {
      worker.terminate();
      if (msg.success) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      worker.terminate();
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker thread stopped with exit code ${code}`));
      }
    });

    worker.postMessage({ taskId, type, params });
  });
}

