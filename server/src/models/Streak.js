import mongoose from 'mongoose';

const streakLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dateString: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    activityType: {
      type: String,
      enum: ['lesson_completed', 'quiz_completed', 'course_completed', 'discussion_contributed', 'study_session'],
      required: true,
    },
    detail: { type: String, trim: true },
    xpEarned: { type: Number, default: 0 },
    minutesSpent: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'streak_logs' },
);

streakLogSchema.index({ user: 1, dateString: 1 });

export const StreakLog = mongoose.model('StreakLog', streakLogSchema);

