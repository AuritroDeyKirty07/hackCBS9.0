import { TASK_TYPES } from 'meshcompute-shared/constants.js';
import { runMonteCarloPi } from './montecarloPi.js';
import { runImageBatchProcess } from './imageBatchProcess.js';

/**
 * Extensible Task Registry.
 * Pure computational handler functions mapped to whitelisted task types.
 */
export const taskRegistry = new Map([
  [TASK_TYPES.MONTE_CARLO_PI, runMonteCarloPi],
  [TASK_TYPES.IMAGE_BATCH_PROCESS, runImageBatchProcess],
]);

export function getTaskHandler(type) {
  return taskRegistry.get(type);
}
