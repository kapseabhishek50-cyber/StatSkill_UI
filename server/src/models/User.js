import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema(
  {
    badgeId: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    icon: String,
    awardedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['learner', 'trainer', 'admin'], default: 'learner', index: true },

    // Official identity, as it appears in the department's own records.
    employeeId: { type: String, trim: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    jobRole: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole', index: true },

    // Gamification and progress
    xp: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    learningHours: { type: Number, default: 0 },
    lastActiveDate: Date,
    badges: [badgeSchema],

    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true, collection: 'users' },
);

// passwordHash is select:false, so it never leaves the DB layer by accident.
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role,
    employeeId: this.employeeId,
    department: this.department,
    jobRole: this.jobRole,
    xp: this.xp || 0,
    currentStreak: this.currentStreak || 0,
    longestStreak: this.longestStreak || 0,
    learningHours: this.learningHours || 0,
    badges: this.badges || [],
    lastActiveDate: this.lastActiveDate,
  };
};

export const User = mongoose.model('User', userSchema);
