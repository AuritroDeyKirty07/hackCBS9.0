import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../coordinator/src/models/User.js';
import { Job } from '../coordinator/src/models/Job.js';
import { Task } from '../coordinator/src/models/Task.js';
import { config } from '../coordinator/src/config.js';
import { TASK_TYPES, JOB_STATUS, TASK_STATUS } from 'meshcompute-shared/constants.js';

export async function seedDemoData() {
  console.log('[Seed] Connecting to MongoDB to prepare demo dataset...');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri);
  }

  // 1. Create or update demo user
  const email = 'demo@meshcompute.ai';
  let user = await User.findOne({ email });
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    user = await User.create({
      name: 'Dr. Alan Turing',
      email,
      passwordHash,
      role: 'both',
      workerToken: 'meshcompute-demo-worker-token',
    });
    console.log('[Seed] Created demo user: demo@meshcompute.ai');
  }

  // 2. Ensure at least one historic completed benchmark job exists
  const existingJob = await Job.findOne({ status: JOB_STATUS.COMPLETED });
  if (!existingJob) {
    const totalSamples = 100_000_000;
    const chunkSize = 5_000_000;
    const totalTasks = 20;

    const job = await Job.create({
      owner: user._id,
      type: TASK_TYPES.MONTE_CARLO_PI,
      params: { totalSamples, chunkSize },
      rawPrompt: 'Estimate pi using 100 million samples with 5M chunks',
      aiConfig: {
        explanation: '100M samples divided into 20 tasks',
        fallback: false,
      },
      status: JOB_STATUS.COMPLETED,
      totalTasks,
      completedTasks: totalTasks,
      result: {
        piEstimate: 3.1415984,
        insideCount: 78539960,
        totalCount: totalSamples,
        error: null,
      },
      timing: {
        startedAt: new Date(Date.now() - 3600000),
        finishedAt: new Date(Date.now() - 3598500),
        durationMs: 1500,
      },
      baseline: {
        durationMs: 3800,
        piEstimate: 3.1415926,
      },
    });

    console.log(`[Seed] Seeded completed benchmark job: ${job._id}`);
  }

  console.log('[Seed] Demo database ready.');
}

if (process.argv[1]?.endsWith('seedDemoData.js')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

