import mongoose from 'mongoose';
import { io } from 'socket.io-client';
import { config } from '../config.js';
import { Job } from '../models/Job.js';
import { Task } from '../models/Task.js';
import { TASK_TYPES, JOB_STATUS, DASH_EVENTS } from 'meshcompute-shared/constants.js';

// Parse CLI args: --samples 100000000 --chunk 5000000
const args = process.argv.slice(2);
let samples = 100_000_000;
let chunkSize = 5_000_000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--samples' && args[i + 1]) {
    samples = parseInt(args[i + 1], 10);
  } else if (args[i] === '--chunk' && args[i + 1]) {
    chunkSize = parseInt(args[i + 1], 10);
  }
}

async function run() {
  console.log(`=================================================`);
  console.log(`  Submitting Job: Monte Carlo Pi Estimation`);
  console.log(`  Total Samples: ${samples.toLocaleString()}`);
  console.log(`  Chunk Size:    ${chunkSize.toLocaleString()}`);
  console.log(`=================================================`);

  // Submit via REST API to exercise full server pipeline
  const res = await fetch(`http://localhost:${config.port}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: TASK_TYPES.MONTE_CARLO_PI,
      params: { totalSamples: samples, chunkSize },
      rawPrompt: `Estimate pi with ${samples} samples`,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('Failed to submit job:', err);
    process.exit(1);
  }

  const { job, tasksCount } = await res.json();
  console.log(`[Job Created] ID: ${job._id} (${tasksCount} tasks)`);

  const socket = io(`http://localhost:${config.port}/dashboard`, {
    transports: ['websocket'],
  });

  const startTime = Date.now();

  socket.on(DASH_EVENTS.TASK_UPDATE, (task) => {
    if (task.jobId === job._id.toString()) {
      if (task.status === 'completed') {
        process.stdout.write('.');
      }
    }
  });

  socket.on(DASH_EVENTS.JOB_UPDATE, (updated) => {
    if (updated.jobId === job._id.toString()) {
      if (updated.status === JOB_STATUS.COMPLETED) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n\n=================================================`);
        console.log(`  🎉 JOB COMPLETED SUCCESSFULLY!`);
        console.log(`  Estimated Pi: ${updated.partialPi}`);
        console.log(`  Actual Math.PI: ${Math.PI}`);
        console.log(`  Absolute Error: ${Math.abs(updated.partialPi - Math.PI).toFixed(8)}`);
        console.log(`  Total Time:     ${duration}s`);
        console.log(`=================================================\n`);
        socket.disconnect();
        process.exit(0);
      } else if (updated.status === JOB_STATUS.FAILED) {
        console.error(`\n❌ Job failed: ${updated.error}`);
        socket.disconnect();
        process.exit(1);
      }
    }
  });

  // Polling fallback
  const pollTimer = setInterval(async () => {
    try {
      const pollRes = await fetch(`http://localhost:${config.port}/api/jobs/${job._id}`);
      if (pollRes.ok) {
        const { job: current } = await pollRes.json();
        if (current.status === JOB_STATUS.COMPLETED) {
          clearInterval(pollTimer);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`\n\n=================================================`);
          console.log(`  🎉 JOB COMPLETED SUCCESSFULLY (Polled)!`);
          console.log(`  Estimated Pi:   ${current.result?.piEstimate}`);
          console.log(`  Actual Math.PI: ${Math.PI}`);
          console.log(`  Total Time:     ${duration}s`);
          console.log(`=================================================\n`);
          socket.disconnect();
          process.exit(0);
        }
      }
    } catch (err) {}
  }, 2000);
}

run().catch((err) => {
  console.error('Fatal submitJob error:', err);
  process.exit(1);
});
