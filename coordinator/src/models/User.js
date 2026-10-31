import mongoose from 'mongoose';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['consumer', 'provider', 'both'],
      default: 'both',
    },
    workerToken: {
      type: String,
      default: () => crypto.randomUUID(),
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);

