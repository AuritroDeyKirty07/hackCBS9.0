import { TASK_TYPES } from 'meshcompute-shared/constants.js';
import { runMonteCarloPi } from './montecarloPi.js';

/**
 * Extensible Task Registry.
 * Drop any pure computational handler function here and map it to its whitelisted task type.
 */
export const taskRegistry = new Map([
  [TASK_TYPES.MONTE_CARLO_PI, runMonteCarloPi],
  // Future extensions:
  // [TASK_TYPES.IMAGE_RESIZE, runImageResize],
  // [TASK_TYPES.CSV_PROCESSING, runCsvProcessing],
]);

export function getTaskHandler(type) {
  return taskRegistry.get(type);
}
