import express from 'express';
import { Job } from '../models/Job.js';
import { Task } from '../models/Task.js';
import { Worker } from '../models/Worker.js';
import { TASK_TYPES, JOB_STATUS, LIMITS, DASH_EVENTS } from 'meshcompute-shared/constants.js';
import { splitJobIntoTasks } from '../services/jobSplitter.js';
import { runScheduler } from '../services/scheduler.js';
import { interpretJobPrompt } from '../services/aiInterpreter.js';
import { runBaseline } from '../services/baselineRunner.js';

const router = express.Router();

/**
 * POST /api/jobs/interpret
 * Translates natural-language prompt into validated job config
 */
router.post('/interpret', async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const config = await interpretJobPrompt(prompt);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs
 * Creates a job, splits it into tasks, and kicks off scheduling
 */
router.post('/', async (req, res, next) => {
  try {
    const { type, params, rawPrompt, aiConfig } = req.body;

    const jobType = type || TASK_TYPES.MONTE_CARLO_PI;
    if (!Object.values(TASK_TYPES).includes(jobType)) {
      return res.status(400).json({ error: `Unsupported job type: ${jobType}` });
    }

    let jobParams = params || {};

    if (jobType === TASK_TYPES.MONTE_CARLO_PI) {
      let { totalSamples, chunkSize } = params || {};
      totalSamples = parseInt(totalSamples, 10);
      chunkSize = parseInt(chunkSize, 10) || LIMITS.DEFAULT_CHUNK_SIZE;

      if (!totalSamples || totalSamples < 10_000 || totalSamples > LIMITS.MAX_SAMPLES_PER_JOB) {
        return res.status(400).json({
          error: `totalSamples must be between 10,000 and ${LIMITS.MAX_SAMPLES_PER_JOB.toLocaleString()}`,
        });
      }

      chunkSize = Math.min(Math.max(chunkSize, LIMITS.MIN_CHUNK_SIZE), LIMITS.MAX_CHUNK_SIZE);
      jobParams = { totalSamples, chunkSize };
    } else if (jobType === TASK_TYPES.MATRIX_MULTIPLY) {
      let { matrixSize, chunkSize } = params || {};
      matrixSize = Math.min(Math.max(parseInt(matrixSize, 10) || 6, 2), 50);
      chunkSize = Math.min(Math.max(parseInt(chunkSize, 10) || 1, 1), matrixSize);
      jobParams = { matrixSize, chunkSize };
    }

    const job = await Job.create({
      owner: req.user?._id || null,
      type: jobType,
      params: jobParams,
      rawPrompt: rawPrompt || null,
      aiConfig: aiConfig || null,
      status: JOB_STATUS.PENDING,
    });

    // Split job into tasks
    const tasks = await splitJobIntoTasks(job);

    const io = req.app.get('io');
    if (io) {
      // Notify dashboard
      io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
        jobId: job._id.toString(),
        status: job.status,
        totalTasks: job.totalTasks,
        completedTasks: 0,
        params: job.params,
        createdAt: job.createdAt,
      });

      // Trigger scheduler immediately
      runScheduler(io);
    }

    res.status(201).json({
      job,
      tasksCount: tasks.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs
 * List all jobs (sorted by newest first)
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const jobs = await Job.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs/:id
 * Job details including its task list
 */
router.get('/:id', async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('owner', 'name email');
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const tasks = await Task.find({ job: job._id })
      .populate('assignedTo', 'name workerId')
      .sort({ index: 1 });

    // Map worker IDs to computer names for any historic tasks missing assignedWorkerName
    const workers = await Worker.find({}, 'workerId name');
    const workerMap = new Map(workers.map((w) => [w.workerId, w.name]));

    const populatedTasks = tasks.map((t) => {
      const doc = t.toObject();
      if (!doc.assignedWorkerName) {
        doc.assignedWorkerName =
          doc.assignedTo?.name || workerMap.get(doc.assignedWorkerId) || doc.assignedWorkerId;
      }
      if (!doc.completedByWorkerName && doc.completedByWorkerId) {
        doc.completedByWorkerName = workerMap.get(doc.completedByWorkerId) || doc.completedByWorkerId;
      }
      // Resolve names for older attempt-history entries created before workerName was stored.
      doc.history = (doc.history || []).map((entry) => ({
        ...entry,
        workerName: entry.workerName || workerMap.get(entry.workerId) || entry.workerId || null,
      }));
      // For legacy completed tasks, the successful attempt is the best available executor record.
      if (!doc.completedByWorkerName && doc.status === 'completed') {
        const successfulAttempt = [...doc.history].reverse().find((entry) => entry.outcome === 'success');
        if (successfulAttempt?.workerName) {
          doc.completedByWorkerName = successfulAttempt.workerName;
        }
      }
      return doc;
    });

    res.json({ job, tasks: populatedTasks });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs/:id/cancel
 * Cancel an active or pending job
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    job.status = JOB_STATUS.CANCELLED;
    job.timing.finishedAt = new Date();
    await job.save();

    // Cancel pending/assigned tasks and reset workers
    const activeTasks = await Task.find({
      job: job._id,
      status: { $in: ['pending', 'assigned', 'running'] },
    });

    await Task.updateMany(
      { job: job._id, status: { $in: ['pending', 'assigned', 'running'] } },
      { status: 'failed' }
    );

    const assignedWorkerIds = [...new Set(activeTasks.map((t) => t.assignedWorkerId).filter(Boolean))];
    if (assignedWorkerIds.length > 0) {
      await Worker.updateMany(
        { workerId: { $in: assignedWorkerIds } },
        { activeTasks: 0 }
      );
    }

    const io = req.app.get('io');
    if (io) {
      io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
        jobId: job._id.toString(),
        status: job.status,
      });

      for (const t of activeTasks) {
        io.of('/dashboard').emit(DASH_EVENTS.TASK_UPDATE, {
          taskId: t._id.toString(),
          jobId: job._id.toString(),
          index: t.index,
          status: 'failed',
        });
      }
    }

    res.json({ job, message: 'Job cancelled successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs/:id/baseline
 * Run single-machine baseline comparison benchmark
 */
router.post('/:id/baseline', async (req, res, next) => {
  try {
    const baseline = await runBaseline(req.params.id);
    const updatedJob = await Job.findById(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.of('/dashboard').emit(DASH_EVENTS.JOB_UPDATE, {
        jobId: updatedJob._id.toString(),
        baseline: updatedJob.baseline,
      });
    }

    res.json({ baseline, job: updatedJob });
  } catch (err) {
    next(err);
  }
});

export default router;

