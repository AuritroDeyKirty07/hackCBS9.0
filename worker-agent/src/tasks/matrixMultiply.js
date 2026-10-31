/**
 * High-Performance Distributed Matrix Multiplication Task Runner
 * Computes C = A x B for a slice of rows: C[startRow ... startRow + rowCount - 1, :]
 * 
 * Matrices are deterministically generated via closed-form pseudo-random functions
 * so 0MB of matrix data needs to be transferred over the network!
 */

function getA(i, k) {
  return (((i * 104729 + k * 7919 + 17) % 1000) / 500.0) - 1.0;
}

function getB(k, j) {
  return (((k * 65537 + j * 49157 + 31) % 1000) / 500.0) - 1.0;
}

/**
 * Executes a chunk of matrix multiplication.
 * @param {Object} params
 * @param {number} params.matrixSize - Dimension N of the NxN matrices
 * @param {number} params.startRow - 0-indexed start row for this task
 * @param {number} params.rowCount - Number of rows to compute
 * @returns {Object} compute results and verification checksums
 */
export function runMatrixMultiply({ matrixSize = 1000, startRow = 0, rowCount = 50 }) {
  const N = parseInt(matrixSize, 10);
  const start = parseInt(startRow, 10);
  const count = parseInt(rowCount, 10);
  const end = Math.min(start + count, N);

  const startTime = Date.now();
  let sumOfSquares = 0.0;
  const sampleValues = []; // Sample for top-left corner (0..4, 0..4)

  // Cache matrix B row-stripes if needed or direct compute
  for (let i = start; i < end; i++) {
    for (let j = 0; j < N; j++) {
      let sum = 0.0;
      for (let k = 0; k < N; k++) {
        sum += getA(i, k) * getB(k, j);
      }

      sumOfSquares += sum * sum;

      // Capture top-left 5x5 submatrix for visual display
      if (i < 5 && j < 5) {
        sampleValues.push({ row: i, col: j, val: parseFloat(sum.toFixed(3)) });
      }
    }
  }

  const computeMs = Math.max(1, Date.now() - startTime);
  const totalFlops = 2 * (end - start) * N * N;

  return {
    startRow: start,
    rowCount: end - start,
    matrixSize: N,
    computeMs,
    flops: totalFlops,
    sumOfSquares,
    sampleValues,
  };
}
