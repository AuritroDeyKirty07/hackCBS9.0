import express from 'express';
import { Worker } from '../models/Worker.js';

const router = express.Router();

/**
 * GET /api/workers
 * List all workers with live status and metrics.
 * Automatically deduplicates by worker name so a machine never appears multiple times.
 */
router.get('/', async (req, res, next) => {
  try {
    // Sort so 'online' workers take precedence over 'offline'
    const rawWorkers = await Worker.find()
      .populate('owner', 'name email')
      .sort({ status: 1, updatedAt: -1 });

    const seenNames = new Set();
    const seenIds = new Set();
    const workers = [];
    const staleIds = [];

    for (const w of rawWorkers) {
      if (!seenNames.has(w.name) && !seenIds.has(w.workerId)) {
        seenNames.add(w.name);
        seenIds.add(w.workerId);
        workers.push(w);
      } else {
        // Collect duplicate records to delete
        staleIds.push(w._id);
      }
    }

    // Clean up duplicate historical records in DB
    if (staleIds.length > 0) {
      Worker.deleteMany({ _id: { $in: staleIds } }).catch(() => {});
    }

    res.json({ workers });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/workers/cleanup/offline
 * Purges all offline or stale workers from the cluster registry
 */
router.delete('/cleanup/offline', async (req, res, next) => {
  try {
    const result = await Worker.deleteMany({ status: 'offline' });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/workers/:workerId
 * Deletes a specific worker node
 */
router.delete('/:workerId', async (req, res, next) => {
  try {
    const result = await Worker.deleteOne({
      $or: [{ workerId: req.params.workerId }, { _id: req.params.workerId }],
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Worker node not found' });
    }
    res.json({ ok: true, message: 'Worker removed from cluster registry' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workers/:workerId
 */
router.get('/:workerId', async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ workerId: req.params.workerId }).populate(
      'owner',
      'name email'
    );
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.json({ worker });
  } catch (err) {
    next(err);
  }
});

export default router;
