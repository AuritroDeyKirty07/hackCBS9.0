import { parentPort } from 'worker_threads';
import { getTaskHandler } from './tasks/index.js';

if (parentPort) {
  parentPort.on('message', (msg) => {
    const { taskId, type, params } = msg;
    const start = performance.now();

    try {
      const handler = getTaskHandler(type);
      if (!handler) {
        throw new Error(`Untrusted or unsupported task type: ${type}`);
      }

      const result = handler(params);
      const computeMs = Math.round(performance.now() - start);

      parentPort.postMessage({
        taskId,
        success: true,
        result: {
          ...result,
          computeMs,
        },
      });
    } catch (err) {
      parentPort.postMessage({
        taskId,
        success: false,
        error: err.message,
      });
    }
  });
}
