import mongoose from 'mongoose';

const learningProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },

    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
      index: true,
    },
    percentComplete: { type: Number, min: 0, max: 100, default: 0 },

    startedAt: Date,
    completedAt: Date,
    lastActivityAt: Date,
    timeSpentMinutes: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'learning_progress' },
);

learningProgressSchema.index({ user: 1, course: 1 }, { unique: true });

export const LearningProgress = mongoose.model('LearningProgress', learningProgressSchema);
