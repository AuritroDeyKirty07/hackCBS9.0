import express from 'express';
import { Worker } from '../models/Worker.js';

const router = express.Router();

/**
 * GET /api/workers
 * List all workers with live status and metrics
 */
router.get('/', async (req, res, next) => {
  try {
    const workers = await Worker.find()
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });

    res.json({ workers });
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
