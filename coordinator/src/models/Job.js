import mongoose from 'mongoose';
import { TASK_TYPES, JOB_STATUS } from 'meshcompute-shared/constants.js';

const jobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(TASK_TYPES),
      default: TASK_TYPES.MONTE_CARLO_PI,
      required: true,
    },
    params: {
      totalSamples: { type: Number, required: true },
      chunkSize: { type: Number, required: true },
    },
    rawPrompt: {
      type: String,
      default: null,
    },
    aiConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.PENDING,
      index: true,
    },
    totalTasks: {
      type: Number,
      default: 0,
    },
    completedTasks: {
      type: Number,
      default: 0,
    },
    result: {
      piEstimate: { type: Number, default: null },
      insideCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 },
      error: { type: String, default: null },
    },
    timing: {
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      durationMs: { type: Number, default: null },
    },
    baseline: {
      durationMs: { type: Number, default: null },
      piEstimate: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export const Job = mongoose.model('Job', jobSchema);
