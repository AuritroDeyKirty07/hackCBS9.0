import mongoose from 'mongoose';
import { TASK_TYPES, TASK_STATUS, LIMITS } from 'meshcompute-shared/constants.js';

const taskSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    index: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(TASK_TYPES),
      default: TASK_TYPES.MONTE_CARLO_PI,
      required: true,
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      default: null,
    },
    assignedWorkerId: {
      type: String,
      default: null,
      index: true,
    },
    assignedWorkerName: {
      type: String,
      default: null,
    },
    // Immutable identity of the worker whose result was accepted.
    completedByWorkerId: {
      type: String,
      default: null,
      index: true,
    },
    completedByWorkerName: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    maxAttempts: {
      type: Number,
      default: LIMITS.MAX_ATTEMPTS,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    history: [
      {
        workerId: { type: String, default: null },
        workerName: { type: String, default: null },
        attempt: { type: Number, required: true },
        outcome: { type: String, required: true },
        at: { type: Date, default: Date.now },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        computeMs: { type: Number, default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model('Task', taskSchema);
