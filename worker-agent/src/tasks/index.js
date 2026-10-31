import { TASK_TYPES } from 'meshcompute-shared/constants.js';
import { runMonteCarloPi } from './montecarloPi.js';
import { runMatrixMultiply } from './matrixMultiply.js';

/**
 * Extensible Task Registry.
 * Pure computational handler functions mapped to whitelisted task types.
 */
export const taskRegistry = new Map([
  [TASK_TYPES.MONTE_CARLO_PI, runMonteCarloPi],
  [TASK_TYPES.MATRIX_MULTIPLY, runMatrixMultiply],
]);

export function getTaskHandler(type) {
  return taskRegistry.get(type);
}
