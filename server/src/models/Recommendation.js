import mongoose from 'mongoose';

/**
 * A generated learning path. Snapshotted rather than recomputed on read, so the
 * path a learner is working through does not silently reshuffle underneath them
 * and so the inputs behind any recommendation stay auditable.
 */
const recommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    isCurrent: { type: Boolean, default: true, index: true },

    /** Exact inputs the engine saw. Reproduces the score without a re-query. */
    inputs: {
      jobRole: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole' },
      department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
      experienceYears: Number,
      weights: {
        roleImportance: Number,
        departmentPriority: Number,
        futureDemand: Number,
      },
    },

    items: [
      {
        _id: false,
        competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true },
        currentLevel: Number,
        requiredLevel: Number,
        gap: Number,
        priority: Number,
        band: String,
        mandatory: Boolean,
        courses: [
          {
            _id: false,
            course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            matchScore: Number,
            reason: String,
          },
        ],
      },
    ],

    /** LLM prose explaining the path. Presentation only - never an input. */
    narrative: { type: String, trim: true },
    llmModel: String,
    llmSource: { type: String, enum: ['live', 'cache', 'mock'], default: 'mock' },
  },
  { timestamps: true, collection: 'recommendations' },
);

recommendationSchema.index({ user: 1, isCurrent: 1 });

export const Recommendation = mongoose.model('Recommendation', recommendationSchema);
