# MeshCompute Worker Attribution Fix

This patch addresses incorrect worker attribution in the Task Allocation Matrix and hardens matrix-task result handling.

## What changed

1. The coordinator now verifies the worker identity attached to the Socket.IO connection before accepting `TASK_STARTED`, `TASK_RESULT`, or `TASK_ERROR` events.
2. The worker that actually submits an accepted result is stored in `completedByWorkerId` and `completedByWorkerName`.
3. Per-attempt history now stores worker ID, worker name, outcome, timestamps, and compute time where available.
4. The job detail API resolves worker names for older history entries from the Workers collection.
5. The Task Allocation Matrix displays the successful executor and a compact list of workers involved across attempts.
6. Retry handling now respects `maxAttempts`, clears stale assignment fields, and decrements the correct worker's active-task count.
7. Matrix multiplication workers now return a `flops` value, matching the coordinator's result validation and the UI's MFLOPs column.

## Important deployment steps

- Deploy the updated coordinator backend.
- Rebuild and deploy the updated frontend.
- Update/restart the worker-agent on **every participating computer**, including the host machine if it also runs a worker agent.
- Create a **new matrix multiplication job** to verify the fix. Old task records cannot be retroactively assigned reliable executor identities if the old backend never stored them.

## Verification

- Changed JavaScript files passed `node --check`.
- The changed JSX file passed a TypeScript JSX syntax parse.
- A matrix chunk smoke test verified `startRow`, `rowCount`, `computedRows`, and `flops` for a 10x10 matrix chunk.
- Full npm tests/build were not run because dependencies are not installed in this archive environment.
