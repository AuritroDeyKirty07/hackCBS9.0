import mongoose from 'mongoose';
import { WORKER_STATUS } from 'meshcompute-shared/constants.js';

const workerSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      default: 'worker',
    },
    platform: {
      type: String,
      default: 'unknown',
    },
    cpuCores: {
      type: Number,
      default: 1,
    },
    totalRamMB: {
      type: Number,
      default: 1024,
    },
    status: {
      type: String,
      enum: Object.values(WORKER_STATUS),
      default: WORKER_STATUS.ONLINE,
      index: true,
    },
    socketId: {
      type: String,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
    },
    lastCpuLoad: {
      type: Number,
      default: 0,
    },
    lastFreeRamMB: {
      type: Number,
      default: 0,
    },
    activeTasks: {
      type: Number,
      default: 0,
    },
    maxConcurrentTasks: {
      type: Number,
      default: 4,
    },
    stats: {
      tasksCompleted: { type: Number, default: 0 },
      totalComputeMs: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export const Worker = mongoose.model('Worker', workerSchema);

